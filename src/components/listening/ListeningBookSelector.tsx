import { ChevronLeft, ChevronRight, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ListeningBookSet } from "../../types/listening";

interface Props {
  book: ListeningBookSet;
  books: ListeningBookSet[];
  selectedIndex: number;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (index: number) => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  readOnly?: boolean;
}

export default function ListeningBookSelector({
  book,
  books,
  selectedIndex,
  isOpen,
  onToggle,
  onSelect,
  onClose,
  onEdit,
  onDelete,
  readOnly = false,
}: Props) {
  const [isManageOpen, setIsManageOpen] = useState(false);
  const manageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (manageRef.current && !manageRef.current.contains(event.target as Node)) {
        setIsManageOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsManageOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="nf-listening-book-nav" aria-label="Chọn sách nghe">
      <button
        className="nf-btn nf-btn-square"
        type="button"
        onClick={onToggle}
        aria-label="Mở danh sách sách nghe trước"
      >
        <ChevronLeft size={18} strokeWidth={1.75} />
      </button>

      {!readOnly && <div className="nf-listening-book-manage" ref={manageRef}>
        <button
          type="button"
          className="nf-btn nf-btn-square"
          onClick={() => setIsManageOpen((current) => !current)}
          aria-label="Quản lý sách nghe"
          aria-expanded={isManageOpen}
        >
          <MoreVertical size={18} strokeWidth={1.75} />
        </button>
        {isManageOpen && (
          <div className="nf-listening-book-manage-menu" role="menu">
            <button
              type="button"
              className="nf-listening-book-menu-item"
              onClick={() => {
                setIsManageOpen(false);
                onEdit();
              }}
            >
              <Pencil size={14} /> Chỉnh sửa sách
            </button>
            <button
              type="button"
              className="nf-listening-book-menu-item danger"
              onClick={() => {
                setIsManageOpen(false);
                onDelete();
              }}
            >
              <Trash2 size={14} /> Xóa sách
            </button>
          </div>
        )}
      </div>}

      <div className="nf-listening-book-panel">
        <span className="nf-listening-book-label">Listening Books</span>
        <div className="nf-listening-book-name">{book.book.name}</div>
      </div>

      <button
        className="nf-btn nf-btn-square"
        type="button"
        onClick={onToggle}
        aria-label="Mở danh sách sách nghe sau"
      >
        <ChevronRight size={18} strokeWidth={1.75} />
      </button>

      {isOpen && (
        <div className="nf-listening-book-dropdown" role="menu" aria-label="Danh sách sách nghe">
          <div className="nf-listening-book-dropdown-head">Listening Books</div>
          {books.map((item, index) => (
            <button
              key={item.book.id}
              type="button"
              className={`nf-listening-book-option${index === selectedIndex ? " is-selected" : ""}`}
              onClick={() => {
                onSelect(index);
                onClose();
              }}
            >
              <span className="nf-listening-book-option-dot" aria-hidden="true" />
              <span>{item.book.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
