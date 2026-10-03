import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = path.resolve(process.argv[2] ?? path.join(projectRoot, "public", "lessons.json"));
const maxAudioBytes = 100 * 1024 * 1024;

function requiredEnv(name, fallback) {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`Thiếu biến môi trường ${name}.`);
  return value;
}

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableUuid(value) {
  const hex = createHash("md5").update(value).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function safeFileName(value) {
  return path.basename(value.replaceAll("\\", "/")).normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "") || "audio";
}

function normalizeScript(value, lessonId) {
  if (!Array.isArray(value)) return [];
  return value.filter(record).map((line, index) => ({
    id: String(line.id ?? `${lessonId}-line-${index + 1}`),
    speaker: typeof line.speaker === "string" ? line.speaker : "",
    japanese: typeof line.japanese === "string" ? line.japanese : typeof line.text === "string" ? line.text : "",
    furigana: Array.isArray(line.furigana) || typeof line.furigana === "string" ? line.furigana : [],
    translation: typeof line.translation === "string" ? line.translation : "",
    ...(line.needsReview === true ? { needsReview: true } : {}),
  }));
}

function flatten(source) {
  const books = new Map();
  const lessons = [];
  const declaredBooks = record(source) && Array.isArray(source.books) ? source.books.filter(record) : [];
  for (const book of declaredBooks) {
    if (book.id === undefined || typeof book.name !== "string") continue;
    const id = String(book.id);
    books.set(id, { id, name: book.name, description: typeof book.description === "string" ? book.description : null });
  }

  const grouped = Array.isArray(source)
    ? source.filter(record).flatMap((book) => {
      const id = String(book.id ?? book.name ?? "listening");
      const name = typeof book.name === "string" ? book.name : "Listening";
      books.set(id, { id, name, description: typeof book.description === "string" ? book.description : null });
      return Array.isArray(book.lessons) ? book.lessons.filter(record).map((lesson) => ({ ...lesson, bookId: id, bookName: name })) : [];
    })
    : record(source) && Array.isArray(source.lessons)
      ? source.lessons.filter(record).map((lesson) => ({ ...lesson }))
      : [];

  grouped.forEach((lesson, index) => {
    const bookId = String(lesson.bookId ?? declaredBooks[0]?.id ?? "listening");
    const bookName = typeof lesson.bookName === "string"
      ? lesson.bookName
      : typeof declaredBooks[0]?.name === "string" ? declaredBooks[0].name : "Listening";
    if (!books.has(bookId)) books.set(bookId, { id: bookId, name: bookName, description: null });
    lessons.push({ ...lesson, bookId, sourceIndex: index });
  });
  return { books: [...books.values()], lessons };
}

function localAudioCandidates(reference) {
  if (typeof reference !== "string" || !reference) return [];
  let pathname = reference;
  if (/^https?:\/\//i.test(reference)) {
    try {
      pathname = decodeURIComponent(new URL(reference).pathname);
    } catch {
      return [];
    }
  }
  if (pathname.startsWith("/")) pathname = pathname.slice(1);
  const relativePath = path.normalize(pathname);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) return [];
  const fileName = safeFileName(relativePath);
  return [
    path.resolve(projectRoot, "public", relativePath),
    path.resolve(projectRoot, relativePath),
    path.resolve(projectRoot, "uploads", "audio", fileName),
    path.resolve(projectRoot, "public", "uploads", "audio", fileName),
  ];
}

async function readAudio(reference, sourceType) {
  if (typeof reference !== "string" || !reference) return null;
  if (sourceType === "youtube" || sourceType === "googleDrive" || sourceType === "drive") return null;

  if (/^https?:\/\//i.test(reference)) {
    const response = await fetch(reference);
    if (!response.ok) throw new Error(`Không tải được audio nguồn ${reference} (${response.status}).`);
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > maxAudioBytes) throw new Error(`Audio vượt quá giới hạn ${maxAudioBytes / 1024 / 1024} MB.`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maxAudioBytes) throw new Error(`Audio vượt quá giới hạn ${maxAudioBytes / 1024 / 1024} MB.`);
    return { bytes, fileName: safeFileName(path.basename(new URL(reference).pathname)), contentType: response.headers.get("content-type") || "audio/mpeg" };
  }

  const filePath = localAudioCandidates(reference).find(existsSync);
  if (!filePath) return null;
  const bytes = await readFile(filePath);
  if (bytes.length > maxAudioBytes) throw new Error(`Audio vượt quá giới hạn ${maxAudioBytes / 1024 / 1024} MB.`);
  return { bytes, fileName: safeFileName(path.basename(filePath)), contentType: "audio/mpeg" };
}

