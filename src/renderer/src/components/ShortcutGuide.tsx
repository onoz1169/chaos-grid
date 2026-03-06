import { useState, useRef, useEffect, type JSX } from 'react'

export default function ShortcutGuide(): JSX.Element {
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC')
  const mod = isMac ? '\u2318\u21E7' : 'Ctrl+Shift+'

  useEffect(() => {
    if (!show) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [show])

  const shortcuts = [
    { key: 'L', label: 'Launch All' },
    { key: 'R', label: 'Reset All' },
    { key: 'G', label: 'Grid View' },
    { key: 'C', label: 'Control View' },
  ]

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn-icon"
        onClick={() => setShow(v => !v)}
        title="Keyboard shortcuts"
        style={{ fontSize: 12, color: show ? '#ccc' : '#555', padding: '0 6px' }}
      >?</button>
      {show && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0,
          background: '#111', border: '1px solid #2a2a2a',
          borderRadius: 6, padding: '10px 14px', zIndex: 100,
          minWidth: 180, display: 'flex', flexDirection: 'column', gap: 6,
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        }}>
          <div style={{ fontSize: 9, color: '#555', letterSpacing: 2, marginBottom: 2 }}>SHORTCUTS</div>
          {shortcuts.map(({ key, label }) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>{mod}{key}</span>
              <span style={{ fontSize: 11, color: '#ccc' }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
