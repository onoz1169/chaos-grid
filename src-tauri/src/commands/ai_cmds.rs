use std::collections::HashMap;
use std::sync::Mutex;

use crate::storage::AiConfig;
use crate::{ai, storage, AnalyzeResult, CellState, CellStateMap, DebateHistory, DebateResult};

#[tauri::command]
pub(crate) async fn analyze(
    app: tauri::AppHandle,
    ai_config: tauri::State<'_, Mutex<AiConfig>>,
    cell_states: tauri::State<'_, CellStateMap>,
    language: Option<String>,
    cols: Option<u32>,
    output_dir: Option<String>,
) -> Result<AnalyzeResult, String> {
    let config = ai_config.lock().unwrap().clone();
    let cells: Vec<CellState> = {
        let states = cell_states.0.lock().map_err(|e| e.to_string())?;
        states.values().cloned().collect()
    };

    let lang = language.as_deref().unwrap_or("English");
    let cols_count = cols.unwrap_or(3) as usize;
    let history = storage::load_analysis_history(&app);
    let result = ai::analyze_cells(&config, &cells, &history, lang, cols_count, output_dir.as_deref()).await?;

    let themes: HashMap<String, String> = cells.iter().map(|c| (c.id.clone(), c.theme.clone())).collect();
    storage::save_analysis(&app, &result, themes);

    Ok(result)
}

#[tauri::command]
pub(crate) async fn get_ai_config(
    ai_config: tauri::State<'_, Mutex<AiConfig>>,
) -> Result<AiConfig, String> {
    Ok(ai_config.lock().unwrap().clone())
}

#[tauri::command]
pub(crate) async fn set_ai_config(
    ai_config: tauri::State<'_, Mutex<AiConfig>>,
    config: AiConfig,
) -> Result<(), String> {
    storage::save_ai_config(&config)?;
    *ai_config.lock().unwrap() = config;
    Ok(())
}

#[tauri::command]
pub(crate) async fn run_debate_cmd(
    app: tauri::AppHandle,
    cell_states: tauri::State<'_, CellStateMap>,
    debate_history: tauri::State<'_, DebateHistory>,
    cell_id: String,
    language: Option<String>,
    cols: Option<u32>,
    output_dir: Option<String>,
) -> Result<DebateResult, String> {
    let lang = language.as_deref().unwrap_or("English");
    let cols_count = cols.unwrap_or(3) as usize;

    // Get cell state
    let cell = {
        let states = cell_states.0.lock().map_err(|e| e.to_string())?;
        states.get(&cell_id).cloned()
            .ok_or_else(|| format!("Cell {} not found", cell_id))?
    };

    if cell.last_output.is_empty() {
        return Err(format!("Cell {} has no output to review", cell_id));
    }

    // Resolve work directory for the cell
    let work_dir = if let Some(ref out_dir) = output_dir {
        let role = get_cell_role(&cell_id, cols_count).to_lowercase();
        let base = out_dir.trim_end_matches('/');
        if cell.theme.is_empty() {
            format!("{}/{}", base, role)
        } else {
            format!("{}/{}/{}", base, role, cell.theme)
        }
    } else {
        return Err("Output directory not configured. Set it in Settings.".to_string());
    };

    let result = ai::run_debate(&cell_id, &cell.theme, &cell.last_output, &work_dir, lang).await?;

    // Store in history
    {
        let mut history = debate_history.0.lock().map_err(|e| e.to_string())?;
        history.push(result.clone());
        if history.len() > 50 {
            let start = history.len() - 50;
            *history = history[start..].to_vec();
        }
    }
    storage::save_debate_entry(&app, &result);

    Ok(result)
}

#[tauri::command]
pub(crate) async fn get_debate_history(
    debate_history: tauri::State<'_, DebateHistory>,
) -> Result<Vec<DebateResult>, String> {
    let history = debate_history.0.lock().map_err(|e| e.to_string())?;
    Ok(history.clone())
}

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
