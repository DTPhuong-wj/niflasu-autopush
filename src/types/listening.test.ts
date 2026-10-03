import assert from "node:assert/strict";
import { getFuriganaSegments } from "./listening";

const unitNineLine = {
  speaker: "リー",
  japanese: "大沢さん、すみません。",
  furigana: "大沢（おおさわ）、売上（うりあげ）、処理（しょり）",
};

assert.deepEqual(getFuriganaSegments(unitNineLine), [{ text: "大沢", reading: "おおさわ" }]);

assert.deepEqual(getFuriganaSegments({
  ...unitNineLine,
  furigana: "おおさわさん、すみません。",
}), []);

console.log("Unit 9 Ruby mapping checks passed.");