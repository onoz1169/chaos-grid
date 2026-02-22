import { GoogleGenerativeAI } from '@google/generative-ai'
import type { CellState, AnalyzeResult } from '../shared/types'
import { getCellRole } from '../shared/types'
import type { AnalysisEntry } from './storage'

let model: ReturnType<GoogleGenerativeAI['getGenerativeModel']> | null = null

function getModel(): ReturnType<GoogleGenerativeAI['getGenerativeModel']> {
  if (!model) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY is not set. Copy .env.example to .env and add your key.')
    const genAI = new GoogleGenerativeAI(apiKey)
    model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  }
  return model
}

function formatHistory(history: AnalysisEntry[]): string {
  if (history.length === 0) return ''
  return history.slice(-5).map((entry) => {
    const date = new Date(entry.timestamp).toLocaleString('ja-JP', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    const summaries = Object.entries(entry.summaries)
      .map(([id, s]) => `  [${entry.themes[id] || id}] ${s}`)
      .join('\n')
    return `${date}\n${summaries}`
  }).join('\n\n')
}

export async function analyzeCells(
  cells: CellState[],
  history: AnalysisEntry[]
): Promise<AnalyzeResult> {

  const byCells = {
    刺激: cells.filter(c => getCellRole(c.id) === '刺激' && c.lastOutput.length > 0),
    意志: cells.filter(c => getCellRole(c.id) === '意志' && c.lastOutput.length > 0),
    供給: cells.filter(c => getCellRole(c.id) === '供給' && c.lastOutput.length > 0),
  }

  const hasAny = Object.values(byCells).some(arr => arr.length > 0)
  if (!hasAny) return { summaries: {}, ideas: [] }

  const formatCells = (arr: CellState[]) =>
    arr.map(c => `  [${c.theme}]\n${c.lastOutput.slice(-600)}`).join('\n---\n')

  const historySection = formatHistory(history)

  const prompt = `あなたは知的生産の流れを分析するAI「司令塔」です。

ユーザーの知的生産は3つのレイヤーで構成されています：
- 刺激（外から受け取る）→ 意志（自分ごとに変換）→ 供給（作って世に出す）

この縦の流れが健全に機能しているかを分析してください。

${historySection ? `## 過去のセッション履歴\n${historySection}\n` : ''}

## 現在のセッション

### 刺激レイヤー（外から何を受け取っているか）
${byCells.刺激.length > 0 ? formatCells(byCells.刺激) : '（アクティブなセルなし）'}

### 意志レイヤー（何を自分ごとにしているか）
${byCells.意志.length > 0 ? formatCells(byCells.意志) : '（アクティブなセルなし）'}

### 供給レイヤー（何を作って出しているか）
${byCells.供給.length > 0 ? formatCells(byCells.供給) : '（アクティブなセルなし）'}

## 出力形式（JSONのみ、マークダウン不要）
{
  "summaries": {
    "<cellId>": "このセルで何が起きているか1文"
  },
  "ideas": [
    "刺激×意志から生まれる具体的なアクションや発見（2〜3個）"
  ],
  "flow": {
    "stimuli_to_will": "刺激が意志に変換されているか。されていれば何に変換されたか",
    "will_to_supply": "意志が供給に落ちているか。落ちていれば何を作っているか",
    "stuck": "流れが詰まっている場所と理由（なければ「詰まりなし」）",
    "next": "今最もすべき1つのアクション"
  }
}`

  const result = await getModel().generateContent(prompt)
  const text = result.response.text()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return { summaries: {}, ideas: [] }

  const parsed = JSON.parse(jsonMatch[0]) as AnalyzeResult
  return {
    summaries: parsed.summaries || {},
    ideas: parsed.ideas || [],
    flow: parsed.flow,
  }
}