async function main() {
  const url = requiredEnv("SUPABASE_URL", process.env.VITE_SUPABASE_URL);
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const source = JSON.parse(await readFile(inputPath, "utf8"));
  const { books, lessons } = flatten(source);
  if (lessons.length === 0) throw new Error(`Không tìm thấy bài nghe trong ${inputPath}.`);

  for (const book of books) {
    const { error } = await supabase.from("listening_books").upsert(book);
    if (error) throw new Error(`Không nhập được sách "${book.name}": ${error.message}`);
  }

  let uploadedAudioCount = 0;
  for (const lesson of lessons) {
    const legacyId = String(lesson.id ?? `${lesson.bookId}-${lesson.sourceIndex}`);
    const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(legacyId)
      ? legacyId
      : stableUuid(legacyId);
    const title = typeof lesson.title === "string" ? lesson.title : "Untitled listening";
    const audio = record(lesson.audio) ? lesson.audio : null;
    const audioReference = typeof audio?.path === "string"
      ? audio.path
      : typeof audio?.url === "string" ? audio.url
        : typeof lesson.audio === "string" ? lesson.audio
          : typeof lesson.sourceUrl === "string" ? lesson.sourceUrl : "";
    const sourceType = typeof lesson.sourceType === "string" ? lesson.sourceType : "directAudio";
    const { data: existing, error: lookupError } = await supabase.from("lessons").select("audio_path").eq("id", id).maybeSingle();
    if (lookupError) throw new Error(`Không kiểm tra được bài "${title}": ${lookupError.message}`);

    let audioPath = existing?.audio_path ?? null;
    let uploadedPath = null;
    if (!audioPath && audioReference) {
      const isExternalMedia = ["youtube", "googleDrive", "google-drive", "drive"].includes(sourceType)
        || /youtube\.com|youtu\.be|drive\.google\.com/i.test(audioReference);
      const audioData = isExternalMedia ? null : await readAudio(audioReference, sourceType);
      if (!isExternalMedia && !audioData) {
        throw new Error(`Không tìm thấy file audio "${audioReference}" của bài "${title}". Giữ file cũ và sửa đường dẫn rồi thử lại.`);
      }
      if (audioData) {
        uploadedPath = `${id}/${randomUUID()}-${audioData.fileName}`;
        const { error } = await supabase.storage.from("audio").upload(uploadedPath, audioData.bytes, {
          contentType: audioData.contentType,
          upsert: false,
        });
        if (error) throw new Error(`Không tải được audio của "${title}": ${error.message}`);
        audioPath = uploadedPath;
        uploadedAudioCount += 1;
      }
    }

    const metadata = Object.fromEntries(Object.entries(lesson).filter(([key]) => ![
      "id", "title", "script", "audio", "audioUrl", "audioFileId", "bookId", "bookName", "unit",
      "number", "settings", "sourceIndex",
    ].includes(key)));
    if (audioPath) {
      metadata.sourceUrl = "";
      metadata.source = "local";
      metadata.fileName = audio?.filename ?? path.basename(audioReference);
    } else if (audioReference) {
      metadata.sourceUrl = audioReference;
    }
    const unit = Number(lesson.unit);
    const number = Number(lesson.number);
    const { error } = await supabase.from("lessons").upsert({
      id,
      title,
      script: normalizeScript(lesson.script, id),
      audio_path: audioPath,
      book_id: lesson.bookId,
      unit: Number.isFinite(unit) && unit > 0 ? unit : 1,
      number: Number.isFinite(number) && number > 0 ? number : lesson.sourceIndex + 1,
      data: metadata,
    });
    if (error) {
      if (uploadedPath) {
        const cleanup = await supabase.storage.from("audio").remove([uploadedPath]);
        if (cleanup.error) throw new Error(`Không nhập được "${title}": ${error.message}. File vừa tải lên chưa dọn được: ${cleanup.error.message}`);
      }
      throw new Error(`Không nhập được bài "${title}": ${error.message}`);
    }
    console.log(`Đã nhập: ${title}`);
  }

  console.log(`Hoàn tất ${lessons.length} bài nghe; đã tải ${uploadedAudioCount} file audio lên bucket audio.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
