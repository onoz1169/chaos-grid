import { useState, useEffect, type JSX } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface SessionEntry {
  cellId: string
  workDir: string
  toolCmd: string
}

interface SavedSession {
  entries: SessionEntry[]
  savedAt: number
}

interface Props {
  onRestore: (entries: SessionEntry[]) => void
  onDismiss: () => void
}

export default function SessionRestoreDialog({ onRestore, onDismiss }: Props): JSX.Element | null {
  const [session, setSession] = useState<SavedSession | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    invoke<SavedSession | null>('load_session_state').then((s) => {
      setSession(s)
      setChecked(true)
    }).catch(() => setChecked(true))
  }, [])

  if (!checked || !session || session.entries.length === 0) return null

  const timeAgo = (() => {
    const diff = Date.now() - session.savedAt
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  })()

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#111', border: '1px solid #00ff88',
        borderRadius: 8, padding: '24px 28px', maxWidth: 400, width: '90%',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#00ff88', marginBottom: 8, letterSpacing: 2 }}>
          RESTORE SESSION
        </div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
          Found {session.entries.length} cells from {timeAgo}. Restore all?
        </div>
        <div style={{ maxHeight: 120, overflow: 'auto', marginBottom: 16 }}>
          {session.entries.map((e) => (
            <div key={e.cellId} style={{ fontSize: 10, color: '#555', padding: '2px 0', fontFamily: 'monospace' }}>
              {e.cellId}: {e.workDir || '\u2014'}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onDismiss}
            style={{ background: 'none', border: '1px solid #333', color: '#666', padding: '6px 16px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
          >
            Skip
          </button>
          <button
            onClick={() => onRestore(session.entries)}
            style={{ background: '#001a0d', border: '1px solid #00ff88', color: '#00ff88', padding: '6px 16px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
          >
            Restore All
          </button>
        </div>
      </div>
    </div>
  )
}
