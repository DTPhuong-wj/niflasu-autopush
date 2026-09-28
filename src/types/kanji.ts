export interface KanjiWord {
  word: string;
  reading: string;
  meaning: string;
  mnemonic: string;
}

export interface Kanji {
  id: number;
  source: string;
  week: number;
  day: number;
  number: number;
  kanji: string;
  on: string;
  kun: string;
  hanViet: string;
  words: KanjiWord[];
}

/** Thiết lập người dùng, lưu trong localStorage. */
export interface Settings {
  examDate: string; // ISO local: "2026-12-05T08:00"
  targetLevel: "N5" | "N4" | "N3" | "N2" | "N1";
  targetScore: number;
}
