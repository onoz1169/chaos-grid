use crate::storage::{AiConfig, AnalysisEntry};
use crate::{AnalyzeResult, CellState, FlowConnection};
use std::collections::HashMap;

use super::call_ai;
use super::utils::extract_json_object;

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

fn cell_work_dir(cell: &CellState, output_dir: &str, cols: usize) -> String {
    let role = get_cell_role(&cell.id, cols).to_lowercase();
    let base = output_dir.trim_end_matches('/');
    if cell.theme.is_empty() {
        format!("{}/{}", base, role)
    } else {
        format!("{}/{}/{}", base, role, cell.theme)
    }
}

fn git_diff_stat(dir: &str) -> String {
    let expanded = crate::files::expand_tilde(dir);
    let path = std::path::Path::new(&expanded);
    if !path.exists() {
        return "(directory does not exist)".to_string();
    }
    match std::process::Command::new("git")
        .args(["-C", &expanded, "diff", "--stat"])
        .output()
    {
        Ok(output) if output.status.success() => {
            let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if text.is_empty() {
                let status = std::process::Command::new("git")
                    .args(["-C", &expanded, "status", "--short"])
                    .output()
                    .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                    .unwrap_or_default();
                if status.is_empty() {
                    "(no changes)".to_string()
                } else {
                    status
                }
            } else {
                text
            }
        }
        _ => "(not a git repo)".to_string(),
    }
}

fn time_since_last(history: &[AnalysisEntry]) -> String {
    if history.is_empty() {
        return "first analysis".to_string();
    }
    let last = &history[history.len() - 1];
    let now = crate::now_millis() / 1000;
    let parts: Vec<&str> = last.timestamp.split('T').collect();
    if parts.len() != 2 {
        return "unknown".to_string();
    }
    let date_parts: Vec<u64> = parts[0].split('-').filter_map(|s| s.parse().ok()).collect();
    let time_str = parts[1].trim_end_matches('Z').trim_end_matches(".000");
    let time_parts: Vec<u64> = time_str.split(':').filter_map(|s| s.parse().ok()).collect();
    if date_parts.len() != 3 || time_parts.len() != 3 {
        return "unknown".to_string();
    }
    let days_approx = (date_parts[0] - 1970) * 365 + (date_parts[0] - 1970) / 4
        + match date_parts[1] {
            1 => 0, 2 => 31, 3 => 59, 4 => 90, 5 => 120, 6 => 151,
            7 => 181, 8 => 212, 9 => 243, 10 => 273, 11 => 304, 12 => 334,
            _ => 0,
        } + date_parts[2] - 1;
    let last_epoch = days_approx * 86400 + time_parts[0] * 3600 + time_parts[1] * 60 + time_parts[2];
    let delta = now.saturating_sub(last_epoch);
    if delta < 60 {
        format!("{}s ago", delta)
    } else if delta < 3600 {
        format!("{}m ago", delta / 60)
    } else if delta < 86400 {
        format!("{}h ago", delta / 3600)
    } else {
        format!("{}d ago", delta / 86400)
    }
}

