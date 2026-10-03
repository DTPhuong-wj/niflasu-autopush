import { listeningBooks } from "../data/listening";
import { extractGoogleDriveFileId } from "./listeningSources";
import type { ListeningBookSet, ListeningLesson, ListeningSourceType } from "../types/listening";

export const LISTENING_STORAGE_KEY = "niflasu-listening-books-v1";

export function normalizeSourceType(value?: string): ListeningSourceType {
  const sourceType = (value ?? "").toLowerCase();

  if (sourceType === "youtube" || sourceType === "yt") return "youtube";
  if (sourceType === "drive" || sourceType === "googleDrive" || sourceType === "googledrive") return "googleDrive";
  if (sourceType === "audio" || sourceType === "directaudio" || sourceType === "direct_audio") return "directAudio";

  return "directAudio";
}

export function parseDurationToSeconds(value: string | number): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  }

  const trimmed = value.trim();
  if (!trimmed) return 0;

  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [minutes = NaN, seconds = NaN] = trimmed.split(":").map(Number);
    return isNaN(minutes) || isNaN(seconds) ? 0 : minutes * 60 + seconds;
  }

  const numericValue = Number(trimmed);
  if (!Number.isNaN(numericValue)) {
    return Math.max(0, Math.round(numericValue));
  }

  return 0;
}

export function formatDuration(value: string | number): string {
  const seconds = typeof value === "number" ? value : parseDurationToSeconds(value);
  if (seconds <= 0) return "00:00";

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function detectSourceTypeFromUrl(rawUrl: string): ListeningSourceType {
  const url = (rawUrl ?? "").trim();
  if (!url) return "directAudio";

  if (/youtu\.be|youtube\.com|youtube-nocookie\.com/i.test(url)) return "youtube";
  if (/drive\.google\.com/i.test(url)) return "googleDrive";
  return "directAudio";
}

function normalizeGoogleDriveLesson(lesson: ListeningLesson): ListeningLesson {
  const sourceUrlFileId = extractGoogleDriveFileId(lesson.sourceUrl);
  const googleDriveUrlFileId = extractGoogleDriveFileId(lesson.googleDriveUrl ?? "");
  const directUrlFileId = extractGoogleDriveFileId(lesson.directUrl ?? "");
  const isGoogleDrive = lesson.source === "google-drive"
    || lesson.sourceType === "googleDrive"
    || lesson.sourceType === "drive"
    || Boolean(googleDriveUrlFileId || sourceUrlFileId);

  if (!isGoogleDrive) return lesson;

  const fileId = lesson.googleDriveId ?? lesson.sourceId ?? googleDriveUrlFileId ?? sourceUrlFileId ?? directUrlFileId;
  if (!fileId) return lesson;

  return {
    ...lesson,
    sourceUrl: lesson.sourceUrl || lesson.googleDriveUrl || "",
    sourceId: lesson.sourceId ?? fileId,
    googleDriveId: fileId,
  };
}

function normalizeListeningBooks(books: ListeningBookSet[]): ListeningBookSet[] {
  return books.map((bookSet) => ({
    ...bookSet,
    lessons: bookSet.lessons.map(normalizeGoogleDriveLesson),
  }));
}

export function loadListeningBooks(): ListeningBookSet[] {
  if (typeof window === "undefined") return listeningBooks;

  try {
    const raw = window.localStorage.getItem(LISTENING_STORAGE_KEY);
    if (!raw) return listeningBooks;

    const parsed = JSON.parse(raw) as ListeningBookSet[];
    if (!Array.isArray(parsed)) return listeningBooks;

    const normalized = normalizeListeningBooks(parsed);
    const serialized = JSON.stringify(normalized);
    if (serialized !== raw) {
      try {
        window.localStorage.setItem(LISTENING_STORAGE_KEY, serialized);
      } catch {
        // Keep the normalized data available even if the migration cannot be persisted.
      }
    }
    return normalized;
  } catch {
    return listeningBooks;
  }
}

export function saveListeningBooks(books: ListeningBookSet[]): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(LISTENING_STORAGE_KEY, JSON.stringify(normalizeListeningBooks(books)));
  } catch {
    // Bỏ qua lỗi lưu local khi browser không cho phép.
  }
}

export function getNextLessonNumber(lessons: ListeningLesson[]): number {
  if (lessons.length === 0) return 1;
  return Math.max(...lessons.map((lesson) => Number(lesson.number) || 0)) + 1;
}
