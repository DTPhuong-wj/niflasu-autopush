import type { ListeningBook, ListeningBookSet, ListeningLesson } from "../types/listening";

type FileHandle = {
  read: (buffer: Uint8Array, offset: number, length: number, position: number) => Promise<{ bytesRead: number }>;
  writeFile: (data: string) => Promise<void>;
  close: () => Promise<void>;
};

type NodeFileSystem = {
  mkdir: (path: string, options: { recursive: true }) => Promise<unknown>;
  open: (path: string, flags: string) => Promise<FileHandle>;
  readFile: (path: string, encoding: "utf8") => Promise<string>;
  rename: (from: string, to: string) => Promise<void>;
  rm: (path: string, options: { force: true }) => Promise<void>;
  stat: (path: string) => Promise<{ size: number; isFile: () => boolean }>;
  unlink: (path: string) => Promise<void>;
  writeFile: (path: string, data: Uint8Array | string, options?: { flag?: string }) => Promise<void>;
};

type NodePath = {
  basename: (path: string, suffix?: string) => string;
  extname: (path: string) => string;
  join: (...paths: string[]) => string;
  resolve: (...paths: string[]) => string;
  sep: string;
};

type RuntimeProcess = {
  cwd: () => string;
  versions?: { node?: string };
  getBuiltinModule?: (name: string) => unknown;
};

type UploadedAudio = File;

type NodeModules = { fs: NodeFileSystem; path: NodePath; root: string };

export class ListeningStorageUnavailableError extends Error {
  constructor() {
    super("Filesystem listening storage requires the Node.js runtime.");
    this.name = "ListeningStorageUnavailableError";
  }
}

export class ListeningFileStorageError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
    this.name = "ListeningFileStorageError";
  }
}

const MAX_AUDIO_SIZE = 250 * 1024 * 1024;
const MIME_BY_EXTENSION: Record<string, string> = {
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".webm": "audio/webm",
};
const EXTENSION_BY_MIME: Record<string, string> = {
  "audio/aac": ".aac",
  "audio/flac": ".flac",
  "audio/mp3": ".mp3",
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/ogg": ".ogg",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/webm": ".webm",
};

let writeQueue: Promise<unknown> = Promise.resolve();

function nodeModules(): NodeModules {
  const runtime = (globalThis as typeof globalThis & { process?: RuntimeProcess }).process;
  if (!runtime?.versions?.node || !runtime.getBuiltinModule) {
    throw new ListeningStorageUnavailableError();
  }
  const fs = runtime.getBuiltinModule("node:fs/promises") as NodeFileSystem | undefined;
  const path = runtime.getBuiltinModule("node:path") as NodePath | undefined;
  if (!fs || !path) throw new ListeningStorageUnavailableError();
  return { fs, path, root: runtime.cwd() };
}

function storagePaths(modules: NodeModules) {
  const dataDirectory = modules.path.join(modules.root, "src", "data");
  const uploadsDirectory = modules.path.join(modules.root, "uploads");
  const audioDirectory = modules.path.join(uploadsDirectory, "audio");
  return {
    dataDirectory,
    uploadsDirectory,
    audioDirectory,
    jsonFile: modules.path.join(dataDirectory, "listening.json"),
  };
}

