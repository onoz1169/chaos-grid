pub(super) fn pull_text(resp_json: &serde_json::Value, path: &str) -> Result<String, String> {
    let text = resp_json
        .pointer(path)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if text.is_empty() {
        return Err(extract_error(resp_json));
    }
    Ok(text)
}

pub(super) fn extract_error(resp_json: &serde_json::Value) -> String {
    resp_json
        .pointer("/error/message")
        .or_else(|| resp_json.pointer("/error"))
        .or_else(|| resp_json.pointer("/message"))
        .and_then(|v| v.as_str())
        .unwrap_or("empty response from model")
        .to_string()
}

pub(super) fn extract_json_object(text: &str) -> Option<String> {
    let start = text.find('{')?;
    let end = text.rfind('}')?;
    if end > start {
        Some(text[start..=end].to_string())
    } else {
        None
    }
}

pub(super) fn strip_ansi(s: &str) -> String {
    let mut result = String::new();
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1b' {
            if chars.peek() == Some(&'[') {
                chars.next();
                for nc in chars.by_ref() {
                    if nc.is_ascii_alphabetic() {
                        break;
                    }
                }
            } else {
                chars.next();
            }
        } else if c != '\r' {
            result.push(c);
        }
    }
    result
}
