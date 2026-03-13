use crate::{CellState, CellStateMap};

#[tauri::command]
pub(crate) async fn get_cells(
    cell_states: tauri::State<'_, CellStateMap>,
) -> Result<Vec<CellState>, String> {
    let states = cell_states.0.lock().map_err(|e| e.to_string())?;
    let mut cells: Vec<CellState> = states.values().cloned().collect();
    cells.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(cells)
}

#[tauri::command]
pub(crate) async fn set_theme(
    cell_states: tauri::State<'_, CellStateMap>,
    cell_id: String,
    theme: String,
) -> Result<(), String> {
    let mut states = cell_states.0.lock().map_err(|e| e.to_string())?;
    if let Some(state) = states.get_mut(&cell_id) {
        state.theme = theme;
        state.updated_at = crate::now_millis();
    }
    Ok(())
}

fn cpu_for_tree(root_pid: u32) -> f32 {
    let output = match std::process::Command::new("ps")
        .args(["axo", "pid=,ppid=,%cpu="])
        .output()
    {
        Ok(o) => o,
        Err(_) => return 0.0,
    };
    let text = String::from_utf8_lossy(&output.stdout);
    let processes: Vec<(u32, u32, f32)> = text
        .lines()
        .filter_map(|line| {
            let p: Vec<&str> = line.split_whitespace().collect();
            if p.len() >= 3 {
                Some((p[0].parse().ok()?, p[1].parse().ok()?, p[2].parse().ok()?))
            } else {
                None
            }
        })
        .collect();

    let mut total = 0.0f32;
    let mut to_visit = vec![root_pid];
    let mut visited = std::collections::HashSet::new();
    while let Some(pid) = to_visit.pop() {
        if !visited.insert(pid) { continue; }
        if let Some((_, _, cpu)) = processes.iter().find(|(p, _, _)| *p == pid) {
            total += cpu;
        }
        for (child, _, _) in processes.iter().filter(|(_, pp, _)| *pp == pid) {
            to_visit.push(*child);
        }
    }
    total
}

#[tauri::command]
pub(crate) async fn get_cell_cpu(
    cell_states: tauri::State<'_, CellStateMap>,
    cell_id: String,
) -> Result<f32, String> {
    let pid = {
        let states = cell_states.0.lock().map_err(|e| e.to_string())?;
        states.get(&cell_id).and_then(|s| s.pid)
    };
    Ok(pid.map(cpu_for_tree).unwrap_or(0.0))
}
