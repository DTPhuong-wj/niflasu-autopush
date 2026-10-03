import { loadLocalAudioFile } from "./localAudioStorage";
import type { ListeningBook, ListeningBookSet, ListeningLesson } from "../types/listening";

type SaveLessonResponse = { books: ListeningBookSet[]; lesson: ListeningLesson };

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Listening API lỗi (${response.status}).`;
    try {
      const payload = await response.json() as { message?: string };
      if (payload.message) message = payload.message;
    } catch {
      // Keep the status message when the server did not return JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function getListeningBooks(): Promise<ListeningBookSet[]> {
  return responseJson<ListeningBookSet[]>(await fetch("/api/listening", { cache: "no-store" }));
}

export async function persistListeningBook(book: ListeningBook, isNew: boolean): Promise<ListeningBookSet[]> {
  const response = await fetch(isNew ? "/api/listening" : `/api/listening/books/${encodeURIComponent(book.id)}`, {
    method: isNew ? "POST" : "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ book }),
  });
  return responseJson<ListeningBookSet[]>(response);
}

export async function saveListeningLesson(
  book: ListeningBook,
  lesson: ListeningLesson,
  audioFile?: File | null,
  isNew = true,
): Promise<SaveLessonResponse> {
  const form = new FormData();
  form.set("book", JSON.stringify(book));
  form.set("lesson", JSON.stringify(lesson));
  if (audioFile) form.set("audio", audioFile, audioFile.name);
  const response = await fetch(
    isNew ? "/api/listening" : `/api/listening/${encodeURIComponent(String(lesson.id))}`,
    { method: isNew ? "POST" : "PUT", body: form },
  );
  return responseJson<SaveLessonResponse>(response);
}

export async function deleteListeningLesson(lessonId: string | number): Promise<ListeningBookSet[]> {
  const response = await fetch(`/api/listening/${encodeURIComponent(String(lessonId))}`, { method: "DELETE" });
  return responseJson<ListeningBookSet[]>(response);
}

export async function deleteListeningBook(bookId: string): Promise<ListeningBookSet[]> {
  const response = await fetch(`/api/listening/books/${encodeURIComponent(bookId)}`, { method: "DELETE" });
  return responseJson<ListeningBookSet[]>(response);
}

export async function migrateCachedListeningBooks(
  cachedBooks: ListeningBookSet[],
  serverBooks: ListeningBookSet[],
): Promise<ListeningBookSet[]> {
  let currentBooks = serverBooks;
  for (const cachedBookSet of cachedBooks) {
    const cachedBook = cachedBookSet.book;
    if (!currentBooks.some((bookSet) => bookSet.book.id === cachedBook.id)) {
      currentBooks = await persistListeningBook(cachedBook, true);
    }

    for (const cachedLesson of cachedBookSet.lessons) {
      const serverBookSet = currentBooks.find((bookSet) => bookSet.book.id === cachedBook.id);
      if (serverBookSet?.lessons.some((lesson) => String(lesson.id) === String(cachedLesson.id))) continue;

      let audioFile: File | null = null;
      if (cachedLesson.audioFileId) {
        try {
          const blob = await loadLocalAudioFile(cachedLesson.audioFileId);
          if (blob) {
            audioFile = new File([blob], cachedLesson.fileName ?? "listening-audio", {
              type: cachedLesson.audioMimeType ?? blob.type,
            });
          }
        } catch {
          audioFile = null;
        }
      }
      const lesson = cachedLesson.sourceUrl.startsWith("blob:") && !audioFile
        ? { ...cachedLesson, sourceUrl: "", audioFileId: undefined, audio: undefined }
        : cachedLesson;
      const result = await saveListeningLesson(cachedBook, lesson, audioFile, true);
      currentBooks = result.books;
    }
  }
  return currentBooks;
}