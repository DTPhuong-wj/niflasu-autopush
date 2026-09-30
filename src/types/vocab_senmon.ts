import type { Example } from "./vocabulary";

export interface Vocabulary {
  id: number;
  source: string;
  unit: number;
  number: number;
  word: string;
  type?: string;
  reading: string;
  meaning: string;
  example?: Example;
}