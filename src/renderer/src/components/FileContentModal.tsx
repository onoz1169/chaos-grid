import { useState, useEffect, type JSX } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { fileExt, extColor } from '../utils/files'

interface FileContentModalProps {
  path: string
  onClose: () => void
}

export default function FileContentModal({ path, onClose }: FileContentModalProps): JSX.Element {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    invoke<string>('read_file_content', { path })
      .then(setContent)
      .catch((e) => setError(String(e)))
  }, [path])

  const name = path.split('/').pop() ?? path
  const ext = fileExt(name)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#111', border: '1px solid #333',
          width: '80vw', height: '80vh',
          display: 'flex', flexDirection: 'column',
          borderRadius: 4, overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: '8px 12px', borderBottom: '1px solid #222',
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#0f0f0f', flexShrink: 0,
        }}>
          <span style={{ color: extColor(ext), fontSize: 11, fontWeight: 700 }}>.{ext}</span>
          <span style={{ color: '#ccc', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {path}
          </span>
          <button className="btn-icon" onClick={onClose} title="Close">✕</button>
        </div>
        <div style={{
          flex: 1, overflow: 'auto', padding: 16,
          fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
          fontSize: 12, lineHeight: 1.6,
          color: error ? '#ff4444' : '#ccc',
          whiteSpace: 'pre',
        }}>
          {content ?? error ?? 'Loading...'}
        </div>
      </div>
    </div>
  )
}
