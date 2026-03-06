export interface GridPreset {
  name: string
  gridRows: number
  gridCols: number
  outputDir: string
  cliTool: string
  customCmd: string
}

export interface CellState {
  id: string
  theme: string
  pid: number | null
  lastOutput: string
  status: 'idle' | 'active' | 'thinking'
  updatedAt: number
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

export const ROLE_COLORS: Record<string, string> = {
  Stimulus: '#55bbff',
  Will: '#00ff88',
  Supply: '#ff4466',
}
export function roleColor(role: string): string {
  return ROLE_COLORS[role] ?? '#888'
}

export function cellWorkDir(
  cellId: string,
  cellState: CellState | undefined,
  outputDir: string,
  gridCols: number
): string {
  const theme = cellState?.theme
  const role = getCellRole(cellId, gridCols).toLowerCase()
  const base = outputDir.replace(/\/+$/, '')
  return theme ? `${base}/${role}/${theme}` : `${base}/${role}`
}