export async function ensureListeningFileStorage() {
  const modules = nodeModules();
  const paths = storagePaths(modules);
  await modules.fs.mkdir(paths.dataDirectory, { recursive: true });
  await modules.fs.mkdir(paths.audioDirectory, { recursive: true });
  try {
    const handle = await modules.fs.open(paths.jsonFile, "wx");
    await handle.writeFile("[]\n");
    await handle.close();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}

export function initializeListeningFileStorage() {
  const runtime = (globalThis as typeof globalThis & { process?: RuntimeProcess }).process;
  if (!runtime?.versions?.node || !runtime.getBuiltinModule) return Promise.resolve();
  return ensureListeningFileStorage();
}

async function readBookSets(): Promise<ListeningBookSet[]> {
  await ensureListeningFileStorage();
  const modules = nodeModules();
  const { jsonFile } = storagePaths(modules);
  const content = await modules.fs.readFile(jsonFile, "utf8");
  const parsed: unknown = JSON.parse(content);
  if (!Array.isArray(parsed)) {
    throw new ListeningFileStorageError("LISTENING_DATA_INVALID", "src/data/listening.json phải chứa một mảng JSON.", 500);
  }
  return parsed as ListeningBookSet[];
}

async function writeBookSets(bookSets: ListeningBookSet[]) {
  const modules = nodeModules();
  const { jsonFile } = storagePaths(modules);
  const temporaryFile = `${jsonFile}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    await modules.fs.writeFile(temporaryFile, `${JSON.stringify(bookSets, null, 2)}\n`, { flag: "wx" });
    await modules.fs.rename(temporaryFile, jsonFile);
  } catch (error) {
    await modules.fs.rm(temporaryFile, { force: true }).catch(() => undefined);
    throw error;
  }
}

function serializeWrite<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.then(() => undefined, () => undefined);
  return result;
}

export async function getListeningBookSets() {
  return readBookSets();
}

function audioUrlOf(lesson: ListeningLesson): string | undefined {
  const audio = lesson.audio ?? lesson.sourceUrl ?? lesson.audioUrl ?? "";
  return audio.startsWith("/uploads/audio/") ? audio : undefined;
}

function collectAudioUrls(bookSets: ListeningBookSet[]) {
  return new Set(bookSets.flatMap((bookSet) => bookSet.lessons.map(audioUrlOf).filter((url): url is string => Boolean(url))));
}

async function deleteUnusedAudio(audioUrl: string | undefined, bookSets: ListeningBookSet[]) {
  if (!audioUrl || collectAudioUrls(bookSets).has(audioUrl)) return;
  const modules = nodeModules();
  const filename = audioUrl.slice("/uploads/audio/".length);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(filename)) return;
  const { audioDirectory } = storagePaths(modules);
  const target = modules.path.resolve(audioDirectory, filename);
  if (!target.startsWith(`${modules.path.resolve(audioDirectory)}${modules.path.sep}`)) return;
  await modules.fs.unlink(target).catch((error) => {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  });
}

function safeAudioExtension(file: UploadedAudio, modules: NodeModules) {
  const originalName = file.name.replace(/\\/g, "/").split("/").pop() ?? "";
  const extension = modules.path.extname(originalName).toLowerCase();
  if (MIME_BY_EXTENSION[extension]) return extension;
  return EXTENSION_BY_MIME[file.type.toLowerCase()];
}

async function saveUploadedAudio(file: UploadedAudio) {
  if (file.size <= 0 || file.size > MAX_AUDIO_SIZE) {
    throw new ListeningFileStorageError("AUDIO_FILE_SIZE_INVALID", "File audio phải lớn hơn 0 và không quá 250 MB.", 413);
  }
  const modules = nodeModules();
  const extension = safeAudioExtension(file, modules);
  if (!extension) {
    throw new ListeningFileStorageError("AUDIO_FILE_TYPE_INVALID", "Định dạng audio không được hỗ trợ.", 415);
  }
  const paths = storagePaths(modules);
  const originalName = file.name.replace(/\\/g, "/").split("/").pop() ?? "audio";
  const rawBaseName = modules.path.basename(originalName, modules.path.extname(originalName));
  const safeBaseName = rawBaseName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "audio";
  const filename = `${safeBaseName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;
  const target = modules.path.resolve(paths.audioDirectory, filename);
  if (!target.startsWith(`${modules.path.resolve(paths.audioDirectory)}${modules.path.sep}`)) {
    throw new ListeningFileStorageError("AUDIO_FILE_NAME_INVALID", "Tên file audio không hợp lệ.", 400);
  }
  await modules.fs.writeFile(target, new Uint8Array(await file.arrayBuffer()), { flag: "wx" });
  return {
    url: `/uploads/audio/${filename}`,
    fileName: filename,
    mimeType: MIME_BY_EXTENSION[extension] ?? (file.type || "application/octet-stream"),
  };
}

function normalizeLesson(book: ListeningBook, lesson: ListeningLesson): ListeningLesson {
  const sourceUrl = lesson.sourceUrl ?? "";
  if (lesson.source === "local" && sourceUrl.startsWith("blob:")) {
    throw new ListeningFileStorageError("AUDIO_FILE_REQUIRED", "Chọn lại file local để lưu file vào máy chủ.", 400);
  }
  const playableAudio = lesson.sourceType === "googleDrive" || lesson.sourceType === "drive" || lesson.sourceType === "youtube"
    ? undefined
    : lesson.audio ?? lesson.audioUrl ?? sourceUrl;
  return {
    ...lesson,
    sourceUrl,
    audio: playableAudio,
    name: lesson.title,
    author: book.name,
    audioFileId: lesson.audioFileId,
  };
}

function isUploadedAudio(value: FormDataEntryValue | null): value is UploadedAudio {
  return typeof File !== "undefined" && value instanceof File;
}

export async function saveListeningBook(book: ListeningBook, lesson?: ListeningLesson | null, audioFile?: UploadedAudio | null, replaceLessonId?: string) {
  return serializeWrite(async () => {
    const bookSets = await readBookSets();
    const oldBookSet = bookSets.find((bookSet) => bookSet.book.id === book.id);
    const currentLessonId = replaceLessonId ?? (lesson ? String(lesson.id) : "");
    const oldLocation = currentLessonId
      ? bookSets.flatMap((bookSet) => bookSet.lessons.map((item) => ({ bookSet, lesson: item }))).find((entry) => String(entry.lesson.id) === currentLessonId)
      : undefined;
    if (replaceLessonId && !oldLocation) {
      throw new ListeningFileStorageError("LISTENING_LESSON_NOT_FOUND", "Không tìm thấy bài nghe cần cập nhật.", 404);
    }

    let updatedLesson: ListeningLesson | undefined;
    let newAudioUrl: string | undefined;
    if (lesson) {
      if (!replaceLessonId && bookSets.some((bookSet) => bookSet.lessons.some((item) => String(item.id) === String(lesson.id)))) {
        throw new ListeningFileStorageError("LISTENING_LESSON_EXISTS", "Bài nghe này đã tồn tại.", 409);
      }
      const uploaded = audioFile ? await saveUploadedAudio(audioFile) : undefined;
      if (uploaded) newAudioUrl = uploaded.url;
      const sourceUrl = uploaded?.url ?? (lesson.sourceUrl.startsWith("blob:") ? "" : lesson.sourceUrl);
      if (lesson.source === "local" && !sourceUrl && !uploaded && !lesson.audioFileId) {
        throw new ListeningFileStorageError("AUDIO_FILE_REQUIRED", "Cần tải file audio lên trước khi lưu bài.", 400);
      }
      updatedLesson = normalizeLesson(book, {
        ...lesson,
        source: lesson.source === "local" ? "local" : lesson.source,
        sourceUrl,
        audio: uploaded?.url ?? lesson.audio ?? (lesson.sourceType === "directAudio" ? sourceUrl : undefined),
        audioUrl: uploaded?.url ?? lesson.audioUrl,
        audioMimeType: uploaded?.mimeType ?? lesson.audioMimeType,
        audioFileId: uploaded ? undefined : lesson.audioFileId,
        fileName: uploaded?.fileName ?? lesson.fileName,
        author: book.name,
        name: lesson.title,
      });
    }

    let next = bookSets.map((bookSet) => ({ ...bookSet, lessons: [...bookSet.lessons] }));
    if (replaceLessonId && oldLocation && updatedLesson) {
      next = next.map((bookSet) => ({
        ...bookSet,
        lessons: bookSet.lessons.filter((item) => String(item.id) !== currentLessonId),
      }));
    }

    let targetBookSet = next.find((bookSet) => bookSet.book.id === book.id);
    if (targetBookSet) targetBookSet.book = book;
    else {
      targetBookSet = { book, lessons: [] };
      next.push(targetBookSet);
    }
    if (updatedLesson) {
      targetBookSet.lessons.push(updatedLesson);
      targetBookSet.lessons.sort((first, second) => first.unit - second.unit || first.number - second.number);
    }

    try {
      await writeBookSets(next);
    } catch (error) {
      if (newAudioUrl) await deleteUnusedAudio(newAudioUrl, bookSets).catch(() => undefined);
      throw error;
    }
    if (oldLocation && updatedLesson && newAudioUrl) {
      await deleteUnusedAudio(audioUrlOf(oldLocation.lesson), next);
    }
    return { books: next, lesson: updatedLesson };
  });
}

export async function deleteListeningLesson(lessonId: string) {
  return serializeWrite(async () => {
    const bookSets = await readBookSets();
    const removed = bookSets.flatMap((bookSet) => bookSet.lessons).find((lesson) => String(lesson.id) === lessonId);
    if (!removed) throw new ListeningFileStorageError("LISTENING_LESSON_NOT_FOUND", "Không tìm thấy bài nghe.", 404);
    const next = bookSets.map((bookSet) => ({
      ...bookSet,
      lessons: bookSet.lessons.filter((lesson) => String(lesson.id) !== lessonId),
    }));
    await writeBookSets(next);
    await deleteUnusedAudio(audioUrlOf(removed), next);
    return next;
  });
}

export async function deleteListeningBook(bookId: string) {
  return serializeWrite(async () => {
    const bookSets = await readBookSets();
    const removed = bookSets.find((bookSet) => bookSet.book.id === bookId);
    if (!removed) throw new ListeningFileStorageError("LISTENING_BOOK_NOT_FOUND", "Không tìm thấy sách nghe.", 404);
    const next = bookSets.filter((bookSet) => bookSet.book.id !== bookId);
    await writeBookSets(next);
    for (const lesson of removed.lessons) await deleteUnusedAudio(audioUrlOf(lesson), next);
    return next;
  });
}

export async function serveUploadedAudio(request: Request, rawFilename: string): Promise<Response> {
  const modules = nodeModules();
  let filename: string;
  try {
    filename = decodeURIComponent(rawFilename);
  } catch {
    return new Response("Invalid audio file name.", { status: 400 });
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(filename)) {
    return new Response("Invalid audio file name.", { status: 400 });
  }
  const { audioDirectory } = storagePaths(modules);
  const target = modules.path.resolve(audioDirectory, filename);
  if (!target.startsWith(`${modules.path.resolve(audioDirectory)}${modules.path.sep}`)) {
    return new Response("Invalid audio file name.", { status: 400 });
  }

  let handle: FileHandle;
  let fileSize: number;
  try {
    const stat = await modules.fs.stat(target);
    if (!stat.isFile()) return new Response("Audio file not found.", { status: 404 });
    fileSize = stat.size;
    handle = await modules.fs.open(target, "r");
  } catch {
    return new Response("Audio file not found.", { status: 404 });
  }

  const extension = modules.path.extname(filename).toLowerCase();
  const headers = new Headers({
    "accept-ranges": "bytes",
    "cache-control": "no-store",
    "content-type": MIME_BY_EXTENSION[extension] ?? "application/octet-stream",
  });
  if (request.method === "HEAD") {
    await handle.close();
    headers.set("content-length", String(fileSize));
    return new Response(null, { status: 200, headers });
  }

  const range = request.headers.get("range");
  let start = 0;
  let end = fileSize - 1;
  let status = 200;
  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!match || fileSize === 0 || (!match[1] && !match[2])) {
      await handle.close();
      headers.set("content-range", `bytes */${fileSize}`);
      return new Response(null, { status: 416, headers });
    }
    if (!match[1]) {
      const suffixLength = Number(match[2]);
      start = Math.max(fileSize - suffixLength, 0);
    } else {
      start = Number(match[1]);
      if (match[2]) end = Math.min(Number(match[2]), end);
    }
    if (start >= fileSize || end < start) {
      await handle.close();
      headers.set("content-range", `bytes */${fileSize}`);
      return new Response(null, { status: 416, headers });
    }
    status = 206;
    headers.set("content-range", `bytes ${start}-${end}/${fileSize}`);
  }

  const contentLength = end - start + 1;
  headers.set("content-length", String(contentLength));
  let position = start;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (position > end) {
        await handle.close();
        controller.close();
        return;
      }
      try {
        const chunk = new Uint8Array(Math.min(64 * 1024, end - position + 1));
        const result = await handle.read(chunk, 0, chunk.byteLength, position);
        if (result.bytesRead === 0) {
          await handle.close();
          controller.close();
          return;
        }
        position += result.bytesRead;
        controller.enqueue(chunk.subarray(0, result.bytesRead));
        if (position > end) {
          await handle.close();
          controller.close();
        }
      } catch (error) {
        await handle.close().catch(() => undefined);
        controller.error(error);
      }
    },
    async cancel() {
      await handle.close().catch(() => undefined);
    },
  });
  return new Response(body, { status, headers });
}

