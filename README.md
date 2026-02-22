# CHAOS GRID

Multi-terminal manager for running Claude Code (and other AI agents) in parallel. Built for people who thrive in chaos.

```
┌─────────────┬─────────────┬─────────────┐
│  勉強        │  ツール      │  プロダクト  │
│ claude code │ claude code │ claude code │
├─────────────┼─────────────┼─────────────┤
│  アイデア    │  分析        │  実験        │
│ claude code │ claude code │ claude code │
├─────────────┼─────────────┼─────────────┤
│ ライティング  │   AI        │  タスク      │
│ claude code │ claude code │ claude code │
└─────────────┴─────────────┴─────────────┘
         ↓ [STATUS] one press
   AI summarizes all 9 terminals at once
   + cross-theme idea suggestions
```

## Features

- **3x3 terminal grid** — 9 real terminals (PTY), each with a named theme
- **LAUNCH ALL** — sends `claude --dangerously-skip-permissions` to every terminal at once
- **STATUS** — Gemini analyzes all active terminals and returns a one-sentence summary per cell
- **Cross-theme ideas** — AI suggests combinations across your running themes (e.g. 勉強 × プロダクト → ...)
- **Auto-timer** — trigger status analysis automatically every 1 / 3 / 5 / 10 minutes
- **Editable themes** — double-click any cell header to rename

## Requirements

- macOS (Apple Silicon or Intel)
- Node.js 18+
- [Claude Code](https://github.com/anthropics/claude-code) installed (`npm i -g @anthropic-ai/claude-code`)
- Gemini API key ([get one free](https://aistudio.google.com/apikey))

## Setup

```bash
git clone https://github.com/onoz1169/chaos-grid.git
cd chaos-grid
npm install
cp .env.example .env
# Edit .env and add your Gemini API key
npm run dev
```

`.env`:
```
GEMINI_API_KEY=your_key_here
```

## Usage

| Action | How |
|--------|-----|
| Launch Claude in all terminals | Click **⚡ LAUNCH ALL** |
| Launch Claude in one terminal | Click **▶** in cell header |
| See what's happening everywhere | Click **STATUS** |
| Auto-summarize | Set timer in top bar (1 / 3 / 5 / 10 min) |
| Rename a theme | Double-click the theme name in cell header |
| Kill a terminal | Click **✕** in cell header |

## Stack

- [Electron](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/)
- [React](https://react.dev/) + TypeScript
- [xterm.js](https://xtermjs.org/) — terminal emulation
- [node-pty](https://github.com/microsoft/node-pty) — real PTY processes
- [Gemini 2.0 Flash](https://ai.google.dev/) — status summary + idea generation

## License

MIT
