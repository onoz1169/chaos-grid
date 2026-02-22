# CHAOS GRID

知的生産の流れを可視化する、9画面ターミナルマネージャー。

```
┌──────────────┬──────────────┬──────────────┐
│     供給      │     意志      │     刺激      │
│  (作って出す) │ (自分ごとにする)│ (外から受け取る)│
├──────────────┼──────────────┼──────────────┤
│  claude code │  claude code │  claude code │
├──────────────┼──────────────┼──────────────┤
│  claude code │  claude code │  claude code │
├──────────────┼──────────────┼──────────────┤
│  claude code │  claude code │  claude code │
└──────────────┴──────────────┴──────────────┘
                ↓ [司令塔 / 分析]
    AIが9つのターミナルを横断して分析
    流れの詰まりと次のアクションを提示
```

## コンセプト

知的生産を3つの縦レイヤーで整理する。

| レイヤー | 役割 | 列 |
|--------|------|-----|
| **刺激** | 外から情報を受け取る（リサーチ・読書・調査） | 右列 |
| **意志** | 自分ごとに変換する（思考・整理・判断） | 中列 |
| **供給** | 作って世に出す（執筆・実装・発信） | 左列 |

各セルにテーマをつけて Claude Code を走らせ、司令塔 AI（Gemini）が「どこで流れが詰まっているか」「次に何をすべきか」を教えてくれる。

## Features

- **3×3 ターミナルグリッド** — PTY による本物のターミナル 9 画面
- **LAUNCH ALL** — 全セルに `claude --dangerously-skip-permissions` を一括送信
- **司令塔（COMMAND モード）** — Gemini が全ターミナルを分析し、刺激→意志→供給の流れを診断
- **セッション永続化** — アプリを再起動しても各セルの出力と分析履歴が復元される
- **自動分析タイマー** — 1 / 3 / 5 / 10 分ごとに自動で分析を実行

## Requirements

- macOS / Windows
- [Rust](https://rustup.rs/) 1.77+
- Node.js 18+
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (`npm i -g @anthropic-ai/claude-code`)
- [Gemini API キー](https://aistudio.google.com/apikey)（無料枠あり）

## Setup

```bash
git clone https://github.com/onoz1169/chaos-grid.git
cd chaos-grid
npm install
cp .env.example .env
# .env に Gemini API キーを記入
npm run dev
```

`.env`:
```
GEMINI_API_KEY=your_key_here
```

## Usage

| 操作 | 方法 |
|------|------|
| 全セルで Claude を起動 | **⚡ LAUNCH ALL** をクリック |
| 特定セルで Claude を起動 | セルヘッダーの **▶** をクリック |
| 流れを分析する | **COMMAND** モードに切り替えて **⟳ 分析** をクリック |
| 自動分析 | トップバーのタイマーを設定（1 / 3 / 5 / 10 分） |
| テーマ名を変更 | セルヘッダーのテーマをダブルクリック |
| ターミナルを終了 | セルヘッダーの **✕** をクリック |

## Stack

- [Tauri v2](https://v2.tauri.app/) — Rust バックエンド + システム WebView（軽量、クロスプラットフォーム）
- [React](https://react.dev/) + TypeScript
- [xterm.js](https://xtermjs.org/) — ターミナルエミュレーション
- [portable-pty](https://github.com/wez/wezterm/tree/main/pty) — 本物の PTY プロセス管理
- [Gemini 2.5 Flash](https://ai.google.dev/) — 司令塔分析エンジン

## License

MIT
