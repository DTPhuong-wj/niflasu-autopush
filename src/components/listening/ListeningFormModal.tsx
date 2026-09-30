import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { detectSourceTypeFromUrl, formatDuration, parseDurationToSeconds } from "../../services/listeningService";
import type { ListeningBook, ListeningBookSet, ListeningLesson } from "../../types/listening";

interface Props {
  books: ListeningBookSet[];
  selectedBookId: string;
  editingLesson: ListeningLesson | null;
  onClose: () => void;
  onSave: (payload: { bookId: string; lesson: ListeningLesson }) => void;
  onCreateBook: (book: ListeningBook) => void;
}

const DEFAULT_DURATION = "02:35";

function parseScriptText(text: string): ListeningLesson["script"] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^：]+)[:：]\s*(.*)$/);
      return {
        speaker: match ? match[1].trim() : "",
        text: match ? match[2].trim() : line,
      };
    })
    .filter((line) => line.speaker || line.text);

  return lines.length > 0
    ? lines
    : [{ speaker: "N/A", text: text.trim() || "Script chưa được nhập." }];
}

export default function ListeningFormModal({
  books,
  selectedBookId,
  editingLesson,
  onClose,
  onSave,
  onCreateBook,
}: Props) {
  const defaultBookId = books.some((book) => book.book.id === selectedBookId)
    ? selectedBookId
    : books[0]?.book.id ?? "";

  const [bookId, setBookId] = useState<string>(editingLesson?.bookId ?? defaultBookId);
  const [unit, setUnit] = useState<number | string>(editingLesson?.unit ?? "");
  const [number, setNumber] = useState<number | string>(editingLesson?.number ?? "");
  const [title, setTitle] = useState(editingLesson?.title ?? "");
  const [sourceMode, setSourceMode] = useState<"link" | "upload">("link");
  const [sourceUrl, setSourceUrl] = useState(editingLesson?.sourceUrl ?? "");
  const [duration, setDuration] = useState<string>(
    editingLesson ? formatDuration(editingLesson.duration ?? 0) : DEFAULT_DURATION,
  );
  const [hasScript, setHasScript] = useState<boolean>(editingLesson?.hasScript ?? true);
  const [scriptText, setScriptText] = useState(
    editingLesson?.script.map((line) => `${line.speaker}：${line.text}`).join("\n") ?? "",
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showAddBookForm, setShowAddBookForm] = useState(false);
  const [newBookName, setNewBookName] = useState("");
  const [newBookDescription, setNewBookDescription] = useState("");
  const [error, setError] = useState("");

  const currentBook = useMemo(
    () => books.find((item) => item.book.id === bookId) ?? books[0],
    [bookId, books],
  );

  const handleSelectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setSelectedFile(nextFile);
    if (nextFile) {
      const fileSizeLabel = nextFile.size >= 1024 * 1024 ? `${(nextFile.size / (1024 * 1024)).toFixed(1)} MB` : `${(nextFile.size / 1024).toFixed(1)} KB`;
      setSourceUrl("");
      setDuration(formatDuration(Math.max(1, Math.round((nextFile.size / 16000) || 1))));
      setError("File tải lên chỉ được lưu dưới dạng metadata vì project chưa tích hợp storage/backend. Vui lòng dùng URL nếu muốn bài nghe hoạt động lâu dài.");
      console.info(`Selected file: ${nextFile.name} (${fileSizeLabel})`);
    }
  };

  const handleCreateBook = () => {
    const normalizedName = newBookName.trim();
    if (!normalizedName) {
      setError("Tên sách không được để trống.");
      return;
    }

    const newBook: ListeningBook = {
      id: normalizedName.toLowerCase().replace(/\s+/g, "-") + `-${Date.now()}`,
      name: normalizedName,
      description: newBookDescription.trim() || "Sách nghe mới",
    };

    onCreateBook(newBook);
    setBookId(newBook.id);
    setShowAddBookForm(false);
    setNewBookName("");
    setNewBookDescription("");
    setError("");
  };

  const handleSubmit = () => {
    const nextBookId = bookId || currentBook?.book.id || "";
    const nextUnit = Number(unit);
    const nextNumber = Number(number);

    if (!nextBookId) {
      setError("Vui lòng chọn sách.");
      return;
    }

    if (!Number.isFinite(nextUnit) || nextUnit <= 0) {
      setError("Unit phải là số hợp lệ.");
      return;
    }

    if (!Number.isFinite(nextNumber) || nextNumber <= 0) {
      setError("Số thứ tự phải là số hợp lệ.");
      return;
    }

    if (!title.trim()) {
      setError("Tên bài nghe không được để trống.");
      return;
    }

    if (sourceMode === "link") {
      if (!sourceUrl.trim()) {
        setError("URL audio không được để trống.");
        return;
      }

      try {
        new URL(sourceUrl.trim());
      } catch {
        setError("URL audio không hợp lệ. Vui lòng nhập URL đầy đủ.");
        return;
      }
    }

    if (sourceMode === "upload" && !selectedFile && !sourceUrl.trim()) {
      setError("Vui lòng chọn file hoặc nhập URL audio.");
      return;
    }

    const normalizedSourceType = sourceMode === "link" ? detectSourceTypeFromUrl(sourceUrl) : "directAudio";
    const lesson: ListeningLesson = {
      id: editingLesson?.id ?? Date.now(),
      bookId: nextBookId,
      unit: nextUnit,
      number: nextNumber,
      title: title.trim(),
      audioUrl: sourceUrl.trim(),
      sourceType: normalizedSourceType,
      sourceUrl: sourceUrl.trim(),
      duration: parseDurationToSeconds(duration),
      hasScript,
      script: hasScript ? parseScriptText(scriptText) : [],
      createdAt: editingLesson?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave({ bookId: nextBookId, lesson });
  };

  return (
    <div className="nf-overlay" onClick={onClose}>
      <div className="nf-listening-form-modal" onClick={(event) => event.stopPropagation()}>
        <div className="nf-listening-form-header">
          <h2 className="nf-modal-title">{editingLesson ? "Chỉnh sửa bài nghe" : "Thêm bài nghe"}</h2>
          <button type="button" className="nf-btn nf-btn-square" onClick={onClose} aria-label="Đóng form thêm bài nghe">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="nf-listening-form-grid">
          <label className="nf-field">
            <span>Tên sách</span>
            <select value={bookId} onChange={(event) => setBookId(event.target.value)}>
              {books.map((item) => (
                <option key={item.book.id} value={item.book.id}>
                  {item.book.name}
                </option>
              ))}
            </select>
          </label>

          <div className="nf-listening-inline-actions">
            <button type="button" className="nf-btn" onClick={() => setShowAddBookForm((current) => !current)}>
              <Plus size={15} strokeWidth={1.8} />
              Thêm sách mới
            </button>
          </div>

          {showAddBookForm && (
            <div className="nf-listening-create-book">
              <label className="nf-field">
                <span>Tên sách</span>
                <input value={newBookName} onChange={(event) => setNewBookName(event.target.value)} placeholder="Ví dụ: Dekiru N3" />
              </label>
              <label className="nf-field">
                <span>Mô tả</span>
                <input value={newBookDescription} onChange={(event) => setNewBookDescription(event.target.value)} placeholder="Tùy chọn" />
              </label>
              <div className="nf-listening-inline-actions">
                <button type="button" className="nf-btn" onClick={handleCreateBook}>
                  Tạo sách
                </button>
              </div>
            </div>
          )}

          <div className="nf-listening-two-col">
            <label className="nf-field">
              <span>Unit</span>
              <input type="number" min={1} value={unit} onChange={(event) => setUnit(event.target.value)} />
            </label>
            <label className="nf-field">
              <span>Số thứ tự</span>
              <input type="number" min={1} value={number} onChange={(event) => setNumber(event.target.value)} />
            </label>
          </div>

          <label className="nf-field">
            <span>Tên bài</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: モデル会話" />
          </label>

          <div className="nf-field nf-listening-source-mode">
            <span>Nguồn audio</span>
            <div className="nf-listening-radio-row">
              <label>
                <input
                  type="radio"
                  checked={sourceMode === "link"}
                  onChange={() => setSourceMode("link")}
                />
                Link
              </label>
              <label>
                <input
                  type="radio"
                  checked={sourceMode === "upload"}
                  onChange={() => setSourceMode("upload")}
                />
                Upload file
              </label>
            </div>
          </div>

          {sourceMode === "link" ? (
            <label className="nf-field">
              <span>Link audio</span>
              <input
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="https://example.com/audio.mp3"
              />
            </label>
          ) : (
            <div className="nf-field">
              <span>Upload file</span>
              <input type="file" accept=".mp3,.m4a,.wav,.ogg,audio/mpeg,audio/mp4,audio/wav,audio/ogg" onChange={handleSelectFile} />
              {selectedFile && (
                <div className="nf-listening-upload-meta">
                  <div>Tên file: {selectedFile.name}</div>
                  <div>Dung lượng: {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</div>
                  <div className="nf-listening-upload-note">
                    Lưu ý: file upload chỉ có thể xem trước trong trình duyệt; cần storage/backend để lưu lâu dài.
                  </div>
                </div>
              )}
            </div>
          )}

          <label className="nf-field">
            <span>Thời lượng</span>
            <input value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="02:35" />
          </label>

          <label className="nf-field nf-listening-check-row">
            <input type="checkbox" checked={hasScript} onChange={(event) => setHasScript(event.target.checked)} />
            <span>Có Script</span>
          </label>

          {hasScript && (
            <label className="nf-field">
              <span>Nội dung Script</span>
              <textarea
                rows={6}
                value={scriptText}
                onChange={(event) => setScriptText(event.target.value)}
                placeholder={'男：こんにちは。\n女：こんにちは。'}
              />
            </label>
          )}
        </div>

        {error && <div className="nf-listening-form-error">{error}</div>}

        <div className="nf-modal-actions">
          <button type="button" className="nf-btn" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="nf-btn is-active" onClick={handleSubmit}>
            {editingLesson ? "Cập nhật" : "Lưu bài nghe"}
          </button>
        </div>
      </div>
    </div>
  );
}
