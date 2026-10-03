export type ListeningSourceType = "directAudio" | "youtube" | "googleDrive" | "audio" | "drive";
export type ListeningSource = "local" | "google-drive" | "youtube";

export type DetectedListeningSourceType = "directAudio" | "youtube" | "googleDrive" | "unknown";

export interface FuriganaSegment {
  text: string;
  reading: string;
}

export interface ListeningScriptLine {
  id?: string | undefined;
  speaker: string;
  /** Japanese sentence (kept as `text` for backward compatibility). */
  text?: string | undefined;
  japanese?: string | undefined;
  furigana?: FuriganaSegment[] | string | undefined;
  translation?: string | undefined;
  needsReview?: boolean | undefined;
}

export function getScriptLineText(line: Pick<ListeningScriptLine, "text" | "japanese">): string {
  return (line.text ?? line.japanese ?? "").trim();
}

export function getFuriganaSegments(line: ListeningScriptLine): FuriganaSegment[] {
  const japanese = getScriptLineText(line);
  let segments: FuriganaSegment[];

  if (Array.isArray(line.furigana)) {
    segments = line.furigana;
  } else if (typeof line.furigana === "string") {
    segments = [...line.furigana.matchAll(/([\p{Script=Han}々ヶ]+)[（(]([^）)]+)[）)]/gu)]
      .map((match) => ({ text: match[1] ?? "", reading: match[2] ?? "" }));
  } else {
    return [];
  }

  const ordered = [...segments]
    .filter((segment) => segment.text.trim() && segment.reading.trim())
    .sort((left, right) => japanese.indexOf(left.text) - japanese.indexOf(right.text));
  const matched: FuriganaSegment[] = [];
  let cursor = 0;

  for (const segment of ordered) {
    const index = japanese.indexOf(segment.text, cursor);
    if (index < cursor) continue;
    matched.push({ text: segment.text, reading: segment.reading });
    cursor = index + segment.text.length;
  }

  return matched;
}

export interface ListeningLesson {
  id: number | string;
  bookId: string;
  unit: number;
  number: number;
  title: string;
  name?: string | undefined;
  author?: string | undefined;
  audio?: string | undefined;
  audioMimeType?: string | undefined;
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
  audioFileId?: string | undefined;
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
