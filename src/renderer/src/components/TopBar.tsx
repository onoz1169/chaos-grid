import { useState, useRef, useEffect, type JSX } from 'react'
import type { ViewMode } from './Grid'
import type { GridPreset } from '../../../shared/types'
import AiSettings from './AiSettings'
import ShortcutGuide from './ShortcutGuide'

export type CliTool = 'claude' | 'codex' | 'custom'

export const TOOL_COMMANDS: Record<Exclude<CliTool, 'custom'>, string> = {
  claude: 'claude --dangerously-skip-permissions',
  codex: 'codex',
}

const LANGUAGES = [
  { code: 'English', label: 'EN' },
  { code: 'Japanese', label: 'JA' },
  { code: 'Chinese', label: 'ZH' },
  { code: 'Korean', label: 'KO' },
  { code: 'Spanish', label: 'ES' },
  { code: 'French', label: 'FR' },
  { code: 'German', label: 'DE' },
]

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
  worktreeEnabled: boolean
  onWorktreeEnabledChange: (v: boolean) => void
  worktreeRepoPath: string
  onWorktreeRepoPathChange: (v: string) => void
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
  worktreeEnabled, onWorktreeEnabledChange,
  worktreeRepoPath, onWorktreeRepoPathChange,
}: TopBarProps): JSX.Element {
  const [showSettings, setShowSettings] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  const [broadcastInput, setBroadcastInput] = useState('')
  const [presetName, setPresetName] = useState('')
  const [selectedPreset, setSelectedPreset] = useState('')

  useEffect(() => {
    if (!showSettings) return
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSettings])

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

      {/* Mode switcher */}
      <div className="mode-switcher">
        {(['grid', 'control'] as ViewMode[]).map((key) => (
          <button
            key={key}
            className={`mode-btn ${viewMode === key ? 'mode-btn-active' : ''}`}
            onClick={() => onViewModeChange(key)}
          >
            {key === 'grid' ? '⊞ GRID' : '◎ CONTROL'}
          </button>
        ))}
      </div>

      {/* Broadcast input */}
      <input
        type="text"
        value={broadcastInput}
        onChange={(e) => setBroadcastInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && broadcastInput.trim()) {
            onBroadcast(broadcastInput + '\n')
            setBroadcastInput('')
          }
        }}
        placeholder="Broadcast to all..."
        style={{
          background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#ccc',
          fontFamily: 'monospace', fontSize: 11, padding: '4px 8px',
          outline: 'none', borderRadius: 3, width: 200,
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = '#444')}
        onBlur={(e) => (e.currentTarget.style.borderColor = '#2a2a2a')}
      />
      <button
        className="btn"
        disabled={!broadcastInput.trim() || activeCells === 0}
        onClick={() => {
          if (broadcastInput.trim()) {
            onBroadcast(broadcastInput + '\n')
            setBroadcastInput('')
          }
        }}
        style={{ color: broadcastInput.trim() && activeCells > 0 ? '#ffcc00' : '#555' }}
      >&#10230; BROADCAST</button>

      {/* Primary actions */}
      <button className="btn btn-green" onClick={onLaunchAll}>⚡ LAUNCH ALL</button>
      <button className="btn" onClick={onResetAll} title="Kill all sessions">⟳ RESET ALL</button>

      {/* Settings gear */}
      <div ref={settingsRef} style={{ position: 'relative' }}>
        <button
          className="btn"
          onClick={() => setShowSettings((v) => !v)}
          title="Settings"
          style={{ fontSize: 14, padding: '0 10px', color: showSettings ? '#ccc' : '#888' }}
        >
          ⚙
        </button>

        {showSettings && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            background: '#111', border: '1px solid #2a2a2a',
            borderRadius: 6, padding: '14px 16px', zIndex: 100,
            minWidth: 280, display: 'flex', flexDirection: 'column', gap: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontSize: 9, color: '#555', letterSpacing: 2, marginBottom: 2 }}>SETTINGS</div>

            {/* Presets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 9, color: '#666' }}>PRESETS</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="preset name..."
                  style={{
                    flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#ccc',
                    fontFamily: 'monospace', fontSize: 11, padding: '4px 8px',
                    outline: 'none', borderRadius: 3,
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#444')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#2a2a2a')}
                />
                <button
                  className="btn"
                  onClick={() => { if (presetName.trim()) { onSavePreset(presetName.trim()); setPresetName('') } }}
                  disabled={!presetName.trim()}
                  style={{ fontSize: 10, color: presetName.trim() ? '#00ff88' : '#555' }}
                >保存</button>
              </div>
              {presets.length > 0 && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <select
                    value={selectedPreset}
                    onChange={(e) => setSelectedPreset(e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">-- select preset --</option>
                    {presets.map((p) => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                  <button
                    className="btn"
                    onClick={() => { if (selectedPreset) onLoadPreset(selectedPreset) }}
                    disabled={!selectedPreset}
                    style={{ fontSize: 10, color: selectedPreset ? '#00ff88' : '#555' }}
                  >読込</button>
                  <button
                    className="btn"
                    onClick={() => { if (selectedPreset) { onDeletePreset(selectedPreset); setSelectedPreset('') } }}
                    disabled={!selectedPreset}
                    style={{ fontSize: 10, color: selectedPreset ? '#ff4466' : '#555' }}
                  >削除</button>
                </div>
              )}
            </div>

            {/* Output directory */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 9, color: '#666' }}>OUTPUT DIRECTORY</span>
              <input
                type="text"
                value={outputDir}
                onChange={(e) => onOutputDirChange(e.target.value)}
                placeholder="~/chaos-grid-output"
                style={{
                  background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#ccc',
                  fontFamily: 'monospace', fontSize: 11, padding: '5px 8px',
                  outline: 'none', borderRadius: 3, width: '100%', boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#444')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#2a2a2a')}
              />
            </label>

            {/* CLI Tool */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 9, color: '#666' }}>CLI TOOL</span>
              <select
                value={cliTool}
                onChange={(e) => onCliToolChange(e.target.value as CliTool)}
                style={{ width: '100%' }}
              >
                <option value="claude">Claude (claude --dangerously-skip-permissions)</option>
                <option value="codex">Codex</option>
                <option value="custom">Custom...</option>
              </select>
              {cliTool === 'custom' && (
                <input
                  type="text"
                  value={customCmd}
                  onChange={(e) => onCustomCmdChange(e.target.value)}
                  placeholder="command to run in each terminal"
                  style={{
                    background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#ccc',
                    fontFamily: 'monospace', fontSize: 11, padding: '5px 8px',
                    outline: 'none', borderRadius: 3, marginTop: 4,
                    width: '100%', boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#444')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#2a2a2a')}
                />
              )}
            </label>

            {/* Git Worktree */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 9, color: '#666', flex: 1 }}>GIT WORKTREE</span>
                <button
                  onClick={() => onWorktreeEnabledChange(!worktreeEnabled)}
                  style={{
                    background: worktreeEnabled ? '#001a0d' : '#1a1a1a',
                    border: `1px solid ${worktreeEnabled ? '#00ff88' : '#333'}`,
                    color: worktreeEnabled ? '#00ff88' : '#666',
                    fontSize: 9, padding: '2px 8px', borderRadius: 3, cursor: 'pointer',
                  }}
                >{worktreeEnabled ? 'ON' : 'OFF'}</button>
              </div>
              {worktreeEnabled && (
                <input
                  type="text"
                  value={worktreeRepoPath}
                  onChange={(e) => onWorktreeRepoPathChange(e.target.value)}
                  placeholder="Main repo path (e.g. ~/myproject)"
                  style={{
                    background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#ccc',
                    fontFamily: 'monospace', fontSize: 11, padding: '5px 8px',
                    outline: 'none', borderRadius: 3, width: '100%', boxSizing: 'border-box',
                  }}
                />
              )}
              {worktreeEnabled && (
                <span style={{ fontSize: 9, color: '#444' }}>
                  Each cell gets its own branch: chaos/cell-N-theme
                </span>
              )}
            </div>

            {/* Grid size */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 9, color: '#666' }}>GRID SIZE</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#888' }}>
                  <button
                    className="btn-icon"
                    onClick={() => gridRows > 1 && onGridChange(gridRows - 1, gridCols)}
                    disabled={gridRows <= 1}
                    style={{ color: gridRows <= 1 ? '#333' : '#888' }}
                  >－</button>
                  <span style={{ minWidth: 20, textAlign: 'center', color: '#ccc' }}>{gridRows}</span>
                  <button
                    className="btn-icon"
                    onClick={() => gridRows < 6 && onGridChange(gridRows + 1, gridCols)}
                    disabled={gridRows >= 6}
                    style={{ color: gridRows >= 6 ? '#333' : '#00ff88' }}
                  >＋</button>
                  <span style={{ color: '#444' }}>rows</span>
                </div>
                <span style={{ color: '#333' }}>×</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <select
                    value={gridCols}
                    onChange={(e) => onGridChange(gridRows, parseInt(e.target.value))}
                    style={{ width: 54 }}
                  >
                    {[1, 2, 3, 4, 5].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span style={{ fontSize: 11, color: '#666' }}>cols</span>
                </div>
              </div>
            </label>

            {/* Language */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 9, color: '#666' }}>AI LANGUAGE</span>
              <select
                value={language}
                onChange={(e) => onLanguageChange(e.target.value)}
                style={{ width: '100%' }}
              >
                {LANGUAGES.map(({ code, label }) => (
                  <option key={code} value={code}>{label} — {code}</option>
                ))}
              </select>
            </label>

            <AiSettings />
          </div>
        )}
      </div>

      {/* Shortcut guide */}
      <ShortcutGuide />

      {/* Close */}
      <button
        className="btn-icon"
        onClick={() => window.close()}
        style={{ fontSize: 12, color: '#555', padding: '0 6px' }}
        title="Close"
      >✕</button>
    </div>
  )
}
