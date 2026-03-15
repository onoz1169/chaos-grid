#[tauri::command]
pub async fn read_file_content(path: String) -> Result<String, String> {
    let expanded = super::expand_tilde(&path);
    let meta = std::fs::metadata(&expanded).map_err(|e| e.to_string())?;
    if meta.len() > 2_000_000 {
        return Err("File too large (>2MB)".to_string());
    }
    std::fs::read_to_string(&expanded).map_err(|e| e.to_string())
}
