export interface CellState {
  id: string
  theme: string
  pid: number | null
  lastOutput: string
  status: 'idle' | 'active' | 'thinking'
  updatedAt: number
}

export interface AnalyzeResult {
  summaries: Record<string, string>
  ideas: string[]
}

export const DEFAULT_THEMES = [
  '勉強', 'ツール', 'プロダクト',
  'アイデア', '分析', '実験',
  'ライティング', 'AI', 'タスク'
]

export const CELL_IDS = Array.from({ length: 9 }, (_, i) => `cell-${i}`)
