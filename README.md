# PuruPet Desktop

<p align="center"><strong>PuruPuru PNGTuberを、会話・音声・Codex作業に対応したWindowsデスクトップペットへ。</strong></p>
<p align="center"><strong>An unofficial Windows desktop-pet extension of PuruPuru PNGTuber.</strong></p>

<p align="center">
  <img alt="License: Apache-2.0" src="https://img.shields.io/badge/code-Apache--2.0-blue">
  <img alt="Platform: Windows" src="https://img.shields.io/badge/platform-Windows-0078D4">
  <img alt="Desktop: Electron" src="https://img.shields.io/badge/desktop-Electron-47848F">
  <img alt="Status: pre-release" src="https://img.shields.io/badge/status-pre--release-orange">
</p>

<p align="center">
  <img src="./docs/images/purupet-work-mode.png" alt="PuruPet Desktopの透過アバターと作業モード" width="520">
</p>

PuruPet Desktopは、[rotejin/PuruPuruPNGTuber](https://github.com/rotejin/PuruPuruPNGTuber)を基にした非公式派生アプリです。透過アバターをデスクトップへ常駐させ、キャラクターとの会話、音声入出力、Codex app-serverによる作業、一枚絵からのキャラクター追加を同じ小さなUIから利用できます。

This project is not endorsed by or affiliated with the original PuruPuru PNGTuber developer.

> [!WARNING]
> このリポジトリは公開準備中です。コードはApache-2.0ですが、同梱キャラクター画像は別条件です。公開・フォーク・配布の前に、画像の複製・加工・配布に必要な権利を必ず確認してください。詳しくは[ライセンスと素材](#ライセンスと素材)を参照してください。

## 主な機能

- 透過・最前面のWindowsデスクトップアバター
- 呼吸、まばたき、髪揺れ、待機視線、マウス追従、音量リップシンク
- キャラクターに近い吹き出しへのストリーミング応答
- Codex app-serverのChatGPTログイン、またはOpenAI APIによる会話
- Codex Realtime音声を優先し、未提供時は端末音声認識へ自動フォールバック
- 設定画面を開かずに切り替えられる`会話 / 作業`モード
- 選択した1フォルダーだけを書き込み可能にするCodex workspace-write作業
- 一枚絵から目・口・髪の標準差分、性格、話し方を作るCodex Avatar Studio
- キャラクターごとの表示サイズ、可動範囲、性格、吹き出し位置設定
- 画面端への吸着、位置ロック、マルチモニター対応
- PuruPuruのブラウザー編集画面とOBS向け透過表示

## 収録キャラクター

デスクトップ版には次の3キャラクターだけを収録します。

- 琥珀（`assets/amber-avatar`）
- セピア（`assets/bronze-avatar`）
- ルナ（`assets/silver-hood-avatar`）

それぞれ通常の目・口差分に加え、嬉しい・驚き・やさしい表情差分を持ちます。画像の利用条件は[DISTRIBUTION_ASSET_LICENSE.md](./DISTRIBUTION_ASSET_LICENSE.md)を確認してください。

## 必要環境

- Windows 10/11 x64
- Node.js 22以降
- npm
- Codex機能を使う場合は、ログイン可能な[Codex CLI](https://github.com/openai/codex)
- Python系の開発チェックを実行する場合のみPython 3.11と[uv](https://docs.astral.sh/uv/)

OpenAI API接続は任意です。APIキーを使わず、Codex CLIのChatGPTログインだけでも会話と作業を利用できます。

## 開発版を起動する

```bash
npm ci
npm run desktop
```

初回起動では次を設定します。

1. ChatGPTログイン、またはOpenAI API接続
2. キャラクター選択
3. 音声出力確認

Windows Store版Codexも自動検出します。`codex`が`PATH`にない場合は、`CODEX_CLI_PATH`で実行ファイルを指定できます。

## デスクトップから会話・作業する

1. キャラクター右下の`✦`へマウスを重ねるかクリックします。
2. 小さな入力欄からそのまま会話できます。
3. 入力欄左端の`会話`を押すと`作業`へ切り替わります。
4. 初回だけWindowsのフォルダー選択で作業先を指定します。
5. 作業先チップを押すとフォルダーを変更でき、`作業`を押すと会話へ戻ります。

会話モードのCodexスレッドはread-onlyです。作業モードは利用者が選んだフォルダーだけをworkspace-writeにし、追加領域へは書き込みません。

## AI・音声・プライバシー

### Codex app-server

- ローカルの`codex app-server --stdio`を起動します。
- ChatGPTの認証トークンはCodex側が管理し、PuruPetは受け取りません。
- 会話モードと作業モードは別のスレッド・権限で実行します。
- Codex Realtimeは実験機能のため、アカウントによって利用できない場合があります。

### OpenAI API

- Responses APIによる会話とTranscriptions APIによる音声認識を利用できます。
- APIキーはレンダラーへ渡さず、利用可能な場合はOSの暗号化ストレージへ保存します。

### マイク

- マイク連動は音量値だけをローカル処理し、口パクへ使います。
- Codex Realtime利用時は音声がCodex app-server経由でOpenAIへ送信されます。
- 端末音声認識やOpenAI文字起こしへ切り替わる場合は、画面に現在の方式を表示します。
- 音声読み上げはWindows/Chromiumの`SpeechSynthesis`を使い、設定から無効化できます。

## 一枚絵からキャラクターを追加する

Codex app-server接続時は、キャラクター画面の「一枚絵からキャラクターを追加」を利用できます。同梱の`.agents/skills/build-purupuru-avatar/`を隔離されたworkspace-writeジョブで実行し、次を生成・検証してからキャラクター一覧へ追加します。

- 目2段階 × 口3段階の標準PNG差分
- 前髪・後ろ髪レイヤー
- 表情差分
- 初期リグと可動範囲
- 性格、話し方、触れ合い文

利用者は、アップロード・加工・利用に必要な権利を持つ画像だけを使用してください。

## Windows版をビルドする

展開済みフォルダー版を生成します。

```bash
npm run dist:win
```

Windows上でNSISインストーラーとportable版を生成する場合:

```bash
npm run dist:win:installer
```

現在の開発ビルドはコード署名されていません。一般配布前に署名、SmartScreen確認、クリーンなWindows環境での動作確認を推奨します。

## ブラウザー版PuruPuruエディター

元のPuruPuru編集画面も残しています。Python 3.11とuvを用意し、次でローカルサーバーを起動します。

```bash
uv run python scripts/run_local_server.py
```

表示された`http://127.0.0.1:8223/`をChromeまたはChromiumで開きます。素材形式、`.purupuru`パッケージ、OBS、調整方法は[docs/usage.md](./docs/usage.md)を参照してください。

調整したキャラクターは、画像込みのポータブルな `.purupuru` アバターパッケージとして保存できます。元のPNG素材フォルダに依存しないため、バックアップや別PCへの移行に利用できます。

## テスト

```bash
npm test
```

`npm test`はJavaScriptランタイム検査、ElectronバックエンドのNodeテスト、Python静的テストを実行します。vendored依存関係だけを確認する場合:

```bash
uv run python scripts/verify_vendor_checksums.py
```

## なぜ`vendor/`を含めるのか

`vendor/`はビルド生成物ではなく実行時依存です。

- MediaPipe Tasks VisionのJavaScript、WASM、Face Landmarkerモデル
- CSP下でオフライン表示するZen Maru Gothic

これらはブラウザー/Electron実行時にローカル配信されます。`npm install`だけでは顔モデルと同じオフライン構成を復元できないためGitへ含め、SHA-256マニフェストで検証します。更新方法は[docs/vendor-update.md](./docs/vendor-update.md)を参照してください。

## リポジトリ構成

| パス | 内容 |
| --- | --- |
| `desktop/` | Electronメインプロセス、preload、設定・会話UI |
| `assets/` | PuruPuru用キャラクター画像と設定 |
| `.agents/skills/` | 一枚絵からキャラクターを追加するCodex Skill |
| `vendor/` | オフライン実行に必要なMediaPipe・フォント |
| `scripts/` | ローカルサーバー、vendor検証・更新補助 |
| `tests/` | Node/JavaScript/Pythonテスト |
| `docs/` | 利用方法、設計、依存関係更新手順 |

`node_modules/`、`dist/`、`work/`、元画像、ローカル設定、APIキーを含み得るファイルはGit対象外です。

## ライセンスと素材

- ソフトウェアコードとドキュメント: [Apache License 2.0](./LICENSE)
- 元プロジェクトと変更点: [NOTICE](./NOTICE)、[MODIFICATIONS.md](./MODIFICATIONS.md)
- 第三者依存関係: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
- デスクトップ版の新規3キャラクター: [DISTRIBUTION_ASSET_LICENSE.md](./DISTRIBUTION_ASSET_LICENSE.md)
- 元ブラウザー版に残る上流サンプル素材: [ASSET_LICENSE.md](./ASSET_LICENSE.md)

デスクトップ配布物には上流の旧デモキャラクターと旧faviconを含めません。ソースツリーに残る上流サンプルは、元ブラウザー編集画面の互換性・検証用であり、Apache-2.0の対象ではありません。

このリポジトリを公開する前に、新規3キャラクターの元絵と生成差分を複製・加工・公開配布できることを権利者が確認してください。ライセンス文書を置くだけでは、元画像の権利が発生するわけではありません。

## コントリビューションとセキュリティ

- [Contributing](./.github/CONTRIBUTING.md)
- [Security policy](./.github/SECURITY.md)
- [Support](./.github/SUPPORT.md)
- [GitHub公開チェックリスト](./docs/github-release-checklist.md)

不具合報告へログやスクリーンショットを添付する前に、APIキー、ユーザー名、ローカルパス、非公開キャラクターが含まれていないことを確認してください。
