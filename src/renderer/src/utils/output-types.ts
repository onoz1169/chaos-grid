export interface FileEntry {
  name: string
  path: string
  modifiedMs: number
  sizeBytes: number
  isDir: boolean
}

export interface GenreInfo {
  name: string
  dir: string
  color: string
  role: string
  cellId: string
}

export interface GitCommit {
  hash: string
  timeAgo: string
  message: string
}

export interface GitInfo {
  isGitRepo: boolean
  branch: string
  commits: GitCommit[]
  staged: string[]
  unstaged: string[]
  fileStatuses: Record<string, string>
}

export interface ActivityEntry {
  genre: string
  hash: string
  timestampMs: number
  timeAgo: string
  message: string
}
