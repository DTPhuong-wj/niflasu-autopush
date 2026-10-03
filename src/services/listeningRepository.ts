import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  getScriptLineText,
  type ListeningBook,
  type ListeningBookSet,
  type ListeningLesson,
  type ListeningScriptLine,
} from "../types/listening";

const BUCKET = "audio";

type LessonRow = {
  id: string;
  title: string;
  script: Json;
  audio_path: string | null;
  created_at: string;
  updated_at: string;
  book_id: string | null;
  unit: number;
  number: number;
  data: Json;
};

type BookRow = {
  id: string;
  name: string;
  description: string | null;
};

function fail(error: { message: string } | null, what: string): void {
  if (error) throw new Error(`${what}: ${error.message}`);
}

function isRecord(value: Json | undefined): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toFurigana(value: Json | undefined): ListeningScriptLine["furigana"] {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return [];
  return value.flatMap((segment) => {
    if (!isRecord(segment)) return [];
    const text = segment["text"];
    const reading = segment["reading"];
    return typeof text === "string" && typeof reading === "string" ? [{ text, reading }] : [];
  });
}

function toScriptLine(value: Json, index: number, lessonId: string): ListeningScriptLine {
  const line = isRecord(value) ? value : {};
  const japanese =
    typeof line["japanese"] === "string"
      ? line["japanese"]
      : typeof line["text"] === "string"
        ? line["text"]
        : "";
  return {
    id: typeof line["id"] === "string" ? line["id"] : `${lessonId}-line-${index + 1}`,
    speaker: typeof line["speaker"] === "string" ? line["speaker"] : "",
    text: japanese,
    japanese,
    furigana: toFurigana(line["furigana"]),
    translation: typeof line["translation"] === "string" ? line["translation"] : "",
    needsReview: line["needsReview"] === true,
  };
}

