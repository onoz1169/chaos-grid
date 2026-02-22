use crate::storage::AnalysisEntry;
use crate::AnalyzeResult;
use crate::CellState;
use std::collections::HashMap;

fn get_cell_role(cell_id: &str, cols: usize) -> &'static str {
    let index: usize = cell_id
        .strip_prefix("cell-")
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    let cols = cols.max(1);
    let col = index % cols;
    if col == cols - 1 {
        "Stimulus"
    } else if cols >= 2 && col == cols - 2 {
        "Will"
    } else {
        "Supply"
    }
}

fn format_history(history: &[AnalysisEntry]) -> String {
    if history.is_empty() {
        return String::new();
    }
    let last_5 = if history.len() > 5 {
        &history[history.len() - 5..]
    } else {
        history
    };

    last_5
        .iter()
        .map(|entry| {
            let date = &entry.timestamp;
            let summaries: String = entry
                .summaries
                .iter()
                .map(|(id, s)| {
                    let theme = entry.themes.get(id).map(|t| t.as_str()).unwrap_or(id);
                    format!("  [{}] {}", theme, s)
                })
                .collect::<Vec<_>>()
                .join("\n");
            format!("{}\n{}", date, summaries)
        })
        .collect::<Vec<_>>()
        .join("\n\n")
}

fn format_cells(cells: &[&CellState]) -> String {
    cells
        .iter()
        .map(|c| {
            let output = if c.last_output.len() > 600 {
                let mut start = c.last_output.len() - 600;
                while !c.last_output.is_char_boundary(start) {
                    start += 1;
                }
                &c.last_output[start..]
            } else {
                &c.last_output
            };
            format!("  [{}]\n{}", c.theme, output)
        })
        .collect::<Vec<_>>()
        .join("\n---\n")
}

pub async fn analyze_cells(
    cells: &[CellState],
    history: &[AnalysisEntry],
    language: &str,
    cols: usize,
) -> Result<AnalyzeResult, String> {
    let stimuli: Vec<&CellState> = cells
        .iter()
        .filter(|c| get_cell_role(&c.id, cols) == "Stimulus" && !c.last_output.is_empty())
        .collect();
    let will: Vec<&CellState> = cells
        .iter()
        .filter(|c| get_cell_role(&c.id, cols) == "Will" && !c.last_output.is_empty())
        .collect();
    let supply: Vec<&CellState> = cells
        .iter()
        .filter(|c| get_cell_role(&c.id, cols) == "Supply" && !c.last_output.is_empty())
        .collect();

    let has_any = !stimuli.is_empty() || !will.is_empty() || !supply.is_empty();
    if !has_any {
        return Ok(AnalyzeResult {
            summaries: HashMap::new(),
            ideas: Vec::new(),
            flow: None,
        });
    }

    let history_section = format_history(history);
    let history_block = if history_section.is_empty() {
        String::new()
    } else {
        format!("## Past Session History\n{}\n", history_section)
    };

    let stimuli_text = if !stimuli.is_empty() {
        format_cells(&stimuli)
    } else {
        "(no active cells)".to_string()
    };
    let will_text = if !will.is_empty() {
        format_cells(&will)
    } else {
        "(no active cells)".to_string()
    };
    let supply_text = if !supply.is_empty() {
        format_cells(&supply)
    } else {
        "(no active cells)".to_string()
    };

    let prompt = format!(
        r#"You are an AI called "Command" that analyzes the flow of knowledge work.

The user's knowledge work is organized into 3 layers:
- Stimulus (receiving from outside) → Will (converting to personal intent) → Supply (creating and putting out)

Analyze whether this vertical flow is functioning healthily.

{}

## Current Session

### Stimulus Layer (what is being received from outside)
{}

### Will Layer (what is being internalized)
{}

### Supply Layer (what is being created and shipped)
{}

Respond entirely in: {}

## Output format (JSON only, no markdown)
{{
  "summaries": {{
    "<cellId>": "one sentence describing what is happening in this cell"
  }},
  "ideas": [
    "concrete action or insight emerging from Stimulus × Will (2-3 items)"
  ],
  "flow": {{
    "stimuli_to_will": "whether Stimulus is being converted to Will, and if so what it became",
    "will_to_supply": "whether Will is being converted to Supply, and if so what is being created",
    "stuck": "where and why the flow is blocked (write 'none' if no blockage)",
    "next": "the single most important action to take right now"
  }}
}}"#,
        history_block, stimuli_text, will_text, supply_text, language
    );

    let api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| "GEMINI_API_KEY is not set. Copy .env.example to .env and add your key.".to_string())?;

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={}",
        api_key
    );

    let body = serde_json::json!({
        "contents": [{
            "parts": [{
                "text": prompt
            }]
        }]
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let resp_json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let text = resp_json
        .pointer("/candidates/0/content/parts/0/text")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    // Extract JSON from response text
    let json_match = extract_json_object(text);
    match json_match {
        Some(json_str) => {
            let parsed: serde_json::Value =
                serde_json::from_str(&json_str).map_err(|e| e.to_string())?;

            let summaries: HashMap<String, String> = parsed
                .get("summaries")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_default();

            let ideas: Vec<String> = parsed
                .get("ideas")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_default();

            let flow = parsed.get("flow").and_then(|v| {
                Some(crate::FlowAnalysis {
                    stimuli_to_will: v.get("stimuli_to_will")?.as_str()?.to_string(),
                    will_to_supply: v.get("will_to_supply")?.as_str()?.to_string(),
                    stuck: v.get("stuck")?.as_str()?.to_string(),
                    next: v.get("next")?.as_str()?.to_string(),
                })
            });

            Ok(AnalyzeResult {
                summaries,
                ideas,
                flow,
            })
        }
        None => Ok(AnalyzeResult {
            summaries: HashMap::new(),
            ideas: Vec::new(),
            flow: None,
        }),
    }
}

fn extract_json_object(text: &str) -> Option<String> {
    // Find the first '{' and last '}' to extract the JSON object
    let start = text.find('{')?;
    let end = text.rfind('}')?;
    if end > start {
        Some(text[start..=end].to_string())
    } else {
        None
    }
}
