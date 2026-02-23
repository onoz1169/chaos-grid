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
const DEFAULT_TOOL_CMD: &str = "claude --dangerously-skip-permissions";

// Used for filesystem operations only — not for shell commands (the shell expands ~ itself).
fn expand_tilde(path: &str) -> String {
    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return format!("{}/{}", home.display(), rest);
        }
    }
    path.to_string()
}

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
    let expanded = expand_tilde(&path);
    let entries = std::fs::read_dir(&expanded).map_err(|e| format!("{}: {}", expanded, e))?;
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
async fn list_dir_files_recursive(path: String) -> Result<Vec<FileEntry>, String> {
    use std::time::UNIX_EPOCH;
    let expanded = expand_tilde(&path);
    let root = std::path::Path::new(&expanded);
    let mut files: Vec<FileEntry> = Vec::new();

    fn walk(root: &std::path::Path, dir: &std::path::Path, files: &mut Vec<FileEntry>) {
        let entries = match std::fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            // Skip hidden directories (including .git)
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.starts_with('.') {
                continue;
            }
            let meta = match entry.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            if meta.is_dir() {
                walk(root, &path, files);
            } else {
                let modified_ms = meta
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);
                // Use path relative to root as display name
                let rel = path.strip_prefix(root).unwrap_or(&path);
                files.push(FileEntry {
                    name: rel.to_string_lossy().to_string(),
                    path: path.to_string_lossy().to_string(),
                    modified_ms,
                    size_bytes: meta.len(),
                    is_dir: false,
                });
            }
        }
    }

    if root.exists() {
        walk(root, root, &mut files);
    }
    files.sort_by(|a, b| b.modified_ms.cmp(&a.modified_ms));
    files.truncate(500);
    Ok(files)
}

#[derive(serde::Deserialize)]
struct GenreInput {
    name: String,
    dir: String,
}

#[tauri::command]
async fn summarize_all_genres(
    genres: Vec<GenreInput>,
    language: String,
) -> Result<String, String> {
    let api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| "GEMINI_API_KEY not set".to_string())?;

    fn collect_files(dir_path: &str) -> Vec<(String, std::path::PathBuf, u64)> {
        use std::time::UNIX_EPOCH;
        let mut files = Vec::new();
        fn walk(root: &std::path::Path, dir: &std::path::Path, out: &mut Vec<(String, std::path::PathBuf, u64)>) {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.filter_map(|e| e.ok()) {
                    let name = entry.file_name();
                    if name.to_string_lossy().starts_with('.') { continue; }
                    let path = entry.path();
                    if let Ok(meta) = entry.metadata() {
                        if meta.is_dir() {
                            walk(root, &path, out);
                        } else {
                            let modified_ms = meta.modified().ok()
                                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                                .map(|d| d.as_millis() as u64).unwrap_or(0);
                            let rel = path.strip_prefix(root).unwrap_or(&path).to_string_lossy().to_string();
                            out.push((rel, path, modified_ms));
                        }
                    }
                }
            }
        }
        let root = std::path::Path::new(dir_path);
        if root.exists() { walk(root, root, &mut files); }
        files.sort_by(|a, b| b.2.cmp(&a.2));
        files
    }

    // Build one prompt section per genre
    let genre_sections: Vec<String> = genres.iter().map(|g| {
        let expanded = expand_tilde(&g.dir);
        let files = collect_files(&expanded);
        if files.is_empty() {
            return format!("=== {} ===\n(no files)", g.name);
        }
        let file_list = files.iter()
            .map(|(n, _, _)| format!("  - {}", n))
            .collect::<Vec<_>>().join("\n");
        // Top 2 files, up to 1200 chars each
        let snippets = files.iter().take(2)
            .filter_map(|(name, path, _)| {
                let content = std::fs::read_to_string(path).ok()?;
                let mut end = content.len().min(1200);
                while !content.is_char_boundary(end) { end -= 1; }
                Some(format!("--- {}\n{}", name, &content[..end]))
            })
            .collect::<Vec<_>>().join("\n\n");
        format!("=== {} ===\nFiles ({} total):\n{}\n\nRecent content:\n{}", g.name, files.len(), file_list, snippets)
    }).collect();

    let prompt = format!(
        "You are reviewing AI agent work output across multiple streams (stimulus=research/input, will=planning, supply=deliverables).\n\
        Write 2-3 concise sentences summarizing the overall progress: what has been accomplished, what is in progress, and what comes next.\n\
        Be specific and chronological. No filler phrases. Plain text only, no markdown, no bullet points.\n\
        \n\
        {}\n\
        \n\
        Respond in: {}",
        genre_sections.join("\n\n"),
        language
    );

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={}",
        api_key
    );

    let body = serde_json::json!({
        "contents": [{ "parts": [{ "text": prompt }] }],
        "generationConfig": { "maxOutputTokens": 300 }
    });

    let client = reqwest::Client::new();
    let resp = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    let resp_json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let text = resp_json
        .pointer("/candidates/0/content/parts/0/text")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    if text.is_empty() {
        return Err("empty response from model".to_string());
    }

    Ok(text)
}

