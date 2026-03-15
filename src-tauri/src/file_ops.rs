use serde::Serialize;

#[tauri::command]
pub async fn open_file(path: String) -> Result<(), String> {
    let expanded = super::expand_tilde(&path);
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
    let expanded = super::expand_tilde(&path);

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
        let expanded = super::expand_tilde(dir);

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
    let expanded = super::expand_tilde(&path);
    if !hash.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Invalid hash".to_string());
    }
    let out = Command::new("git")
        .args(["-C", &expanded, "show", "--patch", "--stat", &hash])
        .output()
        .map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

#[derive(Serialize)]
pub struct DiffFileStat {
    pub name: String,
    pub insertions: i32,
    pub deletions: i32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UncommittedDiff {
    pub files: Vec<DiffFileStat>,
    pub diff_text: String,
    pub total_insertions: i32,
    pub total_deletions: i32,
}

#[tauri::command]
pub async fn get_uncommitted_diff(path: String) -> Result<UncommittedDiff, String> {
    use std::process::Command;
    let expanded = super::expand_tilde(&path);

    if !is_git_repo(&expanded) {
        return Ok(UncommittedDiff {
            files: vec![],
            diff_text: String::new(),
            total_insertions: 0,
            total_deletions: 0,
        });
    }

    // Get numstat for both staged and unstaged
    let numstat_unstaged = Command::new("git")
        .args(["-C", &expanded, "diff", "--numstat"])
        .output()
        .map_err(|e| e.to_string())?;
    let numstat_staged = Command::new("git")
        .args(["-C", &expanded, "diff", "--cached", "--numstat"])
        .output()
        .map_err(|e| e.to_string())?;

    let mut files: Vec<DiffFileStat> = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for output in [&numstat_unstaged.stdout, &numstat_staged.stdout] {
        let text = String::from_utf8_lossy(output);
        for line in text.lines() {
            let parts: Vec<&str> = line.split('\t').collect();
            if parts.len() >= 3 {
                let name = parts[2].to_string();
                if seen.contains(&name) {
                    continue;
                }
                seen.insert(name.clone());
                let ins = parts[0].parse::<i32>().unwrap_or(0);
                let del = parts[1].parse::<i32>().unwrap_or(0);
                files.push(DiffFileStat {
                    name,
                    insertions: ins,
                    deletions: del,
                });
            }
        }
    }

    let total_insertions = files.iter().map(|f| f.insertions).sum();
    let total_deletions = files.iter().map(|f| f.deletions).sum();

    // Get full diff text (both staged and unstaged combined)
    let diff_unstaged = Command::new("git")
        .args(["-C", &expanded, "diff"])
        .output()
        .map_err(|e| e.to_string())?;
    let diff_staged = Command::new("git")
        .args(["-C", &expanded, "diff", "--cached"])
        .output()
        .map_err(|e| e.to_string())?;

    let mut diff_text = String::from_utf8_lossy(&diff_staged.stdout).to_string();
    let unstaged_text = String::from_utf8_lossy(&diff_unstaged.stdout);
    if !unstaged_text.is_empty() {
        if !diff_text.is_empty() {
            diff_text.push('\n');
        }
        diff_text.push_str(&unstaged_text);
    }

    Ok(UncommittedDiff {
        files,
        diff_text,
        total_insertions,
        total_deletions,
    })
}
