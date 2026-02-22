import { BrowserWindow, ipcMain } from 'electron'
import { CellState, DEFAULT_THEMES, CELL_IDS } from '../shared/types'
import { spawnPty, writePty, resizePty, killPty, getBuffer, hasPty, sendCommand } from './ptyManager'
import { analyzeCells } from './gemini'
import { loadCellOutputs, saveCellOutput, loadAnalysisHistory, saveAnalysis } from './storage'

const cellStates = new Map<string, CellState>()

function initCellStates(): void {
  const savedOutputs = loadCellOutputs()
  CELL_IDS.forEach((id, i) => {
    cellStates.set(id, {
      id,
      theme: DEFAULT_THEMES[i] || 'General',
      pid: null,
      lastOutput: savedOutputs[id] || '',  // restore previous output
      status: 'idle',
      updatedAt: Date.now()
    })
  })
}

export function setupIPC(mainWindow: BrowserWindow): void {
  initCellStates()

  ipcMain.handle('chaos:spawn', async (_event, cellId: string, cols: number, rows: number) => {
    const pid = spawnPty(cellId, cols, rows, (data: string) => {
      mainWindow.webContents.send('chaos:pty-data', cellId, data)
      const state = cellStates.get(cellId)
      if (state) {
        state.lastOutput = getBuffer(cellId)
        state.status = 'active'
        state.updatedAt = Date.now()
        // persist output every time buffer updates
        saveCellOutput(cellId, state.lastOutput)
      }
    })

    const state = cellStates.get(cellId)
    if (state) {
      state.pid = pid
      state.status = 'active'
      state.updatedAt = Date.now()
    }

    return pid
  })

  ipcMain.handle('chaos:write', async (_event, cellId: string, data: string) => {
    writePty(cellId, data)
  })

  ipcMain.handle('chaos:resize', async (_event, cellId: string, cols: number, rows: number) => {
    resizePty(cellId, cols, rows)
  })

  ipcMain.handle('chaos:kill', async (_event, cellId: string) => {
    killPty(cellId)
    const state = cellStates.get(cellId)
    if (state) {
      state.pid = null
      state.status = 'idle'
      state.updatedAt = Date.now()
    }
  })

  ipcMain.handle('chaos:analyze', async () => {
    const cells = Array.from(cellStates.values())
    const history = loadAnalysisHistory()
    const result = await analyzeCells(cells, history)

    // Save this analysis to history
    const themes: Record<string, string> = {}
    cells.forEach((c) => { themes[c.id] = c.theme })
    saveAnalysis(result, themes)

    return result
  })

  ipcMain.handle('chaos:get-cells', async () => {
    return Array.from(cellStates.values())
  })

  ipcMain.handle('chaos:set-theme', async (_event, cellId: string, theme: string) => {
    const state = cellStates.get(cellId)
    if (state) {
      state.theme = theme
      state.updatedAt = Date.now()
    }
  })

  const DEFAULT_COLS = 80
  const DEFAULT_ROWS = 24
  const SHELL_READY_DELAY = 500
  const LAUNCH_COMMAND = 'claude --dangerously-skip-permissions\n'

  async function ensureSpawnAndSend(cellId: string): Promise<boolean> {
    if (!hasPty(cellId)) {
      spawnPty(cellId, DEFAULT_COLS, DEFAULT_ROWS, (data: string) => {
        mainWindow.webContents.send('chaos:pty-data', cellId, data)
        const state = cellStates.get(cellId)
        if (state) {
          state.lastOutput = getBuffer(cellId)
          state.status = 'active'
          state.updatedAt = Date.now()
          saveCellOutput(cellId, state.lastOutput)
        }
      })
      const state = cellStates.get(cellId)
      if (state) {
        state.status = 'active'
        state.updatedAt = Date.now()
      }
      await new Promise((r) => setTimeout(r, SHELL_READY_DELAY))
    }
    sendCommand(cellId, LAUNCH_COMMAND)
    return true
  }

  ipcMain.handle('chaos:launch-cell', async (_event, cellId: string) => {
    await ensureSpawnAndSend(cellId)
  })

  ipcMain.handle('chaos:launch-all', async () => {
    const launched: string[] = []
    for (const cellId of CELL_IDS) {
      await ensureSpawnAndSend(cellId)
      launched.push(cellId)
    }
    return launched
  })
}
