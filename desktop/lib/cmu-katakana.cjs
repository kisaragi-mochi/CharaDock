// SPDX-License-Identifier: Apache-2.0

const VOWELS = new Set(["AA", "AE", "AH", "AO", "AW", "AY", "EH", "ER", "EY", "IH", "IY", "OW", "OY", "UH", "UW"]);

const ROWS = Object.freeze({
  B: ["バ", "ビ", "ブ", "ベ", "ボ"], P: ["パ", "ピ", "プ", "ペ", "ポ"],
  K: ["カ", "キ", "ク", "ケ", "コ"], G: ["ガ", "ギ", "グ", "ゲ", "ゴ"],
  T: ["タ", "ティ", "トゥ", "テ", "ト"], D: ["ダ", "ディ", "ドゥ", "デ", "ド"],
  S: ["サ", "シ", "ス", "セ", "ソ"], Z: ["ザ", "ジ", "ズ", "ゼ", "ゾ"],
  SH: ["シャ", "シ", "シュ", "シェ", "ショ"], ZH: ["ジャ", "ジ", "ジュ", "ジェ", "ジョ"],
  CH: ["チャ", "チ", "チュ", "チェ", "チョ"], JH: ["ジャ", "ジ", "ジュ", "ジェ", "ジョ"],
  F: ["ファ", "フィ", "フ", "フェ", "フォ"], V: ["ヴァ", "ヴィ", "ヴ", "ヴェ", "ヴォ"],
  TH: ["サ", "シ", "ス", "セ", "ソ"], DH: ["ザ", "ジ", "ズ", "ゼ", "ゾ"],
  HH: ["ハ", "ヒ", "フ", "ヘ", "ホ"], M: ["マ", "ミ", "ム", "メ", "モ"],
  N: ["ナ", "ニ", "ヌ", "ネ", "ノ"], L: ["ラ", "リ", "ル", "レ", "ロ"],
  R: ["ラ", "リ", "ル", "レ", "ロ"], W: ["ワ", "ウィ", "ウ", "ウェ", "ウォ"],
  Y: ["ヤ", "イ", "ユ", "イェ", "ヨ"],
});

const CODAS = Object.freeze({
  B: "ブ", CH: "チ", D: "ド", DH: "ズ", F: "フ", G: "グ", HH: "", JH: "ジ", K: "ク",
  L: "ル", M: "ン", N: "ン", NG: "ング", P: "プ", R: "ル", S: "ス", SH: "シュ", T: "ト",
  TH: "ス", V: "ヴ", W: "ウ", Y: "イ", Z: "ズ", ZH: "ジュ",
});

const CLUSTER_PREFIX = Object.freeze({
  B: "ブ", CH: "チ", D: "ド", F: "フ", G: "グ", K: "ク", P: "プ", S: "ス", SH: "シュ",
  T: "ト", TH: "ス", V: "ヴ", Z: "ズ",
});

const PALATAL = Object.freeze({
  BY: ["ビャ", "ビ", "ビュ", "ビェ", "ビョ"], CHY: ["チャ", "チ", "チュ", "チェ", "チョ"],
  DY: ["ヂャ", "ヂ", "ヂュ", "ヂェ", "ヂョ"], FY: ["フャ", "フィ", "フュ", "フィェ", "フョ"],
  GY: ["ギャ", "ギ", "ギュ", "ギェ", "ギョ"], HHY: ["ヒャ", "ヒ", "ヒュ", "ヒェ", "ヒョ"],
  JHY: ["ジャ", "ジ", "ジュ", "ジェ", "ジョ"], KY: ["キャ", "キ", "キュ", "キェ", "キョ"],
  LY: ["リャ", "リ", "リュ", "リェ", "リョ"], MY: ["ミャ", "ミ", "ミュ", "ミェ", "ミョ"],
  NY: ["ニャ", "ニ", "ニュ", "ニェ", "ニョ"], PY: ["ピャ", "ピ", "ピュ", "ピェ", "ピョ"],
  RY: ["リャ", "リ", "リュ", "リェ", "リョ"], SHY: ["シャ", "シ", "シュ", "シェ", "ショ"],
  TY: ["チャ", "チ", "チュ", "チェ", "チョ"], VY: ["ヴャ", "ヴィ", "ヴュ", "ヴィェ", "ヴョ"],
  ZY: ["ジャ", "ジ", "ジュ", "ジェ", "ジョ"],
});

