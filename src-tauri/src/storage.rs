use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

const MAX_HISTORY: usize = 20;
const MAX_OUTPUT_CHARS: usize = 5000;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisEntry {
    pub timestamp: String,
    pub summaries: HashMap<String, String>,
    pub themes: HashMap<String, String>,
    pub ideas: Vec<String>,
}

fn data_dir(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| dirs::home_dir().unwrap().join(".chaos-grid-data"))
        .join("chaos-grid")
}

fn ensure_dir(dir: &PathBuf) {
    if !dir.exists() {
        let _ = fs::create_dir_all(dir);
    }
}

pub fn load_cell_outputs(app: &tauri::AppHandle) -> HashMap<String, String> {
    let path = data_dir(app).join("cell-outputs.json");
    if !path.exists() {
        return HashMap::new();
    }
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => HashMap::new(),
    }
}

pub fn save_cell_output(app: &tauri::AppHandle, cell_id: &str, buffer: &str) {
    let dir = data_dir(app);
    ensure_dir(&dir);
    let path = dir.join("cell-outputs.json");

    let mut all = load_cell_outputs(app);
    let truncated = if buffer.len() > MAX_OUTPUT_CHARS {
        &buffer[buffer.len() - MAX_OUTPUT_CHARS..]
    } else {
        buffer
    };
    all.insert(cell_id.to_string(), truncated.to_string());

    if let Ok(json) = serde_json::to_string(&all) {
        let _ = fs::write(&path, json);
    }
}

pub fn load_analysis_history(app: &tauri::AppHandle) -> Vec<AnalysisEntry> {
    let path = data_dir(app).join("analysis-history.json");
    if !path.exists() {
        return Vec::new();
    }
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

pub fn save_analysis(
    app: &tauri::AppHandle,
    result: &crate::AnalyzeResult,
    themes: HashMap<String, String>,
) {
    let dir = data_dir(app);
    ensure_dir(&dir);
    let path = dir.join("analysis-history.json");

    let mut history = load_analysis_history(app);
    let entry = AnalysisEntry {
        timestamp: chrono_now_iso(),
        summaries: result.summaries.clone(),
        themes,
        ideas: result.ideas.clone(),
    };
    history.push(entry);

    // Keep last N
    if history.len() > MAX_HISTORY {
        let start = history.len() - MAX_HISTORY;
        history = history[start..].to_vec();
    }

    if let Ok(json) = serde_json::to_string_pretty(&history) {
        let _ = fs::write(&path, json);
    }
}

fn chrono_now_iso() -> String {
    // Simple ISO timestamp without chrono dependency
    use std::time::{SystemTime, UNIX_EPOCH};
    let dur = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let secs = dur.as_secs();
    // Format as ISO-ish: use seconds since epoch as a fallback
    // For proper ISO, we'd need chrono, but let's keep deps minimal
    let days = secs / 86400;
    let remaining = secs % 86400;
    let hours = remaining / 3600;
    let minutes = (remaining % 3600) / 60;
    let seconds = remaining % 60;

    // Calculate year/month/day from days since epoch (1970-01-01)
    let (year, month, day) = days_to_date(days);

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.000Z",
        year, month, day, hours, minutes, seconds
    )
}

fn days_to_date(days_since_epoch: u64) -> (u64, u64, u64) {
    // Algorithm from http://howardhinnant.github.io/date_algorithms.html
    let z = days_since_epoch + 719468;
    let era = z / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}
