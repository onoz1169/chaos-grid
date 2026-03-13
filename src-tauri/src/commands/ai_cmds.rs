use std::collections::HashMap;
use std::sync::Mutex;

use crate::storage::AiConfig;
use crate::{ai, storage, AnalyzeResult, CellState, CellStateMap};

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
