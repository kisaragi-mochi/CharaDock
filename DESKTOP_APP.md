# PuruPuru Desktop Mascot

The Electron desktop app reuses the existing PuruPuru canvas renderer in a
transparent, frameless, always-on-top window. A separate control window handles
character selection, chat, microphone lip sync, speech input, expressions, and
desktop behavior.

## Start

```bash
npm install
npm run desktop
```

起動時は透明なキャラクターだけが表示されます。右下の `✦` へマウスを重ねるかクリックすると小さな会話欄が開き、離れると自動で収納されます。返答は顔へテールを向けた短いバブルへストリーミング表示されます。キャラクターへマウスを重ねている間は視線がカーソルを追い、離れると呼吸・揺れ・視線移動の待機モーションへ戻ります。顔付近をクリックするとキャラごとの短い反応が返ります。

小さな会話欄の左端にある `会話` を押すと、設定画面を開かずに `作業` モードへ切り替えられます。初回だけWindowsのフォルダー選択が開き、選択した作業先は細いチップで表示されます。チップを押すと作業先を変更でき、`作業` を押すと会話モードへ戻ります。作業モードはCodex app-server接続時のみ利用でき、選択フォルダーだけを書き込み可能なworkspace-writeセッションとして動作します。

キャラクター画面では、画像から想定した初期性格・話し方をキャラごとに編集できます。名前、性格、吹き出し位置は保存され、Codex app-serverとOpenAI APIの両方の会話へ反映されます。追加キャラ3人には通常差分に加え、嬉しい・驚き・やさしく心配する表情PNGを収録しています。

Codex app-server接続時は、キャラクター画面の「一枚絵からキャラクターを追加」からPNG・JPEG・WebPを選べます。同梱の `$build-purupuru-avatar` Skillを隔離されたworkspace-writeジョブで実行し、標準の目2段階×口3段階、前髪レイヤー、推定した性格・話し方・触れ合い文を検証してからライブラリへ追加します。この機能はChatGPTログインと、利用中のCodexモデルによる画像生成対応が必要です。OpenAI API接続時は利用できません。

Global shortcuts:

- `Ctrl+Shift+Enter`: open the compact character chat
- `Ctrl+Shift+M`: open settings and chat
- `Ctrl+Shift+L`: toggle click-through
- `Ctrl+Shift+H`: show or hide the character

## Response backends

### Codex app-server

Select **Codex app-server** in AI Connection. The app launches the locally
installed `codex app-server --stdio`, performs the required JSON-RPC
initialization, and creates an ephemeral read-only conversation. It uses the
existing Codex login. Set `CODEX_CLI_PATH` if `codex` is not on `PATH`.
On Windows, the app also detects the Microsoft Store Codex installation. Its
protected CLI binary is copied into this app's user-data cache before launch so
that Windows permits app-server child-process execution.

未ログインの場合はAI接続画面の **ChatGPTでログイン** を押します。app-serverの
managed ChatGPT OAuthを開始し、既定ブラウザでログインした後、画面が
`ChatGPTログイン済み` へ自動更新されます。認証トークンの保存・更新はCodex側が
担当し、このアプリはトークンを受け取りません。

### OpenAI API

Select **OpenAI API**, paste an API key, and save it. The app uses the Responses
API for chat and the transcription API as the fallback speech-recognition path.
The key never enters a renderer window. When Electron's `safeStorage` is
available it is encrypted with the operating system credential store; otherwise
it remains in memory for the current app session only.

## Voice and animation

- **Mic link** continuously measures microphone volume locally and sends only a
  numeric level to the mascot renderer for three-stage lip sync.
- **Voice input** normally starts the experimental Codex app-server Realtime
  WebRTC session when Codex is selected. Live user transcripts are written into
  the composer and the spoken response is played while its transcript streams
  into the mascot bubble. Realtime availability depends on the signed-in
  account; an unavailable session automatically falls back to Chromium speech
  recognition. If that is also unavailable, a short clip can use OpenAI
  transcription when an API key exists.
- Reply read-aloud uses the operating system speech voice. A generated amplitude
  envelope drives the character's mouth while it speaks.
- Codex and OpenAI replies stream into both the control chat and the desktop
  speech bubble, with a light mouth pulse while text arrives.
- When the mouse rests, breathing, swaying, blinking, hair spring, and small
  autonomous gaze changes form the idle loop.
- The hooded character clips its hair layer to the hood opening; other custom
  characters use face-following spring hair.

## Build

Create an unpacked application directory:

```bash
npm run dist
```

Create an unpacked Windows application directory (also works from WSL):

```bash
npm run dist:win
```

`dist:win` はWineなしでも生成できるWindows用フォルダ版です。Windows上でNSISインストーラー／単体portable版を生成する場合は `npm run dist:win:installer` を使います。