export function isUploadedAudioValue(value: FormDataEntryValue | null): value is UploadedAudio {
  return isUploadedAudio(value);
}

function errorResponse(error: unknown) {
  const fileStorageError = error instanceof ListeningFileStorageError
    ? error
    : error instanceof ListeningStorageUnavailableError
      ? new ListeningFileStorageError(
          "LISTENING_STORAGE_UNAVAILABLE",
          "Filesystem persistence is available with the Node.js backend; this runtime has no writable disk.",
          503,
        )
      : new ListeningFileStorageError("LISTENING_STORAGE_ERROR", "Không thể đọc hoặc lưu dữ liệu bài nghe.", 500);
  return Response.json(
    { code: fileStorageError.code, message: fileStorageError.message },
    { status: fileStorageError.status, headers: { "cache-control": "no-store" } },
  );
}

function isValidBook(value: unknown): value is ListeningBook {
  if (!value || typeof value !== "object") return false;
  const book = value as Partial<ListeningBook>;
  return typeof book.id === "string" && book.id.length > 0 && typeof book.name === "string" && book.name.trim().length > 0;
}

function isValidLesson(value: unknown): value is ListeningLesson {
  if (!value || typeof value !== "object") return false;
  const lesson = value as Partial<ListeningLesson>;
  return typeof lesson.id === "string" || typeof lesson.id === "number"
    ? typeof lesson.bookId === "string" &&
        typeof lesson.title === "string" && lesson.title.trim().length > 0 &&
        Number.isFinite(Number(lesson.unit)) && Number(lesson.unit) > 0 &&
        Number.isFinite(Number(lesson.number)) && Number(lesson.number) > 0 &&
        typeof lesson.sourceType === "string"
    : false;
}

