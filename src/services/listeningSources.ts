import type { DetectedListeningSourceType, ListeningSourceType } from "../types/listening";

export interface ListeningSourceInspection {
  type: DetectedListeningSourceType;
  sourceId: string | null;
  sourceUrl: string;
  previewUrl: string;
  fileId?: string;
  streamUrl?: string;
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
  const result = detectGoogleDriveFileId(rawUrl);
  return result.valid ? { type: "googleDrive", id: result.fileId } : null;
}

export function detectGoogleDriveFileId(rawUrl: string): { valid: true; fileId: string } | { valid: false; fileId: null } {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { valid: false, fileId: null };
  }
  if (url.hostname !== "drive.google.com" || !["http:", "https:"].includes(url.protocol)) {
    return { valid: false, fileId: null };
  }

  const pathId = url.pathname.match(/^\/file\/d\/([^/]+)(?:\/view)?\/?$/)?.[1];
  const queryId = ["/open", "/uc"].includes(url.pathname) ? url.searchParams.get("id") : null;
  const fileId = pathId ?? queryId;
  return fileId && /^[A-Za-z0-9_-]{10,200}$/.test(fileId)
    ? { valid: true, fileId }
    : { valid: false, fileId: null };
}

export function extractGoogleDriveFileId(url: string): string | null {
  const result = detectGoogleDriveFileId(url);
  return result.valid ? result.fileId : null;
}

export function createGoogleDriveStreamUrl(fileId: string): string | null {
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(fileId)) return null;
  return `/api/listening/google-drive/${encodeURIComponent(fileId)}/stream`;
}

export function getGoogleDriveDirectUrl(googleDriveUrl: string): string | null {
  const googleDriveId = extractGoogleDriveFileId(googleDriveUrl);
  if (!googleDriveId) return null;
  return createGoogleDriveStreamUrl(googleDriveId);
}

export async function getGoogleDrivePlaybackError(streamUrl: string): Promise<string | undefined> {
  try {
    const response = await fetch(streamUrl, { method: "HEAD", cache: "no-store" });
    if (response.ok) return undefined;
    const messages: Record<string, string> = {
      INVALID_FILE_ID: "Link Google Drive không hợp lệ.",
      GOOGLE_DRIVE_FILE_NOT_FOUND: "Không tìm thấy file Google Drive.",
      GOOGLE_DRIVE_PERMISSION_DENIED: "Không có quyền truy cập file Google Drive.",
      GOOGLE_DRIVE_AUTH_REQUIRED: "Máy chủ chưa có Google Drive credentials. Cấu hình GOOGLE_DRIVE_API_KEY cho file công khai, hoặc GOOGLE_SERVICE_ACCOUNT_EMAIL và GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY cho file riêng tư.",
      GOOGLE_DRIVE_API_ERROR: "Không thể đọc file từ Google Drive.",
      GOOGLE_DRIVE_FILE_IS_NOT_AUDIO: "File Google Drive này không phải file âm thanh.",
      AUDIO_STREAM_FAILED: "Không thể phát file âm thanh từ Google Drive.",
      AUDIO_RANGE_REQUEST_FAILED: "Không thể tải đoạn âm thanh được yêu cầu.",
      NETWORK_ERROR: "Không thể kết nối đến máy chủ.",
    };
    const code = response.headers.get("x-audio-error-code") ?? "";
    return messages[code] ?? "Không thể phát file âm thanh từ Google Drive.";
  } catch {
    return "Không thể kết nối đến máy chủ.";
  }
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
  createPreviewUrl: (sourceId) => createGoogleDriveStreamUrl(sourceId) ?? "",
  inspect: (sourceUrl, sourceId) => ({
    type: "googleDrive",
    sourceId,
    fileId: sourceId,
    streamUrl: createGoogleDriveStreamUrl(sourceId) ?? "",
    sourceUrl,
    previewUrl: createGoogleDriveStreamUrl(sourceId) ?? "",
    isValid: true,
    message: "Link hợp lệ về cấu trúc. Quyền truy cập và định dạng sẽ được xác nhận khi phát.",
  }),
};

const directAudioAdapter: ListeningSourceAdapter = {
  type: "directAudio",
  detect: (url) => /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(url.pathname) ? url.toString() : null,
  createPreviewUrl: (_sourceId, sourceUrl) => sourceUrl,
  inspect: (sourceUrl) => ({
    type: "directAudio",
    sourceId: null,
    sourceUrl,
    previewUrl: sourceUrl,
    isValid: true,
    message: "Link audio trực tiếp hợp lệ.",
  }),
};

export const listeningSourceAdapters: ListeningSourceAdapter[] = [youtubeAdapter, googleDriveAdapter, directAudioAdapter];

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

  return unknownInspection(sourceUrl, "Link không được hỗ trợ. Vui lòng sử dụng Google Drive hoặc YouTube.");
}

export function inspectListeningSource(rawUrl: string, preferredType?: ListeningSourceType): ListeningSourceInspection {
  return detectListeningSource(rawUrl, preferredType);
}
