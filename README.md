# VoiceArticle

Chrome 拡張機能として動作するウェブページ読み上げツールです。

## 機能

- ウェブページのテキスト自動読み上げ
- AI 要約機能（Google Gemini API 使用）
- 多言語翻訳機能
- ダークモード対応
- ワンクリックで要約＋読み上げ
- ワンクリックで翻訳＋読み上げ

## 必要な環境

- **Node.js** (開発用)
- **Google Gemini API キー** (必須)
  - 現在は Gemini API 専用です
  - 他の AI API（OpenAI、Claude 等）には対応していません
  - API キーは[Google AI Studio](https://makersuite.google.com/app/apikey)で取得できます

## セットアップ

1. 依存関係をインストール:

   ```bash
   npm install
   ```

2. `.env.local`ファイルを作成し、Gemini API キーを設定:

   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. 開発サーバーを起動:
   ```bash
   npm run dev
   ```

## Chrome 拡張機能としてインストール

1. 拡張機能をビルド:

   ```bash
   npm run build
   ```

2. Chrome で拡張機能管理画面を開く:

   - `chrome://extensions/` にアクセス
   - 「デベロッパーモード」を有効化

3. 「パッケージ化されていない拡張機能を読み込む」をクリック

4. プロジェクトの`dist`フォルダを選択

## 使用方法

1. 読み上げたいウェブページでツールバーの VoiceArticle アイコンをクリック
2. 以下のオプションから選択:
   - **「要約して読み上げる」** - ページ内容を自動取得 →AI 要約 → 読み上げ
   - **「翻訳して読み上げる」** - ページ内容を自動取得 → 指定言語に翻訳 → 読み上げ
   - **「読み込み内容を確認」** - 取得したページ内容の確認のみ

## 対応言語

翻訳機能では以下の言語に対応:

- 英語、日本語、スペイン語、フランス語、ドイツ語
- 中国語（簡体字）、韓国語、アラビア語、ロシア語、ポルトガル語

## 技術仕様

- **フロントエンド**: React 19 + TypeScript
- **スタイリング**: Tailwind CSS
- **AI API**: Google Gemini 2.5 Flash
- **音声合成**: Web Speech API
- **ビルドツール**: esbuild

## 開発者向け情報

### プロジェクト構造

```
voicearticle-chrome-extension/
├── components/          # React コンポーネント
│   ├── ActionButton.tsx # 再利用可能なボタンコンポーネント
│   ├── Header.tsx       # アプリヘッダー
│   └── LanguageSelector.tsx # 言語選択ドロップダウン
├── services/           # 外部サービス統合
│   └── geminiService.ts # Google Gemini API 統合
├── icons/              # 拡張機能アイコン
├── constants.tsx       # 定数とSVGアイコン
├── types.ts           # TypeScript 型定義
├── manifest.json      # Chrome 拡張機能設定
├── popup.html         # 拡張機能ポップアップ
└── package.json       # プロジェクト設定
```

### 開発コマンド

```bash
# 開発モード（ファイル監視）
npm run dev

# CSS のみビルド
npm run build:css

# JavaScript のみビルド
npm run build:js

# 本番ビルド
npm run build
```

### 環境変数

| 変数名           | 説明                   | 必須 |
| ---------------- | ---------------------- | ---- |
| `GEMINI_API_KEY` | Google Gemini API キー | ✅   |

### コントリビューション

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## ライセンス

ISC License
