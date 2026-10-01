export type ListeningSourceType = "directAudio" | "youtube" | "googleDrive" | "audio" | "drive";
export type ListeningSource = "local" | "google-drive" | "youtube";

export type DetectedListeningSourceType = "directAudio" | "youtube" | "googleDrive" | "unknown";

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
  level?: string;
  description?: string;
  source?: ListeningSource;
  audioUrl?: string;
  sourceType: ListeningSourceType;
  sourceUrl: string;
  sourceId?: string;
  googleDriveUrl?: string;
  googleDriveId?: string;
  directUrl?: string;
  fileName?: string;
  duration?: number | string;
  thumbnailUrl?: string;
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
