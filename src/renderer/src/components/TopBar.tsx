import type { JSX } from 'react'
import type { ViewMode } from './Grid'

type AutoTimer = 'off' | '1' | '3' | '5' | '10'

export const LANGUAGES = [
  { code: 'English',    label: 'EN' },
  { code: 'Japanese',   label: 'JA' },
  { code: 'Chinese',    label: 'ZH' },
  { code: 'Korean',     label: 'KO' },
  { code: 'Spanish',    label: 'ES' },
  { code: 'French',     label: 'FR' },
  { code: 'German',     label: 'DE' },
]

interface TopBarProps {
  activeCells: number
  totalCells: number
  analyzing: boolean
  autoTimer: AutoTimer
  onAutoTimerChange: (value: AutoTimer) => void
  onAnalyze: () => void
  onLaunchAll: () => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  language: string
  onLanguageChange: (lang: string) => void
  gridRows: number
  gridCols: number
  onGridChange: (rows: number, cols: number) => void
  outputDir: string
  onOutputDirChange: (dir: string) => void
}

const MODE_LABELS: { key: ViewMode; label: string; title: string }[] = [
  { key: 'grid',    label: '⊞ GRID',    title: 'Equal-size terminal grid' },
  { key: 'output',  label: '◉ OUTPUT',  title: 'All terminal outputs at a glance' },
  { key: 'files',   label: '📁 FILES',  title: 'Browse AI output files per cell' },
  { key: 'command', label: '⌘ COMMAND', title: 'Always-on command panel' },
]

export default function TopBar({
  activeCells,
  totalCells,
  analyzing,
  autoTimer,
  onAutoTimerChange,
  onAnalyze,
  onLaunchAll,
  viewMode,
  onViewModeChange,
  language,
  onLanguageChange,
  gridRows,
  gridCols,
  onGridChange,
  outputDir,
  onOutputDirChange,
}: TopBarProps): JSX.Element {
  return (
    <div className="top-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 'auto' }}>
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 2, color: '#00ff88' }}>
          CHAOS GRID
        </span>
        <span style={{ fontSize: 11, color: '#666', background: '#1a1a1a', padding: '2px 8px', borderRadius: 4 }}>
          {activeCells} / {totalCells} ACTIVE
        </span>
      </div>

      {/* Mode switcher */}
      <div className="mode-switcher">
        {MODE_LABELS.map(({ key, label, title }) => (
          <button
            key={key}
            className={`mode-btn ${viewMode === key ? 'mode-btn-active' : ''}`}
            onClick={() => onViewModeChange(key)}
            title={title}
          >
            {label}
          </button>
        ))}
      </div>

      <button className="btn btn-green" onClick={onLaunchAll}>
        &#9889; LAUNCH ALL
      </button>

      {viewMode === 'grid' && (
        <button className="btn" onClick={onAnalyze} disabled={analyzing}>
          {analyzing ? 'ANALYZING...' : 'STATUS'}
        </button>
      )}

      {/* Grid size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#888' }}>
        <select
          value={gridRows}
          onChange={(e) => onGridChange(parseInt(e.target.value), gridCols)}
          title="Grid rows"
          style={{ width: 44 }}
        >
          {[1, 2, 3, 4, 5, 6].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <span>×</span>
        <select
          value={gridCols}
          onChange={(e) => onGridChange(gridRows, parseInt(e.target.value))}
          title="Grid cols"
          style={{ width: 44 }}
        >
          {[1, 2, 3, 4, 5].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Output directory */}
      <input
        type="text"
        value={outputDir}
        onChange={(e) => onOutputDirChange(e.target.value)}
        placeholder="~/chaos-grid-output"
        title="Output directory for AI-generated files"
        style={{
          background: '#1a1a1a', border: '1px solid #333', color: '#888',
          fontFamily: 'monospace', fontSize: 10, padding: '2px 6px',
          outline: 'none', width: 160, borderRadius: 3,
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = '#555')}
        onBlur={(e) => (e.currentTarget.style.borderColor = '#333')}
      />

      <select
        value={language}
        onChange={(e) => onLanguageChange(e.target.value)}
        title="Analysis language"
      >
        {LANGUAGES.map(({ code, label }) => (
          <option key={code} value={code}>{label}</option>
        ))}
      </select>

      <select
        value={autoTimer}
        onChange={(e) => onAutoTimerChange(e.target.value as AutoTimer)}
      >
        <option value="off">Auto: Off</option>
        <option value="1">Auto: 1min</option>
        <option value="3">Auto: 3min</option>
        <option value="5">Auto: 5min</option>
        <option value="10">Auto: 10min</option>
      </select>

      <button
        className="btn-icon"
        onClick={() => window.close()}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        title="Close"
      >
        &#10005;
      </button>
    </div>
  )
}
