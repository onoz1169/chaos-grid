import { useMemo, type JSX } from 'react'
import type { CellState } from '../../../shared/types'

export default function AgentStatusBar({ cellStates }: { cellStates: Record<string, CellState> }): JSX.Element | null {
  const counts = useMemo(() => {
    const vals = Object.values(cellStates)
    return {
      active: vals.filter((c) => c.status === 'active').length,
      thinking: vals.filter((c) => c.status === 'thinking').length,
    }
  }, [cellStates])
  const running = counts.active + counts.thinking
  if (running === 0) return null
  return (
    <div style={{
      padding: '3px 14px', borderBottom: '1px solid #141414',
      display: 'flex', alignItems: 'center', gap: 10,
      background: '#050f07', flexShrink: 0,
    }}>
      {counts.thinking > 0 && <span style={{ fontSize: 10, color: '#ffcc00' }}>◎ {counts.thinking} thinking</span>}
      {counts.active > 0 && <span style={{ fontSize: 10, color: '#00ff88' }}>● {counts.active} active</span>}
    </div>
  )
}
