use crate::storage::AnalysisEntry;
use crate::AnalyzeResult;
use crate::CellState;
use std::collections::HashMap;

fn get_cell_role(cell_id: &str) -> &'static str {
    // cell-0 through cell-8, index = last char as digit
    let index: usize = cell_id
        .strip_prefix("cell-")
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    match index % 3 {
        2 => "刺激",
        1 => "意志",
        _ => "供給",
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
                &c.last_output[c.last_output.len() - 600..]
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
) -> Result<AnalyzeResult, String> {
    let stimuli: Vec<&CellState> = cells
        .iter()
        .filter(|c| get_cell_role(&c.id) == "刺激" && !c.last_output.is_empty())
        .collect();
    let will: Vec<&CellState> = cells
        .iter()
        .filter(|c| get_cell_role(&c.id) == "意志" && !c.last_output.is_empty())
        .collect();
    let supply: Vec<&CellState> = cells
        .iter()
        .filter(|c| get_cell_role(&c.id) == "供給" && !c.last_output.is_empty())
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
        format!("## 過去のセッション履歴\n{}\n", history_section)
    };

    let stimuli_text = if !stimuli.is_empty() {
        format_cells(&stimuli)
    } else {
        "（アクティブなセルなし）".to_string()
    };
    let will_text = if !will.is_empty() {
        format_cells(&will)
    } else {
        "（アクティブなセルなし）".to_string()
    };
    let supply_text = if !supply.is_empty() {
        format_cells(&supply)
    } else {
        "（アクティブなセルなし）".to_string()
    };

    let prompt = format!(
        r#"あなたは知的生産の流れを分析するAI「司令塔」です。

ユーザーの知的生産は3つのレイヤーで構成されています：
- 刺激（外から受け取る）→ 意志（自分ごとに変換）→ 供給（作って世に出す）

この縦の流れが健全に機能しているかを分析してください。

{}

## 現在のセッション

### 刺激レイヤー（外から何を受け取っているか）
{}

### 意志レイヤー（何を自分ごとにしているか）
{}

### 供給レイヤー（何を作って出しているか）
{}

## 出力形式（JSONのみ、マークダウン不要）
{{
  "summaries": {{
    "<cellId>": "このセルで何が起きているか1文"
  }},
  "ideas": [
    "刺激×意志から生まれる具体的なアクションや発見（2〜3個）"
  ],
  "flow": {{
    "stimuli_to_will": "刺激が意志に変換されているか。されていれば何に変換されたか",
    "will_to_supply": "意志が供給に落ちているか。落ちていれば何を作っているか",
    "stuck": "流れが詰まっている場所と理由（なければ「詰まりなし」）",
    "next": "今最もすべき1つのアクション"
  }}
}}"#,
        history_block, stimuli_text, will_text, supply_text
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
