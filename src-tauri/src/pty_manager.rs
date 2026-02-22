use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::Emitter;

const BUFFER_LIMIT: usize = 2000;

pub struct PtySession {
    pub writer: Box<dyn Write + Send>,
    pub child: Box<dyn portable_pty::Child + Send + Sync>,
    pub master: Box<dyn portable_pty::MasterPty + Send>,
    pub buffer: Arc<Mutex<String>>,
    pub pid: u32,
}

#[derive(serde::Serialize, Clone)]
struct PtyDataPayload {
    #[serde(rename = "cellId")]
    cell_id: String,
    data: String,
}

pub fn spawn(
    app: tauri::AppHandle,
    cell_id: &str,
    cols: u16,
    rows: u16,
    cell_states: Arc<Mutex<HashMap<String, crate::CellState>>>,
    app_handle_for_storage: tauri::AppHandle,
) -> Result<PtySession, String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());

    let mut cmd = CommandBuilder::new(&shell);
    cmd.arg("-l"); // login shell: sources .zprofile/.bash_profile so nvm/rbenv etc. are loaded
    cmd.cwd(dirs::home_dir().unwrap_or_else(|| "/".into()));

    // Clear inherited env completely, then rebuild without Claude Code vars
    cmd.env_clear();
    let filtered_keys = ["CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT", "npm_config_prefix"];
    for (key, value) in std::env::vars() {
        if filtered_keys.contains(&key.as_str()) {
            continue;
        }
        if key == "PATH" {
            // Prepend common paths for macOS
            let extra = "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin";
            let new_path = format!("{}:{}", extra, value);
            cmd.env(key, new_path);
        } else {
            cmd.env(key, value);
        }
    }
    // Ensure TERM is set
    cmd.env("TERM", "xterm-256color");

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let pid = child.process_id().unwrap_or(0);

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    // Drop the slave side - we don't need it after spawning
    drop(pair.slave);

    let buffer = Arc::new(Mutex::new(String::new()));
    let buffer_clone = buffer.clone();
    let cell_id_clone = cell_id.to_string();
    let cell_id_for_state = cell_id.to_string();

    // Spawn reader thread (std::thread for blocking I/O)
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();

                    // Update buffer
                    {
                        let mut b = buffer_clone.lock().unwrap();
                        b.push_str(&data);
                        if b.len() > BUFFER_LIMIT * 2 {
                            let start = b.len() - BUFFER_LIMIT;
                            *b = b[start..].to_string();
                        }
                    }

                    // Emit event to frontend
                    let payload = PtyDataPayload {
                        cell_id: cell_id_clone.clone(),
                        data: data.clone(),
                    };
                    let _ = app.emit("pty-data", payload);

                    // Update cell state
                    {
                        let buffer_content = buffer_clone.lock().unwrap().clone();
                        let mut states = cell_states.lock().unwrap();
                        if let Some(state) = states.get_mut(&cell_id_for_state) {
                            state.last_output = buffer_content.clone();
                            state.status = "active".to_string();
                            state.updated_at = crate::now_millis();
                        }
                        drop(states);

                        // Persist output
                        crate::storage::save_cell_output(
                            &app_handle_for_storage,
                            &cell_id_for_state,
                            &buffer_content,
                        );
                    }
                }
                Err(_) => break,
            }
        }
    });

    Ok(PtySession {
        writer,
        child,
        master: pair.master,
        buffer,
        pid,
    })
}

pub fn resize(session: &PtySession, cols: u16, rows: u16) -> Result<(), String> {
    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())
}

pub fn kill(session: &mut PtySession) {
    let _ = session.child.kill();
}

