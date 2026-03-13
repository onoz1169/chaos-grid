use crate::storage::AiConfig;

use super::utils::{extract_error, pull_text};

pub(super) fn effective_model(config: &AiConfig) -> String {
    if let Some(m) = &config.model {
        if !m.is_empty() {
            return m.clone();
        }
    }
    match config.provider.as_str() {
        "openai" => "gpt-4o-mini".to_string(),
        "anthropic" => "claude-haiku-4-5-20251001".to_string(),
        "ollama" => "llama3.3".to_string(),
        _ => "gemini-2.0-flash".to_string(), // gemini default
    }
}

pub(super) fn active_api_key(config: &AiConfig) -> &str {
    match config.provider.as_str() {
        "openai" => &config.openai_key,
        "anthropic" => &config.anthropic_key,
        _ => &config.gemini_key,
    }
}

pub(super) fn check_key(config: &AiConfig) -> Result<(), String> {
    if config.provider == "ollama" {
        return Ok(());
    }
    let key = active_api_key(config);
    if key.is_empty() {
        let name = match config.provider.as_str() {
            "openai" => "OpenAI",
            "anthropic" => "Anthropic",
            _ => "Gemini",
        };
        return Err(format!(
            "{} API key is not set. Please configure it in Settings (⚙).",
            name
        ));
    }
    Ok(())
}

async fn send_request(
    url: &str,
    headers: &[(&str, &str)],
    body: &serde_json::Value,
    provider_name: &str,
    text_path: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let mut req = client.post(url).header("Content-Type", "application/json");
    for (key, value) in headers {
        req = req.header(*key, *value);
    }
    let resp = req
        .json(body)
        .send()
        .await
        .map_err(|e| format!("{} request failed: {}", provider_name, e))?;
    let status = resp.status();
    let resp_json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("{} response parse failed: {}", provider_name, e))?;
    if !status.is_success() {
        let msg = extract_error(&resp_json);
        return Err(format!("{} API error {}: {}", provider_name, status, msg));
    }
    pull_text(&resp_json, text_path)
}

pub(super) async fn call_gemini(
    config: &AiConfig,
    system: Option<&str>,
    messages: &[(String, String)],
    max_tokens: u32,
) -> Result<String, String> {
    let model = effective_model(config);
    let key = active_api_key(config);
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model, key
    );

    // Gemini has no system role; inject as a first user/model exchange.
    let mut contents: Vec<serde_json::Value> = Vec::new();
    if let Some(sys) = system {
        contents.push(serde_json::json!({"role": "user", "parts": [{"text": sys}]}));
        contents
            .push(serde_json::json!({"role": "model", "parts": [{"text": "Understood."}]}));
    }
    for (role, content) in messages {
        let gemini_role = if role == "assistant" { "model" } else { "user" };
        contents.push(serde_json::json!({"role": gemini_role, "parts": [{"text": content}]}));
    }

    let body = serde_json::json!({
        "contents": contents,
        "generationConfig": {"maxOutputTokens": max_tokens}
    });

    send_request(&url, &[], &body, "Gemini", "/candidates/0/content/parts/0/text").await
}

pub(super) async fn call_openai(
    config: &AiConfig,
    system: Option<&str>,
    messages: &[(String, String)],
    max_tokens: u32,
) -> Result<String, String> {
    let model = effective_model(config);
    let key = active_api_key(config);
    let auth = format!("Bearer {}", key);

    let mut msgs: Vec<serde_json::Value> = Vec::new();
    if let Some(sys) = system {
        msgs.push(serde_json::json!({"role": "system", "content": sys}));
    }
    for (role, content) in messages {
        let r = if role == "assistant" { "assistant" } else { "user" };
        msgs.push(serde_json::json!({"role": r, "content": content}));
    }

    let body = serde_json::json!({
        "model": model,
        "messages": msgs,
        "max_tokens": max_tokens
    });

    send_request(
        "https://api.openai.com/v1/chat/completions",
        &[("Authorization", &auth)],
        &body,
        "OpenAI",
        "/choices/0/message/content",
    ).await
}

pub(super) async fn call_anthropic(
    config: &AiConfig,
    system: Option<&str>,
    messages: &[(String, String)],
    max_tokens: u32,
) -> Result<String, String> {
    let model = effective_model(config);
    let key = active_api_key(config);

    let mut msgs: Vec<serde_json::Value> = Vec::new();
    for (role, content) in messages {
        let r = if role == "assistant" { "assistant" } else { "user" };
        msgs.push(serde_json::json!({"role": r, "content": content}));
    }

    let mut body = serde_json::json!({
        "model": model,
        "max_tokens": max_tokens,
        "messages": msgs
    });
    if let Some(sys) = system {
        body["system"] = serde_json::Value::String(sys.to_string());
    }

    send_request(
        "https://api.anthropic.com/v1/messages",
        &[("x-api-key", key), ("anthropic-version", "2023-06-01")],
        &body,
        "Anthropic",
        "/content/0/text",
    ).await
}

pub(super) async fn call_ollama(
    config: &AiConfig,
    system: Option<&str>,
    messages: &[(String, String)],
    max_tokens: u32,
) -> Result<String, String> {
    let model = effective_model(config);
    let base_url = if config.ollama_url.is_empty() {
        "http://localhost:11434"
    } else {
        config.ollama_url.trim_end_matches('/')
    };
    let url = format!("{}/api/chat", base_url);

    let mut msgs: Vec<serde_json::Value> = Vec::new();
    if let Some(sys) = system {
        msgs.push(serde_json::json!({"role": "system", "content": sys}));
    }
    for (role, content) in messages {
        let r = if role == "assistant" { "assistant" } else { "user" };
        msgs.push(serde_json::json!({"role": r, "content": content}));
    }

    let body = serde_json::json!({
        "model": model,
        "messages": msgs,
        "stream": false,
        "options": {"num_predict": max_tokens}
    });

    send_request(&url, &[], &body, "Ollama", "/message/content").await
}
