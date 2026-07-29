// SPDX-License-Identifier: Apache-2.0
(function initializeCharaDockI18n(root) {
  "use strict";

  const ENGLISH = Object.freeze({
    "設定カテゴリ": "Settings categories",
    "会話": "Chat",
    "キャラクター": "Character",
    "AI接続": "AI Connection",
    "デスクトップ": "Desktop",
    "準備中": "Getting ready",
    "状態を確認しています": "Checking status",
    "すぐ入力": "Quick input",
    "キャラクターと話す": "Talk with your character",
    "新しい会話": "New chat",
    "こんにちは。今日は何をしようか？": "Hi! What shall we do today?",
    "表情操作": "Expression controls",
    "表情": "Expression",
    "通常": "Neutral",
    "にこっ": "Happy",
    "びっくり": "Surprised",
    "やさしく": "Soft",
    "おやすみ": "Sleepy",
    "メッセージを入力…（Ctrl＋Enterで送信）": "Type a message… (Ctrl+Enter to send)",
    "設定画面では文字入力のみ": "Text input only in Settings",
    "送信": "Send",
    "中断": "Stop",
    "Codex app-serverを使用します。": "Using Codex app-server.",
    "見た目と振る舞い": "Appearance and behavior",
    "クリックすると透明ウィンドウのキャラクターがすぐ切り替わります。": "Click a character to switch the transparent desktop window immediately.",
    "キャラクターを追加": "Add a character",
    "完成済みのパッケージを読み込むか、一枚の画像から新しく作成できます。": "Import a finished package or create a new character from one image.",
    ".purupuruからキャラクターを追加": "Add from a .purupuru file",
    "画像・表情差分・髪レイヤー・調整値をアプリ内へコピーします。元ファイルを移動・削除しても使えます。": "Copies images, expressions, hair layers, and tuning data into the app so the original file can be moved or deleted.",
    ".purupuruを選択": "Choose .purupuru",
    "80MBまで": "Up to 80 MB",
    "一枚絵からキャラクターを追加": "Create a character from one image",
    "目の開閉×口3段階の6差分と、独立して揺れる前髪を生成し、画素単位の品質検査後に追加します。": "Generates six eye/mouth states and a separately moving front-hair layer, then validates quality pixel by pixel.",
    "Codexのみ": "Codex only",
    "画像を選択": "Choose image",
    "選択したキャラクター画像": "Selected character image",
    "PNG・JPEG・WebP / 15MBまで": "PNG, JPEG, or WebP / up to 15 MB",
    "キャラクター名（任意）": "Character name (optional)",
    "空欄なら画像から提案": "Leave blank to suggest from the image",
    "性格・話し方（任意）": "Personality and speaking style (optional)",
    "例：明るく好奇心旺盛。短く親しみやすく話す。空欄なら画像から提案": "Example: Bright and curious, speaking in short, friendly sentences. Leave blank for a suggestion.",
    "名前や性格が空欄の場合だけ、元絵の雰囲気から提案します。生成中はCodexの利用枠を消費し、数分かかることがあります。": "CharaDock suggests only fields left blank. Generation uses your Codex allowance and may take several minutes.",
    "この画像をアップロード・加工・利用する権利があります": "I have the rights to upload, modify, and use this image",
    "CodexでPuruPuru化": "Create PuruPuru with Codex",
    "画像を選択してください。": "Choose an image.",
    "AI接続を「Codex app-server」にすると利用できます。": "Available when AI Connection is set to Codex app-server.",
    "キャラクター一覧": "Character library",
    "キャラクター設定": "Character settings",
    "名前と性格は会話にも反映されます。吹き出しはキャラクターに重なる位置へ調整できます。": "The name and personality affect conversations. You can also position the speech bubble over the character.",
    "名前": "Name",
    "性格・話し方": "Personality and speaking style",
    "このキャラのメモリ": "This character's memories",
    "会話から自動で覚えた呼び名・好み・継続目標です。ほかのキャラとは共有しません。": "Names, preferences, and ongoing goals learned automatically from conversations. They are not shared with other characters.",
    "すべて忘れる": "Forget all",
    "吹き出し 左 (%)": "Bubble left (%)",
    "上 (%)": "Top (%)",
    "幅 (%)": "Width (%)",
    "デスクトップ表示と動き": "Desktop appearance and motion",
    "表示サイズと顔の可動範囲を調整します。変更はキャラクターへすぐ反映されます。": "Adjust display size and facial movement. Changes appear on the character immediately.",
    "キャラクターサイズ": "Character size",
    "左を向く幅": "Look-left range",
    "右を向く幅": "Look-right range",
    "上を向く幅": "Look-up range",
    "下を向く幅": "Look-down range",
    "動きの質感を詳しく調整": "Fine-tune motion",
    "追従の速さ": "Follow speed",
    "呼吸の強さ": "Breathing strength",
    "体の傾き": "Body tilt",
    "上下の弾み": "Vertical bounce",
    "髪のしなり": "Hair spring",
    "髪の揺れ幅": "Hair movement",
    "このキャラに保存": "Save for this character",
    "初期設定へ戻す": "Restore defaults",
    "作成したキャラを削除": "Delete custom character",
    "動きと反応": "Motion and reactions",
    "自動まばたき、呼吸、髪揺れ、アプリ上のマウス追従、音量リップシンクを利用します。": "Uses automatic blinking, breathing, hair motion, in-app mouse tracking, and volume-based lip sync.",
    "マウスを目で追う": "Follow the mouse with eyes",
    "カーソルがキャラクター上にある間だけ追従": "Only while the pointer is over the character",
    "応答エンジン": "Response engine",
    "接続を確認": "Test connection",
    "Codexのログイン状態を使う": "Use your Codex sign-in",
    "ローカルのCodex CLIを安全な読み取り専用モードで起動し、会話を継続します。": "Continues conversations through the local Codex CLI with protected access.",
    "自分のAPIキーを使う": "Use your own API key",
    "Responses APIを使います。APIキーはOSの暗号化ストレージからのみ復号します。": "Uses the Responses API. Your API key is decrypted only from the operating system's secure storage.",
    "Codex設定": "Codex settings",
    "会話と作業でモデルと推論の深さを分けられます。空欄ならCodex側の既定値です。": "Choose separate models and reasoning levels for chat and work. Blank fields use Codex defaults.",
    "モデル": "Model",
    "Codex既定": "Codex default",
    "推論の深さ": "Reasoning effort",
    "なし": "None",
    "最小": "Minimal",
    "低": "Low",
    "中": "Medium",
    "高": "High",
    "非常に高い": "Extra high",
    "最大": "Maximum",
    "作業": "Work",
    "深くするほど応答に時間がかかる場合があります。利用できる値はモデルによって異なります。": "Deeper reasoning can take longer. Available values depend on the model.",
    "ChatGPTでログイン": "Sign in with ChatGPT",
    "アカウント状態を確認しています…": "Checking account status…",
    "音声入力方式はデスクトップ設定で明示的に選択します。Codex Realtimeは選択した場合だけ接続します。": "Choose voice input explicitly in Desktop settings. Codex Realtime connects only when selected.",
    "OpenAI API設定": "OpenAI API settings",
    "APIキー未設定": "API key not set",
    "APIキー": "API key",
    "保存": "Save",
    "応答モデル": "Response model",
    "音声認識モデル": "Transcription model",
    "常駐と表示": "Display and behavior",
    "表示言語": "Display language",
    "言語": "Language",
    "画面表示と組み込みキャラクターの名前・性格に適用します。音声認識と日本語TTS処理は変更しません。": "Applies to the interface and built-in character names and personalities. Speech recognition and Japanese TTS processing are unchanged.",
    "ウィンドウ": "Window",
    "常に最前面": "Always on top",
    "他のアプリより手前に表示": "Keep above other apps",
    "クリックを背面へ通す": "Click through to apps behind",
    "解除は Ctrl＋Shift＋L": "Toggle with Ctrl+Shift+L",
    "位置をロック": "Lock position",
    "誤操作でキャラクターが動くのを防止": "Prevent accidental character movement",
    "画面端へ吸着": "Snap to screen edges",
    "近くまで移動すると端へ揃える": "Align to an edge when moved nearby",
    "PC起動時に開始": "Launch at startup",
    "Windows・macOSで有効": "Available on Windows and macOS",
    "音声入力": "Voice input",
    "認識方式": "Recognition method",
    "GPT-Live / Codex Voice（実験的）": "GPT-Live / Codex Voice (experimental)",
    "sherpa-onnx（ローカル）": "sherpa-onnx (local)",
    "端末音声認識": "System speech recognition",
    "OpenAI文字起こし": "OpenAI transcription",
    "開始方法": "Activation",
    "VAD（発話と無音を自動検出）": "VAD (automatic speech and silence detection)",
    "ボタンで開始・停止": "Start and stop with button",
    "VAD感度": "VAD sensitivity",
    "低（ノイズの多い場所）": "Low (noisy spaces)",
    "標準": "Standard",
    "高（静かな場所）": "High (quiet spaces)",
    "認識後に自動送信": "Send automatically after recognition",
    "文字を一度表示してから送信します": "Shows the transcript before sending",
    "キャラクター画面の音声ボタンに適用します。約0.6MBのSilero VADが声とノイズを判別し、話し終わりを自動検出します。準備できない場合だけ従来の音量検出へ戻ります。": "Applies to the character-window microphone. The small Silero VAD model distinguishes speech from noise and detects when you finish speaking.",
    "ローカル認識モデル": "Local recognition model",
    "内蔵音声モデルを確認しています…": "Checking bundled speech models…",
    "日本語モデルをダウンロード": "Download Japanese model",
    "モデルを削除": "Delete model",
    "選択したモデルを初回だけ取得します。認識処理と音声データは端末内で完結します。": "Downloads the selected model once. Recognition and audio stay on this device.",
    "キャラクターの声": "Character voice",
    "このキャラクター": "This character",
    "の音声": " voice",
    "選択中のキャラクターだけに、音声方式と声を保存します。": "Saves the voice method and voice for the selected character only.",
    "通常TTS": "Standard TTS",
    "現在の音声方式を確認中": "Checking current voice method",
    "設定を読み込んでいます。": "Loading settings.",
    "Realtimeの声": "Realtime voice",
    "Cove（標準）": "Cove (standard)",
    "Realtime用の音声一覧を確認しています…": "Checking Realtime voices…",
    "男性寄り・女性寄り・中性的は聞こえ方の目安です。OpenAI公式の性別分類ではなく、言語や話し方でも印象は変わります。Realtimeセッションは録音ボタンからのみ開始し、キャラクタークリックは表情と吹き出しだけで反応します。": "Masculine, feminine, and neutral are listening impressions, not official OpenAI gender classifications. Language and delivery can change the impression. Realtime sessions start only from the microphone button; clicking the character reacts with an expression and bubble only.",
    "AIの返答を音声で読み上げる": "Read AI responses aloud",
    "読み上げのON/OFFは全キャラクター共通です": "The speech on/off setting is shared by all characters",
    "音声方式": "Voice method",
    "Windows標準": "Windows system voice",
    "piper-plus（ローカル）": "piper-plus (local)",
    "Supertonic 3（ローカル）": "Supertonic 3 (local)",
    "モデルID": "Model ID",
    "速度（0.5–2.0×）": "Speed (0.5–2.0×)",
    "サンプルモデルを確認しています…": "Checking sample model…",
    "サンプルをダウンロード": "Download sample",
    "声: つくよみちゃん。利用規約とクレジットを確認して初回だけ取得します。": "Voice: Tsukuyomi-chan. Review the terms and credits before the one-time download.",
    "つくよみちゃん音声のクレジット・利用条件": "Tsukuyomi-chan voice credits and terms",
    "本ソフトウェアの音声合成には、フリー素材キャラクター「つくよみちゃん」（© Rei Yumesaki）が無料公開している音声データを使用しています。": "Speech synthesis uses voice data published free of charge by the free-material character Tsukuyomi-chan (© Rei Yumesaki).",
    "つくよみちゃんコーパス（CV.夢前黎） · https://tyc.rei-yumesaki.net/material/corpus/": "Tsukuyomi-chan Corpus (CV: Rei Yumesaki) · https://tyc.rei-yumesaki.net/material/corpus/",
    "人への批判・攻撃、政治・宗教・思想への賛否の呼びかけ、強い表現のゾーニングなしの公開、素材としての二次利用を許す公開には使用できません。": "Do not use it to attack people, advocate political/religious/ideological positions, publish strong content without appropriate separation, or distribute it for reuse as source material.",
    "piper-plusの準備状況を確認しています…": "Checking piper-plus status…",
    "手動ファイルを使う": "Use manual files",
    "実行ファイル": "Executable",
    "未選択": "Not selected",
    "選択": "Choose",
    "音声モデル": "Voice model",
    "公式sherpa-onnx用int8モデルを初回だけ取得します。": "Downloads the official int8 model for sherpa-onnx once.",
    "声": "Voice",
    "生成ステップ（2–20）": "Generation steps (2–20)",
    "手動モデルを使う": "Use a manual model",
    "モデルフォルダー": "Model folder",
    "Supertonic 3の準備状況を確認しています…": "Checking Supertonic 3 status…",
    "日本語モデルを確認しています…": "Checking Japanese model…",
    "Kokoro 82Mの日本語5音声、WebGPU推奨FP32、CPU用q8モデル（合計約421MB）を初回だけ取得します。": "Downloads Kokoro 82M with five Japanese voices, a WebGPU FP32 model, and a CPU q8 model (about 421 MB total) once.",
    "Alpha（女性）": "Alpha (feminine)",
    "Gongitsune（女性）": "Gongitsune (feminine)",
    "Nezumi（女性）": "Nezumi (feminine)",
    "Tebukuro（女性）": "Tebukuro (feminine)",
    "Kumo（男性）": "Kumo (masculine)",
    "処理方法": "Processing method",
    "自動（WebGPU優先）": "Auto (prefer WebGPU)",
    "WebGPUのみ": "WebGPU only",
    "CPUのみ": "CPU only",
    "Kokoroの準備状況を確認しています…": "Checking Kokoro status…",
    "日本語G2Pと音声生成は端末内で完結します。WebGPUで失敗した場合、「自動」ではCPUへ切り替わります。": "Japanese G2P and speech generation stay on this device. Auto mode falls back to CPU if WebGPU fails.",
    "FP16モデルをダウンロード": "Download FP16 model",
    "必要なFP16ファイルだけ取得します。WebGPU対応GPUと約1.3GBの保存容量を使います。": "Downloads only the required FP16 files. Requires a WebGPU-capable GPU and about 1.3 GB of storage.",
    "参照音声": "Reference voice",
    "未追加": "None added",
    "音声を追加": "Add voice",
    "名前を変更": "Rename",
    "削除": "Delete",
    "WAV / MP3 / M4A / AAC / OGG / FLAC / WebMを48kHz WAVへ変換し、アプリ内へコピーします。元ファイルを削除しても使えます。": "Converts WAV, MP3, M4A, AAC, OGG, FLAC, or WebM to 48 kHz WAV and copies it into the app, so the original can be deleted.",
    "再生速度（0.5–2.0×）": "Playback speed (0.5–2.0×)",
    "生成方式": "Generation method",
    "高速（Sway）": "Fast (Sway)",
    "互換（Linear）": "Compatible (Linear)",
    "生成ステップ（4–40）": "Generation steps (4–40)",
    "高速設定はSway 8ステップです。音質が合わない場合は10～12ステップ、またはLinearへ戻せます。": "Fast mode uses 8 Sway steps. If the quality does not fit, try 10–12 steps or switch back to Linear.",
    "シード": "Seed",
    "Irodori TTSの準備状況を確認しています…": "Checking Irodori TTS status…",
    "テキストと参照音声は端末内で処理されます。本人の許可がある声、または利用権を持つ音声だけを使用してください。": "Text and reference audio are processed on this device. Use only voices with the speaker's permission or appropriate usage rights.",
    "同梱参照音声のクレジット": "Bundled reference voice credits",
    "Hiro: ochisamu本人の録音・許諾音声": "Hiro: recorded and authorized by ochisamu",
    "Kohaku:": "Kohaku:",
    "あみたろの声素材工房": "あみたろの声素材工房 (Amitaro's Voice Material Workshop)",
    "の音声素材を使用しています。": ".",
    "利用規約": "Terms of use",
    "FP16モデル": "FP16 model",
    "英単語を日本語読みする": "Pronounce English words in Japanese",
    "ユーザー辞書とCMUdictの発音を読み上げ時だけ使用": "Use the user dictionary and CMUdict only for speech",
    "英単語のユーザー辞書": "English pronunciation dictionary",
    "1行に1件、英字=読み": "One entry per line: English=reading",
    "CharaDock=キャラドック\nFooBar=フーバー": "CharaDock=キャラドック\nFooBar=フーバー",
    "ユーザー辞書を最優先し、未登録語は技術用語辞書、略語、CMUdictの順で読みを決めます。表示文、URL、ファイル名は変更しません。": "The user dictionary has priority, followed by the technical-term dictionary, abbreviations, and CMUdict. Display text, URLs, and file names are unchanged.",
    "この音声を試す": "Test this voice",
    "キャラクターウィンドウ": "Character window",
    "表示するモニター": "Display",
    "メインモニター": "Primary display",
    "キャラクターを表示": "Show character",
    "一時的に隠す": "Hide temporarily",
    "− 小さく": "− Smaller",
    "＋ 大きく": "+ Larger",
    "画面右下へ戻す": "Reset to bottom right",
    "キャラクター本体をドラッグして移動できます。クリック透過中はドラッグできません。": "Drag the character to move it. Dragging is unavailable while click-through is on.",
    "初回セットアップをもう一度開く": "Run first-time setup again",
    "ショートカット": "Shortcuts",
    "どこからでも入力欄を開く": "Open input from anywhere",
    "設定を開く": "Open settings",
    "クリック透過を切替": "Toggle click-through",
    "キャラクター表示を切替": "Toggle character visibility",
    "ライセンス": "Licenses",
    "配布とクレジット": "Distribution and credits",
    "CharaDockは、Apache License 2.0のPuruPuru PNGTuberを基にした非公式派生アプリです。元開発者による公式製品ではありません。": "CharaDock is an unofficial derivative app based on PuruPuru PNGTuber under the Apache License 2.0. It is not an official product of the original developer.",
    "旧デモキャラクターと旧faviconは配布物に含めていません。画像を追加・公開するときは、アップロード・加工・配布に必要な権利を利用者自身で確認してください。": "The former demo character and favicon are not included. When adding or publishing images, confirm that you hold the rights required to upload, modify, and distribute them.",
    "同梱のKohaku参照音声には、": "The bundled Kohaku reference voice uses voice material from ",
    "同梱文書: LICENSE / NOTICE / MODIFICATIONS.md / DISTRIBUTION_ASSET_LICENSE.md / THIRD_PARTY_NOTICES.md": "Included documents: LICENSE / NOTICE / MODIFICATIONS.md / DISTRIBUTION_ASSET_LICENSE.md / THIRD_PARTY_NOTICES.md",
    "はじめに": "Welcome",
    "最初の3分セットアップ": "Three-minute setup",
    "あとで設定": "Set up later",
    "進行状況": "Progress",
    "1 · AI接続": "1 · AI Connection",
    "ChatGPTと接続": "Connect to ChatGPT",
    "Codex app-serverはCodex CLIのChatGPTログインを使います。APIキーを画面へ渡しません。": "Codex app-server uses the Codex CLI's ChatGPT sign-in and does not expose an API key to the interface.",
    "ログイン状態を確認しています…": "Checking sign-in status…",
    "2 · キャラクター": "2 · Character",
    "最初のキャラクター": "Choose your first character",
    "同梱の4キャラから選べます。一枚絵からの追加はCodex Avatar Studioで行えます。": "Choose from four built-in characters. You can create another from one image in Codex Avatar Studio.",
    "＋ 自分の画像からキャラを追加": "+ Create from my image",
    "画像を追加する場合、その画像をアップロード・加工・利用する権利が必要です。生成処理では画像がCodexへ送信されます。": "You must have the rights to upload, modify, and use any image you add. Generation sends the image to Codex.",
    "3 · 音声": "3 · Voice",
    "声を確認": "Check the voice",
    "Windows標準の日本語音声でAIの返答を読み上げます。追加の音声API料金はありません。": "Reads AI responses with the standard Windows Japanese voice, with no additional speech API fees.",
    "音声読み上げを使う": "Read responses aloud",
    "後からデスクトップ設定で変更できます": "You can change this later in Desktop settings",
    "音声をテスト": "Test voice",
    "戻る": "Back",
    "次へ": "Next",
    "依頼を許可": "Allow request",
    "やめる": "Cancel",
    "全文": "Full text",
    "会話モードと作業モードを切り替える": "Switch between chat and work mode",
    "作業先フォルダーを変更する": "Change work folder",
    "履歴": "History",
    "履歴を開く": "Open history",
    "メッセージ": "Message",
    "短く話しかける…": "Say something…",
    "応答を中断": "Stop response",
    "会話入力を開く": "Open chat input",
    "会話と作業の記録": "Chat and work history",
    "作業履歴を閉じる": "Close work history",
    "キャラクターに触れる": "Interact with character",
    "ドラッグで移動・クリックで触れる": "Drag to move; click to interact",
    "作業履歴": "Work history",
    "会話履歴": "Chat history",
    "まだ作業履歴はありません": "No work history yet",
    "このキャラクターとの会話はまだありません": "No conversations with this character yet",
    "作業中": "Working",
    "中断中": "Stopping",
    "完了": "Completed",
    "エラー": "Error",
    "キャラクター": "Character",
    "あなた": "You",
    "作業内容なし": "No work request",
    "中断しています…": "Stopping…",
    "会話モードへ戻す": "Switch to chat mode",
    "作業モードへ切り替える": "Switch to work mode",
    "未選択": "Not selected",
    "このフォルダーでやること…": "What should I do in this folder?",
    "作業履歴を開く": "Open work history",
    "会話履歴を開く": "Open chat history",
    "会話履歴を閉じる": "Close chat history"
    ,"中性的": "Neutral"
    ,"女性寄り": "Feminine"
    ,"男性寄り": "Masculine"
    ,"気さくで万能": "Friendly and versatile"
    ,"活発で誠実": "Energetic and sincere"
    ,"落ち着いて率直": "Calm and direct"
    ,"自信があり前向き": "Confident and positive"
    ,"開放的で明るい": "Open and bright"
    ,"陽気で率直": "Cheerful and candid"
    ,"聡明でリラックス": "Smart and relaxed"
    ,"穏やかで肯定的": "Gentle and affirming"
    ,"明るく好奇心旺盛": "Bright and curious"
    ,"モデルを展開しています…": "Extracting model…"
    ,"日本語音声モデルはまだダウンロードされていません。": "The Japanese speech model has not been downloaded yet."
    ,"サンプルモデルはまだダウンロードされていません。": "The sample model has not been downloaded yet."
    ,"このサンプルの自動導入はWindows版で利用できます。": "Automatic sample installation is available on Windows."
    ,"会話スタイルを設定できます": "Conversation style can be customized"
    ,"読込": "Imported"
    ,"作成済み": "Created"
    ,"呼び名": "Preferred name"
    ,"好み": "Preference"
    ,"関係性": "Relationship"
    ,"目標": "Goal"
    ,"背景": "Background"
    ,"その他": "Other"
    ,"まだメモリはありません。普段どおり会話すると、今後も役立つ好みや呼び名をこのキャラだけが自動で覚えます。": "No memories yet. As you chat normally, this character will remember useful preferences and names for future conversations."
    ,"まだメモリはありません。会話から自動で覚える機能はCodex app-server接続で利用できます。": "No memories yet. Automatic learning from conversations is available with Codex app-server."
    ,"セットアップ完了": "Finish setup"
    ,"音声モデルは未導入です。後から選択できます。": "No voice model is installed. You can choose one later."
    ,"ローカル音声合成の準備ができています。": "Local speech synthesis is ready."
    ,"Supertonic 3のローカル音声合成を利用できます。": "Supertonic 3 local speech synthesis is available."
    ,"モデルは未導入です。後からフォルダーを選択できます。": "No model is installed. You can choose a folder later."
    ,"Kokoroの日本語モデルは未導入です。": "The Kokoro Japanese model is not installed."
    ,"このPCではWebGPUを利用できません。自動またはCPUを選んでください。": "WebGPU is unavailable on this PC. Choose Auto or CPU."
    ,"KokoroをWebGPUで利用できます。初回生成時にモデルをGPUへ読み込みます。": "Kokoro can use WebGPU. The model loads onto the GPU on first generation."
    ,"Kokoroを利用できます。WebGPUが使えない場合はCPUへ自動で切り替わります。": "Kokoro is available and will fall back to CPU if WebGPU cannot be used."
    ,"KokoroをCPUで利用できます。": "Kokoro can use the CPU."
    ,"WebGPUを利用できません。GPUドライバーを確認してください。": "WebGPU is unavailable. Check your GPU driver."
    ,"FP16モデルは未導入です。後からフォルダーを選択できます。": "The FP16 model is not installed. You can choose a folder later."
    ,"本人の許可がある参照音声を追加してください。": "Add a reference voice with the speaker's permission."
    ,"Irodori TTSのWebGPU音声合成を利用できます。": "Irodori TTS WebGPU speech synthesis is available."
    ,"モデルと参照音声を確認しました。初回生成時にWebGPUを確認します。": "Model and reference voice are ready. WebGPU will be checked on first generation."
    ,"自動（メインモニター）": "Auto (primary display)"
    ,"OpenAI Responses APIを使用します。": "Using OpenAI Responses API."
    ,"アカウント確認中": "Checking account"
    ,"APIキー設定済み": "API key configured"
    ,"接続済み": "Connected"
    ,"ChatGPTにログインしていません。": "Not signed in to ChatGPT."
    ,"ChatGPT未ログイン": "Not signed in to ChatGPT"
    ,"再確認": "Check again"
    ,"接続を確認できません": "Unable to verify connection"
    ,"ChatGPTログインを確認しました。": "ChatGPT sign-in confirmed."
    ,"話してください…": "Start speaking…"
    ,"聞き取っています…": "Listening…"
    ,"Codexが考えています…": "Codex is thinking…"
    ,"考え中": "Thinking"
    ,"応答を待っています…": "Waiting for a response…"
    ,"Codexから応答しました。": "Received a response from Codex."
    ,"OpenAI APIから応答しました。": "Received a response from the OpenAI API."
    ,"応答を中断しました。続けて修正できます。": "Response stopped. You can send a correction."
    ,"応答を中断しました。": "Response stopped."
    ,"画像を読み込んでいます…": "Loading image…"
    ,"中断しています…": "Stopping…"
    ,"新しい会話を始めよう。何を話す？": "Let's start a new conversation. What would you like to talk about?"
    ,"保存して会話へ反映しました。": "Saved and applied to conversations."
    ,"初期設定へ戻しました。": "Defaults restored."
    ,"このキャラのメモリから削除しました。": "Removed from this character's memories."
    ,"接続を確認しています…": "Checking connection…"
    ,"起動エラー": "Startup error"
    ,"作業を実行しています": "Work is in progress"
    ,"今回だけ許可してもいい？": "Allow this request once?"
    ,"今回だけ見る": "View once"
    ,"操作を許可": "Allow control"
    ,"ブラウザを許可": "Allow browser"
    ,"閉じる": "Close"
    ,"画面を1枚だけ取得しています…": "Capturing one screenshot…"
    ,"Windows操作を準備しています…": "Preparing Windows control…"
    ,"専用ブラウザを準備しています…": "Preparing the dedicated browser…"
    ,"画面を確認しました": "Screen checked"
    ,"Windows操作が完了しました": "Windows task completed"
    ,"ブラウザ確認が完了しました": "Browser task completed"
    ,"作業を開始…": "Starting work…"
    ,"考え中…": "Thinking…"
    ,"作業を中断しました": "Work stopped"
    ,"送信できませんでした": "Could not send"
    ,"音声入力は詳細画面で利用できます": "Voice input is available in the full window"
    ,"音声待機を停止": "Stop voice standby"
    ,"音声待機中…そのまま話してください": "Voice standby… start speaking"
    ,"音声を入力しました": "Voice input added"
    ,"作業を開始しています": "Starting work"
    ,"作業中…": "Working…"
    ,"作業完了": "Work completed"
    ,"作業を完了できませんでした": "Could not complete the work"
  });

  const PATTERNS = Object.freeze([
    [/^(.+)のプレビュー$/, "$1 preview"],
    [/^(.+)に切り替えました。$/, "Switched to $1."],
    [/^(.+)の設定$/, "$1 settings"],
    [/^作業先[ ·:：]+(.+)$/, "Work folder · $1"],
    [/^(\d+)件を保持$/, "$1 saved"],
    [/^(\d+)往復を保持$/, "$1 exchanges saved"],
    [/^進捗履歴（(\d+)件）$/, "Progress history ($1)"],
    [/^エラー[:：]\s*(.+)$/, "Error: $1"],
    [/^起動エラー[:：]\s*(.+)$/, "Startup error: $1"],
    [/^(.+)を削除しました。$/, "Deleted $1."],
    [/^(.+)でログイン済み$/, "Signed in with $1"],
    [/^モデルをダウンロードしています…\s*(\d+)%\s*(.*)$/, "Downloading model… $1% $2"],
    [/^ダウンロード（約(.+)）$/, "Download (about $1)"],
    [/^(.+) · 利用できます$/, "$1 · Available"],
    [/^(.+) · 導入済み$/, "$1 · Installed"],
    [/^(.+)（保存済み）$/, "$1 (saved)"],
    [/^(.+)（声の印象）$/, "$1 (voice impression)"],
    [/^(\d+)種類のRealtime音声を利用できます。$/, "$1 Realtime voices available."],
    [/^モデル一覧を取得できません[:：]\s*(.+)$/, "Could not retrieve model list: $1"],
    [/^音声一覧を取得できません[:：]\s*(.+)$/, "Could not retrieve voice list: $1"],
    [/^切り替えられませんでした[:：]\s*(.+)$/, "Could not switch: $1"],
    [/^メモリ「(.+)」を削除$/, "Delete memory “$1”"],
    [/^モデルファイルが不足しています（(\d+)件）。$/, "$1 model files are missing."],
    [/^APIキー設定済み（(.+)）$/, "API key configured ($1)"],
    [/^Codex CLIを確認できません[:：]\s*(.+)$/, "Could not verify Codex CLI: $1"],
    [/^音声入力[:：]\s*(.+)$/, "Voice input: $1"],
    [/^(.+)で生成しています…$/, "Generating with $1…"],
    [/^(.+)から音声データが返されませんでした。音声出力がONか確認してください。$/, "$1 returned no audio. Check that voice output is enabled."],
    [/^(.+) を確認しています…$/, "Checking $1…"],
    [/^(.+) を使用します。$/, "Using $1."],
    [/^作業先[:：]\s*(.+)$/, "Work folder: $1"],
  ]);

  function translateText(value, language = "ja") {
    const source = String(value ?? "");
    if (language !== "en") return source;
    if (Object.prototype.hasOwnProperty.call(ENGLISH, source)) return ENGLISH[source];
    for (const [pattern, replacement] of PATTERNS) {
      if (pattern.test(source)) return source.replace(pattern, replacement);
    }
    return source;
  }

  const api = { translateText, translations: ENGLISH };
  if (typeof module === "object" && module.exports) module.exports = api;
  if (!root || typeof root.document === "undefined") return;

  const textSources = new WeakMap();
  const attributeSources = new WeakMap();
  let activeLanguage = "ja";
  let translating = false;
  const attributes = ["placeholder", "aria-label", "title"];

  function translatedWhitespace(value, language) {
    const match = String(value).match(/^(\s*)(.*?)(\s*)$/s);
    return `${match[1]}${translateText(match[2], language)}${match[3]}`;
  }

  function translateNode(node) {
    if (node.nodeType === 3) {
      let source = textSources.get(node);
      if (!source || node.nodeValue !== source.rendered) source = { original: node.nodeValue, rendered: node.nodeValue };
      source.rendered = translatedWhitespace(source.original, activeLanguage);
      textSources.set(node, source);
      if (node.nodeValue !== source.rendered) node.nodeValue = source.rendered;
      return;
    }
    if (node.nodeType !== 1) return;
    let sources = attributeSources.get(node);
    if (!sources) {
      sources = new Map();
      attributeSources.set(node, sources);
    }
    for (const name of attributes) {
      if (!node.hasAttribute(name)) continue;
      const current = node.getAttribute(name);
      const previous = sources.get(name);
      const original = previous && current === previous.rendered ? previous.original : current;
      const rendered = translateText(original, activeLanguage);
      sources.set(name, { original, rendered });
      if (current !== rendered) node.setAttribute(name, rendered);
    }
    for (const child of node.childNodes) translateNode(child);
  }

  function apply() {
    translating = true;
    translateNode(document.documentElement);
    document.documentElement.lang = activeLanguage;
    translating = false;
  }

  api.setLanguage = (language) => {
    activeLanguage = language === "en" ? "en" : "ja";
    document.documentElement.dataset.uiLanguage = activeLanguage;
    apply();
  };
  api.getLanguage = () => activeLanguage;
  root.CharaDockI18n = api;

  const observer = new MutationObserver((records) => {
    if (translating) return;
    translating = true;
    for (const record of records) {
      if (record.type === "characterData") translateNode(record.target);
      else if (record.type === "attributes") translateNode(record.target);
      else for (const node of record.addedNodes) translateNode(node);
    }
    translating = false;
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });
  api.setLanguage(document.documentElement.dataset.uiLanguage || "ja");
})(typeof window !== "undefined" ? window : null);
