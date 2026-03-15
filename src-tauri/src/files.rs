// Used for filesystem operations only — not for shell commands (the shell expands ~ itself).
pub fn expand_tilde(path: &str) -> String {
    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = dirs::home_dir() {
            return format!("{}/{}", home.display(), rest);
        }
    }
    path.to_string()
}

#[path = "dir_listing.rs"]
pub mod dir_listing;

#[path = "file_reading.rs"]
pub mod file_reading;

#[path = "file_ops.rs"]
pub mod file_ops;

// Re-export all public symbols so callers using `files::` keep working unchanged.
pub use dir_listing::{FileEntry, list_dir_files, list_dir_files_recursive, walk_dir};
pub use file_reading::read_file_content;
pub use file_ops::{
    open_file,
    GitCommit, GitInfo, get_git_info,
    ActivityEntry, get_all_git_activity,
    get_git_diff,
    DiffFileStat, UncommittedDiff, get_uncommitted_diff,
};
