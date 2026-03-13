mod ai;
mod commands;
pub mod files;
mod pty_manager;
mod storage;

use crate::ai::{summarize_all_genres, chat_control};
use crate::commands::pty::{spawn_pty, write_pty, resize_pty, kill_pty, kill_all_ptys};
use crate::commands::cell::{get_cells, set_theme, get_cell_cpu};
use crate::commands::launch::{launch_all, launch_cell, launch_cells};
use crate::commands::ai_cmds::{analyze, get_ai_config, set_ai_config};
use crate::files::{list_dir_files, list_dir_files_recursive, read_file_content, open_file,
                   get_git_info, get_all_git_activity, get_git_diff, get_uncommitted_diff};

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::Manager;

pub(crate) const MAX_CELLS: usize = 30;
pub(crate) const DEFAULT_COLS: u16 = 80;
pub(crate) const DEFAULT_ROWS: u16 = 24;
pub(crate) const SHELL_READY_DELAY_MS: u64 = 500;
pub(crate) const DEFAULT_TOOL_CMD: &str = "claude --dangerously-skip-permissions";

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
pub struct FlowConnection {
    pub from_cell: String,
    pub to_cell: String,
    pub insight: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowAnalysis {
    pub stimuli_to_will: String,
    pub will_to_supply: String,
    pub stuck: String,
    pub next: String,
    #[serde(default)]
    pub blocked_cells: Option<Vec<String>>,
    pub priority_cell: Option<String>,
    pub confidence: Option<String>,
    pub connections: Option<Vec<FlowConnection>>,
    pub human_questions: Option<Vec<String>>,
    pub changes_since_last: Option<String>,
}

pub(crate) struct PtySessions(pub(crate) Mutex<HashMap<String, pty_manager::PtySession>>);
pub(crate) struct CellStateMap(pub(crate) Arc<Mutex<HashMap<String, CellState>>>);

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

pub fn run() {
    dotenvy::dotenv().ok();
    if let Some(home) = dirs::home_dir() {
        let env_path = home.join(".chaos-grid.env");
        if env_path.exists() {
            dotenvy::from_path(env_path).ok();
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
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
            get_git_info, get_all_git_activity, get_git_diff, get_uncommitted_diff,
            summarize_all_genres, chat_control,
            get_ai_config, set_ai_config,
            get_cell_cpu
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
