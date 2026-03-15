use crate::{CodexReview, DebateIssue, DebateResult};

use super::utils::extract_json_object;

fn truncate_tail(s: &str, max: usize) -> &str {
    if s.len() <= max {
        return s;
    }
    let mut start = s.len() - max;
    while !s.is_char_boundary(start) {
        start += 1;
    }
    &s[start..]
}

pub(crate) fn git_diff_full(dir: &str) -> String {
    let expanded = crate::files::expand_tilde(dir);
    let path = std::path::Path::new(&expanded);
    if !path.exists() {
        return String::new();
    }
    match std::process::Command::new("git")
        .args(["-C", &expanded, "diff"])
        .output()
    {
        Ok(output) if output.status.success() => {
            let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if text.is_empty() {
                std::process::Command::new("git")
                    .args(["-C", &expanded, "diff", "--cached"])
                    .output()
                    .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                    .unwrap_or_default()
            } else {
                text
            }
        }
        _ => String::new(),
    }
}

/// Run `codex review` on the cell's work directory.
/// Uses the user's ChatGPT subscription via Codex CLI — no API key needed.
pub(crate) async fn run_debate(
    cell_id: &str,
    cell_theme: &str,
    claude_output: &str,
    work_dir: &str,
    language: &str,
) -> Result<DebateResult, String> {
    // Check codex is available
    let which = tokio::process::Command::new("which")
        .arg("codex")
        .output()
        .await
        .map_err(|e| format!("Failed to check codex: {}", e))?;
    if !which.status.success() {
        return Err("Codex CLI not found. Install with: npm i -g @openai/codex".to_string());
    }

    let output_snippet = truncate_tail(claude_output, 2000);

    // Build review prompt
    let prompt = format!(
        "Review the recent changes in this repository. Another AI agent (Claude Code) made these changes.\n\
         Focus on: bugs, security issues, design problems, and improvements.\n\
         \n\
         Claude Code's recent terminal output:\n```\n{}\n```\n\
         \n\
         After your review, output ONLY a JSON object (no markdown fences) in this format:\n\
         {{\n\
           \"verdict\": \"approve|request_changes|comment\",\n\
           \"issues\": [\n\
             {{\"severity\": \"critical|warning|info\", \"description\": \"...\", \"suggestion\": \"...\"}}\n\
           ],\n\
           \"summary\": \"1-2 sentence overall assessment\",\n\
           \"score\": 85\n\
         }}\n\
         \n\
         Respond in: {}",
        output_snippet, language
    );

    let expanded_dir = crate::files::expand_tilde(work_dir);
    let dir_path = std::path::Path::new(&expanded_dir);

    // Use `codex review --uncommitted` if the directory exists and is a git repo,
    // otherwise fall back to `codex exec` with the prompt
    let output = if dir_path.exists() && dir_path.join(".git").exists() {
        tokio::process::Command::new("codex")
            .args(["review", "--uncommitted", &prompt])
            .current_dir(&expanded_dir)
            .output()
            .await
            .map_err(|e| format!("Failed to run codex review: {}", e))?
    } else if dir_path.exists() {
        // Directory exists but no .git — use exec mode
        tokio::process::Command::new("codex")
            .args(["exec", &prompt])
            .current_dir(&expanded_dir)
            .output()
            .await
            .map_err(|e| format!("Failed to run codex exec: {}", e))?
    } else {
        return Err(format!("Work directory does not exist: {}", work_dir));
    };

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() && stdout.is_empty() {
        return Err(format!(
            "Codex CLI failed (exit {}): {}",
            output.status.code().unwrap_or(-1),
            if stderr.is_empty() { "no output" } else { &stderr }
        ));
    }

    // Try to extract structured JSON from the output
    let review = if let Some(json_str) = extract_json_object(&stdout) {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&json_str) {
            CodexReview {
                verdict: parsed.get("verdict")
                    .and_then(|v| v.as_str())
                    .unwrap_or("comment")
                    .to_string(),
                issues: parsed.get("issues")
                    .and_then(|v| serde_json::from_value(v.clone()).ok())
                    .unwrap_or_default(),
                summary: parsed.get("summary")
                    .and_then(|v| v.as_str())
                    .unwrap_or("No summary provided")
                    .to_string(),
                score: parsed.get("score")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0) as u32,
            }
        } else {
            // JSON extraction found something but parsing failed — wrap as free-text
            free_text_review(&stdout)
        }
    } else {
        // No JSON found — treat the whole output as a free-text review
        free_text_review(&stdout)
    };

    let timestamp = crate::storage::now_iso();

    Ok(DebateResult {
        id: format!("debate-{}", crate::now_millis()),
        cell_id: cell_id.to_string(),
        cell_theme: cell_theme.to_string(),
        claude_output: output_snippet.to_string(),
        review,
        timestamp,
    })
}

/// Wrap unstructured Codex output as a review with a single info issue.
fn free_text_review(text: &str) -> CodexReview {
    let summary = if text.len() > 200 {
        let mut end = 200;
        while !text.is_char_boundary(end) { end -= 1; }
        format!("{}...", &text[..end])
    } else {
        text.trim().to_string()
    };

    CodexReview {
        verdict: "comment".to_string(),
        issues: vec![DebateIssue {
            severity: "info".to_string(),
            description: text.trim().to_string(),
            suggestion: String::new(),
        }],
        summary,
        score: 0,
    }
}
