# chaos-grid 改善レポート (2026-03-06)

4並列レビュー（フロントエンド/Rustバックエンド/共有型・フック/CSS・設定）の統合結果。

## 高優先度

| # | 領域 | 問題 | 修正提案 |
|---|------|------|----------|
| 1 | Rust | コマンドインジェクション: `make_launch_command` で `work_dir`/`tool_cmd` をシェル文字列にそのまま展開 | `tool_cmd` を許可リストで制御、`work_dir` をパス正規化+バリデーション |
| 2 | Rust | パストラバーサル: `read_file_content`/`open_file` が任意パスのファイルを読める | 許可ディレクトリのホワイトリスト、canonical path チェック |
| 3 | Tauri設定 | CSP未設定 (`security.csp: null`): XSSリスク | 最低限の CSP ポリシーを設定 |
| 4 | Frontend | Cell.tsx: Terminal の useEffect 依存配列不備。PTYリークの可能性 | 依存配列の修正、クリーンアップでPTY kill |
| 5 | Frontend | Grid.tsx: `createRef()` がレンダー本体で毎回呼ばれ、refs が毎レンダーで再生成 | `useRef` + Map パターンに変更 |
| 6 | 構成 | Electron デッドコード: `src/preload/index.ts` が Electron API をインポート。Tauri では不要 | `src/preload/` ディレクトリごと削除 |

## 中優先度

| # | 領域 | 問題 | 修正提案 |
|---|------|------|----------|
| 7 | Rust | `gemini.rs` (472行) がデッドファイル。mod宣言なし | ファイル削除 |
| 8 | Rust | Mutex の `unwrap()` が一貫性なし。poison時にpanicする箇所あり | `map_err` でエラー変換に統一 |
| 9 | Rust | `storage::save_cell_output` が毎回ファイル全体をread+write。高頻度I/O | debounce導入（1秒間隔でフラッシュ） |
| 10 | Rust | `save_cell_output` のバッファスライスがUTF-8境界未考慮。マルチバイト文字でpanic | `is_char_boundary` チェック追加 |
| 11 | Frontend | App.tsx のセッション保存が `cellStates` 変更のたびに発火 | debounce（2-3秒）を追加 |
| 12 | Frontend | `activeCells` が `Date.now()` ベースだが定期再評価タイマーなし | `setInterval` で定期更新 |
| 13 | Frontend | OutputView が view 切り替えで destroy/recreate。スクロール位置等が失われる | display:none パターンに変更（Grid と同様） |
| 14 | Frontend | TaskQueue の React state と localStorage の二重管理 | `useLocalStorage` フックに統一 |
| 15 | 共有型 | `STATUS_COLOR` (status.ts) と `STATUS_COLORS` (CellHeader.tsx) が重複定義。idle の色が `#333` vs `#444` で不一致 | status.ts に統一して一箇所から参照 |
| 16 | 共有型 | `ROLE_COLORS` が `Record<string, string>` で `CellRole` 型を使っていない | `Record<CellRole, string>` に修正 |
| 17 | 共有型 | `usePtyOutput` の `rawOutputRef` が無制限に肥大化する可能性 | 上限設定（例: 100KB）で切り詰め |
| 18 | CSS | 未使用CSS約70行（COMMAND mode、Synthesis panel、Overlay関連） | 使われていないクラスを削除 |
| 19 | CSS | ダークテーマのカラー値が6種以上の黒系にハードコード分散 | CSS custom properties に統一 |
| 20 | Rust | `reqwest::Client` を毎回生成。コネクションプール不活用 | Tauri State として1つ共有 |

## 低優先度

| # | 領域 | 問題 |
|---|------|------|
| 21 | Rust | `lib.rs` が506行（上限超過）。PTYコマンドを分離すべき |
| 22 | Rust | `cpu_for_tree` が sync I/O。`spawn_blocking` でラップ推奨 |
| 23 | Rust | `get_git_diff` の hash 長さ制限なし |
| 24 | Rust | Gemini API key が URL クエリパラメータに含まれる。ヘッダー方式に変更推奨 |
| 25 | 共有型 | `AnalyzeResult`/`FlowAnalysis` が未使用エクスポート |
| 26 | 共有型 | `CELL_IDS`/`COL_LABELS` の未使用定数 |
| 27 | 共有型 | `roleColor()` 関数と `ROLE_COLORS` 直接参照の使い分けが不統一 |
| 28 | Frontend | インラインスタイルが大量。毎レンダーで新規オブジェクト生成 |
| 29 | CSS | `!important` の使用 |
| 30 | 設定 | `tokio` の `features = ["full"]` がバイナリサイズ膨張 |
| 31 | 設定 | ビルド成果物が複数箇所に残存 (`dist/`, `out/`, `src/renderer/dist/`) |

## 推奨対応順

1. セキュリティ (#1, #2, #3): コマンドインジェクション・パストラバーサル・CSP
2. バグ修正 (#4, #5, #10, #15): PTYリーク・refs再生成・panic・色不一致
3. デッドコード削除 (#6, #7, #18, #25, #26): gemini.rs・preload・未使用CSS・未使用型
4. パフォーマンス (#9, #11, #17, #20): I/O debounce・セッション保存throttle
5. コード品質 (#8, #16, #19, #21): Mutex統一・型安全性・CSS変数・ファイル分割
