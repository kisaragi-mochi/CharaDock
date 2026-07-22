// SPDX-License-Identifier: Apache-2.0

// Japanese voices often spell Latin text one character at a time. Keep this
// mapping deliberately small and predictable: known product/technical words
// are read as words, while all-caps abbreviations are read as letter names.
const WORD_PRONUNCIATIONS = Object.freeze(new Map([
  ["style-bert-vits2", "スタイルバートビッツツー"],
  ["sherpa-onnx", "シェルパオニキス"],
  ["javascript", "ジャバスクリプト"],
  ["typescript", "タイプスクリプト"],
  ["microsoft", "マイクロソフト"],
  ["windows", "ウィンドウズ"],
  ["openai", "オープンエーアイ"],
  ["codex", "コーデックス"],
  ["realtime", "リアルタイム"],
  ["electron", "エレクトロン"],
  ["github", "ギットハブ"],
  ["python", "パイソン"],
  ["chrome", "クローム"],
  ["browser", "ブラウザー"],
  ["computer", "コンピューター"],
  ["desktop", "デスクトップ"],
  ["server", "サーバー"],
  ["model", "モデル"],
  ["stream", "ストリーム"],
  ["audio", "オーディオ"],
  ["voice", "ボイス"],
  ["download", "ダウンロード"],
  ["update", "アップデート"],
  ["mouse", "マウス"],
  ["click", "クリック"],
  ["google", "グーグル"],
  ["style", "スタイル"],
  ["bert", "バート"],
  ["sherpa", "シェルパ"],
  ["onnx", "オニキス"],
  ["app", "アプリ"],
]));

const LETTER_NAMES = Object.freeze({
  A: "エー", B: "ビー", C: "シー", D: "ディー", E: "イー", F: "エフ", G: "ジー",
  H: "エイチ", I: "アイ", J: "ジェー", K: "ケー", L: "エル", M: "エム", N: "エヌ",
  O: "オー", P: "ピー", Q: "キュー", R: "アール", S: "エス", T: "ティー", U: "ユー",
  V: "ブイ", W: "ダブリュー", X: "エックス", Y: "ワイ", Z: "ゼット",
});

function normalizeSpeechPronunciation(value) {
  const text = String(value || "");
  if (!text) return "";
  return text.replace(/[A-Za-z][A-Za-z0-9+#._-]*/g, (token) => {
    const known = WORD_PRONUNCIATIONS.get(token.toLowerCase());
    if (known) return known;
    // File names, versions, hashes, and paths should remain intact rather than
    // being turned into misleading words.
    if (/[._\\/]/.test(token) || /\d/.test(token) && !/^vits2$/i.test(token)) return token;
    if (/^[A-Z]{2,8}$/.test(token)) return [...token].map((letter) => LETTER_NAMES[letter]).join("");
    return token;
  });
}

module.exports = { normalizeSpeechPronunciation };
