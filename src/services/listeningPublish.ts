import { strToU8, zipSync } from "fflate";
import { getScriptLineText, type ListeningBookSet, type ListeningLesson } from "../types/listening";
import { loadLocalAudioFile } from "./localAudioStorage";

interface PublishedLesson extends Omit<ListeningLesson, "audio" | "audioUrl" | "audioFileId"> {
  bookName: string;
  audio: { id: string; filename: string; path: string; mimeType?: string } | null;
  settings: { furiganaVisible: boolean; translationVisible: boolean };
}

interface PublishedData {
  version: number;
  updatedAt: string;
  books: Array<{ id: string; name: string; description?: string }>;
  lessons: PublishedLesson[];
}

interface JsonRecord {
  [key: string]: unknown;
  id?: unknown;
  name?: unknown;
  description?: unknown;
  lessons?: unknown;
  books?: unknown;
  audio?: unknown;
  path?: unknown;
  url?: unknown;
  sourceUrl?: unknown;
  bookId?: unknown;
  bookName?: unknown;
  sourceType?: unknown;
  script?: unknown;
  filename?: unknown;
  speaker?: unknown;
  text?: unknown;
  japanese?: unknown;
  furigana?: unknown;
  translation?: unknown;
  unit?: unknown;
  number?: unknown;
  title?: unknown;
  source?: unknown;
}

function safeFilename(value: string, fallback: string) {
  const basename = value.replace(/\\/g, "/").split("/").pop() ?? "";
  const safe = basename.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe || fallback;
}

