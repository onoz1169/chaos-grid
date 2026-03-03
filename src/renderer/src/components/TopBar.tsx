import { useState, useRef, useEffect, type JSX } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { ViewMode } from './Grid'

// ─── AI Provider config ───────────────────────────────────────────────────────

interface AiConfig {
  provider: string
  geminiKey: string
  openaiKey: string
  anthropicKey: string
  model: string | null
  ollamaUrl: string
}

const PROVIDERS = [
  { value: 'gemini', label: 'Gemini (Google)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'ollama', label: 'Ollama (Local)' },
]

// 2026-03 時点の代表モデル
const PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  gemini: [
    { value: '', label: 'gemini-2.0-flash (default)' },
    { value: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
    { value: 'gemini-2.5-pro', label: 'gemini-2.5-pro' },
    { value: 'gemini-2.0-flash-lite', label: 'gemini-2.0-flash-lite' },
    { value: '__custom__', label: 'Custom...' },
  ],
  openai: [
    { value: '', label: 'gpt-4o-mini (default)' },
    { value: 'gpt-4o', label: 'gpt-4o' },
    { value: 'gpt-4.5-preview', label: 'gpt-4.5-preview' },
    { value: 'o3-mini', label: 'o3-mini' },
    { value: 'o1', label: 'o1' },
    { value: '__custom__', label: 'Custom...' },
  ],
  anthropic: [
    { value: '', label: 'claude-haiku-4-5 (default)' },
    { value: 'claude-sonnet-4-6', label: 'claude-sonnet-4-6' },
    { value: 'claude-opus-4-6', label: 'claude-opus-4-6' },
    { value: 'claude-3-5-sonnet-latest', label: 'claude-3-5-sonnet-latest' },
    { value: '__custom__', label: 'Custom...' },
  ],
  ollama: [
    { value: '', label: 'llama3.3 (default)' },
    { value: 'llama3.2', label: 'llama3.2' },
    { value: 'qwen2.5', label: 'qwen2.5' },
    { value: 'deepseek-r1', label: 'deepseek-r1' },
    { value: 'mistral', label: 'mistral' },
    { value: 'codellama', label: 'codellama' },
    { value: '__custom__', label: 'Custom...' },
  ],
}

const inputStyle: React.CSSProperties = {
  background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#ccc',
  fontFamily: 'monospace', fontSize: 11, padding: '5px 8px',
  outline: 'none', borderRadius: 3, width: '100%', boxSizing: 'border-box',
}

function AiSettings(): JSX.Element {
  const [config, setConfig] = useState<AiConfig>({
    provider: 'gemini', geminiKey: '', openaiKey: '', anthropicKey: '',
    model: null, ollamaUrl: 'http://localhost:11434',
  })
  const [customModel, setCustomModel] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    invoke<AiConfig>('get_ai_config').then((c) => {
      setConfig(c)
      const models = PROVIDER_MODELS[c.provider] ?? []
      const isCustom = c.model && !models.some((m) => m.value === c.model)
      if (isCustom) setCustomModel(c.model ?? '')
    }).catch(() => {})
  }, [])

  const models = PROVIDER_MODELS[config.provider] ?? []
  const dropdownVal = () => {
    if (!config.model) return ''
    if (models.some((m) => m.value === config.model)) return config.model
    return '__custom__'
  }

  const handleSave = async () => {
    const finalModel = dropdownVal() === '__custom__'
      ? (customModel.trim() || null)
      : (config.model || null)
    const toSave = { ...config, model: finalModel }
    try {
      await invoke('set_ai_config', { config: toSave })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      alert(String(e))
    }
  }

  const keyField = (label: string, value: string, onChange: (v: string) => void) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 9, color: '#666' }}>{label}</span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="sk-..."
        style={inputStyle}
        onFocus={(e) => (e.currentTarget.style.borderColor = '#444')}
        onBlur={(e) => (e.currentTarget.style.borderColor = '#2a2a2a')}
      />
    </label>
  )

  return (
    <>
      {/* Divider */}
      <div style={{ borderTop: '1px solid #1e1e1e', margin: '2px 0' }} />
      <div style={{ fontSize: 9, color: '#555', letterSpacing: 2 }}>AI PROVIDER</div>

      {/* Provider */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 9, color: '#666' }}>PROVIDER</span>
        <select
          value={config.provider}
          onChange={(e) => setConfig({ ...config, provider: e.target.value, model: null })}
          style={{ width: '100%' }}
        >
          {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </label>

      {/* API Key (per provider) */}
      {config.provider === 'gemini' && keyField('GEMINI API KEY', config.geminiKey, (v) => setConfig({ ...config, geminiKey: v }))}
      {config.provider === 'openai' && keyField('OPENAI API KEY', config.openaiKey, (v) => setConfig({ ...config, openaiKey: v }))}
      {config.provider === 'anthropic' && keyField('ANTHROPIC API KEY', config.anthropicKey, (v) => setConfig({ ...config, anthropicKey: v }))}

      {/* Ollama URL */}
      {config.provider === 'ollama' && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 9, color: '#666' }}>OLLAMA URL</span>
          <input
            type="text"
            value={config.ollamaUrl}
            onChange={(e) => setConfig({ ...config, ollamaUrl: e.target.value })}
            style={inputStyle}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#444')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#2a2a2a')}
          />
        </label>
      )}

      {/* Model */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 9, color: '#666' }}>MODEL</span>
        <select
          value={dropdownVal()}
          onChange={(e) => {
            const v = e.target.value
            if (v === '__custom__') {
              setConfig({ ...config, model: customModel || null })
            } else {
              setConfig({ ...config, model: v || null })
            }
          }}
          style={{ width: '100%' }}
        >
          {models.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        {dropdownVal() === '__custom__' && (
          <input
            type="text"
            value={customModel}
            onChange={(e) => { setCustomModel(e.target.value); setConfig({ ...config, model: e.target.value }) }}
            placeholder="model name"
            style={{ ...inputStyle, marginTop: 4 }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#444')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#2a2a2a')}
          />
        )}
      </label>

      {/* Save */}
      <button
        onClick={handleSave}
        style={{
          background: saved ? '#1a3a2a' : '#1a2a1a', border: `1px solid ${saved ? '#00ff88' : '#2a3a2a'}`,
          color: saved ? '#00ff88' : '#4a8a4a', fontSize: 11, padding: '5px 0',
          borderRadius: 3, cursor: 'pointer', fontFamily: 'monospace',
        }}
      >
        {saved ? '✓ SAVED' : 'SAVE'}
      </button>
    </>
  )
}

