mod ai;
pub mod files;
mod pty_manager;
mod storage;

use crate::ai::{summarize_all_genres, chat_control, suggest_cell_name};
use crate::files::{list_dir_files, list_dir_files_recursive, read_file_content, open_file, get_git_info, get_all_git_activity, get_git_diff};
use crate::storage::AiConfig;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use std::sync::{Arc, Mutex};
use tauri::Manager;

const MAX_CELLS: usize = 30; // supports up to 6×5 grid
const DEFAULT_COLS: u16 = 80;
const DEFAULT_ROWS: u16 = 24;
const SHELL_READY_DELAY_MS: u64 = 500;
const DEFAULT_TOOL_CMD: &str = "claude --dangerously-skip-permissions";

fn make_launch_command(work_dir: Option<&str>, tool_cmd: &str) -> String {
    let cmd = if tool_cmd.trim().is_empty() { DEFAULT_TOOL_CMD } else { tool_cmd };
    match work_dir {
        Some(dir) if !dir.trim().is_empty() => {
            format!("mkdir -p {dir} && cd {dir} && {cmd}\n", dir = dir, cmd = cmd)
        }
        _ => format!("{cmd}\n", cmd = cmd),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CellState {
    pub id: String,
    pub theme: String,
    pub pid: Option<u32>,
    pub last_output: String,
    pub status: String,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyzeResult {
    pub summaries: HashMap<String, String>,
    pub ideas: Vec<String>,
    pub flow: Option<FlowAnalysis>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowAnalysis {
    pub stimuli_to_will: String,
    pub will_to_supply: String,
    pub stuck: String,
    pub next: String,
}

struct PtySessions(Mutex<HashMap<String, pty_manager::PtySession>>);
struct CellStateMap(Arc<Mutex<HashMap<String, CellState>>>);

pub(crate) fn now_millis() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn init_cell_states(app: &tauri::AppHandle) -> HashMap<String, CellState> {
    let saved_outputs = storage::load_cell_outputs(app);
    let mut states = HashMap::new();
    for i in 0..MAX_CELLS {
        let id = format!("cell-{}", i);
        let last_output = saved_outputs.get(&id).cloned().unwrap_or_default();
        states.insert(
            id.clone(),
            CellState {
                id,
                theme: String::new(),
                pid: None,
                last_output,
                status: "idle".to_string(),
                updated_at: now_millis(),
            },
        );
    }
    states
}

#[tauri::command]
async fn spawn_pty(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, PtySessions>,
    cell_states: tauri::State<'_, CellStateMap>,
    cell_id: String,
    cols: u16,
    rows: u16,
) -> Result<u32, String> {
    // Kill existing session if any
    {
        let mut map = sessions.0.lock().map_err(|e| e.to_string())?;
        if let Some(mut session) = map.remove(&cell_id) {
            pty_manager::kill(&mut session);
        }
    }

    let states_arc = cell_states.0.clone();
    let session = pty_manager::spawn(
        app.clone(),
        &cell_id,
        cols,
        rows,
        states_arc,
        app.clone(),
    )?;

    let pid = session.pid;

    // Update cell state
    {
        let mut states = cell_states.0.lock().map_err(|e| e.to_string())?;
        if let Some(state) = states.get_mut(&cell_id) {
            state.pid = Some(pid);
            state.status = "active".to_string();
            state.updated_at = now_millis();
        }
    }

    // Store session
    {
        let mut map = sessions.0.lock().map_err(|e| e.to_string())?;
        map.insert(cell_id, session);
    }

    Ok(pid)
}

#[tauri::command]
async fn write_pty(
    sessions: tauri::State<'_, PtySessions>,
    cell_id: String,
    data: String,
) -> Result<(), String> {
    let mut map = sessions.0.lock().map_err(|e| e.to_string())?;
    if let Some(session) = map.get_mut(&cell_id) {
        session
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn resize_pty(
    sessions: tauri::State<'_, PtySessions>,
    cell_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let map = sessions.0.lock().map_err(|e| e.to_string())?;
    if let Some(session) = map.get(&cell_id) {
        pty_manager::resize(session, cols, rows)?;
    }
    Ok(())
}

#[tauri::command]
async fn kill_pty(
    sessions: tauri::State<'_, PtySessions>,
    cell_states: tauri::State<'_, CellStateMap>,
    cell_id: String,
) -> Result<(), String> {
    {
        let mut map = sessions.0.lock().map_err(|e| e.to_string())?;
        if let Some(mut session) = map.remove(&cell_id) {
            pty_manager::kill(&mut session);
        }
    }

    {
        let mut states = cell_states.0.lock().map_err(|e| e.to_string())?;
        if let Some(state) = states.get_mut(&cell_id) {
            state.pid = None;
            state.status = "idle".to_string();
            state.updated_at = now_millis();
        }
    }

    Ok(())
}

#[tauri::command]
async fn kill_all_ptys(
    sessions: tauri::State<'_, PtySessions>,
    cell_states: tauri::State<'_, CellStateMap>,
) -> Result<(), String> {
    let killed: Vec<String> = {
        let mut map = sessions.0.lock().map_err(|e| e.to_string())?;
        let ids: Vec<String> = map.keys().cloned().collect();
        for id in &ids {
            if let Some(mut session) = map.remove(id) {
                pty_manager::kill(&mut session);
            }
        }
        ids
    };
    {
        let mut states = cell_states.0.lock().map_err(|e| e.to_string())?;
        for id in &killed {
            if let Some(state) = states.get_mut(id) {
                state.pid = None;
                state.status = "idle".to_string();
                state.updated_at = now_millis();
            }
        }
    }
    Ok(())
}

#[tauri::command]
async fn analyze(
    app: tauri::AppHandle,
    ai_config: tauri::State<'_, Mutex<AiConfig>>,
    cell_states: tauri::State<'_, CellStateMap>,
    language: Option<String>,
    cols: Option<u32>,
) -> Result<AnalyzeResult, String> {
    let config = ai_config.lock().unwrap().clone();
    let cells: Vec<CellState> = {
        let states = cell_states.0.lock().map_err(|e| e.to_string())?;
        states.values().cloned().collect()
    };

    let lang = language.as_deref().unwrap_or("English");
    let cols_count = cols.unwrap_or(3) as usize;
    let history = storage::load_analysis_history(&app);
    let result = ai::analyze_cells(&config, &cells, &history, lang, cols_count).await?;

    let themes: HashMap<String, String> = cells.iter().map(|c| (c.id.clone(), c.theme.clone())).collect();
    storage::save_analysis(&app, &result, themes);

    Ok(result)
}

#[tauri::command]
async fn get_ai_config(
    ai_config: tauri::State<'_, Mutex<AiConfig>>,
) -> Result<AiConfig, String> {
    Ok(ai_config.lock().unwrap().clone())
}

#[tauri::command]
async fn set_ai_config(
    ai_config: tauri::State<'_, Mutex<AiConfig>>,
    config: AiConfig,
) -> Result<(), String> {
    storage::save_ai_config(&config)?;
    *ai_config.lock().unwrap() = config;
    Ok(())
}

#[tauri::command]
async fn get_cells(
    cell_states: tauri::State<'_, CellStateMap>,
) -> Result<Vec<CellState>, String> {
    let states = cell_states.0.lock().map_err(|e| e.to_string())?;
    let mut cells: Vec<CellState> = states.values().cloned().collect();
    cells.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(cells)
}

#[tauri::command]
async fn set_theme(
    cell_states: tauri::State<'_, CellStateMap>,
    cell_id: String,
    theme: String,
) -> Result<(), String> {
    let mut states = cell_states.0.lock().map_err(|e| e.to_string())?;
    if let Some(state) = states.get_mut(&cell_id) {
        state.theme = theme;
        state.updated_at = now_millis();
    }
    Ok(())
}

/// Shared core of the three launch commands.
///
/// If no PTY exists for `cell_id` yet, spawns one and waits for the shell to
/// be ready. Then writes the appropriate launch command into the PTY.
async fn spawn_and_launch(
    app: &tauri::AppHandle,
    sessions: &PtySessions,
    cell_states: &CellStateMap,
    cell_id: &str,
    work_dir: Option<&str>,
    tool_cmd: &str,
) -> Result<(), String> {
    // Spawn a new PTY only when the cell does not already have one.
    let has_pty = {
        let map = sessions.0.lock().map_err(|e| e.to_string())?;
        map.contains_key(cell_id)
    };

    if !has_pty {
        // Kill any stale session that might linger in the map.
        {
            let mut map = sessions.0.lock().map_err(|e| e.to_string())?;
            if let Some(mut session) = map.remove(cell_id) {
                pty_manager::kill(&mut session);
            }
        }

        let states_arc = cell_states.0.clone();
        let session = pty_manager::spawn(
            app.clone(),
            cell_id,
            DEFAULT_COLS,
            DEFAULT_ROWS,
            states_arc,
            app.clone(),
        )?;

        // Update cell state with the new PID.
        {
            let mut states = cell_states.0.lock().map_err(|e| e.to_string())?;
            if let Some(state) = states.get_mut(cell_id) {
                state.pid = Some(session.pid);
                state.status = "active".to_string();
                state.updated_at = now_millis();
            }
        }

        // Store the live session.
        {
            let mut map = sessions.0.lock().map_err(|e| e.to_string())?;
            map.insert(cell_id.to_string(), session);
        }

        // Wait for the shell to be ready before sending commands.
        tokio::time::sleep(tokio::time::Duration::from_millis(SHELL_READY_DELAY_MS)).await;
    }

    // Send the launch command into the PTY.
    {
        let cmd = make_launch_command(work_dir, tool_cmd);
        let mut map = sessions.0.lock().map_err(|e| e.to_string())?;
        if let Some(session) = map.get_mut(cell_id) {
            let _ = session.writer.write_all(cmd.as_bytes());
        }
    }

    Ok(())
}

#[tauri::command]
async fn launch_cells(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, PtySessions>,
    cell_states: tauri::State<'_, CellStateMap>,
    cell_ids: Vec<String>,
    work_dirs: Vec<String>,
    tool_cmd: Option<String>,
) -> Result<Vec<String>, String> {
    let cmd = tool_cmd.as_deref().unwrap_or(DEFAULT_TOOL_CMD);
    let mut launched = Vec::new();

    for (idx, cell_id) in cell_ids.iter().enumerate() {
        let work_dir = work_dirs.get(idx).map(|s| s.as_str());
        spawn_and_launch(&app, &sessions, &cell_states, cell_id, work_dir, cmd).await?;
        launched.push(cell_id.clone());
    }

    Ok(launched)
}

#[tauri::command]
async fn launch_all(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, PtySessions>,
    cell_states: tauri::State<'_, CellStateMap>,
    tool_cmd: Option<String>,
) -> Result<Vec<String>, String> {
    let cmd = tool_cmd.as_deref().unwrap_or(DEFAULT_TOOL_CMD);
    let mut launched = Vec::new();

    for i in 0..MAX_CELLS {
        let cell_id = format!("cell-{}", i);
        spawn_and_launch(&app, &sessions, &cell_states, &cell_id, None, cmd).await?;
        launched.push(cell_id);
    }

    Ok(launched)
}

#[tauri::command]
async fn launch_cell(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, PtySessions>,
    cell_states: tauri::State<'_, CellStateMap>,
    cell_id: String,
    work_dir: Option<String>,
    tool_cmd: Option<String>,
) -> Result<(), String> {
    let cmd = tool_cmd.as_deref().unwrap_or(DEFAULT_TOOL_CMD);
    spawn_and_launch(&app, &sessions, &cell_states, &cell_id, work_dir.as_deref(), cmd).await
}

pub fn run() {
    // Try loading .env from the project directory (dev) or home dir (release bundle)
    dotenvy::dotenv().ok();
    if let Some(home) = dirs::home_dir() {
        let env_path = home.join(".chaos-grid.env");
        if env_path.exists() {
            dotenvy::from_path(env_path).ok();
        }
    }

    tauri::Builder::default()
        .setup(|app| {
            let cell_states = init_cell_states(&app.handle());
            let states_arc = Arc::new(Mutex::new(cell_states));
            let ai_config = storage::load_ai_config();
            app.manage(PtySessions(Mutex::new(HashMap::new())));
            app.manage(CellStateMap(states_arc));
            app.manage(Mutex::new(ai_config));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            spawn_pty, write_pty, resize_pty, kill_pty, kill_all_ptys,
            analyze, get_cells, set_theme,
            launch_all, launch_cell, launch_cells,
            list_dir_files, list_dir_files_recursive, read_file_content, open_file,
            get_git_info, get_all_git_activity, get_git_diff,
            summarize_all_genres, chat_control, suggest_cell_name,
            get_ai_config, set_ai_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
