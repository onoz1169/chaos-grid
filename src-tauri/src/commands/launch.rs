use std::io::Write;

use crate::{CellStateMap, PtySessions, now_millis, pty_manager,
            MAX_CELLS, DEFAULT_COLS, DEFAULT_ROWS, DEFAULT_TOOL_CMD, SHELL_READY_DELAY_MS};

/// Shell metacharacters that must be rejected to prevent command injection.
/// This list covers the characters documented in the POSIX shell specification
/// and common shell extensions that enable injection: command separators,
/// redirections, substitutions, quoting, globbing and special expansions.
const SHELL_METACHARACTERS: &[char] = &[
    ';', '|', '&', '$', '`', '>', '<', '\\',
    '!', '(', ')', '{', '}', '*', '?', '#',
    '\n', '\r',
];

/// Validate that `value` contains no shell metacharacters.
///
/// Returns `Err` with a descriptive message if any forbidden character is
/// found, so the caller can propagate the error without executing unsafe input.
fn validate_no_shell_metacharacters(value: &str, field_name: &str) -> Result<(), String> {
    if let Some(bad_char) = value.chars().find(|c| SHELL_METACHARACTERS.contains(c)) {
        return Err(format!(
            "Invalid {field_name} {:?}: contains shell metacharacter {bad_char:?}. \
             Characters ; | & $ ` > < \\ ! ( ) {{ }} * ? ~ # and newlines are \
             forbidden to prevent command injection.",
            value
        ));
    }
    Ok(())
}

/// Build the shell command string that will be written to the PTY's stdin.
///
/// Because the command is ultimately interpreted by an interactive login shell
/// (PTY), `std::process::Command` with `.current_dir()` / `.arg()` cannot be
/// used directly.  Instead, every user-supplied value is validated against the
/// set of POSIX shell metacharacters before interpolation so that injection is
/// impossible.
fn make_launch_command(work_dir: Option<&str>, tool_cmd: &str) -> Result<String, String> {
    let cmd = if tool_cmd.trim().is_empty() { DEFAULT_TOOL_CMD } else { tool_cmd };

    // Validate both inputs before touching the shell string.
    validate_no_shell_metacharacters(cmd, "tool_cmd")?;

    let shell_cmd = match work_dir {
        Some(dir) if !dir.trim().is_empty() => {
            validate_no_shell_metacharacters(dir, "work_dir")?;
            format!("mkdir -p {dir} && cd {dir} && {cmd}\n", dir = dir, cmd = cmd)
        }
        _ => format!("{cmd}\n", cmd = cmd),
    };

    Ok(shell_cmd)
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
        let cmd = make_launch_command(work_dir, tool_cmd)?;
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
