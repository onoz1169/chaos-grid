use serde::Serialize;
use std::path::PathBuf;
use std::time::UNIX_EPOCH;

// Used for filesystem operations only — not for shell commands (the shell expands ~ itself).
pub fn expand_tilde(path: &str) -> String {
    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return format!("{}/{}", home.display(), rest);
        }
    }
    path.to_string()
}

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
pub async fn list_dir_files_recursive(path: String) -> Result<Vec<FileEntry>, String> {
    let expanded = expand_tilde(&path);
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

#[tauri::command]
pub async fn read_file_content(path: String) -> Result<String, String> {
    let expanded = expand_tilde(&path);
    let meta = std::fs::metadata(&expanded).map_err(|e| e.to_string())?;
    if meta.len() > 2_000_000 {
        return Err("File too large (>2MB)".to_string());
    }
    std::fs::read_to_string(&expanded).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_file(path: String) -> Result<(), String> {
    let expanded = expand_tilde(&path);
    open::that(expanded).map_err(|e| e.to_string())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCommit {
    pub hash: String,
    pub time_ago: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitInfo {
    pub is_git_repo: bool,
    pub branch: String,
    pub commits: Vec<GitCommit>,
    pub staged: Vec<String>,
    pub unstaged: Vec<String>,
    pub file_statuses: std::collections::HashMap<String, String>,
}

#[tauri::command]
pub async fn get_git_info(path: String) -> Result<GitInfo, String> {
    use std::process::Command;
    let expanded = expand_tilde(&path);

    let is_git = Command::new("git")
        .args(["-C", &expanded, "rev-parse", "--git-dir"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if !is_git {
        return Ok(GitInfo { is_git_repo: false, branch: String::new(), commits: vec![], staged: vec![], unstaged: vec![], file_statuses: Default::default() });
    }

    let branch = Command::new("git")
        .args(["-C", &expanded, "branch", "--show-current"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();

    let log_out = Command::new("git")
        .args(["-C", &expanded, "log", "--format=%h\t%ar\t%s", "-20"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default();

    let commits = log_out.lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(3, '\t').collect();
            if parts.len() == 3 {
                Some(GitCommit { hash: parts[0].to_string(), time_ago: parts[1].to_string(), message: parts[2].to_string() })
            } else { None }
        })
        .collect();

    let status_out = Command::new("git")
        .args(["-C", &expanded, "status", "--porcelain"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default();

    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut file_statuses: std::collections::HashMap<String, String> = Default::default();
    for line in status_out.lines() {
        if line.len() < 3 { continue; }
        let x = line.chars().next().unwrap_or(' ');
        let y = line.chars().nth(1).unwrap_or(' ');
        let file = line[3..].to_string();
        if x != ' ' && x != '?' { staged.push(format!("{} {}", x, file)); }
        if y != ' ' && y != '?' { unstaged.push(format!("{} {}", y, file)); }
        if x == '?' { unstaged.push(format!("? {}", file)); }
        let status_code = if x != ' ' && x != '?' { x.to_string() } else if y != ' ' && y != '?' { y.to_string() } else { "?".to_string() };
        file_statuses.insert(file, status_code);
    }

    Ok(GitInfo { is_git_repo: true, branch, commits, staged, unstaged, file_statuses })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEntry {
    pub genre: String,
    pub hash: String,
    pub timestamp_ms: u64,
    pub time_ago: String,
    pub message: String,
}

fn collect_git_log(dir: &str, genre: &str, entries: &mut Vec<ActivityEntry>) {
    use std::process::Command;
    let log_out = Command::new("git")
        .args(["-C", dir, "log", "--format=%h\t%at\t%ar\t%s", "-30"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .unwrap_or_default();
    for line in log_out.lines() {
        let parts: Vec<&str> = line.splitn(4, '\t').collect();
        if parts.len() == 4 {
            let timestamp_ms = parts[1].parse::<u64>().unwrap_or(0) * 1000;
            entries.push(ActivityEntry {
                genre: genre.to_string(),
                hash: parts[0].to_string(),
                timestamp_ms,
                time_ago: parts[2].to_string(),
                message: parts[3].to_string(),
            });
        }
    }
}

fn is_git_repo(dir: &str) -> bool {
    use std::process::Command;
    Command::new("git")
        .args(["-C", dir, "rev-parse", "--git-dir"])
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[tauri::command]
pub async fn get_all_git_activity(dirs: Vec<String>, genres: Vec<String>) -> Result<Vec<ActivityEntry>, String> {
    let mut entries: Vec<ActivityEntry> = Vec::new();

    for (dir, genre) in dirs.iter().zip(genres.iter()) {
        let expanded = expand_tilde(dir);

        if is_git_repo(&expanded) {
            // Dir is itself a git repo — use directly
            collect_git_log(&expanded, genre, &mut entries);
        } else {
            // Not a git repo — scan one level of subdirs for git repos
            if let Ok(read) = std::fs::read_dir(&expanded) {
                for entry in read.filter_map(|e| e.ok()) {
                    if !entry.metadata().map(|m| m.is_dir()).unwrap_or(false) { continue; }
                    let name = entry.file_name();
                    let name_str = name.to_string_lossy();
                    if name_str.starts_with('.') { continue; }
                    let sub = entry.path().to_string_lossy().to_string();
                    if is_git_repo(&sub) {
                        collect_git_log(&sub, genre, &mut entries);
                    }
                }
            }
        }
    }

    entries.sort_by(|a, b| b.timestamp_ms.cmp(&a.timestamp_ms));
    entries.truncate(100);
    Ok(entries)
}

#[tauri::command]
pub async fn get_git_diff(path: String, hash: String) -> Result<String, String> {
    use std::process::Command;
    let expanded = expand_tilde(&path);
    if !hash.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Invalid hash".to_string());
    }
    let out = Command::new("git")
        .args(["-C", &expanded, "show", "--patch", "--stat", &hash])
        .output()
        .map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}
