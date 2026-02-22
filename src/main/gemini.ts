import { GoogleGenerativeAI } from '@google/generative-ai'
import { CellState, AnalyzeResult } from '../shared/types'

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) throw new Error('GEMINI_API_KEY is not set. Copy .env.example to .env and add your key.')

const genAI = new GoogleGenerativeAI(apiKey)
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

export async function analyzeCells(cells: CellState[]): Promise<AnalyzeResult> {
  const cellDescriptions = cells
    .filter((c) => c.lastOutput.length > 0)
    .map((c) => {
      const output = c.lastOutput.slice(-500)
      return `[${c.id}] Theme: ${c.theme}\nRecent output:\n${output}`
    })
    .join('\n\n---\n\n')

  if (!cellDescriptions) {
    return { summaries: {}, ideas: [] }
  }

  const prompt = `You are analyzing multiple terminal sessions running in parallel.
Each session has a theme and recent terminal output.

${cellDescriptions}

Respond with JSON only (no markdown fences):
{
  "summaries": {
    "<cellId>": "1 sentence summary of what this terminal is doing"
  },
  "ideas": [
    "theme1 × theme2 → description of a cross-pollination idea"
  ]
}

Provide concise summaries and 1-3 creative cross-theme ideas based on what's happening across terminals.`

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { summaries: {}, ideas: [] }
  }

  const parsed = JSON.parse(jsonMatch[0]) as AnalyzeResult
  return {
    summaries: parsed.summaries || {},
    ideas: parsed.ideas || []
  }
}
