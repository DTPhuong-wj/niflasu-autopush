import { Headphones } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ListeningLesson } from "../../types/listening";

interface Props {
  lesson: ListeningLesson;
  onSelect: (lesson: ListeningLesson) => void;
  onEdit: (lesson: ListeningLesson) => void;
  onDelete: (lesson: ListeningLesson) => void;
  readOnly?: boolean;
}

export default function ListeningLessonCard({ lesson, onSelect, onEdit, onDelete, readOnly = false }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="nf-listening-card">
      <button
        type="button"
        className="nf-listening-card-main"
        onClick={() => onSelect(lesson)}
        aria-label={`Nghe bài ${lesson.title} - Unit ${lesson.unit}`}
      >
        <div className="nf-listening-card-head">
          <div className="nf-listening-card-icon" aria-hidden="true">
            <Headphones size={16} strokeWidth={1.8} />
          </div>
          <span className="nf-listening-card-number">{String(lesson.number).padStart(2, "0")}</span>
        </div>

        <div className="nf-listening-card-body">
          <div className="nf-listening-card-unit">Unit {lesson.unit}</div>
          <div className="nf-listening-card-title">{lesson.title}</div>
          <div className="nf-listening-card-unit">Nguồn: {lesson.source === "youtube" || lesson.sourceType === "youtube" ? "YouTube" : lesson.source === "google-drive" || lesson.sourceType === "googleDrive" || lesson.sourceType === "drive" ? "Google Drive" : "File"}</div>
        </div>

        {lesson.hasScript && <span className="nf-listening-card-script">Script</span>}
      </button>

      {!readOnly && <div className="nf-listening-card-menu-wrap" ref={menuRef}>
        <button
          type="button"
          className="nf-listening-card-menu"
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen((current) => !current);
          }}
          aria-label={`Menu cho bài ${lesson.title}`}
        >
          ⋮
        </button>

        {menuOpen && (
          <div className="nf-listening-card-menu-panel" role="menu">
            <button
              type="button"
              className="nf-listening-card-menu-item"
              onClick={() => {
                setMenuOpen(false);
                onEdit(lesson);
              }}
            >
              ✏ Chỉnh sửa
            </button>
            <button
              type="button"
              className="nf-listening-card-menu-item danger"
              onClick={() => {
                setMenuOpen(false);
                onDelete(lesson);
              }}
            >
              🗑 Xóa
            </button>
          </div>
        )}
      </div>}
    </div>
  );
}
