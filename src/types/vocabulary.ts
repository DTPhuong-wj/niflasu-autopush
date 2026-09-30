export interface RelatedWord {
  word?: string;
  reading?: string;
  type?: string;
  formula?: string;
}

export interface Example {
  sentence: string;
  reading: string;
  meaning: string;
}

export interface Vocabulary {
  id: number;
  source: string;
  unit: number;
  number: number;
  word: string;
  type?: string;
  reading: string;
  hanViet: string | null;
  meaning: string;
  relatedWords: RelatedWord[];
  example?: Example;
}
