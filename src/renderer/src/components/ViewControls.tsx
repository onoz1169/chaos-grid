import type { JSX } from 'react'
import type { ViewMode } from './Grid'

interface ViewControlsProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
}

export default function ViewControls({ viewMode, onViewModeChange }: ViewControlsProps): JSX.Element {
  return (
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
  )
}
