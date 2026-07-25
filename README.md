<p align="center">
  <img src="./app-icon.ico" width="88" height="88" alt="PuruPet Desktop">
</p>

<h1 align="center">PuruPet Desktop</h1>

<p align="center"><strong>デスクトップに、会話できる相棒を。</strong></p>
<p align="center">透過PNGTuber × ChatGPTログイン × 音声 × Codex作業を、邪魔にならない小さなWindowsアプリへ。</p>

<p align="center">
  <img alt="Code: Apache-2.0" src="https://img.shields.io/badge/code-Apache--2.0-20201f?style=flat-square">
  <img alt="Platform: Windows" src="https://img.shields.io/badge/platform-Windows-20201f?style=flat-square">
  <img alt="Electron 43" src="https://img.shields.io/badge/Electron-43-20201f?style=flat-square">
  <img alt="Status: pre-release" src="https://img.shields.io/badge/status-pre--release-df9848?style=flat-square">
</p>

<p align="center">
  <a href="#クイックスタート">クイックスタート</a> ·
  <a href="#できること">できること</a> ·
  <a href="#一枚絵からキャラクターを追加">Avatar Studio</a> ·
  <a href="./DESKTOP_APP.md">デスクトップ版ガイド</a> ·
  <a href="./docs/usage.md">ブラウザー版ガイド</a>
</p>

<p align="center">
  <img src="./docs/images/purupet-work-mode.png" alt="PuruPet Desktopの透過アバターとコンパクトな作業モード" width="560">
</p>

