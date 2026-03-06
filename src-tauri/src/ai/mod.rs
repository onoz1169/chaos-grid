mod providers;
mod utils;

use crate::storage::{AiConfig, AnalysisEntry};
use crate::{AnalyzeResult, CellState};
use std::collections::HashMap;

use providers::{check_key, call_gemini, call_openai, call_anthropic, call_ollama};
use utils::{extract_json_object, strip_ansi};

#[derive(serde::Deserialize)]
pub struct GenreInput {
    pub name: String,
    pub dir: String,
}

#[derive(serde::Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

// ─── Public AI call API ───────────────────────────────────────────────────────

/// Single-turn AI call.
pub async fn call_ai(config: &AiConfig, prompt: &str, max_tokens: u32) -> Result<String, String> {
    let messages = vec![("user".to_string(), prompt.to_string())];
    call_ai_messages(config, None, &messages, max_tokens).await
}

/// Multi-turn chat with optional system prompt.
/// `messages` is a list of `(role, content)` where role is "user" or "assistant".
pub async fn call_ai_messages(
    config: &AiConfig,
    system: Option<&str>,
    messages: &[(String, String)],
    max_tokens: u32,
) -> Result<String, String> {
    check_key(config)?;
    match config.provider.as_str() {
        "gemini" => call_gemini(config, system, messages, max_tokens).await,
        "openai" => call_openai(config, system, messages, max_tokens).await,
        "anthropic" => call_anthropic(config, system, messages, max_tokens).await,
        "ollama" => call_ollama(config, system, messages, max_tokens).await,
        p => Err(format!(
            "Unknown provider: \"{}\". Set a valid provider in Settings (⚙).",
            p
        )),
    }
}

// ─── Domain: analyze cells ────────────────────────────────────────────────────

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
            let summaries: String = entry
                .summaries
                .iter()
                .map(|(id, s)| {
                    let theme = entry.themes.get(id).map(|t| t.as_str()).unwrap_or(id);
                    format!("  [{}] {}", theme, s)
                })
                .collect::<Vec<_>>()
                .join("\n");
            format!("{}\n{}", entry.timestamp, summaries)
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
    config: &AiConfig,
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

    if stimuli.is_empty() && will.is_empty() && supply.is_empty() {
        return Ok(AnalyzeResult { summaries: HashMap::new(), ideas: Vec::new(), flow: None });
    }

    let history_block = {
        let s = format_history(history);
        if s.is_empty() { String::new() } else { format!("## Past Session History\n{}\n", s) }
    };
    let stimuli_text = if !stimuli.is_empty() { format_cells(&stimuli) } else { "(no active cells)".to_string() };
    let will_text = if !will.is_empty() { format_cells(&will) } else { "(no active cells)".to_string() };
    let supply_text = if !supply.is_empty() { format_cells(&supply) } else { "(no active cells)".to_string() };

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

    // For analysis, prefer higher-capability model when on Gemini default
    let mut analysis_config = config.clone();
    if analysis_config.model.is_none() && analysis_config.provider == "gemini" {
        analysis_config.model = Some("gemini-2.5-flash".to_string());
    }

    let text = call_ai(&analysis_config, &prompt, 800).await?;
    match extract_json_object(&text) {
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
            Ok(AnalyzeResult { summaries, ideas, flow })
        }
        None => Ok(AnalyzeResult { summaries: HashMap::new(), ideas: Vec::new(), flow: None }),
    }
}

