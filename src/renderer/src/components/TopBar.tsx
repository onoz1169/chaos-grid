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
  analyzing: boolean
  autoTimer: AutoTimer
  onAutoTimerChange: (value: AutoTimer) => void
  onAnalyze: () => void
  onLaunchAll: () => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  language: string
  onLanguageChange: (lang: string) => void
}

const MODE_LABELS: { key: ViewMode; label: string; title: string }[] = [
  { key: 'grid',    label: '⊞ GRID',    title: 'Equal-size 3×3 grid' },
  { key: 'command', label: '⌘ COMMAND', title: 'Always-on command panel' },
]

export default function TopBar({
  activeCells,
  analyzing,
  autoTimer,
  onAutoTimerChange,
  onAnalyze,
  onLaunchAll,
  viewMode,
  onViewModeChange,
  language,
  onLanguageChange,
}: TopBarProps): JSX.Element {
  return (
    <div className="top-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 'auto' }}>
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 2, color: '#00ff88' }}>
          CHAOS GRID
        </span>
        <span style={{ fontSize: 11, color: '#666', background: '#1a1a1a', padding: '2px 8px', borderRadius: 4 }}>
          {activeCells} / 9 ACTIVE
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

      {viewMode !== 'command' && (
        <button className="btn" onClick={onAnalyze} disabled={analyzing}>
          {analyzing ? 'ANALYZING...' : 'STATUS'}
        </button>
      )}

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