function toLesson(row: LessonRow): ListeningLesson {
  const meta = isRecord(row.data) ? row.data : {};
  const script = Array.isArray(row.script)
    ? row.script.map((line, index) => toScriptLine(line, index, row.id))
    : [];
  const sourceUrl = typeof meta["sourceUrl"] === "string" ? meta["sourceUrl"] : "";
  const sourceType =
    meta["sourceType"] === "youtube" ||
    meta["sourceType"] === "googleDrive" ||
    meta["sourceType"] === "drive" ||
    meta["sourceType"] === "audio" ||
    meta["sourceType"] === "directAudio"
      ? meta["sourceType"]
      : "directAudio";
  const lesson: ListeningLesson = {
    ...meta,
    id: row.id,
    bookId: row.book_id ?? "listening",
    unit: row.unit,
    number: row.number,
    title: row.title,
    sourceType,
    sourceUrl,
    hasScript: script.length > 0,
    script,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as ListeningLesson;

  if (row.audio_path) {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(row.audio_path);
    if (!data.publicUrl) throw new Error(`Không tạo được đường dẫn audio cho bài "${row.title}".`);
    lesson.source = "local";
    lesson.sourceType = "directAudio";
    lesson.audio = row.audio_path;
    lesson.audioFileId = undefined;
    lesson.fileName =
      typeof meta["fileName"] === "string" ? meta["fileName"] : row.audio_path.split("/").pop();
    lesson.sourceUrl = data.publicUrl;
  } else if (typeof meta["legacyAudioPath"] === "string") {
    const { data } = supabase.storage.from("listening-audio").getPublicUrl(meta["legacyAudioPath"]);
    lesson.source = "local";
    lesson.sourceType = "directAudio";
    lesson.audio = meta["legacyAudioPath"];
    lesson.fileName = meta["legacyAudioPath"].split("/").pop();
    lesson.sourceUrl = data.publicUrl;
  }
  return lesson;
}

export async function getBooks(): Promise<ListeningBookSet[]> {
  const [booksResult, lessonsResult] = await Promise.all([
    supabase.from("listening_books").select("id,name,description").order("created_at"),
    supabase.from("lessons").select("*").order("unit").order("number"),
  ]);
  fail(booksResult.error ?? lessonsResult.error, "Không tải được bài nghe");

  const books = (booksResult.data ?? []) as BookRow[];
  const lessons = ((lessonsResult.data ?? []) as unknown as LessonRow[]).map(toLesson);
  const bookSets = new Map<string, ListeningBookSet>(
    books.map((book) => [
      book.id,
      {
        book: { id: book.id, name: book.name, description: book.description ?? undefined },
        lessons: [],
      },
    ]),
  );

  for (const lesson of lessons) {
    let bookSet = bookSets.get(lesson.bookId);
    if (!bookSet) {
      bookSet = { book: { id: lesson.bookId, name: "Listening" }, lessons: [] };
      bookSets.set(lesson.bookId, bookSet);
    }
    bookSet.lessons.push(lesson);
  }

  return [...bookSets.values()];
}

export async function saveBook(book: ListeningBook): Promise<void> {
  const { error } = await supabase
    .from("listening_books")
    .upsert({
      id: book.id,
      name: book.name,
      description: book.description ?? null,
    })
    .select("id")
    .single();
  fail(error, "Không lưu được sách");
}

export async function deleteBook(bookId: string): Promise<void> {
  const { data, error: lessonsError } = await supabase
    .from("lessons")
    .select("audio_path,data")
    .eq("book_id", bookId);
  fail(lessonsError, "Không tải được danh sách audio");

  const { data: deletedBooks, error } = await supabase
    .from("listening_books")
    .delete()
    .eq("id", bookId)
    .select("id");
  fail(error, "Không xóa được sách");
  if (!deletedBooks?.length)
    throw new Error("Không xóa được sách: không tìm thấy bản ghi hoặc thiếu quyền quản trị.");

  const audioPaths = (data ?? []).flatMap((row) => {
    const meta = isRecord(row.data) ? row.data : {};
    return [
      ...(row.audio_path ? [{ bucket: BUCKET, path: row.audio_path }] : []),
      ...(typeof meta["legacyAudioPath"] === "string"
        ? [{ bucket: "listening-audio", path: meta["legacyAudioPath"] }]
        : []),
    ];
  });
  const cleanupResults = await Promise.all(
    [BUCKET, "listening-audio"].map(async (bucket) => {
      const paths = audioPaths.filter((item) => item.bucket === bucket).map((item) => item.path);
      return paths.length ? supabase.storage.from(bucket).remove(paths) : { error: null };
    }),
  );
  for (const { error: storageError } of cleanupResults) {
    fail(storageError, "Sách đã bị xóa nhưng không thể dọn một số file audio");
  }
}

function audioFileName(file: File): string {
  const safeName = file.name
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return safeName || "audio";
}

export async function saveLesson(lesson: ListeningLesson, audioFile?: File | null): Promise<void> {
  const id = String(lesson.id);
  const existing = await supabase
    .from("lessons")
    .select("audio_path,data")
    .eq("id", id)
    .maybeSingle();
  fail(existing.error, "Không tải được bài nghe cần cập nhật");
  const previousMetadata = existing.data && isRecord(existing.data.data) ? existing.data.data : {};
  const previousLegacyAudioPath =
    typeof previousMetadata["legacyAudioPath"] === "string"
      ? previousMetadata["legacyAudioPath"]
      : null;

  let audioPath = existing.data?.audio_path ?? null;
  let uploadedPath: string | null = null;
  if (audioFile) {
    uploadedPath = `${id}/${crypto.randomUUID()}-${audioFileName(audioFile)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(uploadedPath, audioFile, {
      contentType: audioFile.type || "application/octet-stream",
      upsert: false,
    });
    fail(error, "Không tải được file audio lên Supabase Storage");
    audioPath = uploadedPath;
  } else if (!lesson.source || lesson.source === "local") {
    audioPath = existing.data?.audio_path ?? null;
  } else {
    audioPath = null;
  }

  const {
    script: _script,
    hasScript: _hasScript,
    id: _id,
    bookId: _bookId,
    unit: _unit,
    number: _number,
    title: _title,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...metadata
  } = lesson;
  const script = lesson.hasScript
    ? lesson.script.map((line, index) => ({
        id: line.id || `${id}-line-${index + 1}`,
        speaker: line.speaker,
        japanese: getScriptLineText(line),
        furigana: line.furigana ?? [],
        translation: line.translation ?? "",
        ...(line.needsReview ? { needsReview: true } : {}),
      }))
    : [];
  const { error } = await supabase
    .from("lessons")
    .upsert({
      id,
      title: lesson.title,
      script: script as unknown as Json,
      audio_path: audioPath,
      book_id: lesson.bookId,
      unit: lesson.unit,
      number: lesson.number,
      data: {
        ...metadata,
        legacyAudioPath:
          !audioPath && lesson.source === "local"
            ? (previousLegacyAudioPath ?? undefined)
            : undefined,
        ...(audioPath ? { sourceUrl: "", source: "local" } : {}),
        fileName: audioFile?.name ?? lesson.fileName ?? null,
      } as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) {
    if (uploadedPath) {
      const cleanup = await supabase.storage.from(BUCKET).remove([uploadedPath]);
      if (cleanup.error) {
        throw new Error(
          `Không lưu được bài nghe: ${error.message}. Không dọn được file audio vừa tải lên: ${cleanup.error.message}`,
        );
      }
    }
    fail(error, "Không lưu được bài nghe");
  }

  const oldAudioPath = existing.data?.audio_path;
  if (oldAudioPath && oldAudioPath !== audioPath) {
    const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([oldAudioPath]);
    fail(cleanupError, "Bài nghe đã được cập nhật nhưng không thể dọn file audio cũ");
  }
  if (previousLegacyAudioPath && (audioPath || lesson.source !== "local")) {
    const { error: cleanupError } = await supabase.storage
      .from("listening-audio")
      .remove([previousLegacyAudioPath]);
    fail(cleanupError, "Bài nghe đã được cập nhật nhưng không thể dọn file audio cũ");
  }
}

export async function deleteLesson(lessonId: string): Promise<void> {
  const { data, error: lookupError } = await supabase
    .from("lessons")
    .select("audio_path,data")
    .eq("id", lessonId)
    .maybeSingle();
  fail(lookupError, "Không tải được bài nghe cần xóa");

  const { data: deletedLessons, error } = await supabase
    .from("lessons")
    .delete()
    .eq("id", lessonId)
    .select("id");
  fail(error, "Không xóa được bài nghe");
  if (!deletedLessons?.length)
    throw new Error("Không xóa được bài nghe: không tìm thấy bản ghi hoặc thiếu quyền quản trị.");
  const meta = data && isRecord(data.data) ? data.data : {};
  const paths = [
    ...(data?.audio_path ? [{ bucket: BUCKET, path: data.audio_path }] : []),
    ...(typeof meta["legacyAudioPath"] === "string"
      ? [{ bucket: "listening-audio", path: meta["legacyAudioPath"] }]
      : []),
  ];
  const cleanupResults = await Promise.all(
    [BUCKET, "listening-audio"].map(async (bucket) => {
      const bucketPaths = paths.filter((item) => item.bucket === bucket).map((item) => item.path);
      return bucketPaths.length
        ? supabase.storage.from(bucket).remove(bucketPaths)
        : { error: null };
    }),
  );
  for (const { error: storageError } of cleanupResults) {
    fail(storageError, "Bài nghe đã bị xóa nhưng không thể dọn file audio");
  }
}
