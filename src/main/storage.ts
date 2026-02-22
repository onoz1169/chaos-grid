import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import type { AnalyzeResult } from '../shared/types'

const DATA_DIR = join(app.getPath('userData'), 'chaos-grid')
const OUTPUTS_FILE = join(DATA_DIR, 'cell-outputs.json')
const HISTORY_FILE = join(DATA_DIR, 'analysis-history.json')
const MAX_HISTORY = 20  // keep last 20 analyses

export interface AnalysisEntry {
  timestamp: string
  summaries: Record<string, string>
  themes: Record<string, string>  // cellId -> theme at time of analysis
  ideas: string[]
}

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
}

// Cell output persistence
export function loadCellOutputs(): Record<string, string> {
  try {
    if (!existsSync(OUTPUTS_FILE)) return {}
    return JSON.parse(readFileSync(OUTPUTS_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

export function saveCellOutput(cellId: string, buffer: string): void {
  try {
    ensureDir()
    const all = loadCellOutputs()
    all[cellId] = buffer.slice(-5000)  // keep last 5000 chars per cell
    writeFileSync(OUTPUTS_FILE, JSON.stringify(all))
  } catch {
    // ignore write errors
  }
}

// Analysis history
export function loadAnalysisHistory(): AnalysisEntry[] {
  try {
    if (!existsSync(HISTORY_FILE)) return []
    return JSON.parse(readFileSync(HISTORY_FILE, 'utf-8'))
  } catch {
    return []
  }
}

export function saveAnalysis(result: AnalyzeResult, themes: Record<string, string>): void {
  try {
    ensureDir()
    const history = loadAnalysisHistory()
    const entry: AnalysisEntry = {
      timestamp: new Date().toISOString(),
      summaries: result.summaries,
      themes,
      ideas: result.ideas,
    }
    history.push(entry)
    // keep last N
    const trimmed = history.slice(-MAX_HISTORY)
    writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2))
  } catch {
    // ignore write errors
  }
}
