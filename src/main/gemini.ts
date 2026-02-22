import { GoogleGenerativeAI } from '@google/generative-ai'
import type { CellState, AnalyzeResult } from '../shared/types'
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
  const recent = history.slice(-5)  // last 5 sessions
  const lines = recent.map((entry) => {
    const date = new Date(entry.timestamp).toLocaleString('ja-JP', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    const summaries = Object.entries(entry.summaries)
      .map(([id, s]) => `  - ${entry.themes[id] || id}: ${s}`)
      .join('\n')
    const ideas = entry.ideas.map((i) => `  * ${i}`).join('\n')
    return `[${date}]\n${summaries}\nIdeas generated:\n${ideas}`
  })
  return lines.join('\n\n')
}

export async function analyzeCells(
  cells: CellState[],
  history: AnalysisEntry[]
): Promise<AnalyzeResult> {
  const activeCells = cells.filter((c) => c.lastOutput.length > 0)

  if (activeCells.length === 0) {
    return { summaries: {}, ideas: [] }
  }

  const cellDescriptions = activeCells
    .map((c) => {
      const output = c.lastOutput.slice(-800)
      return `[${c.id}] Theme: ${c.theme}\nOutput:\n${output}`
    })
    .join('\n\n---\n\n')

  const historySection = formatHistory(history)

  const prompt = `You are the CHAOS BRAIN — an AI analyzing multiple parallel work sessions to find patterns, progress, and creative connections.

${historySection ? `## ACCUMULATED HISTORY (past sessions)\n${historySection}\n\n` : ''}## CURRENT SESSION
${cellDescriptions}

## YOUR TASK
Analyze across ALL of the above (history + current) and respond with JSON only (no markdown fences):
{
  "summaries": {
    "<cellId>": "1-2 sentence summary combining current activity with relevant history"
  },
  "ideas": [
    "ThemeA × ThemeB → concrete idea building on accumulated work"
  ]
}

Rules:
- Summaries: reference past work if relevant ("Previously worked on X, now doing Y")
- Ideas: prioritize combinations that build on BOTH history and current activity
- Generate 2-4 ideas that are specific and actionable, not generic
- Respond in Japanese if themes are in Japanese`

  const result = await getModel().generateContent(prompt)
  const text = result.response.text()

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return { summaries: {}, ideas: [] }

  const parsed = JSON.parse(jsonMatch[0]) as AnalyzeResult
  return {
    summaries: parsed.summaries || {},
    ideas: parsed.ideas || [],
  }
}