#[tauri::command]
async fn open_file(path: String) -> Result<(), String> {
    let expanded = expand_tilde(&path);
    open::that(expanded).map_err(|e| e.to_string())
}

#[tauri::command]
async fn read_file_content(path: String) -> Result<String, String> {
    let expanded = expand_tilde(&path);
    let meta = std::fs::metadata(&expanded).map_err(|e| e.to_string())?;
    if meta.len() > 2_000_000 {
        return Err("File too large (>2MB)".to_string());
    }
    std::fs::read_to_string(&expanded).map_err(|e| e.to_string())
}

#[derive(serde::Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[tauri::command]
async fn chat_control(
    messages: Vec<ChatMessage>,
    genres: Vec<GenreInput>,
    language: String,
) -> Result<String, String> {
    let api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| "GEMINI_API_KEY not set".to_string())?;

    // Collect file context for each genre
    fn collect_files_brief(dir_path: &str) -> Vec<(String, String)> {
        let mut files = Vec::new();
        fn walk(root: &std::path::Path, dir: &std::path::Path, out: &mut Vec<(String, String)>) {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.filter_map(|e| e.ok()) {
                    let name = entry.file_name();
                    if name.to_string_lossy().starts_with('.') { continue; }
                    let path = entry.path();
                    if let Ok(meta) = entry.metadata() {
                        if meta.is_dir() { walk(root, &path, out); }
                        else {
                            let rel = path.strip_prefix(root).unwrap_or(&path).to_string_lossy().to_string();
                            let snippet = std::fs::read_to_string(&path).unwrap_or_default();
                            let mut end = snippet.len().min(600);
                            while !snippet.is_char_boundary(end) { end -= 1; }
                            out.push((rel, snippet[..end].to_string()));
                        }
                    }
                }
            }
        }
        let root = std::path::Path::new(dir_path);
        if root.exists() { walk(root, root, &mut files); }
        files.sort_by_key(|f| f.0.clone());
        files
    }

    let context = genres.iter().map(|g| {
        let expanded = expand_tilde(&g.dir);
        let files = collect_files_brief(&expanded);
        if files.is_empty() {
            return format!("[{}]: no files yet", g.name);
        }
        let items = files.iter().take(3).map(|(name, snippet)| {
            format!("  - {}\n{}", name, snippet.lines().take(8).collect::<Vec<_>>().join("\n"))
        }).collect::<Vec<_>>().join("\n");
        format!("[{}]: {} file(s)\n{}", g.name, files.len(), items)
    }).collect::<Vec<_>>().join("\n\n");

    let system_text = format!(
        "You are a strategic advisor embedded in Chaos Grid, a multi-agent productivity tool.\n\
        Work streams: Stimulus (research/input) → Will (planning) → Supply (deliverables).\n\
        Your role: help the user understand current progress, identify bottlenecks, and decide next actions.\n\
        Be concise and specific. No filler. Respond in: {}\n\n\
        Current project state:\n{}",
        language, context
    );

    // Build Gemini contents: inject system context as first exchange
    let mut contents: Vec<serde_json::Value> = vec![
        serde_json::json!({"role": "user", "parts": [{"text": system_text}]}),
        serde_json::json!({"role": "model", "parts": [{"text": "了解しました。プロジェクトの状況を把握しました。何でも聞いてください。"}]}),
    ];
    for msg in &messages {
        let role = if msg.role == "user" { "user" } else { "model" };
        contents.push(serde_json::json!({"role": role, "parts": [{"text": msg.content}]}));
    }

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={}",
        api_key
    );
    let body = serde_json::json!({
        "contents": contents,
        "generationConfig": { "maxOutputTokens": 600 }
    });

    let client = reqwest::Client::new();
    let resp = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    let resp_json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    let text = resp_json
        .pointer("/candidates/0/content/parts/0/text")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    if text.is_empty() { return Err("empty response".to_string()); }
    Ok(text)
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
            spawn_pty, write_pty, resize_pty, kill_pty, kill_all_ptys, analyze, get_cells, set_theme,
            launch_all, launch_cell, launch_cells, list_dir_files, list_dir_files_recursive,
            read_file_content, open_file, summarize_all_genres, chat_control
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
