mod analyze;
mod providers;
mod utils;

pub(crate) use analyze::analyze_cells;

use crate::storage::AiConfig;
use providers::{check_key, call_gemini, call_openai, call_anthropic, call_ollama};

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
