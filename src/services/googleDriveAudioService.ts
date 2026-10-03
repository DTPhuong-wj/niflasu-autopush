type DriveEnvironment = {
  GOOGLE_DRIVE_API_KEY?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
};

type DriveMetadata = {
  id?: string;
  name?: string;
  mimeType?: string;
  size?: string;
};

type AudioErrorCode =
  | "INVALID_FILE_ID"
  | "GOOGLE_DRIVE_FILE_NOT_FOUND"
  | "GOOGLE_DRIVE_PERMISSION_DENIED"
  | "GOOGLE_DRIVE_AUTH_REQUIRED"
  | "GOOGLE_DRIVE_API_ERROR"
  | "GOOGLE_DRIVE_FILE_IS_NOT_AUDIO"
  | "AUDIO_STREAM_FAILED"
  | "AUDIO_RANGE_REQUEST_FAILED"
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR";

class DriveAudioError extends Error {
  constructor(
    readonly code: AudioErrorCode,
    readonly status: number,
    message: string,
    readonly contentRange?: string,
  ) {
    super(message);
  }
}

const errorMessages: Record<AudioErrorCode, string> = {
  INVALID_FILE_ID: "Link Google Drive không hợp lệ.",
  GOOGLE_DRIVE_FILE_NOT_FOUND: "Không tìm thấy file Google Drive.",
  GOOGLE_DRIVE_PERMISSION_DENIED: "Không có quyền truy cập file Google Drive.",
  GOOGLE_DRIVE_AUTH_REQUIRED: "Máy chủ chưa có Google Drive credentials. Cấu hình GOOGLE_DRIVE_API_KEY cho file công khai, hoặc GOOGLE_SERVICE_ACCOUNT_EMAIL và GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY cho file riêng tư.",
  GOOGLE_DRIVE_API_ERROR: "Không thể đọc file từ Google Drive.",
  GOOGLE_DRIVE_FILE_IS_NOT_AUDIO: "File Google Drive này không phải file âm thanh.",
  AUDIO_STREAM_FAILED: "Không thể phát file âm thanh từ Google Drive.",
  AUDIO_RANGE_REQUEST_FAILED: "Không thể tải đoạn âm thanh được yêu cầu.",
  NETWORK_ERROR: "Không thể kết nối đến máy chủ.",
  UNKNOWN_ERROR: "Đã xảy ra lỗi khi phát file âm thanh.",
};

let cachedToken: { email: string; value: string; expiresAt: number } | undefined;

function isValidGoogleDriveFileId(fileId: string) {
  return /^[A-Za-z0-9_-]{10,200}$/.test(fileId);
}

function base64UrlEncode(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function createServiceAccountToken(email: string, privateKey: string) {
  if (cachedToken?.email === email && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const now = Math.floor(Date.now() / 1000);
  const tokenUrl = "https://oauth2.googleapis.com/token";
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64UrlEncode(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: tokenUrl,
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${claims}`;
  const pem = privateKey.replace(/\\n/g, "\n").replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  let keyBytes: Uint8Array;
  try {
    keyBytes = Uint8Array.from(atob(pem), (character) => character.charCodeAt(0));
  } catch {
    throw new DriveAudioError("GOOGLE_DRIVE_AUTH_REQUIRED", 503, errorMessages.GOOGLE_DRIVE_AUTH_REQUIRED);
  }

  let assertion: string;
  try {
    const keyData = new ArrayBuffer(keyBytes.byteLength);
    new Uint8Array(keyData).set(keyBytes);
    const key = await crypto.subtle.importKey(
      "pkcs8",
      keyData,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
    assertion = `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
  } catch {
    throw new DriveAudioError("GOOGLE_DRIVE_AUTH_REQUIRED", 503, errorMessages.GOOGLE_DRIVE_AUTH_REQUIRED);
  }

  let response: Response;
  try {
    response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });
  } catch {
    throw new DriveAudioError("NETWORK_ERROR", 503, errorMessages.NETWORK_ERROR);
  }
  if (!response.ok) {
    throw new DriveAudioError("GOOGLE_DRIVE_AUTH_REQUIRED", 503, errorMessages.GOOGLE_DRIVE_AUTH_REQUIRED);
  }

  let payload: { access_token?: string; expires_in?: number };
  try {
    payload = await response.json() as { access_token?: string; expires_in?: number };
  } catch {
    throw new DriveAudioError("GOOGLE_DRIVE_AUTH_REQUIRED", 503, errorMessages.GOOGLE_DRIVE_AUTH_REQUIRED);
  }
    if (!payload.access_token) {
      throw new DriveAudioError("GOOGLE_DRIVE_AUTH_REQUIRED", 503, errorMessages.GOOGLE_DRIVE_AUTH_REQUIRED);
    }
  cachedToken = { email, value: payload.access_token, expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000 };
  return payload.access_token;
}

