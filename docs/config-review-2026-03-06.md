# chaos-grid 設定・CSS・構成レビュー (2026-03-06)

## レビュー対象
- `src/renderer/src/styles/global.css`
- `package.json`
- `tsconfig.json` / `tsconfig.node.json` / `tsconfig.web.json`
- `vite.config.ts`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

---

## 1. CSS (global.css)

| # | 問題 | 優先度 | 修正提案 |
|---|------|--------|----------|
| C1 | 未使用CSSクラス多数: `command-layout`, `command-terminals`, `synthesis-panel`, `synthesis-header`, `synthesis-title`, `synthesis-section`, `synthesis-label`, `synthesis-footer`, `activity-row`, `activity-dot`, `summary-row`, `summary-theme`, `summary-text`, `idea-row`, `idea-bullet`, `idea-card`, `overlay`, `overlay-grid`, `overlay-cell`, `col-headers` (計20+クラス) がどのTSX/TSファイルからも参照されていない | 高 | COMMAND mode/Synthesis panel/Overlay 関連のCSS約70行を削除するか、対応コンポーネントが今後必要なら別ファイルに分離 |
| C2 | ダークテーマのハードコードカラー値が分散: `#0a0a0a`, `#080808`, `#060606`, `#0f0f0f`, `#111`, `#1a1a1a` など微妙に異なる黒系が6種以上混在 | 中 | CSS custom properties (`--bg-primary`, `--bg-secondary` 等) に統一し、将来のテーマ切替にも対応 |
| C3 | アクセントカラー `#00ff88` がCSSとインラインstyleの両方に散在。変更時に漏れるリスク | 中 | `--accent-green: #00ff88` として一元管理 |
| C4 | `.mode-btn-active` で `!important` を2箇所使用 | 低 | セレクタ詳細度の設計で `!important` を不要にする (例: `.mode-switcher .mode-btn.active`) |
| C5 | `select` 要素のスタイルがグローバルに適用 (L146)。他のselect要素が追加されると意図しないスタイルが当たる | 低 | `.top-bar select` 等、スコープを限定 |

---

## 2. 依存関係

### フロントエンド (package.json)

| # | 問題 | 優先度 | 修正提案 |
|---|------|--------|----------|
| D1 | `@tauri-apps/plugin-notification` が依存にあるが、実際の通知機能の使用状況を確認すべき | 低 | 使用していなければ削除 |
| D2 | バージョン指定がすべてキャレット (`^`) で最新メジャーまで許容。React 19 は比較的新しく破壊的変更リスクあり | 低 | `package-lock.json` が存在するため実害は少ないが、CI環境では `npm ci` を使用すること |

### Rust (Cargo.toml)

| # | 問題 | 優先度 | 修正提案 |
|---|------|--------|----------|
| D3 | `once_cell` クレートが依存にあるが、Rustソース内で `once_cell` の `use` が存在しない。Rust 1.80+ では `std::sync::LazyLock` / `std::sync::OnceLock` が安定化済み | 中 | `once_cell` を削除し、必要なら std の同等機能に置換 |
| D4 | `tokio` の features = ["full"] は不要な機能も含む。バイナリサイズ増加要因 | 中 | 実際に使用する features のみ指定 (例: `["rt-multi-thread", "macros", "process", "io-util"]`) |
| D5 | `rust-version = "1.77.2"` は古い。Tauri 2 の最新は 1.77.2 以上を要求するが、`once_cell` 置換には 1.80+ が必要 | 低 | D3対応時に `rust-version` も更新 |

---

## 3. 設定

| # | 問題 | 優先度 | 修正提案 |
|---|------|--------|----------|
| S1 | `tauri.conf.json` の `security.csp` が `null`。CSP未設定はXSS等のリスク | 高 | 最低限 `"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"` を設定 |
| S2 | `tauri.conf.json` の `bundle.targets` が `"all"` で全プラットフォーム向けバンドル。CIビルド時間が無駄に長くなる | 中 | 開発時は対象OS限定 (例: `["dmg", "app"]`)、CIで全ターゲットビルド |
| S3 | `bundle.icon` が `["icons/icon.png"]` のみ。macOS向け `.icns`、Windows向け `.ico` が未指定 | 中 | `tauri icon` コマンドで各形式を生成し追加 |
| S4 | `vite.config.ts` に `target` 指定なし。Tauri WebView の対応範囲に合わせた target 設定が望ましい | 低 | `build.target: "es2021"` 等を追加して明示化 |
| S5 | `tsconfig.web.json` の target が `ES2020`、`tsconfig.node.json` が `ES2022`。Vite config にも target がない。ES target の一貫性がない | 低 | フロントエンドは `ES2021` に統一推奨 (Tauri WebView 対応レベル) |

---

## 4. プロジェクト構成

| # | 問題 | 優先度 | 修正提案 |
|---|------|--------|----------|
| P1 | `src/preload/index.ts` が Electron の `contextBridge` / `ipcRenderer` をインポートしている。Tauri プロジェクトなので完全に不要なデッドコード | 高 | `src/preload/` ディレクトリごと削除 |
| P2 | CSSファイルが `styles/global.css` の1ファイルに全スタイル集約 (155行)。現時点では問題ないが、コンポーネント14個に対して1ファイルはスケールしない | 低 | コンポーネント増加時に CSS Modules または コンポーネント単位の分割を検討 |
| P3 | ビルド成果物が複数箇所に残存: `dist/`, `out/`, `src/renderer/dist/`。`.gitignore` で除外されているか確認すべき | 中 | `.gitignore` に `dist/`, `out/`, `src/renderer/dist/` を追加し、既存の成果物を `git rm --cached` |

---

## 優先度別サマリ

### 高 (即対応推奨)
- S1: CSP null は本番セキュリティリスク
- P1: Electron のデッドコード (`src/preload/`) を削除
- C1: 未使用CSS 70行超の削除

### 中 (次回改善)
- C2/C3: カラー値の CSS custom properties 化
- D3: `once_cell` 削除 (std 置換)
- D4: tokio features 絞り込み
- S2/S3: バンドル設定最適化
- P3: ビルド成果物のクリーンアップ

### 低 (将来対応)
- C4/C5, D1/D2, D5, S4/S5, P2