function normalizedPhonemes(pronunciation) {
  return String(pronunciation || "")
    .replace(/\s+#.*$/, "")
    .trim()
    .split(/\s+/)
    .map((phoneme) => phoneme.replace(/[0-2]/g, ""))
    .filter(Boolean);
}

function vowelShape(vowel) {
  if (["AA", "AE", "AH", "AW", "AY"].includes(vowel)) return 0;
  if (["IH", "IY"].includes(vowel)) return 1;
  if (["UH", "UW"].includes(vowel)) return 2;
  if (["EH", "EY"].includes(vowel)) return 3;
  if (vowel === "ER") return 0;
  return 4;
}

function vowelTail(vowel) {
  if (["IY", "UW", "AO", "OW"].includes(vowel)) return "ー";
  if (vowel === "AW") return "ウ";
  if (vowel === "AY") return "イ";
  if (vowel === "OY") return "イ";
  if (vowel === "EY") return "イ";
  if (vowel === "ER") return "ー";
  return "";
}

function bareVowel(vowel) {
  return ["ア", "イ", "ウ", "エ", "オ"][vowelShape(vowel)] + vowelTail(vowel);
}

function onsetVowel(onset, vowel) {
  if (!onset) return bareVowel(vowel);
  const shape = vowelShape(vowel);
  const palatal = PALATAL[onset.join("")];
  if (palatal) return palatal[shape] + vowelTail(vowel);
  if (onset.length === 2 && ["R", "L"].includes(onset[1]) && CLUSTER_PREFIX[onset[0]]) {
    return CLUSTER_PREFIX[onset[0]] + ROWS.R[shape] + vowelTail(vowel);
  }
  if (onset.length === 2 && onset[0] === "S" && ["K", "P", "T"].includes(onset[1])) {
    return "ス" + ROWS[onset[1]][shape] + vowelTail(vowel);
  }
  if (onset.length > 1) {
    return onset.slice(0, -1).map((item) => CODAS[item] || "").join("") + onsetVowel(onset.slice(-1), vowel);
  }
  return (ROWS[onset[0]]?.[shape] || CODAS[onset[0]] || "") + vowelTail(vowel);
}

function isSupportedCluster(first, second) {
  return Boolean(
    (second === "Y" && PALATAL[`${first}${second}`])
      || (["R", "L"].includes(second) && CLUSTER_PREFIX[first])
      || (first === "S" && ["K", "P", "T"].includes(second)),
  );
}

function arpabetToKatakana(pronunciation) {
  const phonemes = normalizedPhonemes(pronunciation);
  let output = "";
  for (let index = 0; index < phonemes.length;) {
    const current = phonemes[index];
    if (VOWELS.has(current)) {
      output += bareVowel(current);
      index += 1;
      continue;
    }
    const next = phonemes[index + 1];
    const afterNext = phonemes[index + 2];
    if (next && afterNext && !VOWELS.has(next) && VOWELS.has(afterNext) && isSupportedCluster(current, next)) {
      output += onsetVowel([current, next], afterNext);
      index += 3;
      continue;
    }
    if (next && VOWELS.has(next)) {
      output += onsetVowel([current], next);
      index += 2;
      continue;
    }
    output += CODAS[current] || "";
    index += 1;
  }
  return output.replace(/ーー+/g, "ー");
}

let cmuDictionary;

function cmuPronunciation(word) {
  if (!cmuDictionary) ({ dictionary: cmuDictionary } = require("cmu-pronouncing-dictionary"));
  const key = String(word || "").toLowerCase();
  return cmuDictionary[key] || "";
}

function cmuWordToKatakana(word) {
  const pronunciation = cmuPronunciation(word);
  return pronunciation ? arpabetToKatakana(pronunciation) : "";
}

module.exports = { arpabetToKatakana, cmuPronunciation, cmuWordToKatakana };
