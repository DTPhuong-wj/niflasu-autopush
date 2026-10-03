import { Download, Headphones, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { loadListeningBooks, saveListeningBooks } from "../../services/listeningStorage";
import { deleteLocalAudioFile } from "../../services/localAudioStorage";
import { createListeningExport, parsePublishedListeningData } from "../../services/listeningPublish";
import { deleteBook as deleteCloudBook, deleteLesson as deleteCloudLesson, getBooks, saveBook as saveCloudBook, saveLesson as saveCloudLesson } from "../../services/listeningRepository";
import type { ListeningBook, ListeningBookSet, ListeningLesson } from "../../types/listening";
import ListeningBookFormModal from "./ListeningBookFormModal";
import ListeningBookSelector from "./ListeningBookSelector";
import ListeningFormModal from "./ListeningFormModal";
import ListeningLessonCard from "./ListeningLessonCard";
import ListeningPlayerModal from "./ListeningPlayerModal";

type DeleteTarget =
  | { type: "book"; book: ListeningBookSet }
  | { type: "lesson"; lesson: ListeningLesson };

const isLocalMode = import.meta.env["VITE_APP_MODE"] === "local";

export default function ListeningPage() {
  const [books, setBooks] = useState<ListeningBookSet[]>([]);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isBookMenuOpen, setIsBookMenuOpen] = useState(false);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [showBookForm, setShowBookForm] = useState(false);
  const [editingBook, setEditingBook] = useState<ListeningBook | null>(null);
  const [editingLesson, setEditingLesson] = useState<ListeningLesson | null>(null);
  const [activeLesson, setActiveLesson] = useState<ListeningLesson | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const selectedBook = books.find((bookSet) => bookSet.book.id === selectedBookId) ?? books[0];
  const lessons = useMemo(() => selectedBook?.lessons ?? [], [selectedBook]);

  useEffect(() => {
    let cancelled = false;
    if (isLocalMode) {
      setBooks(loadListeningBooks());
      setIsReady(true);
      return;
    }

    void getBooks()
      .then(async (cloudBooks) => {
        if (cloudBooks.length > 0) return cloudBooks;
        let response = await fetch("/lessons.json", { cache: "no-store" });
        if (!response.ok) response = await fetch("/data/lessons.json", { cache: "no-store" });
        if (!response.ok) throw new Error(`Không tải được lessons.json (${response.status}).`);
        const seedBooks = parsePublishedListeningData(await response.json() as unknown);
        for (const bookSet of seedBooks) {
          await saveCloudBook(bookSet.book);
          for (const lesson of bookSet.lessons) await saveCloudLesson(lesson);
        }
        return seedBooks.length > 0 ? getBooks() : seedBooks;
      })
      .then((loadedBooks) => {
        if (!cancelled) setBooks(loadedBooks);
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatusMessage(error instanceof Error ? error.message : "Không tải được dữ liệu Listening.");
      })
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isLocalMode || !isReady) return;
    saveListeningBooks(books);
    if (selectedBook && selectedBook.book.id !== selectedBookId) setSelectedBookId(selectedBook.book.id);
    if (!selectedBook) {
      setSelectedBookId("");
      setIsBookMenuOpen(false);
      setActiveLesson(null);
    }
  }, [books, selectedBook, selectedBookId, isReady]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDeleteTarget(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSaveLesson = async ({ bookId, lesson, audioFile }: { bookId: string; lesson: ListeningLesson; audioFile: File | null }) => {
    if (!isLocalMode) {
      const book = books.find((bookSet) => bookSet.book.id === bookId)?.book;
      if (!book) throw new Error("Không tìm thấy sách của bài nghe.");
      await saveCloudBook(book);
      await saveCloudLesson(lesson, audioFile);
      setBooks(await getBooks());
      setSelectedBookId(bookId);
      setShowLessonForm(false);
      setEditingLesson(null);
      return;
    }

    const previousLesson = books.flatMap((bookSet) => bookSet.lessons).find((item) => String(item.id) === String(lesson.id));
    setBooks((current) => current.map((bookSet) => {
      const withoutLesson = bookSet.lessons.filter((item) => item.id !== lesson.id);
      if (bookSet.book.id !== bookId) return { ...bookSet, lessons: withoutLesson };
      return { ...bookSet, lessons: [...withoutLesson, lesson].sort((a, b) => a.unit - b.unit || a.number - b.number) };
    }));
    setSelectedBookId(bookId);
    setShowLessonForm(false);
    setEditingLesson(null);
    if (previousLesson?.audioFileId && previousLesson.audioFileId !== lesson.audioFileId) {
      await deleteLocalAudioFile(previousLesson.audioFileId);
    }
  };

  const handleSaveBook = async (book: ListeningBook) => {
    if (!isLocalMode) {
      await saveCloudBook(book);
      setBooks(await getBooks());
      setShowBookForm(false);
      setEditingBook(null);
      return;
    }

    if (editingBook) {
      setBooks((current) => current.map((bookSet) => bookSet.book.id === book.id ? { ...bookSet, book } : bookSet));
    } else {
      setBooks((current) => [...current, { book, lessons: [] }]);
      setSelectedBookId(book.id);
    }
    setShowBookForm(false);
    setEditingBook(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (!isLocalMode) {
      try {
        if (deleteTarget.type === "book") await deleteCloudBook(deleteTarget.book.book.id);
        else await deleteCloudLesson(String(deleteTarget.lesson.id));
        setBooks(await getBooks());
        setActiveLesson(null);
        setDeleteTarget(null);
      } catch (error) {
        setStatusMessage(error instanceof Error ? error.message : "Không thể xóa dữ liệu Listening.");
      }
      return;
    }

    if (deleteTarget.type === "book") {
      await Promise.all(deleteTarget.book.lessons.flatMap((lesson) => lesson.audioFileId ? [deleteLocalAudioFile(lesson.audioFileId)] : []));
      const nextBooks = books.filter((bookSet) => bookSet.book.id !== deleteTarget.book.book.id);
      setBooks(nextBooks);
      setSelectedBookId(nextBooks[0]?.book.id ?? "");
      setActiveLesson(null);
    } else {
      if (deleteTarget.lesson.audioFileId) await deleteLocalAudioFile(deleteTarget.lesson.audioFileId);
      setBooks((current) => current.map((bookSet) => ({
        ...bookSet,
        lessons: bookSet.lessons.filter((item) => item.id !== deleteTarget.lesson.id),
      })));
      setActiveLesson(null);
    }
    setDeleteTarget(null);
  };

  const handleExport = async () => {
    if (!isLocalMode || isExporting) return;
    setIsExporting(true);
    setStatusMessage("Đang chuẩn bị dữ liệu export...");
    try {
      const result = await createListeningExport(books);
      const objectUrl = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "niflasu-listening-export.zip";
      link.click();
      URL.revokeObjectURL(objectUrl);
      setStatusMessage(`Export hoàn tất: ${result.lessonCount} bài nghe. Giải nén ZIP vào thư mục project rồi deploy.`);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Không thể export dữ liệu Listening.");
    } finally {
      setIsExporting(false);
    }
  };

  const openNewLessonForm = () => {
    setEditingLesson(null);
    setShowLessonForm(true);
  };

  return (
    <div className="nf-listening-page">
      {!isReady ? <div className="nf-listening-empty-state">Đang tải dữ liệu Listening...</div> : null}
      {isReady && statusMessage ? <div className="nf-listening-export-status" role="status">{statusMessage}</div> : null}
      {isReady && (selectedBook ? (
        <>
          <div className="nf-listening-topbar">
            <ListeningBookSelector
              book={selectedBook}
              books={books}
              selectedIndex={books.findIndex((item) => item.book.id === selectedBook.book.id)}
              isOpen={isBookMenuOpen}
              onToggle={() => setIsBookMenuOpen((current) => !current)}
              onSelect={(index) => {
                setSelectedBookId(books[index]?.book.id ?? "");
                setIsBookMenuOpen(false);
                setActiveLesson(null);
              }}
              onClose={() => setIsBookMenuOpen(false)}
              onEdit={() => { setEditingBook(selectedBook.book); setShowBookForm(true); }}
              onDelete={() => setDeleteTarget({ type: "book", book: selectedBook })}
              readOnly={false}
            />
            <div className="nf-listening-manager-actions">
              {isLocalMode && (
                <button type="button" className="nf-btn" onClick={() => void handleExport()} disabled={isExporting}>
                  <Download size={15} /> {isExporting ? "Đang export..." : "Sync / Export"}
                </button>
              )}
              <button type="button" className="nf-btn" onClick={openNewLessonForm}>
                <Plus size={15} strokeWidth={1.8} /> Thêm bài nghe
              </button>
            </div>
          </div>

          {lessons.length > 0 ? (
            <div className="nf-listening-grid">
              {lessons.map((lesson) => (
                <ListeningLessonCard
                  key={String(lesson.id)}
                  lesson={lesson}
                  onSelect={setActiveLesson}
                  onEdit={(nextLesson) => { setEditingLesson(nextLesson); setShowLessonForm(true); }}
                  onDelete={(lessonToDelete) => setDeleteTarget({ type: "lesson", lesson: lessonToDelete })}
                  readOnly={false}
                />
              ))}
            </div>
          ) : (
            <div className="nf-listening-empty-state">
              <Headphones size={30} strokeWidth={1.7} />
              <strong>Chưa có bài nghe trong sách này</strong>
              <span>Thêm bài nghe đầu tiên để bắt đầu học.</span>
              <button type="button" className="nf-btn is-active" onClick={openNewLessonForm}><Plus size={15} /> Thêm bài nghe</button>
            </div>
          )}
        </>
      ) : (
        <div className="nf-listening-empty-state">
          <Headphones size={34} strokeWidth={1.7} />
          <strong>Chưa có sách nghe</strong>
          <span>Hãy thêm sách hoặc bài nghe để bắt đầu.</span>
          <button type="button" className="nf-btn is-active" onClick={() => { setEditingBook(null); setShowBookForm(true); }}><Plus size={15} /> Thêm sách</button>
        </div>
      ))}

      {activeLesson && selectedBook && (
        <ListeningPlayerModal lesson={activeLesson} bookName={selectedBook.book.name} onClose={() => setActiveLesson(null)} />
      )}

      {showLessonForm && (
        <ListeningFormModal
          books={books}
          selectedBookId={selectedBook?.book.id ?? ""}
          editingLesson={editingLesson}
          onClose={() => { setShowLessonForm(false); setEditingLesson(null); }}
          onSave={handleSaveLesson}
          onCreateBook={async (book) => {
            if (isLocalMode) {
              setBooks((current) => [...current, { book, lessons: [] }]);
            } else {
              await saveCloudBook(book);
              setBooks(await getBooks());
            }
            setSelectedBookId(book.id);
          }}
        />
      )}

      {showBookForm && (
        <ListeningBookFormModal
          book={editingBook ?? { id: `book-${Date.now()}`, name: "", description: "" }}
          isNew={!editingBook}
          onClose={() => { setShowBookForm(false); setEditingBook(null); }}
          onSave={handleSaveBook}
        />
      )}

      {deleteTarget && (
        <div className="nf-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="nf-listening-confirm-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <h2 className="nf-modal-title">{deleteTarget.type === "book" ? "Xóa sách?" : "Xóa bài nghe?"}</h2>
            <p>{deleteTarget.type === "book" ? `Bạn có chắc muốn xóa "${deleteTarget.book.book.name}" không? Các bài nghe thuộc sách này cũng sẽ bị xóa khỏi danh sách.` : `Bạn có chắc muốn xóa bài nghe ${deleteTarget.lesson.title}?`}</p>
            <div className="nf-modal-actions">
              <button type="button" className="nf-btn" onClick={() => setDeleteTarget(null)}>Hủy</button>
              <button type="button" className="nf-btn nf-btn-danger" onClick={() => void handleDelete()}><Trash2 size={15} /> {deleteTarget.type === "book" ? "Xóa sách" : "Xóa bài nghe"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
