use serde::Serialize;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;

const SKIP_DIRS: &[&str] = &[
    "node_modules", "target", "dist", ".next", ".nuxt",
    ".venv", "venv", "__pycache__", "vendor", ".gradle",
    "build", ".turbo", "out",
];

/// Walk a directory recursively, skipping hidden files/dirs and build artifacts.
/// Returns Vec<(rel_path, abs_path, modified_ms)>.
pub fn walk_dir(root: &std::path::Path) -> Vec<(String, PathBuf, u64)> {
    let mut out = Vec::new();
    walk_inner(root, root, &mut out);
    out
}

fn walk_inner(root: &std::path::Path, dir: &std::path::Path, out: &mut Vec<(String, PathBuf, u64)>) {
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.filter_map(|e| e.ok()) {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if name_str.starts_with('.') {
            continue;
        }
        if SKIP_DIRS.contains(&name_str.as_ref()) {
            continue;
        }
        let path = entry.path();
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if meta.is_dir() {
            walk_inner(root, &path, out);
        } else {
            let modified_ms = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            let rel = path
                .strip_prefix(root)
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string();
            out.push((rel, path, modified_ms));
        }
    }
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
pub async fn list_dir_files(path: String) -> Result<Vec<FileEntry>, String> {
    let expanded = super::expand_tilde(&path);
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
pub async fn list_dir_files_recursive(path: String) -> Result<Vec<FileEntry>, String> {
    let expanded = super::expand_tilde(&path);
    let root = std::path::Path::new(&expanded);
    let mut files: Vec<FileEntry> = Vec::new();

    if root.exists() {
        let walked = walk_dir(root);
        for (rel, abs_path, modified_ms) in walked {
            let meta = match std::fs::metadata(&abs_path) {
                Ok(m) => m,
                Err(_) => continue,
            };
            files.push(FileEntry {
                name: rel,
                path: abs_path.to_string_lossy().to_string(),
                modified_ms,
                size_bytes: meta.len(),
                is_dir: false,
            });
        }
    }
    files.sort_by(|a, b| b.modified_ms.cmp(&a.modified_ms));
    files.truncate(500);
    Ok(files)
}
