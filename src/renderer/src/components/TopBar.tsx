import type { JSX } from 'react'
import type { ViewMode } from './Grid'
import type { GridPreset } from '../../../shared/types'
import ViewControls from './ViewControls'
import ActionButtons from './ActionButtons'
import FileControls from './FileControls'
import ShortcutGuide from './ShortcutGuide'

import type { CliTool } from './FileControls'
export type { CliTool }
export { TOOL_COMMANDS } from './FileControls'

interface TopBarProps {
  activeCells: number
  totalCells: number
  onLaunchAll: () => void
  onResetAll: () => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  language: string
  onLanguageChange: (lang: string) => void
  gridRows: number
  gridCols: number
  onGridChange: (rows: number, cols: number) => void
  outputDir: string
  onOutputDirChange: (dir: string) => void
  cliTool: CliTool
  onCliToolChange: (tool: CliTool) => void
  customCmd: string
  onCustomCmdChange: (cmd: string) => void
  presets: GridPreset[]
  onSavePreset: (name: string) => void
  onLoadPreset: (name: string) => void
  onDeletePreset: (name: string) => void
  onBroadcast: (data: string) => void
}

export default function TopBar({
  activeCells, totalCells, onLaunchAll, onResetAll,
  viewMode, onViewModeChange,
  language, onLanguageChange,
  gridRows, gridCols, onGridChange,
  outputDir, onOutputDirChange,
  cliTool, onCliToolChange,
  customCmd, onCustomCmdChange,
  presets, onSavePreset, onLoadPreset, onDeletePreset,
  onBroadcast,
}: TopBarProps): JSX.Element {
  return (
    <div className="top-bar">
      {/* Left: logo + active count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 'auto' }}>
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 2, color: '#00ff88' }}>
          CHAOS GRID
        </span>
        <span style={{ fontSize: 11, color: '#555', background: '#141414', padding: '2px 8px', borderRadius: 4 }}>
          {activeCells}/{totalCells}
        </span>
      </div>

      <ViewControls viewMode={viewMode} onViewModeChange={onViewModeChange} />

      <ActionButtons onLaunchAll={onLaunchAll} onResetAll={onResetAll} onBroadcast={onBroadcast} />

      <FileControls
        language={language} onLanguageChange={onLanguageChange}
        gridRows={gridRows} gridCols={gridCols} onGridChange={onGridChange}
        outputDir={outputDir} onOutputDirChange={onOutputDirChange}
        cliTool={cliTool} onCliToolChange={onCliToolChange}
        customCmd={customCmd} onCustomCmdChange={onCustomCmdChange}
        presets={presets} onSavePreset={onSavePreset}
        onLoadPreset={onLoadPreset} onDeletePreset={onDeletePreset}
      />

      <ShortcutGuide />
    </div>
  )
}
