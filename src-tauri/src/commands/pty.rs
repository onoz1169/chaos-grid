use std::io::Write;

use crate::{CellStateMap, PtySessions, now_millis, pty_manager};

#[tauri::command]
pub(crate) async fn spawn_pty(
    app: tauri::AppHandle,
    sessions: tauri::State<'_, PtySessions>,
    cell_states: tauri::State<'_, CellStateMap>,
    cell_id: String,
    cols: u16,
    rows: u16,
) -> Result<u32, String> {
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

    {
        let mut states = cell_states.0.lock().map_err(|e| e.to_string())?;
        if let Some(state) = states.get_mut(&cell_id) {
            state.pid = Some(pid);
            state.status = "active".to_string();
            state.updated_at = now_millis();
        }
    }

    {
        let mut map = sessions.0.lock().map_err(|e| e.to_string())?;
        map.insert(cell_id, session);
    }

    Ok(pid)
}

#[tauri::command]
pub(crate) async fn write_pty(
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
pub(crate) async fn resize_pty(
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
pub(crate) async fn kill_pty(
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
pub(crate) async fn kill_all_ptys(
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
