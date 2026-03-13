use std::io::Write;

use crate::{CellStateMap, PtySessions, now_millis, pty_manager,
            MAX_CELLS, DEFAULT_COLS, DEFAULT_ROWS, DEFAULT_TOOL_CMD, SHELL_READY_DELAY_MS};

fn make_launch_command(work_dir: Option<&str>, tool_cmd: &str) -> String {
    let cmd = if tool_cmd.trim().is_empty() { DEFAULT_TOOL_CMD } else { tool_cmd };
    match work_dir {
        Some(dir) if !dir.trim().is_empty() => {
            format!("mkdir -p {dir} && cd {dir} && {cmd}\n", dir = dir, cmd = cmd)
        }
        _ => format!("{cmd}\n", cmd = cmd),
    }
}

/// Shared core of the three launch commands.
async fn spawn_and_launch(
    app: &tauri::AppHandle,
    sessions: &PtySessions,
    cell_states: &CellStateMap,
    cell_id: &str,
    work_dir: Option<&str>,
    tool_cmd: &str,
) -> Result<(), String> {
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
            map.insert(cell_id.to_string(), session);
        }

        tokio::time::sleep(tokio::time::Duration::from_millis(SHELL_READY_DELAY_MS)).await;
    }

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
pub(crate) async fn launch_cells(
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
pub(crate) async fn launch_all(
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
pub(crate) async fn launch_cell(
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
