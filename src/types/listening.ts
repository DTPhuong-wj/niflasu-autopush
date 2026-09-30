export type ListeningSourceType = "directAudio" | "youtube" | "googleDrive" | "audio" | "drive";

export interface ListeningScriptLine {
  speaker: string;
  text: string;
}

export interface ListeningLesson {
  id: number | string;
  bookId: string;
  unit: number;
  number: number;
  title: string;
  audioUrl?: string;
  sourceType: ListeningSourceType;
  sourceUrl: string;
  duration?: number | string;
  hasScript: boolean;
  script: ListeningScriptLine[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ListeningBook {
  id: string;
  name: string;
  description?: string;
}

export interface ListeningBookSet {
  book: ListeningBook;
  lessons: ListeningLesson[];
}
