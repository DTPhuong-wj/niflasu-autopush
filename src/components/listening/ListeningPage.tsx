import { Headphones, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { loadListeningBooks, saveListeningBooks } from "../../services/listeningStorage";
import type { ListeningBook, ListeningBookSet, ListeningLesson } from "../../types/listening";
import ListeningBookFormModal from "./ListeningBookFormModal";
import ListeningBookSelector from "./ListeningBookSelector";
import ListeningFormModal from "./ListeningFormModal";
import ListeningLessonCard from "./ListeningLessonCard";
import ListeningPlayerModal from "./ListeningPlayerModal";

type DeleteTarget =
  | { type: "book"; book: ListeningBookSet }
  | { type: "lesson"; lesson: ListeningLesson };

export default function ListeningPage() {
  const [books, setBooks] = useState<ListeningBookSet[]>(() => loadListeningBooks());
  const [selectedBookId, setSelectedBookId] = useState(() => loadListeningBooks()[0]?.book.id ?? "");
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
    saveListeningBooks(books);
    if (selectedBook && selectedBook.book.id !== selectedBookId) setSelectedBookId(selectedBook.book.id);
    if (!selectedBook) {
      setSelectedBookId("");
      setIsBookMenuOpen(false);
      setActiveLesson(null);
    }
  }, [books, selectedBook, selectedBookId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDeleteTarget(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSaveLesson = ({ bookId, lesson }: { bookId: string; lesson: ListeningLesson }) => {
    setBooks((current) => current.map((bookSet) => {
      const withoutLesson = bookSet.lessons.filter((item) => item.id !== lesson.id);
      if (bookSet.book.id !== bookId) return { ...bookSet, lessons: withoutLesson };
      return { ...bookSet, lessons: [...withoutLesson, lesson].sort((a, b) => a.unit - b.unit || a.number - b.number) };
    }));
    setSelectedBookId(bookId);
    setShowLessonForm(false);
    setEditingLesson(null);
  };

  const handleSaveBook = (book: ListeningBook) => {
    if (editingBook) {
      setBooks((current) => current.map((bookSet) => bookSet.book.id === book.id ? { ...bookSet, book } : bookSet));
    } else {
      setBooks((current) => [...current, { book, lessons: [] }]);
      setSelectedBookId(book.id);
    }
    setShowBookForm(false);
    setEditingBook(null);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "book") {
      const nextBooks = books.filter((bookSet) => bookSet.book.id !== deleteTarget.book.book.id);
      setBooks(nextBooks);
      setSelectedBookId(nextBooks[0]?.book.id ?? "");
      setActiveLesson(null);
    } else {
      setBooks((current) => current.map((bookSet) => ({
        ...bookSet,
        lessons: bookSet.lessons.filter((item) => item.id !== deleteTarget.lesson.id),
      })));
      setActiveLesson(null);
    }
    setDeleteTarget(null);
  };

  const openNewLessonForm = () => {
    setEditingLesson(null);
    setShowLessonForm(true);
  };

  return (
    <div className="nf-listening-page">
      {selectedBook ? (
        <>
          <div className="nf-listening-topbar">
            <ListeningBookSelector
              book={selectedBook}
              books={books}
              selectedIndex={books.findIndex((item) => item.book.id === selectedBook.book.id)}
              isOpen={isBookMenuOpen}
              onToggle={() => setIsBookMenuOpen((current) => !current)}
              onSelect={(index) => {
                setSelectedBookId(books[index].book.id);
                setIsBookMenuOpen(false);
                setActiveLesson(null);
              }}
              onClose={() => setIsBookMenuOpen(false)}
              onEdit={() => { setEditingBook(selectedBook.book); setShowBookForm(true); }}
              onDelete={() => setDeleteTarget({ type: "book", book: selectedBook })}
            />
            <button type="button" className="nf-btn" onClick={openNewLessonForm}>
              <Plus size={15} strokeWidth={1.8} /> Thêm bài nghe
            </button>
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
      )}

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
          onCreateBook={(book) => { setBooks((current) => [...current, { book, lessons: [] }]); setSelectedBookId(book.id); }}
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
              <button type="button" className="nf-btn nf-btn-danger" onClick={handleDelete}><Trash2 size={15} /> {deleteTarget.type === "book" ? "Xóa sách" : "Xóa bài nghe"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
