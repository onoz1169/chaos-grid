import { useState, type JSX } from 'react'

interface ActionButtonsProps {
  onLaunchAll: () => void
  onResetAll: () => void
  onBroadcast: (data: string) => void
}

export default function ActionButtons({ onLaunchAll, onResetAll, onBroadcast }: ActionButtonsProps): JSX.Element {
  const [broadcastInput, setBroadcastInput] = useState('')

  const submitBroadcast = () => {
    if (broadcastInput.trim()) {
      onBroadcast(broadcastInput + '\n')
      setBroadcastInput('')
    }
  }

  return (
    <>
      <input
        type="text"
        value={broadcastInput}
        onChange={(e) => setBroadcastInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submitBroadcast() }}
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
        disabled={!broadcastInput.trim()}
        onClick={submitBroadcast}
        style={{ color: broadcastInput.trim() ? '#ffcc00' : '#888' }}
      >&#10230; BROADCAST</button>

      <button className="btn btn-green" onClick={onLaunchAll}>⚡ LAUNCH ALL</button>
      <button className="btn" onClick={onResetAll} title="Kill all sessions">⟳ RESET ALL</button>

      <button
        className="btn-icon"
        onClick={() => window.close()}
        style={{ fontSize: 14, color: '#bbb', padding: '0 6px', flexShrink: 0 }}
        title="Close"
      >✕</button>
    </>
  )
}
