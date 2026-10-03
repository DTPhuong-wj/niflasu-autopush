import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { ListeningBook } from "../../types/listening";

interface Props {
  book: ListeningBook;
  isNew?: boolean;
  onClose: () => void;
  onSave: (book: ListeningBook) => Promise<void> | void;
}

export default function ListeningBookFormModal({ book, isNew = false, onClose, onSave }: Props) {
  const [name, setName] = useState(book.name);
  const [description, setDescription] = useState(book.description ?? "");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = async () => {
    const nextName = name.trim();
    if (!nextName) {
      setError("Tên sách không được để trống.");
      return;
    }
    setIsSaving(true);
    setError("");
    try {
      await onSave({ ...book, name: nextName, description: description.trim() || undefined });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu sách.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="nf-overlay" onClick={onClose}>
      <div className="nf-listening-form-modal nf-listening-book-form-modal" role="dialog" aria-modal="true" aria-label="Chỉnh sửa sách" onClick={(event) => event.stopPropagation()}>
        <div className="nf-listening-form-header">
          <h2 className="nf-modal-title">{isNew ? "Thêm sách" : "Chỉnh sửa sách"}</h2>
          <button type="button" className="nf-btn nf-btn-square" onClick={onClose} aria-label="Đóng chỉnh sửa sách">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <label className="nf-field">
          <span>Tên sách</span>
          <input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        </label>
        <label className="nf-field">
          <span>Mô tả</span>
          <input value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>

        {error && <div className="nf-listening-form-error">{error}</div>}

        <div className="nf-modal-actions">
          <button type="button" className="nf-btn" onClick={onClose} disabled={isSaving}>Hủy</button>
          <button type="button" className="nf-btn is-active" onClick={() => void handleSubmit()} disabled={isSaving}>{isSaving ? "Đang lưu..." : isNew ? "Thêm sách" : "Lưu thay đổi"}</button>
        </div>
      </div>
    </div>
  );
}