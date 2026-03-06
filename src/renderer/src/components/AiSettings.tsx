import { useState, useEffect, type JSX } from 'react'
import { invoke } from '@tauri-apps/api/core'

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

export default function AiSettings(): JSX.Element {
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
