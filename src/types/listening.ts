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
  level?: string | undefined;
  description?: string | undefined;
  source?: ListeningSource | undefined;
  audioUrl?: string | undefined;
  sourceType: ListeningSourceType;
  sourceUrl: string;
  sourceId?: string | undefined;
  googleDriveUrl?: string | undefined;
  googleDriveId?: string | undefined;
  directUrl?: string | undefined;
  fileName?: string | undefined;
  duration?: number | string | undefined;
  thumbnailUrl?: string | undefined;
  hasScript: boolean;
  script: ListeningScriptLine[];
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

export interface ListeningBook {
  id: string;
  name: string;
  description?: string | undefined;
}

export interface ListeningBookSet {
  book: ListeningBook;
  lessons: ListeningLesson[];
}
