import type { DetectedListeningSourceType, ListeningSourceType } from "../types/listening";

export interface ListeningSourceInspection {
  type: DetectedListeningSourceType;
  sourceId: string | null;
  sourceUrl: string;
  previewUrl: string;
  thumbnailUrl?: string;
  title?: string;
  duration?: number;
  isValid: boolean;
  message: string;
}

export interface ListeningSourceAdapter {
  type: DetectedListeningSourceType;
  detect: (url: URL) => string | null;
  createPreviewUrl: (sourceId: string, sourceUrl: string) => string;
  inspect: (sourceUrl: string, sourceId: string) => ListeningSourceInspection;
}

export function parseYouTubeUrl(rawUrl: string): { type: "youtube"; id: string } | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.hostname !== "youtu.be" && !/(^|\.)youtube\.com$/.test(url.hostname)) return null;

  const queryId = url.searchParams.get("v");
  const pathId = url.hostname === "youtu.be" ? url.pathname.slice(1).split("/")[0] : null;
  const embedId = url.pathname.match(/\/(?:embed|shorts)\/([\w-]{6,})/)?.[1];
  const id = queryId ?? pathId ?? embedId;
  return id && /^[\w-]{6,}$/.test(id) ? { type: "youtube", id } : null;
}

export function parseGoogleDriveUrl(rawUrl: string): { type: "googleDrive"; id: string } | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.hostname !== "drive.google.com") return null;

  const pathId = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1];
  const id = pathId ?? url.searchParams.get("id");
  return id && /^[\w-]+$/.test(id) ? { type: "googleDrive", id } : null;
}

export function extractGoogleDriveFileId(url: string): string | null {
  return parseGoogleDriveUrl(url)?.id ?? null;
}

export function createGoogleDriveMediaUrl(fileId: string): string | null {
  if (!/^[\w-]+$/.test(fileId)) return null;
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
}

export function getGoogleDriveDirectUrl(googleDriveUrl: string): string | null {
  const googleDriveId = extractGoogleDriveFileId(googleDriveUrl);
  if (!googleDriveId) return null;
  const directUrl = createGoogleDriveMediaUrl(googleDriveId);
  if (!directUrl) return null;
  if (import.meta.env.DEV) {
    console.log("Original Google Drive URL:", googleDriveUrl);
    console.log("Google Drive File ID:", googleDriveId);
    console.log("Direct URL:", directUrl);
  }
  return directUrl;
}

export function extractDroppedUrl(dataTransfer: DataTransfer): string | null {
  const findUrl = (value: string) => value.match(/https?:\/\/[^\s"'<>]+/i)?.[0]?.trim() ?? null;
  const uriList = dataTransfer.getData("text/uri-list").split(/\r?\n/).map((item) => item.trim()).find((item) => item && !item.startsWith("#")) ?? "";
  const uri = findUrl(uriList);
  if (uri) return uri;

  const plainText = findUrl(dataTransfer.getData("text/plain"));
  if (plainText) return plainText;

  const html = dataTransfer.getData("text/html");
  if (html) {
    const href = typeof DOMParser !== "undefined"
      ? new DOMParser().parseFromString(html, "text/html").querySelector("a[href]")?.getAttribute("href")
      : html.match(/href=["']([^"']+)["']/i)?.[1];
    const htmlUrl = href ? findUrl(href) : null;
    if (htmlUrl) return htmlUrl;
  }

  return null;
}

function unknownInspection(sourceUrl: string, message: string): ListeningSourceInspection {
  return { type: "unknown", sourceId: null, sourceUrl, previewUrl: "", isValid: false, message };
}

const youtubeAdapter: ListeningSourceAdapter = {
  type: "youtube",
  detect: (url) => parseYouTubeUrl(url.toString())?.id ?? null,
  createPreviewUrl: (sourceId) => `https://www.youtube.com/embed/${encodeURIComponent(sourceId)}?enablejsapi=1`,
  inspect: (sourceUrl, sourceId) => ({
    type: "youtube",
    sourceId,
    sourceUrl,
    previewUrl: `https://www.youtube.com/embed/${encodeURIComponent(sourceId)}?enablejsapi=1`,
    thumbnailUrl: `https://i.ytimg.com/vi/${encodeURIComponent(sourceId)}/hqdefault.jpg`,
    isValid: true,
    message: "Link YouTube hợp lệ về cấu trúc. Hãy dùng preview để kiểm tra video có thể phát.",
  }),
};

const googleDriveAdapter: ListeningSourceAdapter = {
  type: "googleDrive",
  detect: (url) => parseGoogleDriveUrl(url.toString())?.id ?? null,
  createPreviewUrl: (sourceId) => `https://drive.google.com/uc?export=download&id=${encodeURIComponent(sourceId)}`,
  inspect: (sourceUrl, sourceId) => ({
    type: "googleDrive",
    sourceId,
    sourceUrl,
    previewUrl: `https://drive.google.com/uc?export=download&id=${encodeURIComponent(sourceId)}`,
    isValid: true,
    message: "Link Google Drive hợp lệ về cấu trúc. Quyền truy cập sẽ được xác nhận khi preview.",
  }),
};

export const listeningSourceAdapters: ListeningSourceAdapter[] = [youtubeAdapter, googleDriveAdapter];

export function detectListeningSource(rawUrl: string, preferredType?: ListeningSourceType): ListeningSourceInspection {
  const sourceUrl = rawUrl.trim();
  if (!sourceUrl) return unknownInspection(sourceUrl, "Vui lòng nhập link.");

  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    return unknownInspection(sourceUrl, "Link không được hỗ trợ.");
  }

  const preferredAdapter = listeningSourceAdapters.find((adapter) => adapter.type === preferredType);
  const adapter = preferredAdapter?.detect(url) ? preferredAdapter : listeningSourceAdapters.find((candidate) => candidate.detect(url));
  if (adapter) {
    const sourceId = adapter.detect(url);
    if (sourceId) return adapter.inspect(sourceUrl, sourceId);
  }

  if (/\.(mp3|wav|m4a|aac|ogg|flac)(\?.*)?$/i.test(url.pathname)) {
    return { type: "directAudio", sourceId: null, sourceUrl, previewUrl: sourceUrl, isValid: true, message: "Link audio trực tiếp hợp lệ." };
  }

  return unknownInspection(sourceUrl, "Link không được hỗ trợ. Vui lòng sử dụng Google Drive hoặc YouTube.");
}

export function inspectListeningSource(rawUrl: string, preferredType?: ListeningSourceType): ListeningSourceInspection {
  return detectListeningSource(rawUrl, preferredType);
}
