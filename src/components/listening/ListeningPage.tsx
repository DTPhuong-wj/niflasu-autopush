import { Headphones, LogIn, LogOut, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../integrations/supabase/client";
import {
  deleteBook as deleteCloudBook,
  deleteLesson as deleteCloudLesson,
  getBooks,
  saveBook as saveCloudBook,
  saveLesson as saveCloudLesson,
} from "../../services/listeningRepository";
import type { ListeningBook, ListeningBookSet, ListeningLesson } from "../../types/listening";
import ListeningBookFormModal from "./ListeningBookFormModal";
import ListeningBookSelector from "./ListeningBookSelector";
import ListeningFormModal from "./ListeningFormModal";
import ListeningLessonCard from "./ListeningLessonCard";
import ListeningPlayerModal from "./ListeningPlayerModal";

type DeleteTarget =
  { type: "book"; book: ListeningBookSet } | { type: "lesson"; lesson: ListeningLesson };

const isLocalMode = import.meta.env["VITE_APP_MODE"] === "local";

export default function ListeningPage() {
  const [books, setBooks] = useState<ListeningBookSet[]>([]);
  const [selectedBookId, setSelectedBookId] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isBookMenuOpen, setIsBookMenuOpen] = useState(false);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [showBookForm, setShowBookForm] = useState(false);
  const [editingBook, setEditingBook] = useState<ListeningBook | null>(null);
  const [editingLesson, setEditingLesson] = useState<ListeningLesson | null>(null);
  const [activeLesson, setActiveLesson] = useState<ListeningLesson | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [authLoading, setAuthLoading] = useState(isLocalMode);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginPending, setLoginPending] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const selectedBook = books.find((bookSet) => bookSet.book.id === selectedBookId) ?? books[0];
  const lessons = useMemo(() => selectedBook?.lessons ?? [], [selectedBook]);
  const canManage = isLocalMode && isAdmin;

  useEffect(() => {
    let cancelled = false;
    setIsReady(false);
    setLoadError("");
    void getBooks()
      .then((loadedBooks) => {
        if (cancelled) return;
        setBooks(loadedBooks);
        setSelectedBookId((current) =>
          loadedBooks.some(({ book }) => book.id === current)
            ? current
            : (loadedBooks[0]?.book.id ?? ""),
        );
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setLoadError(
            error instanceof Error ? error.message : "Không tải được dữ liệu Listening.",
          );
      })
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!isLocalMode) return;
    let active = true;
    let unsubscribe = () => {};
    try {
      const auth = supabase.auth;
      const {
        data: { subscription },
      } = auth.onAuthStateChange((_event, session) => {
        if (active) {
          setIsAdmin(session?.user.app_metadata?.["role"] === "admin");
          setAuthLoading(false);
          setAuthError("");
        }
      });
      unsubscribe = () => subscription.unsubscribe();
      void auth
        .getSession()
        .then(({ data, error }) => {
          if (!active) return;
          if (error) setAuthError(`Không kiểm tra được phiên đăng nhập: ${error.message}`);
          setIsAdmin(data.session?.user.app_metadata?.["role"] === "admin");
          setAuthLoading(false);
        })
        .catch((error: unknown) => {
          if (!active) return;
          setAuthError(
            error instanceof Error ? error.message : "Không kiểm tra được phiên đăng nhập.",
          );
          setAuthLoading(false);
        });
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Không khởi tạo được xác thực Supabase.",
      );
      setAuthLoading(false);
    }
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (selectedBook && selectedBook.book.id !== selectedBookId)
      setSelectedBookId(selectedBook.book.id);
    if (!selectedBook) {
      setSelectedBookId("");
      setIsBookMenuOpen(false);
      setActiveLesson(null);
    }
  }, [selectedBook, selectedBookId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDeleteTarget(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const refreshAfterWrite = async (successMessage: string) => {
    try {
      const updatedBooks = await getBooks();
      setBooks(updatedBooks);
      setSelectedBookId((current) =>
        updatedBooks.some(({ book }) => book.id === current)
          ? current
          : (updatedBooks[0]?.book.id ?? ""),
      );
      setStatusMessage(successMessage);
    } catch (error) {
      setStatusMessage(
        `${successMessage} Tuy nhiên, không tải lại được danh sách: ${error instanceof Error ? error.message : "lỗi kết nối."}`,
      );
    }
  };

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loginPending) return;
    setLoginPending(true);
    setAuthError("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (data.user?.app_metadata?.["role"] !== "admin") {
        setAuthError("Tài khoản đã đăng nhập nhưng chưa được cấp quyền Listening admin.");
      }
      setPassword("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Không đăng nhập được.");
    } finally {
      setLoginPending(false);
    }
  };

  const handleLogout = async () => {
    setAuthError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      setAuthError(
        `Không đăng xuất được: ${error instanceof Error ? error.message : "lỗi kết nối."}`,
      );
    }
  };

  const handleSaveLesson = async ({
    bookId,
    lesson,
    audioFile,
  }: {
    bookId: string;
    lesson: ListeningLesson;
    audioFile: File | null;
  }) => {
    if (!canManage)
      throw new Error("Chỉ tài khoản Listening admin trong Local mode mới được ghi dữ liệu.");
    const book = books.find((bookSet) => bookSet.book.id === bookId)?.book;
    if (!book) throw new Error("Không tìm thấy sách của bài nghe.");
    await saveCloudBook(book);
    await saveCloudLesson(lesson, audioFile);
    await refreshAfterWrite("Đã lưu bài nghe lên Supabase.");
    setSelectedBookId(bookId);
    setShowLessonForm(false);
    setEditingLesson(null);
  };

  const handleSaveBook = async (book: ListeningBook) => {
    if (!canManage)
      throw new Error("Chỉ tài khoản Listening admin trong Local mode mới được ghi dữ liệu.");
    await saveCloudBook(book);
    await refreshAfterWrite("Đã lưu sách lên Supabase.");
    setShowBookForm(false);
    setEditingBook(null);
    if (!editingBook) setSelectedBookId(book.id);
  };

  const handleCreateBook = async (book: ListeningBook) => {
    if (!canManage)
      throw new Error("Chỉ tài khoản Listening admin trong Local mode mới được ghi dữ liệu.");
    await saveCloudBook(book);
    await refreshAfterWrite("Đã thêm sách lên Supabase.");
    setSelectedBookId(book.id);
  };

  const handleDelete = async () => {
    if (!deleteTarget || !canManage || isDeleting) return;
    setIsDeleting(true);
    setStatusMessage("");
    try {
      if (deleteTarget.type === "book") await deleteCloudBook(deleteTarget.book.book.id);
      else await deleteCloudLesson(String(deleteTarget.lesson.id));
      await refreshAfterWrite(
        deleteTarget.type === "book"
          ? "Đã xóa sách khỏi Supabase."
          : "Đã xóa bài nghe khỏi Supabase.",
      );
      setActiveLesson(null);
      setDeleteTarget(null);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Không thể xóa dữ liệu Listening.");
      setReloadKey((current) => current + 1);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="nf-listening-page">
      {isLocalMode && (
        <section className="nf-listening-auth-panel" aria-label="Quyền quản trị Listening">
          {authLoading ? (
            <span>Đang kiểm tra quyền quản trị...</span>
          ) : isAdmin ? (
            <>
              <span>Đã đăng nhập Listening admin. Thay đổi được lưu trực tiếp lên Supabase.</span>
              <button type="button" className="nf-btn" onClick={() => void handleLogout()}>
                <LogOut size={15} /> Đăng xuất
              </button>
            </>
          ) : (
            <form onSubmit={(event) => void handleLogin(event)}>
              <strong>
                <LogIn size={15} /> Đăng nhập để quản lý Listening
              </strong>
              <label className="nf-field">
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              <label className="nf-field">
                <span>Mật khẩu</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              <button type="submit" className="nf-btn is-active" disabled={loginPending}>
                {loginPending ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>
            </form>
          )}
          {authError && (
            <div className="nf-listening-form-error" role="alert">
              {authError}
            </div>
          )}
        </section>
      )}

      {!isReady ? (
        <div className="nf-listening-empty-state" role="status">
          Đang tải dữ liệu Listening từ Supabase...
        </div>
      ) : null}
      {isReady && loadError ? (
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
      ) : null}
      {isReady && !loadError && statusMessage ? (
        <div className="nf-listening-status" role="status">
          {statusMessage}
        </div>
      ) : null}

      {isReady &&
        !loadError &&
        (selectedBook ? (
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
                onEdit={() => {
                  setEditingBook(selectedBook.book);
                  setShowBookForm(true);
                }}
                onDelete={() => setDeleteTarget({ type: "book", book: selectedBook })}
                readOnly={!canManage}
              />
              {canManage && (
                <div className="nf-listening-manager-actions">
                  <button
                    type="button"
                    className="nf-btn"
                    onClick={() => {
                      setEditingLesson(null);
                      setShowLessonForm(true);
                    }}
                  >
                    <Plus size={15} strokeWidth={1.8} /> Thêm bài nghe
                  </button>
                </div>
              )}
            </div>

            {lessons.length > 0 ? (
              <div className="nf-listening-grid">
                {lessons.map((lesson) => (
                  <ListeningLessonCard
                    key={String(lesson.id)}
                    lesson={lesson}
                    onSelect={setActiveLesson}
                    onEdit={(nextLesson) => {
                      setEditingLesson(nextLesson);
                      setShowLessonForm(true);
                    }}
                    onDelete={(lessonToDelete) =>
                      setDeleteTarget({ type: "lesson", lesson: lessonToDelete })
                    }
                    readOnly={!canManage}
                  />
                ))}
              </div>
            ) : (
              <div className="nf-listening-empty-state">
                <Headphones size={30} strokeWidth={1.7} />
                <strong>Chưa có bài nghe trong sách này</strong>
                <span>
                  {canManage
                    ? "Thêm bài nghe đầu tiên để bắt đầu."
                    : "Bài nghe sẽ xuất hiện tại đây sau khi được thêm."}
                </span>
                {canManage && (
                  <button
                    type="button"
                    className="nf-btn is-active"
                    onClick={() => {
                      setEditingLesson(null);
                      setShowLessonForm(true);
                    }}
                  >
                    <Plus size={15} /> Thêm bài nghe
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="nf-listening-empty-state">
            <Headphones size={34} strokeWidth={1.7} />
            <strong>Chưa có sách nghe</strong>
            <span>
              {canManage
                ? "Hãy thêm sách hoặc bài nghe để bắt đầu."
                : "Sách và bài nghe sẽ xuất hiện sau khi được thêm."}
            </span>
            {canManage && (
              <button
                type="button"
                className="nf-btn is-active"
                onClick={() => {
                  setEditingBook(null);
                  setShowBookForm(true);
                }}
              >
                <Plus size={15} /> Thêm sách
              </button>
            )}
          </div>
        ))}

      {activeLesson && selectedBook && (
        <ListeningPlayerModal
          lesson={activeLesson}
          bookName={selectedBook.book.name}
          onClose={() => setActiveLesson(null)}
        />
      )}

      {canManage && showLessonForm && (
        <ListeningFormModal
          books={books}
          selectedBookId={selectedBook?.book.id ?? ""}
          editingLesson={editingLesson}
          onClose={() => {
            setShowLessonForm(false);
            setEditingLesson(null);
          }}
          onSave={handleSaveLesson}
          onCreateBook={handleCreateBook}
        />
      )}

      {canManage && showBookForm && (
        <ListeningBookFormModal
          book={editingBook ?? { id: `book-${Date.now()}`, name: "", description: "" }}
          isNew={!editingBook}
          onClose={() => {
            setShowBookForm(false);
            setEditingBook(null);
          }}
          onSave={handleSaveBook}
        />
      )}

      {canManage && deleteTarget && (
        <div
          className="nf-overlay"
          onClick={() => {
            if (!isDeleting) setDeleteTarget(null);
          }}
        >
          <div
            className="nf-listening-confirm-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="nf-modal-title">
              {deleteTarget.type === "book" ? "Xóa sách?" : "Xóa bài nghe?"}
            </h2>
            <p>
              {deleteTarget.type === "book"
                ? `Bạn có chắc muốn xóa "${deleteTarget.book.book.name}" không? Các bài nghe thuộc sách này cũng sẽ bị xóa khỏi Supabase.`
                : `Bạn có chắc muốn xóa bài nghe ${deleteTarget.lesson.title}?`}
            </p>
            <div className="nf-modal-actions">
              <button
                type="button"
                className="nf-btn"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Hủy
              </button>
              <button
                type="button"
                className="nf-btn nf-btn-danger"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
              >
                <Trash2 size={15} />{" "}
                {isDeleting
                  ? "Đang xóa..."
                  : deleteTarget.type === "book"
                    ? "Xóa sách"
                    : "Xóa bài nghe"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
