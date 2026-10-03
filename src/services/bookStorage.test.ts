import assert from "node:assert/strict";
import { isGkiBook } from "./bookStorage";

const vocabularyEntry = {
  id: 1,
  source: "Giữa kì_名詞",
  unit: "9_10_11_12",
  number: 1,
  word: "貿易",
  reading: "ぼうえき",
  meaning: "Thương mại",
  type: "名詞",
  example: {
    sentence: "日本はアメリカと貿易をしています。",
    reading: "にほんはあめりかとぼうえきをしています。",
    meaning: "Nhật Bản giao thương với Mỹ.",
  },
};

assert.equal(isGkiBook([vocabularyEntry]), true);
assert.equal(isGkiBook([{ ...vocabularyEntry, unit: "" }]), false);
assert.equal(isGkiBook([{ ...vocabularyEntry, unit: 9 }]), true);

console.log("Vocabulary book unit validation checks passed.");