PuruPet Desktopは、[rotejin/PuruPuruPNGTuber](https://github.com/rotejin/PuruPuruPNGTuber)を基にした非公式派生アプリです。アバターが呼吸し、視線を動かし、話し、必要なら選択フォルダー内の作業まで手伝います。入力欄も作業UIも必要なときだけ現れる、デスクトップ常駐前提の設計です。

> [!IMPORTANT]
> このリポジトリは公開準備中です。コードはApache-2.0ですが、画像には別の利用条件があります。公開・フォーク・配布前に[ライセンスと素材](#ライセンスと素材)を確認してください。

## できること

| 会話できるデスクトップコンパニオン | そのままCodex作業 | 自分の一枚絵をPuruPuru化 |
| --- | --- | --- |
| 顔の近くの吹き出しへ返答をストリーミング。入力欄はキャラへマウスを重ねたときだけ表示。 | `会話 / 作業`を小さなUIから切替。現在の操作、完了結果、直近12件の履歴を保持。 | Codex Avatar Studioが目・口・表情差分、髪レイヤー、動き、性格をまとめて生成。 |

### デスクトップに馴染む

- 透明・最前面のフレームレスアバター
- 呼吸、まばたき、髪揺れ、待機視線、3段階リップシンク
- キャラクター上にカーソルがある間だけ有効なマウス追従
- モニター端への吸着、位置ロック、マルチモニター対応
- キャラごとの表示サイズ、可動範囲、追従速度、呼吸・体・髪の揺れ、性格、話し方、吹き出し位置
- OSのライト／ダーク表示とキャラクター色へ適応するニュートラルUI
- 視差・透明効果・高コントラストなどOSのアクセシビリティ設定へ追従

### 会話と音声

- Codex app-serverのChatGPTログイン、またはOpenAI Responses API
- 長文読み上げ中は現在話している文を表示し、完了後は全文へ戻るコンパクトな吹き出し
- Codex Realtime、Codex 0.145音声入力、ローカルsherpa-onnx、端末音声認識、OpenAI文字起こしを選択可能
- VADによる無音区切り・認識後の自動送信・3段階の感度調整を選択可能
- Windows標準音声、Style-Bert-VITS2、piper-plus、Supertonic 3、Kokoro、Irodori TTS WebGPUによる読み上げ、文ごとの表情同期、実音声波形リップシンク
- ユーザー辞書、技術用語辞書、略語、CMUdictの順で英字語を日本語読みし、未登録の一般英単語にも対応（表示文は変更しない）
- キャラクターをクリックしたときの反応は、通常時は選択中のTTSで読み上げ、Realtime中は会話への割り込みを避けて表情と吹き出しだけ表示
- 応答待ちが2.6秒を超えたときだけ、キャラクターらしい短い音声フィラーを一度再生。再生を終えてから回答へつなぐ
- キャラクターごとの触れ合い文、表情、会話メモリ

Style-Bert-VITS2は設定の「デスクトップ → 音声方式」から選択します。ローカルAPIのURL（既定 `http://localhost:5000`）、モデルID、速度だけを指定でき、`/docs`のURLを入力した場合も自動的に`/voice`へ接続します。長い返答は画面へ表示された文ごと（最大90文字）に生成キューへ追加し、最初の文が生成できた時点から表示順に再生します。

piper-plusも同じ音声方式から選択できます。Windows版では、公式C++ランタイムと「つくよみちゃん」FP16モデル（合計約72MB）を設定画面から取得し、SHA-256検証後に自動選択できます。つくよみちゃんコーパスのクレジットと利用条件はダウンロード前から同じ画面に表示します。別のpiper-plus専用`.onnx`と設定JSONを手動指定することもできます。生成した一時WAVは再生データへ変換した直後に削除されます。

Supertonic 3は同梱sherpa-onnxランタイムでCPU推論します。公式int8モデル（約129MB）を設定画面から取得して自動選択でき、F1–F5/M1–M5の声、速度、生成ステップを選択できます。ネイティブ推論はアプリ本体と別の短命プロセスで実行し、WAV文字列だけを戻します。Irodori TTSは必要なFP16 ONNXファイルだけ（約1.26GB）を設定画面から取得し、Electron内の専用WebGPUレンダラーでローカル推論します。WAV / MP3 / M4A / AAC / OGG / FLAC / WebMを追加でき、48kHz WAVへ変換してアプリ管理領域へコピーします。複数の名前付き参照音声を管理でき、元ファイルを削除しても利用できます。長文は句点ごと、句読点がない箇所も最大48文字で分け、現在の区間を再生しながら次の1区間を合成します。速度はピッチを保った再生速度として調整します。テキストと参照音声は外部サーバーへ送信しません。音声方式とIrodori/Supertonic/Kokoroの声はキャラクターごとに保存され、Irodori/Supertonicは手動モデルフォルダーの指定も残しています。

Kokoroは日本語5音声をキャラクターごとに選択できます。設定画面からWebGPU推奨FP32とCPU用q8モデル（合計約421MB）を取得し、「自動」ではWebGPUを優先します。GPUが非有限値や無音を返す環境では同じ発話をCPUで再生成し、以後はCPU設定を保持します。日本語G2Pと推論はアプリ内で完結します。

英単語の日本語読みも同じ設定内で無効化でき、`英字=読み`を1行ずつ登録するユーザー辞書で固有名詞や好みの読みを上書きできます。未登録の一般英単語はCMUdictの英語発音からカタカナ読みを端末内で生成します。URL、ファイル名、バージョンなどのコードらしい文字列と画面上の原文は変更しません。

音声入力は「デスクトップ → 音声入力」から選択します。`自動`は、選択したsherpa-onnxモデルがダウンロード済みならローカル認識を、未導入なら端末の日本語音声認識を使います。sherpa-onnxでは、日本語Parakeet CTC、ReazonSpeech Zipformer、SenseVoice、Whisper base、従来のWhisper tinyを切り替えられ、各モデルは必要なものだけ初回にダウンロードします。認識言語は日本語へ固定され、録音音声と認識処理は端末内で完結します。VADには約0.6MBのSileroモデルを使用し、準備できない場合だけ従来の音量検出へ戻ります。実験的なCodex Realtimeを自動起動することはありません。Realtimeではapp-serverが返す音声一覧からキャラクターごとに声を保存し、GPT-Liveの音声を直接再生します。声の選択肢は男性寄り・女性寄り・中性的という聞こえ方の目安でグループ化し、OpenAI公式の性格説明を日本語で併記します。Realtimeセッションは録音ボタンを押したときだけ開始し、キャラクタークリックから追加音声を送らないため、会話中の返答と重なりません。この間は通常のTTSを重ねず、少し遅れて届く文字起こしを吹き出しへ逐次表示します。Codex CLI 0.145以降では`Codex音声入力`を選ぶと、録音を通常のCodexターンへ直接添付できますが、上流側の提供状況に依存します。OpenAI文字起こしもAPIへ`ja`を指定し、端末音声認識も`ja-JP`を使用します。感度は「低・標準・高」から選べます。

### 安全な作業モード

- 会話モードはread-only
- 作業モードは利用者が選択した1フォルダーだけをworkspace-write
- Realtime音声も作業モード中は同じ作業クライアントへ接続し、選択フォルダー内で直接作業
- 作業内容、実行中の操作、完了結果を独立した履歴へ保持
- 実行中ターンを履歴パネルから中断可能
- 技術判断や安全性はキャラクター演出から分離し、進行説明と完了報告だけに性格を反映
- Codex作業ではライブWeb検索を有効化

### 画面とブラウザーを、会話の中で許可

「今の画面を見て」や「このサイトを調べて」と話すと、キャラクターがその場で許可を尋ねます。
「画面を撮影して」「デスクトップをキャプチャして」「ブラウザで検索して」のような言い方にも対応し、設定画面での事前有効化は不要です。

- 読み上げが有効なら許可確認も音声で案内し、VAD中は「いいよ」「やめて」と話して選択可能
- 画面共有は、その瞬間にカーソルがあるモニターを1枚だけ取得
- ブラウザーはログインを引き継がない可視の専用ウィンドウ
- ブラウザー／コンピューターの許可は、完了後5分以内の「続けて」「そのまま」「次に」など明確な操作の続きだけ再確認なしで利用
- 通常の会話、終了表現、5分経過、専用ブラウザーを閉じた場合は自動失効。ブラウザーは同じ1ホストだけで、別サイトは再許可
- 許可したホスト外へのリダイレクトやページ読込失敗は、原因を区別して表示
- ブラウザー操作はページ閲覧、リンク移動、クリック、検索文字入力、選択、キー、スクロール、戻るに対応
- ブラウザー許可中は通常のWeb検索を無効化し、可視の専用ブラウザーを使わなかった回答を停止
- 検索以外のフォーム送信、メッセージ送信、ダウンロード、購入、認証・セキュリティ変更は行わない
- 画面撮影時はキャラを非表示にせず、Windowsのキャプチャ対象から一時的に除外するためちらつかない
- 一時スクリーンショットは回答後に削除

「コンピューターを操作してメモ帳を開いて」のように頼むと、Windowsの前面画面を操作する許可が表示されます。許可後は画面を毎回確認しながら、クリック、文字入力、キー、スクロールを1ターン最大30操作まで実行でき、5分以内の明確な続きなら再許可なしで続行できます。削除、送信、購入、インストール、認証・セキュリティ・支払い設定、秘密情報の入力などは自動操作せず、必要な箇所で利用者へ引き継ぎます。Windowsでは操作中に前面のマウスとキーボードを使用するため、完了または中断まで同じデスクトップを手動操作しないでください。

## 収録キャラクター

デスクトップ配布物には新規4キャラクターだけを収録します。

| 琥珀 | セピア | ルナ | セージ |
|:---:|:---:|:---:|:---:|
| <img src="./docs/images/characters/amber-complete-v2.png" alt="琥珀" width="190"> | <img src="./docs/images/characters/bronze-complete-v2.png" alt="セピア" width="190"> | <img src="./docs/images/characters/silver-complete-v2.png" alt="ルナ" width="190"> | <img src="./docs/images/characters/sage-complete-v1.png" alt="セージ" width="190"> |
| 快活で素直。前向きに背中を押す。 | 余裕と洞察があり、頼れる。 | 静かで丁寧。集中を大切にする。 | 穏やかな知性派。複雑なことを整理する。 |

各キャラクターは通常の目・口差分に加え、嬉しい・驚き・やさしい表情差分を持ちます。選択キャラに合わせて設定画面とコンパニオンUIのアクセントも変化します。

## クイックスタート

### 必要環境

- Windows 10/11 x64
- Node.js 22以降
- Codex機能を使う場合は、ログイン可能な[Codex CLI](https://github.com/openai/codex)
- Python検査を行う場合のみPython 3.11と[uv](https://docs.astral.sh/uv/)

### 開発版を起動

```bash
npm ci
npm run desktop
```

初回起動ウィザードで、ChatGPTログインまたはOpenAI API、キャラクター、音声出力を設定します。Windows Store版Codexも自動検出します。`codex`が`PATH`にない場合は`CODEX_CLI_PATH`で実行ファイルを指定できます。

### キャラクターから会話・作業

1. キャラクター右下の`✦`へマウスを重ねます。
2. 小さな入力欄から会話します。
3. 左端の`会話`を押すと`作業`へ切り替わります。
4. 初回だけWindowsのフォルダー選択で作業先を指定します。
5. `履歴`から直近の指示・操作・結果を再表示できます。

主なショートカット:

| 操作 | キー |
| --- | --- |
| 現在のモードの入力欄を開く | `Ctrl + Shift + Enter` |
| 設定を開く | `Ctrl + Shift + M` |
| クリック透過 | `Ctrl + Shift + L` |
| キャラクター表示 | `Ctrl + Shift + H` |

## AI接続とプライバシー

### Codex app-server

アプリはローカルの`codex app-server --stdio`を起動します。ChatGPTの認証トークンはCodexが管理し、PuruPetは受け取りません。会話と作業は別スレッド・別権限で、app-serverから取得したモデル一覧のプルダウンから、それぞれのモデルと推論の深さを変更できます。推論の深さは固定の秒数ではなく、モデルへ渡すreasoning effortです。

GPT-Live / Codex Voiceは実験機能です。公式ChatGPTデスクトップのVoice提供状況とは別に、Codex app-server経由の利用可否はアカウントや上流実装に依存します。音声セッションは新しい空のタスクとして開始し、利用できず404になる場合は、その起動中の再試行を止めて端末音声認識へ切り替えます。`realtime_conversation`とapp-serverの`experimentalApi`はアプリ側で有効化済みです。

作業モードでRealtimeを開始した場合は、会話用read-onlyスレッドではなく、設定した作業モデル・推論設定と選択フォルダー限定のworkspace-writeスレッドを使用します。音声で依頼した作業も履歴へ残り、実行中のコマンドやファイル更新を表示して中断できます。会話モードへ戻すとRealtime接続をいったん終了し、書き込み権限を持たない会話スレッドへ分離します。

### OpenAI API

Responses APIによる会話とTranscriptions APIによる文字起こしを利用できます。APIキーはレンダラーへ渡さず、利用可能な場合はOSの暗号化ストレージへ保存します。

### マイクと読み上げ

通常の口パクは音量値だけをローカル処理します。sherpa-onnxと端末音声認識はローカルで処理します。Codex Realtime、Codex音声入力、OpenAI文字起こしを使う場合は、音声が該当サービスへ送られます。Codex音声入力用の一時ファイルは応答後に削除され、異常終了時に残ったものも次回起動時に消去されます。現在の入力方式はUIに表示されます。

## 一枚絵からキャラクターを追加

Codex app-server接続時は、設定の`Codex Avatar Studio`からPNG・JPEG・WebPを選べます。同梱の[`.agents/skills/build-purupuru-avatar/`](./.agents/skills/build-purupuru-avatar/)を隔離されたworkspace-writeジョブで実行し、次を生成・検証してから追加します。

- 目2段階 × 口3段階の標準PNG差分
- 嬉しい・驚き・やさしい表情差分
- 前髪・後ろ髪レイヤー
- 初期リグ、表示サイズ、可動範囲
- 性格、話し方、触れ合い文

利用者は、アップロード・加工・利用に必要な権利を持つ画像だけを使用してください。

## WindowsバイナリとGitHub Actions

ローカルでNSISインストーラーとportable版を生成します。

```bash
npm run dist:win:installer
```

[`Windows package`](./.github/workflows/release.yml)はWindowsランナーで同じビルドを行います。

- Actions画面から手動実行すると、14日間保持される成果物を作成
- `v0.1.0`のようなタグをpushすると、`.exe` 2種と`SHA256SUMS.txt`をDraft Releaseへ添付
- 署名設定がない現在はDraftに留め、実機確認後に公開可能
- ActionsはすべてコミットSHAで固定し、Dependabotで更新

現在の開発ビルドはコード署名されていません。一般配布前に署名とSmartScreen確認を推奨します。

## GitHub Pages

[`site/`](./site/)に機能紹介ランディングページを収録しています。ローカル生成:

```bash
npm run site:build
```

生成先は`site-dist/`です。[`GitHub Pages`](./.github/workflows/pages.yml)が`main`更新時に静的成果物を組み立てて公開します。リポジトリの **Settings → Pages → Source** を **GitHub Actions** に設定してください。キャラクター画像は既存素材からビルド時だけコピーし、ソース内では二重保持しません。

## ブラウザー版PuruPuruエディター

元のPuruPuru編集画面とOBS向け透過表示も残しています。

```bash
uv run python scripts/run_local_server.py
```

表示された`http://127.0.0.1:8223/`をChromeまたはChromiumで開きます。素材形式、OBS、調整方法は[docs/usage.md](./docs/usage.md)を参照してください。

調整したキャラクターは、画像込みのポータブルな `.purupuru` アバターパッケージとして保存できます。元のPNG素材フォルダに依存しないため、バックアップや別PCへの移行に利用できます。

## 開発とテスト

```bash
npm test
npm run site:build
```

| パス | 内容 |
| --- | --- |
| `desktop/` | Electronメインプロセス、preload、設定・会話UI |
| `assets/` | キャラクター画像とPuruPuru設定 |
| `.agents/skills/` | 一枚絵からキャラクターを追加するCodex Skill |
| `site/` | GitHub Pages用ランディングページ |
| `vendor/mediapipe/` | オフライン顔追従に必要なMediaPipe、WASM、モデル |
| `scripts/` | ローカルサーバー、サイト生成、検証補助 |
| `tests/` | Node / JavaScript / Pythonテスト |

`vendor/`に残すのは、`npm install`では復元できず、カメラ顔追従をオフラインで動かすMediaPipeランタイムとモデルだけです。日本語Webフォントは数百の分割ファイルになるため同梱せず、OS標準フォントを使います。更新方法は[docs/vendor-update.md](./docs/vendor-update.md)を参照してください。

## ライセンスと素材

- ソフトウェアコードとドキュメント: [Apache License 2.0](./LICENSE)
- 元プロジェクトと変更点: [NOTICE](./NOTICE)、[MODIFICATIONS.md](./MODIFICATIONS.md)
- 第三者依存関係: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
- デスクトップ版の新規4キャラクター: [DISTRIBUTION_ASSET_LICENSE.md](./DISTRIBUTION_ASSET_LICENSE.md)
- 元ブラウザー版に残る上流サンプル素材: [ASSET_LICENSE.md](./ASSET_LICENSE.md)

デスクトップ配布物には上流の旧デモキャラクターと旧faviconを含めません。ソースツリーに残る上流サンプルは、ブラウザー編集画面の互換性・検証用であり、Apache-2.0の対象ではありません。

> [!WARNING]
> 新規4キャラクターの元絵と生成差分を複製・加工・公開配布できることを、公開前に権利者が確認してください。ライセンス文書を置くだけでは元画像の権利は発生しません。

## コントリビューション

- [Contributing](./.github/CONTRIBUTING.md)
- [Security policy](./.github/SECURITY.md)
- [Support](./.github/SUPPORT.md)
- [GitHub公開チェックリスト](./docs/github-release-checklist.md)

PuruPet Desktop is not endorsed by or affiliated with the original PuruPuru PNGTuber developer.