pub(crate) async fn analyze_cells(
    config: &AiConfig,
    cells: &[CellState],
    history: &[AnalysisEntry],
    language: &str,
    cols: usize,
    output_dir: Option<&str>,
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

    let diff_text = if let Some(out_dir) = output_dir {
        let active_cells: Vec<&CellState> = cells
            .iter()
            .filter(|c| !c.last_output.is_empty() && !c.theme.is_empty())
            .collect();
        if active_cells.is_empty() {
            "(no cells with themes to diff)".to_string()
        } else {
            active_cells
                .iter()
                .map(|c| {
                    let wdir = cell_work_dir(c, out_dir, cols);
                    let diff = git_diff_stat(&wdir);
                    format!("  [{}] {}\n{}", c.theme, wdir, diff)
                })
                .collect::<Vec<_>>()
                .join("\n")
        }
    } else {
        "(output_dir not provided)".to_string()
    };

    let time_since = time_since_last(history);

    let history_block = {
        let s = format_history(history);
        if s.is_empty() { String::new() } else { format!("## Past Session History\n{}\n", s) }
    };
    let stimuli_text = if !stimuli.is_empty() { format_cells(&stimuli) } else { "(no active cells)".to_string() };
    let will_text = if !will.is_empty() { format_cells(&will) } else { "(no active cells)".to_string() };
    let supply_text = if !supply.is_empty() { format_cells(&supply) } else { "(no active cells)".to_string() };

    let prompt = format!(
        r#"You are "Command", an AI that analyzes the flow of knowledge work.

Knowledge work flows through 3 layers:
- Stimulus (receiving from outside) → Will (converting to personal intent) → Supply (creating and shipping)

The user runs multiple AI agents in parallel, each working on a different aspect.
Your job is to find CONNECTIONS between cells and help the human decide what to do next.

{}
## Current Session

### Stimulus Layer
{}

### Will Layer
{}

### Supply Layer
{}

### Changes since last analysis ({})
{}

Respond in: {}

## Instructions
1. For each cell, summarize what is happening (1 sentence)
2. Find CONNECTIONS: what insight or output from one cell can feed into another cell? Be specific.
3. Identify what CHANGED since last analysis and whether it moved the flow forward
4. Ask the human 1-2 SPECIFIC QUESTIONS about decisions only they can make
5. Identify blockages and the single most important next action

## Output format (JSON only, no markdown)
{{
  "summaries": {{ "<cellId>": "..." }},
  "ideas": ["2-3 concrete cross-cell insights"],
  "flow": {{
    "stimuli_to_will": "...",
    "will_to_supply": "...",
    "stuck": "...",
    "next": "...",
    "blocked_cells": [],
    "priority_cell": null,
    "confidence": "high|medium|low",
    "connections": [
      {{ "from_cell": "theme-A", "to_cell": "theme-B", "insight": "..." }}
    ],
    "human_questions": ["specific question for human decision"],
    "changes_since_last": "summary of what progressed since last analysis"
  }}
}}"#,
        history_block, stimuli_text, will_text, supply_text, time_since, diff_text, language
    );

    let mut analysis_config = config.clone();
    if analysis_config.model.is_none() && analysis_config.provider == "gemini" {
        analysis_config.model = Some("gemini-2.5-flash".to_string());
    }

    let text = call_ai(&analysis_config, &prompt, 1200).await?;
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
                let blocked_cells: Option<Vec<String>> = v.get("blocked_cells")
                    .and_then(|bc| serde_json::from_value(bc.clone()).ok())
                    .map(|cells: Vec<String>| cells.into_iter().filter(|s| !s.is_empty()).collect());
                let priority_cell: Option<String> = v.get("priority_cell")
                    .and_then(|pc| pc.as_str())
                    .filter(|s| !s.is_empty() && *s != "null")
                    .map(|s| s.to_string());
                let confidence: Option<String> = v.get("confidence")
                    .and_then(|c| c.as_str())
                    .filter(|s| !s.is_empty())
                    .map(|s| s.to_string());
                let connections: Option<Vec<FlowConnection>> = v.get("connections")
                    .and_then(|c| serde_json::from_value(c.clone()).ok());
                let human_questions: Option<Vec<String>> = v.get("human_questions")
                    .and_then(|q| serde_json::from_value(q.clone()).ok());
                let changes_since_last: Option<String> = v.get("changes_since_last")
                    .and_then(|c| c.as_str())
                    .filter(|s| !s.is_empty())
                    .map(|s| s.to_string());
                Some(crate::FlowAnalysis {
                    stimuli_to_will: v.get("stimuli_to_will")?.as_str()?.to_string(),
                    will_to_supply: v.get("will_to_supply")?.as_str()?.to_string(),
                    stuck: v.get("stuck")?.as_str()?.to_string(),
                    next: v.get("next")?.as_str()?.to_string(),
                    blocked_cells,
                    priority_cell,
                    confidence,
                    connections,
                    human_questions,
                    changes_since_last,
                })
            });
            Ok(AnalyzeResult { summaries, ideas, flow })
        }
        None => Ok(AnalyzeResult { summaries: HashMap::new(), ideas: Vec::new(), flow: None }),
    }
}
