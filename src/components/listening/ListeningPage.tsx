import { Headphones, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ListeningBookSelector from "./ListeningBookSelector";
import ListeningLessonCard from "./ListeningLessonCard";
import ListeningPlayerModal from "./ListeningPlayerModal";
import type {
  FuriganaSegment,
  ListeningBookSet,
  ListeningLesson,
  ListeningScriptLine,
} from "../../types/listening";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toScriptLine(value: unknown, index: number, lessonId: string): ListeningScriptLine | null {
  if (!isRecord(value)) return null;
  const japanese = asText(value.japanese) || asText(value.text);
  const furigana = Array.isArray(value.furigana)
    ? value.furigana.flatMap((segment): FuriganaSegment[] => {
        if (!isRecord(segment)) return [];
        const text = asText(segment.text);
        const reading = asText(segment.reading);
        return text && reading ? [{ text, reading }] : [];
      })
    : typeof value.furigana === "string"
      ? value.furigana
      : [];

  return {
    id: asText(value.id) || `${lessonId}-line-${index + 1}`,
    speaker: asText(value.speaker),
    japanese,
    text: japanese,
    furigana,
    translation: asText(value.translation),
  };
}

function unitOf(lesson: Record<string, unknown>, audioUrl: string, index: number): number {
  const unit = Number(lesson.unit);
  if (Number.isFinite(unit) && unit > 0) return unit;
  const filename = audioUrl || asText(lesson.title);
  const match = filename.match(/(?:unit|ユニット)[\s_-]*(\d+)/i);
  return match ? Number(match[1]) : index + 1;
}

function toLesson(value: unknown, bookId: string, index: number): ListeningLesson | null {
  if (!isRecord(value)) return null;
  const id = asText(value.id) || `${bookId}-lesson-${index + 1}`;
  const audio = isRecord(value.audio) ? value.audio : {};
  const audioUrl =
    asText(audio.url) ||
    asText(value.audioUrl) ||
    asText(value.sourceUrl) ||
    (typeof value.audio === "string" ? value.audio : "");
  const rawSourceType = asText(value.sourceType);
  const sourceType = ["youtube", "googleDrive", "drive", "audio", "directAudio"].includes(
    rawSourceType,
  )
    ? (rawSourceType as ListeningLesson["sourceType"])
    : "directAudio";
  const script = Array.isArray(value.script)
    ? value.script.flatMap((line, lineIndex) => {
        const normalized = toScriptLine(line, lineIndex, id);
        return normalized ? [normalized] : [];
      })
    : [];
  const title = asText(value.title) || asText(value.name) || `Bài nghe ${index + 1}`;

  return {
    id,
    bookId,
    unit: unitOf(value, audioUrl, index),
    number:
      Number.isFinite(Number(value.number)) && Number(value.number) > 0
        ? Number(value.number)
        : index + 1,
    title,
    name: asText(value.name) || title,
    description: asText(value.description),
    duration:
      typeof value.duration === "number" || typeof value.duration === "string"
        ? value.duration
        : undefined,
    audio: asText(audio.filename) || audioUrl || undefined,
    audioMimeType: asText(audio.mimeType) || undefined,
    source: audioUrl.startsWith("/") ? "local" : undefined,
    sourceType,
    sourceUrl: audioUrl,
    audioUrl,
    hasScript: script.some((line) => Boolean(line.japanese?.trim() || line.text?.trim())),
    script,
  };
}

function toBookSets(data: unknown): ListeningBookSet[] {
  const roots = Array.isArray(data) ? data.filter(isRecord) : isRecord(data) ? [data] : [];
  const books = new Map<string, ListeningBookSet>();

  for (const root of roots) {
    if (!Array.isArray(root.lessons)) continue;
    const bookId = asText(root.id) || asText(root.name) || "listening";
    const bookName =
      asText(root.bookname) || asText(root.name) || asText(root.title) || "Listening";
    const bookSet = books.get(bookId) ?? {
      book: {
        id: bookId,
        name: bookName,
        description: asText(root.description) || undefined,
      },
      lessons: [],
    };
    const lessonOffset = bookSet.lessons.length;
    bookSet.lessons.push(
      ...root.lessons.flatMap((lesson, index) => {
        const normalized = toLesson(lesson, bookId, lessonOffset + index);
        return normalized ? [normalized] : [];
      }),
    );
    books.set(bookId, bookSet);
  }

  if (books.size === 0 && roots.some((root) => "audio" in root || "script" in root)) {
    const bookId = "listening";
    const lessons = roots.flatMap((lesson, index) => {
      const normalized = toLesson(lesson, bookId, index);
      return normalized ? [normalized] : [];
    });
    if (lessons.length > 0) {
      books.set(bookId, { book: { id: bookId, name: "Listening" }, lessons });
    }
  }

  return [...books.values()];
}

export default function ListeningPage() {
  const [books, setBooks] = useState<ListeningBookSet[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [isBookMenuOpen, setIsBookMenuOpen] = useState(false);
  const [activeLesson, setActiveLesson] = useState<ListeningLesson | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsReady(false);
    setLoadError("");

    void fetch("/lessons.json", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Không tải được lessons.json (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((data) => {
        if (cancelled) return;
        const loadedBooks = toBookSets(data);
        if (loadedBooks.length === 0) {
          throw new Error("File lessons.json không có sách hoặc bài nghe hợp lệ.");
        }
        setBooks(loadedBooks);
        setSelectedBookId((current) =>
          loadedBooks.some(({ book }) => book.id === current)
            ? current
            : (loadedBooks[0]?.book.id ?? ""),
        );
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Không đọc được lessons.json.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const selectedBook = books.find(({ book }) => book.id === selectedBookId) ?? books[0];
  const lessons = useMemo(() => selectedBook?.lessons ?? [], [selectedBook]);

  return (
    <div className="nf-listening-page">
      {!isReady ? (
        <div className="nf-listening-empty-state" role="status">
          Đang tải dữ liệu Listening từ lessons.json...
        </div>
      ) : loadError ? (
        <div className="nf-listening-empty-state" role="alert">
          <strong>Không tải được dữ liệu Listening</strong>
          <span>{loadError}</span>
          <button
            type="button"
            className="nf-btn"
            onClick={() => setReloadKey((current) => current + 1)}
          >
            <RefreshCw size={15} /> Thử lại
          </button>
        </div>
      ) : selectedBook ? (
        <>
          <div className="nf-listening-topbar">
            <ListeningBookSelector
              book={selectedBook}
              books={books}
              selectedIndex={books.findIndex(({ book }) => book.id === selectedBook.book.id)}
              isOpen={isBookMenuOpen}
              onToggle={() => setIsBookMenuOpen((current) => !current)}
              onSelect={(index) => {
                setSelectedBookId(books[index]?.book.id ?? "");
                setIsBookMenuOpen(false);
                setActiveLesson(null);
              }}
              onClose={() => setIsBookMenuOpen(false)}
              onEdit={() => {}}
              onDelete={() => {}}
              readOnly
            />
          </div>

          {lessons.length > 0 ? (
            <div className="nf-listening-grid">
              {lessons.map((lesson) => (
                <ListeningLessonCard
                  key={String(lesson.id)}
                  lesson={lesson}
                  onSelect={setActiveLesson}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  readOnly
                />
              ))}
            </div>
          ) : (
            <div className="nf-listening-empty-state">
              <Headphones size={30} strokeWidth={1.7} />
              <strong>Chưa có bài nghe trong sách này</strong>
              <span>Thêm bài nghe vào lessons.json để hiển thị tại đây.</span>
            </div>
          )}
        </>
      ) : (
        <div className="nf-listening-empty-state">
          <Headphones size={34} strokeWidth={1.7} />
          <strong>Chưa có sách nghe</strong>
          <span>Thêm sách và bài nghe vào lessons.json để hiển thị tại đây.</span>
        </div>
      )}

      {activeLesson && selectedBook && (
        <ListeningPlayerModal
          lesson={activeLesson}
          bookName={selectedBook.book.name}
          onClose={() => setActiveLesson(null)}
        />
      )}
    </div>
  );
}