export async function createListeningExport(books: ListeningBookSet[]) {
  const files: Record<string, Uint8Array> = {};
  const occupiedFilenames = new Set<string>();
  const lessons: PublishedLesson[] = [];

  for (const bookSet of books) {
    for (const lesson of bookSet.lessons) {
      let audio: PublishedLesson["audio"] = null;
      let sourceUrl = lesson.sourceUrl;

      if (lesson.audioFileId) {
        const blob = await loadLocalAudioFile(lesson.audioFileId);
        if (!blob) {
          throw new Error(`Không tìm thấy audio local của bài "${lesson.title}". Hãy chọn lại file audio trước khi export.`);
        }
        let filename = safeFilename(lesson.fileName ?? "", `${lesson.id}.mp3`);
        if (occupiedFilenames.has(filename)) filename = `${safeFilename(String(lesson.id), "lesson")}-${filename}`;
        occupiedFilenames.add(filename);
        files[`public/uploads/audio/${filename}`] = new Uint8Array(await blob.arrayBuffer());
        sourceUrl = `/uploads/audio/${filename}`;
        audio = {
          id: lesson.audioFileId,
          filename,
          path: sourceUrl,
          ...((lesson.audioMimeType || blob.type) ? { mimeType: lesson.audioMimeType || blob.type } : {}),
        };
      } else if (lesson.source === "local" && !sourceUrl.startsWith("/uploads/audio/") && !sourceUrl.startsWith("/audio/")) {
        throw new Error(`Bài "${lesson.title}" chưa có audio có thể export. Hãy tải lại file audio.`);
      } else if (sourceUrl) {
        audio = {
          id: lesson.sourceId ?? String(lesson.id),
          filename: safeFilename(lesson.fileName ?? "", ""),
          path: sourceUrl,
          ...(lesson.audioMimeType ? { mimeType: lesson.audioMimeType } : {}),
        };
      }

      const { audio: _audio, audioUrl: _audioUrl, audioFileId: _audioFileId, ...lessonMetadata } = lesson;
      lessons.push({
        ...lessonMetadata,
        sourceUrl,
        bookName: bookSet.book.name,
        audio,
        script: lesson.script.map((line, index) => ({
          ...line,
          id: line.id ?? `${lesson.id}-line-${index + 1}`,
          japanese: getScriptLineText(line),
        })),
        settings: { furiganaVisible: false, translationVisible: false },
      });
    }
  }

  const data: PublishedData = {
    version: 1,
    updatedAt: new Date().toISOString(),
    books: books.map(({ book }) => ({ id: book.id, name: book.name, ...(book.description ? { description: book.description } : {}) })),
    lessons,
  };
  files["public/data/lessons.json"] = strToU8(`${JSON.stringify(data, null, 2)}\n`);
  return { blob: new Blob([zipSync(files, { level: 0 })], { type: "application/zip" }), lessonCount: lessons.length };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePublishedListeningData(value: unknown): ListeningBookSet[] {
  if (!isRecord(value) || !Array.isArray(value.lessons)) {
    throw new Error("Dữ liệu publish không đúng định dạng.");
  }

  const declaredBooks = Array.isArray(value.books) ? value.books.filter(isRecord) : [];
  const books = new Map<string, ListeningBookSet>();
  for (const item of declaredBooks) {
    if (typeof item.id !== "string" || typeof item.name !== "string") continue;
    books.set(item.id, {
      book: { id: item.id, name: item.name, description: typeof item.description === "string" ? item.description : undefined },
      lessons: [],
    });
  }

  value.lessons.forEach((entry, index) => {
    if (!isRecord(entry)) return;
    const audio = isRecord(entry.audio) ? entry.audio : null;
    const sourceUrl = typeof entry.sourceUrl === "string"
      ? entry.sourceUrl
      : typeof audio?.path === "string"
        ? audio.path
        : typeof audio?.url === "string"
          ? audio.url
        : typeof entry.audio === "string" ? entry.audio : "";
    const bookId = typeof entry.bookId === "string" ? entry.bookId : "published-listening";
    const bookSet = books.get(bookId) ?? {
      book: {
        id: bookId,
        name: typeof entry.bookName === "string" ? entry.bookName : "Listening",
      },
      lessons: [],
    };
    books.set(bookId, bookSet);

    const sourceType = entry.sourceType === "youtube" || entry.sourceType === "googleDrive" || entry.sourceType === "drive"
      ? entry.sourceType
      : /youtu\.be|youtube\.com/i.test(sourceUrl)
        ? "youtube"
        : /drive\.google\.com/i.test(sourceUrl) ? "googleDrive" : "directAudio";
    const script = Array.isArray(entry.script) ? entry.script.filter(isRecord).map((line, lineIndex) => ({
      id: typeof line.id === "string" ? line.id : `${String(entry.id ?? index)}-line-${lineIndex + 1}`,
      speaker: typeof line.speaker === "string" ? line.speaker : "",
      text: typeof line.text === "string" ? line.text : typeof line.japanese === "string" ? line.japanese : "",
      japanese: typeof line.japanese === "string" ? line.japanese : typeof line.text === "string" ? line.text : "",
      furigana: Array.isArray(line.furigana) || typeof line.furigana === "string" ? line.furigana : [],
      translation: typeof line.translation === "string" ? line.translation : undefined,
    })) : [];

    bookSet.lessons.push({
      ...entry,
      id: typeof entry.id === "string" || typeof entry.id === "number" ? entry.id : `published-${index + 1}`,
      bookId,
      unit: Number(entry.unit) || 1,
      number: Number(entry.number) || index + 1,
      title: typeof entry.title === "string" ? entry.title : "Untitled listening",
      source: entry.source === "youtube" || entry.source === "google-drive" ? entry.source : "local",
      sourceType,
      sourceUrl,
      audio: sourceUrl || undefined,
      audioUrl: sourceUrl || undefined,
      audioFileId: undefined,
      fileName: typeof audio?.filename === "string" ? audio.filename : undefined,
      hasScript: script.length > 0,
      script,
    } as ListeningLesson);
  });

  return [...books.values()].map((bookSet) => ({
    ...bookSet,
    lessons: bookSet.lessons.sort((left, right) => left.unit - right.unit || left.number - right.number),
  }));
}