async function createGoogleApiHeaders(environment: DriveEnvironment) {
  const headers = new Headers();
  const email = environment.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = environment.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim();

  if (email && privateKey) {
    headers.set("authorization", `Bearer ${await createServiceAccountToken(email, privateKey)}`);
    return headers;
  }
  if (email || privateKey) {
    throw new DriveAudioError("GOOGLE_DRIVE_AUTH_REQUIRED", 503, errorMessages.GOOGLE_DRIVE_AUTH_REQUIRED);
  }

  const apiKey = environment.GOOGLE_DRIVE_API_KEY?.trim();
  if (!apiKey) {
    throw new DriveAudioError("GOOGLE_DRIVE_AUTH_REQUIRED", 503, errorMessages.GOOGLE_DRIVE_AUTH_REQUIRED);
  }
  headers.set("x-goog-api-key", apiKey);
  return headers;
}

function apiError(response: Response, range?: string, stage: "metadata" | "media" = "metadata"): DriveAudioError {
  if (response.status === 401) {
    return new DriveAudioError("GOOGLE_DRIVE_AUTH_REQUIRED", 401, errorMessages.GOOGLE_DRIVE_AUTH_REQUIRED);
  }
  if (response.status === 403) {
    return new DriveAudioError("GOOGLE_DRIVE_PERMISSION_DENIED", 403, errorMessages.GOOGLE_DRIVE_PERMISSION_DENIED);
  }
  if (response.status === 404) {
    return new DriveAudioError("GOOGLE_DRIVE_FILE_NOT_FOUND", 404, errorMessages.GOOGLE_DRIVE_FILE_NOT_FOUND);
  }
  if (response.status === 416 && range) {
    return new DriveAudioError(
      "AUDIO_RANGE_REQUEST_FAILED",
      416,
      errorMessages.AUDIO_RANGE_REQUEST_FAILED,
      response.headers.get("content-range") ?? undefined,
    );
  }
  const code = stage === "media"
    ? range ? "AUDIO_RANGE_REQUEST_FAILED" : "AUDIO_STREAM_FAILED"
    : "GOOGLE_DRIVE_API_ERROR";
  return new DriveAudioError(code, 502, errorMessages[code]);
}

function errorResponse(error: unknown, headOnly: boolean, range?: string, fileId?: string) {
  const driveError = error instanceof DriveAudioError
    ? error
    : new DriveAudioError("UNKNOWN_ERROR", 500, errorMessages.UNKNOWN_ERROR);
  const headers = new Headers({
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-audio-error-code": driveError.code,
  });
  if (driveError.contentRange) headers.set("content-range", driveError.contentRange);
  if (import.meta.env.DEV) {
    console.warn("[Google Drive audio stream]", {
      sourceType: "googleDrive",
      fileId: fileId ?? null,
      mimeType: null,
      status: driveError.status,
      contentLength: null,
      range: range ?? null,
      error: driveError.code,
    });
  }
  return new Response(headOnly ? null : JSON.stringify({ code: driveError.code, message: driveError.message }), {
    status: driveError.status,
    headers,
  });
}

