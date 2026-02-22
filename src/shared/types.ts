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

export function getCellRole(cellId: string, cols: number = 3): CellRole {
  const index = parseInt(cellId.replace('cell-', ''), 10)
  const col = index % cols
  if (col === cols - 1) return 'Stimulus'
  if (col === cols - 2 && cols >= 2) return 'Will'
  return 'Supply'
}

export function getCellIds(rows: number, cols: number): string[] {
  return Array.from({ length: rows * cols }, (_, i) => `cell-${i}`)
}

export function getColLabels(cols: number): string[] {
  if (cols === 3) return ['Supply', 'Will', 'Stimulus']
  return Array.from({ length: cols }, (_, i) => {
    if (i === cols - 1) return 'Stimulus'
    if (i === cols - 2 && cols >= 2) return 'Will'
    return `Supply${cols > 3 ? ` ${i + 1}` : ''}`
  })
}

// kept for backward compat
export const CELL_IDS = getCellIds(3, 3)
export const COL_LABELS = getColLabels(3)

export const ROLE_COLORS: Record<string, string> = {
  Stimulus: '#4488bb',
  Will: '#bb8844',
  Supply: '#00ff88',
}
export function roleColor(role: string): string {
  return ROLE_COLORS[role] ?? '#888'
}
