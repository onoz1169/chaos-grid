type AutoTimer = 'off' | '1' | '3' | '5' | '10'

interface TopBarProps {
  activeCells: number
  analyzing: boolean
  autoTimer: AutoTimer
  onAutoTimerChange: (value: AutoTimer) => void
  onAnalyze: () => void
  onLaunchAll: () => void
}

export default function TopBar({
  activeCells,
  analyzing,
  autoTimer,
  onAutoTimerChange,
  onAnalyze,
  onLaunchAll
}: TopBarProps): JSX.Element {
  return (
    <div className="top-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 'auto' }}>
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 2, color: '#00ff88' }}>
          CHAOS GRID
        </span>
        <span
          style={{
            fontSize: 11,
            color: '#666',
            background: '#1a1a1a',
            padding: '2px 8px',
            borderRadius: 4
          }}
        >
          {activeCells} / 9 ACTIVE
        </span>
      </div>

      <button className="btn btn-green" onClick={onLaunchAll}>
        &#9889; LAUNCH ALL
      </button>

      <button className="btn" onClick={onAnalyze} disabled={analyzing}>
        {analyzing ? 'ANALYZING...' : 'STATUS'}
      </button>

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
        onClick={() => window.chaosAPI.invoke('chaos:write', '', '')}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        title="Minimize"
      >
        &#8211;
      </button>
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