export async function streamGoogleDriveAudio(request: Request, fileId: string, env: unknown): Promise<Response> {
  const headOnly = request.method === "HEAD";
  const range = request.headers.get("range") ?? undefined;

  if (!isValidGoogleDriveFileId(fileId)) {
    return errorResponse(new DriveAudioError("INVALID_FILE_ID", 400, errorMessages.INVALID_FILE_ID), headOnly, range, fileId);
  }
  if (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) {
    return errorResponse(new DriveAudioError("AUDIO_RANGE_REQUEST_FAILED", 416, errorMessages.AUDIO_RANGE_REQUEST_FAILED), headOnly, range, fileId);
  }

  try {
    const runtimeEnvironment = (globalThis as typeof globalThis & { process?: { env?: DriveEnvironment } }).process?.env ?? {};
    const workerEnvironment = env && typeof env === "object" ? env as DriveEnvironment : {};
    const environment = { ...runtimeEnvironment, ...workerEnvironment };
    const headers = await createGoogleApiHeaders(environment);
    const fileUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;
    let metadataResponse: Response;
    try {
      metadataResponse = await fetch(`${fileUrl}?fields=id%2Cname%2CmimeType%2Csize`, { headers });
    } catch {
      throw new DriveAudioError("NETWORK_ERROR", 503, errorMessages.NETWORK_ERROR);
    }
    if (!metadataResponse.ok) throw apiError(metadataResponse);

    const metadata = await metadataResponse.json() as DriveMetadata;
    if (!metadata.mimeType?.toLowerCase().startsWith("audio/")) {
      throw new DriveAudioError("GOOGLE_DRIVE_FILE_IS_NOT_AUDIO", 415, errorMessages.GOOGLE_DRIVE_FILE_IS_NOT_AUDIO);
    }

    if (headOnly) {
      const responseHeaders = new Headers({
        "accept-ranges": "bytes",
        "cache-control": "no-store",
        "content-type": metadata.mimeType,
      });
      if (metadata.size) responseHeaders.set("content-length", metadata.size);
      return new Response(null, { status: 200, headers: responseHeaders });
    }

    const mediaHeaders = new Headers(headers);
    if (range) mediaHeaders.set("range", range);
    let mediaResponse: Response;
    try {
      mediaResponse = await fetch(`${fileUrl}?alt=media`, { headers: mediaHeaders });
    } catch {
      throw new DriveAudioError("NETWORK_ERROR", 503, errorMessages.NETWORK_ERROR);
    }
    if (!mediaResponse.ok) throw apiError(mediaResponse, range, "media");
    if (range && mediaResponse.status !== 206) {
      await mediaResponse.body?.cancel();
      throw new DriveAudioError("AUDIO_RANGE_REQUEST_FAILED", 502, errorMessages.AUDIO_RANGE_REQUEST_FAILED);
    }
    if (range && (!mediaResponse.headers.get("content-range") || !mediaResponse.headers.get("content-length"))) {
      await mediaResponse.body?.cancel();
      throw new DriveAudioError("AUDIO_RANGE_REQUEST_FAILED", 502, errorMessages.AUDIO_RANGE_REQUEST_FAILED);
    }

    const responseHeaders = new Headers({
      "accept-ranges": mediaResponse.headers.get("accept-ranges") ?? "bytes",
      "cache-control": "no-store",
      "content-type": metadata.mimeType,
    });
    const contentLength = mediaResponse.headers.get("content-length");
    const contentRange = mediaResponse.headers.get("content-range");
    if (contentLength) responseHeaders.set("content-length", contentLength);
    else if (!range && mediaResponse.status === 200 && metadata.size) responseHeaders.set("content-length", metadata.size);
    if (contentRange) responseHeaders.set("content-range", contentRange);
    if (metadata.name) {
      const encodedName = encodeURIComponent(metadata.name).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
      responseHeaders.set("content-disposition", `inline; filename*=UTF-8''${encodedName}`);
    }

    if (import.meta.env.DEV) {
      console.info("[Google Drive audio stream]", {
        sourceType: "googleDrive",
        fileId,
        mimeType: metadata.mimeType,
        status: mediaResponse.status,
        contentLength: contentLength ?? metadata.size ?? null,
        range: range ?? null,
        error: null,
      });
    }
    if (!mediaResponse.body) {
      throw new DriveAudioError("AUDIO_STREAM_FAILED", 502, errorMessages.AUDIO_STREAM_FAILED);
    }
    return new Response(mediaResponse.body, { status: mediaResponse.status, headers: responseHeaders });
  } catch (error) {
    return errorResponse(error, headOnly, range, fileId);
  }
}