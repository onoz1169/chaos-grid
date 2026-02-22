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

export type CellRole = '刺激' | '意志' | '供給'

export function getCellRole(cellId: string): CellRole {
  const index = CELL_IDS.indexOf(cellId)
  const col = index % 3
  if (col === 2) return '刺激'   // 右列
  if (col === 1) return '意志'   // 中列
  return '供給'                   // 左列
}

export const DEFAULT_THEMES = [
  '作る', '考える', '読む',       // row0: 供給, 意志, 刺激
  '動かす', '整理', '見る',       // row1
  '出す', '決める', '聴く',       // row2
]

export const CELL_IDS = Array.from({ length: 9 }, (_, i) => `cell-${i}`)

// 左→右の列ラベル（供給・意志・刺激）
export const COL_LABELS: CellRole[] = ['供給', '意志', '刺激']
