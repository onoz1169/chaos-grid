import { useState, useRef, useEffect, type JSX } from 'react'
import type { GridPreset } from '../../../shared/types'
import AiSettings from './AiSettings'
export type CliTool = 'claude' | 'codex' | 'custom'
export const TOOL_COMMANDS: Record<Exclude<CliTool, 'custom'>, string> = { claude: 'claude --dangerously-skip-permissions', codex: 'codex' }
const LANGUAGES = [
  { code: 'English', label: 'EN' }, { code: 'Japanese', label: 'JA' }, { code: 'Chinese', label: 'ZH' }, { code: 'Korean', label: 'KO' },
  { code: 'Spanish', label: 'ES' }, { code: 'French', label: 'FR' }, { code: 'German', label: 'DE' },
]
const inp = { background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#ccc', fontFamily: 'monospace', fontSize: 11, padding: '5px 8px', outline: 'none', borderRadius: 3, width: '100%', boxSizing: 'border-box' as const }
const onF = (e: React.FocusEvent<HTMLInputElement>) => (e.currentTarget.style.borderColor = '#444')
const onB = (e: React.FocusEvent<HTMLInputElement>) => (e.currentTarget.style.borderColor = '#2a2a2a')
const lbl9 = { fontSize: 9 as const, color: '#666' }
interface FileControlsProps {
  language: string; onLanguageChange: (lang: string) => void; gridRows: number; gridCols: number; onGridChange: (r: number, c: number) => void
  outputDir: string; onOutputDirChange: (dir: string) => void; cliTool: CliTool; onCliToolChange: (tool: CliTool) => void
  customCmd: string; onCustomCmdChange: (cmd: string) => void; presets: GridPreset[]; onSavePreset: (name: string) => void
  onLoadPreset: (name: string) => void; onDeletePreset: (name: string) => void
}

export default function FileControls({ language, onLanguageChange, gridRows, gridCols, onGridChange, outputDir, onOutputDirChange, cliTool, onCliToolChange, customCmd, onCustomCmdChange, presets, onSavePreset, onLoadPreset, onDeletePreset }: FileControlsProps): JSX.Element {
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [presetName, setPresetName] = useState('')
  const [selPreset, setSelPreset] = useState('')

  useEffect(() => {
    if (!show) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setShow(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [show])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button className="btn" onClick={() => setShow((v) => !v)} title="Settings"
        style={{ fontSize: 16, padding: '0 10px', color: show ? '#fff' : '#ccc' }}>⚙</button>
      {show && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#111', border: '1px solid #2a2a2a', borderRadius: 6, padding: '14px 16px', zIndex: 100, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
          <div style={{ fontSize: 9, color: '#555', letterSpacing: 2, marginBottom: 2 }}>SETTINGS</div>

          {/* Presets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={lbl9}>PRESETS</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <input type="text" value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="preset name..."
                style={{ ...inp, padding: '4px 8px' }} onFocus={onF} onBlur={onB} />
              <button className="btn" onClick={() => { if (presetName.trim()) { onSavePreset(presetName.trim()); setPresetName('') } }}
                disabled={!presetName.trim()} style={{ fontSize: 10, color: presetName.trim() ? '#00ff88' : '#555' }}>保存</button>
            </div>
            {presets.length > 0 && (
              <div style={{ display: 'flex', gap: 4 }}>
                <select value={selPreset} onChange={(e) => setSelPreset(e.target.value)} style={{ flex: 1 }}>
                  <option value="">-- select preset --</option>
                  {presets.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
                <button className="btn" onClick={() => { if (selPreset) onLoadPreset(selPreset) }} disabled={!selPreset}
                  style={{ fontSize: 10, color: selPreset ? '#00ff88' : '#555' }}>読込</button>
                <button className="btn" onClick={() => { if (selPreset) { onDeletePreset(selPreset); setSelPreset('') } }} disabled={!selPreset}
                  style={{ fontSize: 10, color: selPreset ? '#ff4466' : '#555' }}>削除</button>
              </div>
            )}
          </div>

          {/* Output directory */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={lbl9}>OUTPUT DIRECTORY</span>
            <input type="text" value={outputDir} onChange={(e) => onOutputDirChange(e.target.value)}
              placeholder="~/chaos-grid-output" style={inp} onFocus={onF} onBlur={onB} />
          </label>

          {/* CLI Tool */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={lbl9}>CLI TOOL</span>
            <select value={cliTool} onChange={(e) => onCliToolChange(e.target.value as CliTool)} style={{ width: '100%' }}>
              <option value="claude">Claude (claude --dangerously-skip-permissions)</option>
              <option value="codex">Codex</option>
              <option value="custom">Custom...</option>
            </select>
            {cliTool === 'custom' && <input type="text" value={customCmd} onChange={(e) => onCustomCmdChange(e.target.value)}
              placeholder="command to run in each terminal" style={{ ...inp, marginTop: 4 }} onFocus={onF} onBlur={onB} />}
          </label>

          {/* Grid size */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={lbl9}>GRID SIZE</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#888' }}>
                <button className="btn-icon" onClick={() => gridRows > 1 && onGridChange(gridRows - 1, gridCols)} disabled={gridRows <= 1} style={{ color: gridRows <= 1 ? '#333' : '#888' }}>－</button>
                <span style={{ minWidth: 20, textAlign: 'center', color: '#ccc' }}>{gridRows}</span>
                <button className="btn-icon" onClick={() => gridRows < 6 && onGridChange(gridRows + 1, gridCols)} disabled={gridRows >= 6} style={{ color: gridRows >= 6 ? '#333' : '#00ff88' }}>＋</button>
                <span style={{ color: '#444' }}>rows</span>
              </div>
              <span style={{ color: '#333' }}>×</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <select value={gridCols} onChange={(e) => onGridChange(gridRows, parseInt(e.target.value))} style={{ width: 54 }}>
                  {[1, 2, 3, 4, 5].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <span style={{ fontSize: 11, color: '#666' }}>cols</span>
              </div>
            </div>
          </label>

          {/* Language */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={lbl9}>AI LANGUAGE</span>
            <select value={language} onChange={(e) => onLanguageChange(e.target.value)} style={{ width: '100%' }}>
              {LANGUAGES.map(({ code, label }) => <option key={code} value={code}>{label} — {code}</option>)}
            </select>
          </label>

          <AiSettings />
        </div>
      )}
    </div>
  )
}
