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
  flow?: FlowAnalysis
}

export interface FlowAnalysis {
  stimuli_to_will: string   // 刺激が意志に変換されているか
  will_to_supply: string    // 意志が供給に落ちているか
  stuck: string             // どこで詰まっているか
  next: string              // 次にすべきこと
}

export type CellRole = 'Stimulus' | 'Will' | 'Supply'

export function getCellRole(cellId: string): CellRole {
  const index = CELL_IDS.indexOf(cellId)
  const col = index % 3
  if (col === 2) return 'Stimulus'   // 右列
  if (col === 1) return 'Will'       // 中列
  return 'Supply'                     // 左列
}

export const DEFAULT_THEMES = [
  '', '', '',
  '', '', '',
  '', '', '',
]

export const CELL_IDS = Array.from({ length: 9 }, (_, i) => `cell-${i}`)

// 左→右の列ラベル（Supply・Will・Stimulus）
export const COL_LABELS: CellRole[] = ['Supply', 'Will', 'Stimulus']
