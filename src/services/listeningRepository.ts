/**
 * Single storage interface for listening data. Used the same way locally and on the web:
 * book/lesson metadata + script lines live in Lovable Cloud tables, audio files in Cloud storage.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { getScriptLineText, type FuriganaSegment, type ListeningBook, type ListeningBookSet, type ListeningLesson, type ListeningScriptLine } from "../types/listening";

const BUCKET = "listening-audio";
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 7;

function fail(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

// ---------- Audio ----------
export async function uploadAudio(lessonId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
  const path = `${lessonId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "audio/mpeg",
    upsert: true,
  });
  fail(error, "Không tải được file audio");
  return path;
}

export async function getAudio(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  fail(error, "Không mở được file audio");
  return data!.signedUrl;
}

export async function deleteAudio(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path]);
}

// ---------- Books ----------
export async function saveBook(book: ListeningBook): Promise<void> {
  const { error } = await supabase.from("listening_books").upsert({
    id: book.id,
    name: book.name,
    description: book.description ?? null,
  });
  fail(error, "Không lưu được sách");
}

export async function deleteBook(bookId: string): Promise<void> {
  const { data } = await supabase.from("listening_lessons").select("audio_path").eq("book_id", bookId);
  const paths = (data ?? []).map((r) => r.audio_path).filter((p): p is string => !!p);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  const { error } = await supabase.from("listening_books").delete().eq("id", bookId);
  fail(error, "Không xóa được sách");
}

// ---------- Lessons ----------
type LessonRow = {
  id: string;
  book_id: string;
  unit: number;
  number: number;
  title: string;
  data: Json;
  audio_path: string | null;
  created_at: string;
  updated_at: string;
};
type LineRow = {
  id: string;
  lesson_id: string;
  position: number;
  speaker: string;
  japanese: string;
  furigana: Json;
  translation: string;
  needs_review: boolean;
};

function toLine(row: LineRow): ListeningScriptLine {
  return {
    id: row.id,
    speaker: row.speaker,
    text: row.japanese,
    furigana: Array.isArray(row.furigana) ? (row.furigana as unknown as FuriganaSegment[]) : [],
    translation: row.translation,
    needsReview: row.needs_review,
  };
}

async function toLesson(row: LessonRow, lines: LineRow[]): Promise<ListeningLesson> {
  const meta = (row.data ?? {}) as unknown as Partial<ListeningLesson>;
  const script = lines.filter((l) => l.lesson_id === row.id).sort((a, b) => a.position - b.position).map(toLine);
  const lesson: ListeningLesson = {
    sourceType: "directAudio",
    sourceUrl: "",
    ...meta,
    id: row.id,
    bookId: row.book_id,
    unit: row.unit,
    number: row.number,
    title: row.title,
    hasScript: script.length > 0,
    script,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.audio_path) {
    lesson.source = "local";
    lesson.sourceType = "directAudio";
    lesson.audio = row.audio_path;
    lesson.audioFileId = undefined;
    lesson.sourceUrl = await getAudio(row.audio_path).catch(() => "");
  }
  return lesson;
}

export async function getBooks(): Promise<ListeningBookSet[]> {
  const [books, lessons, lines] = await Promise.all([
    supabase.from("listening_books").select("*").order("created_at"),
    supabase.from("listening_lessons").select("*"),
    supabase.from("listening_script_lines").select("*"),
  ]);
  fail(books.error ?? lessons.error ?? lines.error, "Không tải được bài nghe");
  const allLessons = await Promise.all((lessons.data ?? []).map((row) => toLesson(row, lines.data ?? [])));
  return (books.data ?? []).map((b) => ({
    book: { id: b.id, name: b.name, description: b.description ?? undefined },
    lessons: allLessons.filter((l) => l.bookId === b.id).sort((a, b2) => a.unit - b2.unit || a.number - b2.number),
  }));
}

export async function getLesson(lessonId: string): Promise<ListeningLesson | null> {
  const [lesson, lines] = await Promise.all([
    supabase.from("listening_lessons").select("*").eq("id", lessonId).maybeSingle(),
    supabase.from("listening_script_lines").select("*").eq("lesson_id", lessonId),
  ]);
  if (!lesson.data) return null;
  return toLesson(lesson.data, lines.data ?? []);
}

/** Replaces the script of a lesson with the given lines (latest version only, no duplicates). */
export async function saveScript(lessonId: string, script: ListeningScriptLine[]): Promise<void> {
  const del = await supabase.from("listening_script_lines").delete().eq("lesson_id", lessonId);
  fail(del.error, "Không lưu được script");
  if (script.length === 0) return;
  const { error } = await supabase.from("listening_script_lines").insert(
    script.map((line, position) => ({
      lesson_id: lessonId,
      position,
      speaker: line.speaker,
      japanese: getScriptLineText(line),
      furigana: (line.furigana ?? []) as unknown as Json,
      translation: line.translation ?? "",
      needs_review: !!line.needsReview,
    })),
  );
  fail(error, "Không lưu được script");
  await supabase.from("listening_lessons").update({ updated_at: new Date().toISOString() }).eq("id", lessonId);
}

export async function saveLesson(lesson: ListeningLesson, audioFile?: File | null): Promise<void> {
  const id = String(lesson.id);
  const existing = await supabase.from("listening_lessons").select("audio_path").eq("id", id).maybeSingle();
  let audioPath = existing.data?.audio_path ?? null;
  if (audioFile) {
    const newPath = await uploadAudio(id, audioFile);
    if (audioPath) await deleteAudio(audioPath);
    audioPath = newPath;
  } else if (lesson.source !== "local" && audioPath) {
    await deleteAudio(audioPath);
    audioPath = null;
  }
  const { script: _script, hasScript: _h, id: _id, bookId: _b, unit, number, title, createdAt: _c, updatedAt: _u, ...meta } = lesson;
  const { error } = await supabase.from("listening_lessons").upsert({
    id,
    book_id: lesson.bookId,
    unit,
    number,
    title,
    data: (audioPath ? { ...meta, sourceUrl: "" } : meta) as unknown as Json,
    audio_path: audioPath,
    updated_at: new Date().toISOString(),
  });
  fail(error, "Không lưu được bài nghe");
  await saveScript(id, lesson.hasScript ? lesson.script : []);
}

export async function deleteLesson(lessonId: string): Promise<void> {
  const { data } = await supabase.from("listening_lessons").select("audio_path").eq("id", lessonId).maybeSingle();
  if (data?.audio_path) await deleteAudio(data.audio_path);
  const { error } = await supabase.from("listening_lessons").delete().eq("id", lessonId);
  fail(error, "Không xóa được bài nghe");
}