// ─── Tauri commands ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn summarize_all_genres(
    ai_config: tauri::State<'_, std::sync::Mutex<AiConfig>>,
    genres: Vec<GenreInput>,
    language: String,
) -> Result<String, String> {
    let config = ai_config.lock().unwrap().clone();

    let genre_sections: Vec<String> = genres
        .iter()
        .map(|g| {
            let expanded = crate::files::expand_tilde(&g.dir);
            let root = std::path::Path::new(&expanded);
            let files = if root.exists() {
                let mut v = crate::files::walk_dir(root);
                v.sort_by(|a, b| b.2.cmp(&a.2));
                v
            } else {
                Vec::new()
            };
            if files.is_empty() {
                return format!("=== {} ===\n(no files)", g.name);
            }
            let file_list = files
                .iter()
                .map(|(n, _, _)| format!("  - {}", n))
                .collect::<Vec<_>>()
                .join("\n");
            let snippets = files
                .iter()
                .take(2)
                .filter_map(|(name, path, _)| {
                    let content = std::fs::read_to_string(path).ok()?;
                    let mut end = content.len().min(1200);
                    while !content.is_char_boundary(end) {
                        end -= 1;
                    }
                    Some(format!("--- {}\n{}", name, &content[..end]))
                })
                .collect::<Vec<_>>()
                .join("\n\n");
            format!(
                "=== {} ===\nFiles ({} total):\n{}\n\nRecent content:\n{}",
                g.name,
                files.len(),
                file_list,
                snippets
            )
        })
        .collect();

    let prompt = format!(
        "You are reviewing AI agent work output across multiple streams \
        (stimulus=research/input, will=planning, supply=deliverables).\n\
        Write 2-3 concise sentences summarizing the overall progress: what has been accomplished, \
        what is in progress, and what comes next.\n\
        Be specific and chronological. No filler phrases. Plain text only, no markdown, no bullet points.\n\
        \n\
        {}\n\
        \n\
        Respond in: {}",
        genre_sections.join("\n\n"),
        language
    );

    call_ai(&config, &prompt, 300).await
}

#[tauri::command]
pub async fn suggest_cell_name(
    ai_config: tauri::State<'_, std::sync::Mutex<AiConfig>>,
    output: String,
    language: String,
) -> Result<String, String> {
    let config = ai_config.lock().unwrap().clone();

    let clean = strip_ansi(&output);
    let mut start = clean.len().saturating_sub(1500);
    while !clean.is_char_boundary(start) {
        start += 1;
    }
    let snippet = &clean[start..];

    let prompt = format!(
        "Based on this terminal session output, suggest a concise name (2-4 words, max 20 characters).\n\
        The name should describe what task or project is being worked on.\n\
        Return ONLY the name, nothing else. No quotes, no punctuation at the end.\n\
        Respond in: {}\n\n\
        Terminal output:\n{}",
        language, snippet
    );

    call_ai(&config, &prompt, 20).await
}

#[tauri::command]
pub async fn chat_control(
    ai_config: tauri::State<'_, std::sync::Mutex<AiConfig>>,
    messages: Vec<ChatMessage>,
    genres: Vec<GenreInput>,
    language: String,
) -> Result<String, String> {
    let config = ai_config.lock().unwrap().clone();

    let context = genres
        .iter()
        .map(|g| {
            let expanded = crate::files::expand_tilde(&g.dir);
            let root = std::path::Path::new(&expanded);
            let files: Vec<(String, String)> = if root.exists() {
                let walked = crate::files::walk_dir(root);
                let mut v: Vec<(String, String)> = walked
                    .into_iter()
                    .map(|(rel, path, _)| {
                        let snippet = std::fs::read_to_string(&path).unwrap_or_default();
                        let mut end = snippet.len().min(600);
                        while !snippet.is_char_boundary(end) {
                            end -= 1;
                        }
                        (rel, snippet[..end].to_string())
                    })
                    .collect();
                v.sort_by_key(|f| f.0.clone());
                v
            } else {
                Vec::new()
            };
            if files.is_empty() {
                return format!("[{}]: no files yet", g.name);
            }
            let items = files
                .iter()
                .take(3)
                .map(|(name, snippet)| {
                    format!(
                        "  - {}\n{}",
                        name,
                        snippet.lines().take(8).collect::<Vec<_>>().join("\n")
                    )
                })
                .collect::<Vec<_>>()
                .join("\n");
            format!("[{}]: {} file(s)\n{}", g.name, files.len(), items)
        })
        .collect::<Vec<_>>()
        .join("\n\n");

    let system = format!(
        "You are a strategic advisor embedded in Chaos Grid, a multi-agent productivity tool.\n\
        Work streams: Stimulus (research/input) → Will (planning) → Supply (deliverables).\n\
        Your role: help the user understand current progress, identify bottlenecks, and decide next actions.\n\
        Be concise and specific. No filler. Respond in: {}\n\n\
        Current project state:\n{}",
        language, context
    );

    let msgs: Vec<(String, String)> = messages
        .iter()
        .map(|m| {
            let role = if m.role == "user" {
                "user".to_string()
            } else {
                "assistant".to_string()
            };
            (role, m.content.clone())
        })
        .collect();

    call_ai_messages(&config, Some(&system), &msgs, 600).await
}
