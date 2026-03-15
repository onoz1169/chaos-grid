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

export interface FlowConnection {
  fromCell: string
  toCell: string
  insight: string
}

export interface FlowAnalysis {
  stimuliToWill: string
  willToSupply: string
  stuck: string
  next: string
  blockedCells?: string[] | null
  priorityCell?: string | null
  confidence?: string | null
  connections?: FlowConnection[] | null
  humanQuestions?: string[] | null
  changesSinceLast?: string | null
}

export interface AnalyzeResult {
  summaries: Record<string, string>
  ideas: string[]
  flow: FlowAnalysis | null
}

export interface DiffFileStat {
  name: string
  insertions: number
  deletions: number
}

export interface UncommittedDiff {
  files: DiffFileStat[]
  diffText: string
  totalInsertions: number
  totalDeletions: number
}