export type CliTool = 'claude' | 'codex' | 'custom'

export const TOOL_COMMANDS: Record<Exclude<CliTool, 'custom'>, string> = {
  claude: 'claude --dangerously-skip-permissions',
  codex: 'codex',
}

const LANGUAGES = [
  { code: 'English', label: 'EN' },
  { code: 'Japanese', label: 'JA' },
  { code: 'Chinese', label: 'ZH' },
  { code: 'Korean', label: 'KO' },
  { code: 'Spanish', label: 'ES' },
  { code: 'French', label: 'FR' },
  { code: 'German', label: 'DE' },
]

interface TopBarProps {
  activeCells: number
  totalCells: number
  onLaunchAll: () => void
  onResetAll: () => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  language: string
  onLanguageChange: (lang: string) => void
  gridRows: number
  gridCols: number
  onGridChange: (rows: number, cols: number) => void
  outputDir: string
  onOutputDirChange: (dir: string) => void
  cliTool: CliTool
  onCliToolChange: (tool: CliTool) => void
  customCmd: string
  onCustomCmdChange: (cmd: string) => void
}

export default function TopBar({
  activeCells, totalCells, onLaunchAll, onResetAll,
  viewMode, onViewModeChange,
  language, onLanguageChange,
  gridRows, gridCols, onGridChange,
  outputDir, onOutputDirChange,
  cliTool, onCliToolChange,
  customCmd, onCustomCmdChange,
}: TopBarProps): JSX.Element {
  const [showSettings, setShowSettings] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showSettings) return
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSettings])

  return (
    <div className="top-bar">
      {/* Left: logo + active count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 'auto' }}>
        <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 2, color: '#00ff88' }}>
          CHAOS GRID
        </span>
        <span style={{ fontSize: 11, color: '#555', background: '#141414', padding: '2px 8px', borderRadius: 4 }}>
          {activeCells}/{totalCells}
        </span>
      </div>

      {/* Mode switcher */}
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

      {/* Primary actions */}
      <button className="btn btn-green" onClick={onLaunchAll}>⚡ LAUNCH ALL</button>
      <button className="btn" onClick={onResetAll} title="Kill all sessions">⟳ RESET ALL</button>

      {/* Settings gear */}
      <div ref={settingsRef} style={{ position: 'relative' }}>
        <button
          className="btn"
          onClick={() => setShowSettings((v) => !v)}
          title="Settings"
          style={{ fontSize: 14, padding: '0 10px', color: showSettings ? '#ccc' : '#888' }}
        >
          ⚙
        </button>

        {showSettings && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0,
            background: '#111', border: '1px solid #2a2a2a',
            borderRadius: 6, padding: '14px 16px', zIndex: 100,
            minWidth: 280, display: 'flex', flexDirection: 'column', gap: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontSize: 9, color: '#555', letterSpacing: 2, marginBottom: 2 }}>SETTINGS</div>

            {/* Output directory */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 9, color: '#666' }}>OUTPUT DIRECTORY</span>
              <input
                type="text"
                value={outputDir}
                onChange={(e) => onOutputDirChange(e.target.value)}
                placeholder="~/chaos-grid-output"
                style={{
                  background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#ccc',
                  fontFamily: 'monospace', fontSize: 11, padding: '5px 8px',
                  outline: 'none', borderRadius: 3, width: '100%', boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = '#444')}
                onBlur={(e) => (e.currentTarget.style.borderColor = '#2a2a2a')}
              />
            </label>

            {/* CLI Tool */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 9, color: '#666' }}>CLI TOOL</span>
              <select
                value={cliTool}
                onChange={(e) => onCliToolChange(e.target.value as CliTool)}
                style={{ width: '100%' }}
              >
                <option value="claude">Claude (claude --dangerously-skip-permissions)</option>
                <option value="codex">Codex</option>
                <option value="custom">Custom...</option>
              </select>
              {cliTool === 'custom' && (
                <input
                  type="text"
                  value={customCmd}
                  onChange={(e) => onCustomCmdChange(e.target.value)}
                  placeholder="command to run in each terminal"
                  style={{
                    background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#ccc',
                    fontFamily: 'monospace', fontSize: 11, padding: '5px 8px',
                    outline: 'none', borderRadius: 3, marginTop: 4,
                    width: '100%', boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#444')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '#2a2a2a')}
                />
              )}
            </label>

            {/* Grid size */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 9, color: '#666' }}>GRID SIZE</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#888' }}>
                  <button
                    className="btn-icon"
                    onClick={() => gridRows > 1 && onGridChange(gridRows - 1, gridCols)}
                    disabled={gridRows <= 1}
                    style={{ color: gridRows <= 1 ? '#333' : '#888' }}
                  >－</button>
                  <span style={{ minWidth: 20, textAlign: 'center', color: '#ccc' }}>{gridRows}</span>
                  <button
                    className="btn-icon"
                    onClick={() => gridRows < 6 && onGridChange(gridRows + 1, gridCols)}
                    disabled={gridRows >= 6}
                    style={{ color: gridRows >= 6 ? '#333' : '#00ff88' }}
                  >＋</button>
                  <span style={{ color: '#444' }}>rows</span>
                </div>
                <span style={{ color: '#333' }}>×</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <select
                    value={gridCols}
                    onChange={(e) => onGridChange(gridRows, parseInt(e.target.value))}
                    style={{ width: 54 }}
                  >
                    {[1, 2, 3, 4, 5].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span style={{ fontSize: 11, color: '#666' }}>cols</span>
                </div>
              </div>
            </label>

            {/* Language */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 9, color: '#666' }}>AI LANGUAGE</span>
              <select
                value={language}
                onChange={(e) => onLanguageChange(e.target.value)}
                style={{ width: '100%' }}
              >
                {LANGUAGES.map(({ code, label }) => (
                  <option key={code} value={code}>{label} — {code}</option>
                ))}
              </select>
            </label>

            <AiSettings />
          </div>
        )}
      </div>

      {/* Close */}
      <button
        className="btn-icon"
        onClick={() => window.close()}
        style={{ fontSize: 12, color: '#555', padding: '0 6px' }}
        title="Close"
      >✕</button>
    </div>
  )
}
