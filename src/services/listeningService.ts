import type { ListeningLesson, ListeningSourceType } from "../types/listening";

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
    const [minutes, seconds] = trimmed.split(":").map(Number);
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

export function getSourceLabel(sourceType: ListeningSourceType): string {
  switch (sourceType) {
    case "youtube":
      return "YouTube";
    case "googleDrive":
    case "drive":
      return "Google Drive";
    case "audio":
    case "directAudio":
    default:
      return "Audio";
  }
}

export function resolveAudioSourceUrl(lesson: Pick<ListeningLesson, "sourceType" | "sourceUrl" | "audioUrl">): string {
  const sourceUrl = lesson.sourceUrl || lesson.audioUrl || "";

  if (!sourceUrl) {
    return "";
  }

  switch (lesson.sourceType) {
    case "youtube": {
      const youtubeId =
        sourceUrl.match(/(?:v=|youtu\.be\/)([\w-]{11})/)?.[1] ??
        sourceUrl.match(/embed\/([\w-]{11})/)?.[1];
      return youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : sourceUrl;
    }
    case "googleDrive":
    case "drive": {
      const driveId =
        sourceUrl.match(/\/file\/d\/([^/]+)/)?.[1] ??
        sourceUrl.match(/[?&]id=([^&]+)/)?.[1] ??
        sourceUrl.match(/id:([\w-]+)/)?.[1];
      return driveId ? `https://drive.google.com/uc?export=download&id=${driveId}` : sourceUrl;
    }
    case "audio":
    case "directAudio":
    default:
      return sourceUrl;
  }
}

export function isDirectAudioUrl(url: string): boolean {
  return /\.(mp3|wav|m4a|aac|ogg|flac)(\?.*)?$/i.test(url) || /googleusercontent\.com/.test(url);
}

export function isAudioPlayable(lesson: Pick<ListeningLesson, "sourceType" | "sourceUrl" | "audioUrl">): boolean {
  if (lesson.sourceType === "audio" || lesson.sourceType === "directAudio") {
    return isDirectAudioUrl(resolveAudioSourceUrl(lesson));
  }

  return false;
}
