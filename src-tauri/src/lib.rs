mod gemini;
mod pty_manager;
mod storage;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use std::sync::{Arc, Mutex};
use tauri::Manager;

const MAX_CELLS: usize = 30; // supports up to 6×5 grid
const DEFAULT_COLS: u16 = 80;
const DEFAULT_ROWS: u16 = 24;
const SHELL_READY_DELAY_MS: u64 = 500;
const LAUNCH_COMMAND: &str = "claude --dangerously-skip-permissions\n";

fn expand_tilde(path: &str) -> String {
    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return format!("{}/{}", home.display(), rest);
        }
    }
    path.to_string()
}

fn make_launch_command(work_dir: Option<&str>) -> String {
    match work_dir {
        Some(dir) if !dir.trim().is_empty() => {
            let expanded = expand_tilde(dir);
            format!(
                "mkdir -p '{}' && cd '{}' && claude --dangerously-skip-permissions\n",
                expanded, expanded
            )
        }
        _ => LAUNCH_COMMAND.to_string(),
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

fn now_millis() -> u64 {
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
async fn analyze(
    app: tauri::AppHandle,
    cell_states: tauri::State<'_, CellStateMap>,
    language: Option<String>,
    cols: Option<u32>,
) -> Result<AnalyzeResult, String> {
    let cells: Vec<CellState> = {
        let states = cell_states.0.lock().map_err(|e| e.to_string())?;
        states.values().cloned().collect()
    };

    let lang = language.as_deref().unwrap_or("English");
    let cols_count = cols.unwrap_or(3) as usize;
    let history = storage::load_analysis_history(&app);
    let result = gemini::analyze_cells(&cells, &history, lang, cols_count).await?;

    // Save analysis to history
    let themes: HashMap<String, String> = cells.iter().map(|c| (c.id.clone(), c.theme.clone())).collect();
    storage::save_analysis(&app, &result, themes);

    Ok(result)
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

#[tauri::command]
async fn launch_cells(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, PtySessions>,
    cell_states: tauri::State<'_, CellStateMap>,
    cell_ids: Vec<String>,
    work_dirs: Vec<String>,
) -> Result<Vec<String>, String> {
    let mut launched = Vec::new();

    for (idx, cell_id) in cell_ids.iter().enumerate() {
        let has_pty = {
            let map = sessions.0.lock().map_err(|e| e.to_string())?;
            map.contains_key(cell_id)
        };

        if !has_pty {
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

            {
                let mut states = cell_states.0.lock().map_err(|e| e.to_string())?;
                if let Some(state) = states.get_mut(cell_id) {
                    state.pid = Some(session.pid);
                    state.status = "active".to_string();
                    state.updated_at = now_millis();
                }
            }

            {
                let mut map = sessions.0.lock().map_err(|e| e.to_string())?;
                map.insert(cell_id.clone(), session);
            }

            tokio::time::sleep(tokio::time::Duration::from_millis(SHELL_READY_DELAY_MS)).await;
        }

        {
            let work_dir = work_dirs.get(idx).map(|s| s.as_str());
            let cmd = make_launch_command(work_dir);
            let mut map = sessions.0.lock().map_err(|e| e.to_string())?;
            if let Some(session) = map.get_mut(cell_id) {
                let _ = session.writer.write_all(cmd.as_bytes());
            }
        }

        launched.push(cell_id.clone());
    }

    Ok(launched)
}

#[tauri::command]
async fn launch_all(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, PtySessions>,
    cell_states: tauri::State<'_, CellStateMap>,
) -> Result<Vec<String>, String> {
    let mut launched = Vec::new();

    for i in 0..MAX_CELLS {
        let cell_id = format!("cell-{}", i);

        // Check if already has a PTY
        let has_pty = {
            let map = sessions.0.lock().map_err(|e| e.to_string())?;
            map.contains_key(&cell_id)
        };

        if !has_pty {
            // Kill any existing session first
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
                DEFAULT_COLS,
                DEFAULT_ROWS,
                states_arc,
                app.clone(),
            )?;

            {
                let mut states = cell_states.0.lock().map_err(|e| e.to_string())?;
                if let Some(state) = states.get_mut(&cell_id) {
                    state.pid = Some(session.pid);
                    state.status = "active".to_string();
                    state.updated_at = now_millis();
                }
            }

            {
                let mut map = sessions.0.lock().map_err(|e| e.to_string())?;
                map.insert(cell_id.clone(), session);
            }

            // Wait for shell to be ready
            tokio::time::sleep(tokio::time::Duration::from_millis(SHELL_READY_DELAY_MS)).await;
        }

        // Send launch command
        {
            let mut map = sessions.0.lock().map_err(|e| e.to_string())?;
            if let Some(session) = map.get_mut(&cell_id) {
                let _ = session.writer.write_all(LAUNCH_COMMAND.as_bytes());
            }
        }

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
) -> Result<(), String> {
    let has_pty = {
        let map = sessions.0.lock().map_err(|e| e.to_string())?;
        map.contains_key(&cell_id)
    };

    if !has_pty {
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
            DEFAULT_COLS,
            DEFAULT_ROWS,
            states_arc,
            app.clone(),
        )?;

        {
            let mut states = cell_states.0.lock().map_err(|e| e.to_string())?;
            if let Some(state) = states.get_mut(&cell_id) {
                state.pid = Some(session.pid);
                state.status = "active".to_string();
                state.updated_at = now_millis();
            }
        }

        {
            let mut map = sessions.0.lock().map_err(|e| e.to_string())?;
            map.insert(cell_id.clone(), session);
        }

        tokio::time::sleep(tokio::time::Duration::from_millis(SHELL_READY_DELAY_MS)).await;
    }

    // Send launch command
    {
        let cmd = make_launch_command(work_dir.as_deref());
        let mut map = sessions.0.lock().map_err(|e| e.to_string())?;
        if let Some(session) = map.get_mut(&cell_id) {
            let _ = session.writer.write_all(cmd.as_bytes());
        }
    }

    Ok(())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub modified_ms: u64,
    pub size_bytes: u64,
    pub is_dir: bool,
}

#[tauri::command]
async fn list_dir_files(path: String) -> Result<Vec<FileEntry>, String> {
    use std::time::UNIX_EPOCH;
    let entries = std::fs::read_dir(&path).map_err(|e| format!("{}: {}", path, e))?;
    let mut files: Vec<FileEntry> = entries
        .filter_map(|e| e.ok())
        .filter_map(|entry| {
            let meta = entry.metadata().ok()?;
            let modified_ms = meta
                .modified()
                .ok()?
                .duration_since(UNIX_EPOCH)
                .ok()?
                .as_millis() as u64;
            Some(FileEntry {
                name: entry.file_name().to_string_lossy().to_string(),
                path: entry.path().to_string_lossy().to_string(),
                modified_ms,
                size_bytes: meta.len(),
                is_dir: meta.is_dir(),
            })
        })
        .collect();
    files.sort_by(|a, b| b.modified_ms.cmp(&a.modified_ms));
    files.truncate(200);
    Ok(files)
}

#[tauri::command]
async fn read_file_content(path: String) -> Result<String, String> {
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > 2_000_000 {
        return Err("File too large (>2MB)".to_string());
    }
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

pub fn run() {
    dotenvy::dotenv().ok();

    tauri::Builder::default()
        .setup(|app| {
            let cell_states = init_cell_states(&app.handle());
            let states_arc = Arc::new(Mutex::new(cell_states));
            app.manage(PtySessions(Mutex::new(HashMap::new())));
            app.manage(CellStateMap(states_arc));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            spawn_pty, write_pty, resize_pty, kill_pty, analyze, get_cells, set_theme,
            launch_all, launch_cell, launch_cells, list_dir_files, read_file_content
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