async function parseMutationRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    let book: unknown;
    let lesson: unknown;
    try {
      book = JSON.parse(String(form.get("book") ?? "null"));
      lesson = JSON.parse(String(form.get("lesson") ?? "null"));
    } catch {
      throw new ListeningFileStorageError("REQUEST_INVALID", "Thông tin bài nghe không đúng định dạng JSON.", 400);
    }
    const audioValue = form.get("audio");
    const audio = isUploadedAudio(audioValue) ? audioValue : null;
    return { book, lesson, audio };
  }

  try {
    const payload = await request.json() as { book?: unknown; lesson?: unknown };
    return { book: payload.book, lesson: payload.lesson, audio: null };
  } catch {
    throw new ListeningFileStorageError("REQUEST_INVALID", "Request body không hợp lệ.", 400);
  }
}

function isSameOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function methodNotAllowed(allow: string) {
  return new Response(null, { status: 405, headers: { allow } });
}

export async function handleListeningApiRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const audioMatch = url.pathname.match(/^\/uploads\/audio\/([^/]+)$/);
  if (audioMatch) {
    if (request.method !== "GET" && request.method !== "HEAD") return methodNotAllowed("GET, HEAD");
    try {
      return await serveUploadedAudio(request, audioMatch[1] ?? "");
    } catch (error) {
      return errorResponse(error);
    }
  }

  if (url.pathname === "/api/listening") {
    if (request.method === "GET") {
      try {
        const books = await getListeningBookSets();
        return Response.json(books, { headers: { "cache-control": "no-store" } });
      } catch (error) {
        return errorResponse(error);
      }
    }
    if (request.method !== "POST") return methodNotAllowed("GET, POST");
    if (!isSameOriginMutation(request)) return new Response("Cross-origin request denied.", { status: 403 });
    try {
      const payload = await parseMutationRequest(request);
      if (!isValidBook(payload.book)) throw new ListeningFileStorageError("BOOK_INVALID", "Thông tin sách không hợp lệ.", 400);
      if (payload.lesson !== null && payload.lesson !== undefined && !isValidLesson(payload.lesson)) {
        throw new ListeningFileStorageError("LESSON_INVALID", "Thông tin bài nghe không hợp lệ.", 400);
      }
      const result = await saveListeningBook(payload.book, payload.lesson as ListeningLesson | null, payload.audio);
      return Response.json(result, { status: 201, headers: { "cache-control": "no-store" } });
    } catch (error) {
      return errorResponse(error);
    }
  }

  const bookMatch = url.pathname.match(/^\/api\/listening\/books\/([^/]+)$/);
  if (bookMatch) {
    let bookId: string;
    try {
      bookId = decodeURIComponent(bookMatch[1] ?? "");
    } catch {
      return Response.json({ code: "BOOK_ID_INVALID", message: "Sách không hợp lệ." }, { status: 400 });
    }
    if (request.method === "DELETE") {
      if (!isSameOriginMutation(request)) return new Response("Cross-origin request denied.", { status: 403 });
      try {
        return Response.json(await deleteListeningBook(bookId), { headers: { "cache-control": "no-store" } });
      } catch (error) {
        return errorResponse(error);
      }
    }
    if (request.method === "PUT") {
      if (!isSameOriginMutation(request)) return new Response("Cross-origin request denied.", { status: 403 });
      try {
        const payload = await parseMutationRequest(request);
        if (!isValidBook(payload.book) || payload.book.id !== bookId) {
          throw new ListeningFileStorageError("BOOK_INVALID", "Thông tin sách không hợp lệ.", 400);
        }
        const result = await saveListeningBook(payload.book);
        return Response.json(result.books, { headers: { "cache-control": "no-store" } });
      } catch (error) {
        return errorResponse(error);
      }
    }
    return methodNotAllowed("PUT, DELETE");
  }

  const lessonMatch = url.pathname.match(/^\/api\/listening\/([^/]+)$/);
  if (lessonMatch) {
    let lessonId: string;
    try {
      lessonId = decodeURIComponent(lessonMatch[1] ?? "");
    } catch {
      return Response.json({ code: "LESSON_ID_INVALID", message: "Bài nghe không hợp lệ." }, { status: 400 });
    }
    if (request.method === "DELETE") {
      if (!isSameOriginMutation(request)) return new Response("Cross-origin request denied.", { status: 403 });
      try {
        return Response.json(await deleteListeningLesson(lessonId), { headers: { "cache-control": "no-store" } });
      } catch (error) {
        return errorResponse(error);
      }
    }
    if (request.method === "PUT") {
      if (!isSameOriginMutation(request)) return new Response("Cross-origin request denied.", { status: 403 });
      try {
        const payload = await parseMutationRequest(request);
        if (!isValidBook(payload.book) || !isValidLesson(payload.lesson)) {
          throw new ListeningFileStorageError("LESSON_INVALID", "Thông tin bài nghe không hợp lệ.", 400);
        }
        const result = await saveListeningBook(payload.book, { ...payload.lesson, id: lessonId }, payload.audio, lessonId);
        return Response.json(result, { headers: { "cache-control": "no-store" } });
      } catch (error) {
        return errorResponse(error);
      }
    }
    return methodNotAllowed("PUT, DELETE");
  }

  return null;
}