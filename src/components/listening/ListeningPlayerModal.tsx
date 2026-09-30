import { useEffect, useState } from "react";
import { Headphones, X } from "lucide-react";
import { formatDuration } from "../../services/listeningService";
import type { ListeningLesson } from "../../types/listening";
import ListeningPlayer from "./ListeningPlayer";
import ListeningScript from "./ListeningScript";

interface Props {
  lesson: ListeningLesson;
  bookName: string;
  onClose: () => void;
}

export default function ListeningPlayerModal({ lesson, bookName, onClose }: Props) {
  const [showScript, setShowScript] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="nf-overlay" onClick={onClose}>
      <div
        className="nf-listening-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Nghe bài ${lesson.title}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="nf-listening-modal-head">
          <div className="nf-listening-modal-title-wrap">
            <span className="nf-listening-modal-kicker">LISTENING</span>
            <h2 className="nf-listening-modal-title">{bookName}</h2>
          </div>
          <button type="button" className="nf-btn nf-btn-square" onClick={onClose} aria-label="Đóng popup nghe">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="nf-listening-modal-hero">
          <div className="nf-listening-hero-icon" aria-hidden="true">
            <Headphones size={28} strokeWidth={1.8} />
          </div>
          <div className="nf-listening-hero-meta">
            <div className="nf-listening-hero-label">Unit {lesson.unit}</div>
            <div className="nf-listening-hero-title">{lesson.title}</div>
            <div className="nf-listening-hero-detail">Duration: {formatDuration(lesson.duration)}</div>
            <div className="nf-listening-hero-detail">Script: {lesson.hasScript ? "Available" : "Unavailable"}</div>
          </div>
        </div>

        <ListeningPlayer lesson={lesson} bookName={bookName} />

        {lesson.hasScript && (
          <button
            type="button"
            className="nf-btn"
            onClick={() => setShowScript((current) => !current)}
            aria-label={showScript ? "Ẩn script" : "Mở script"}
          >
            {showScript ? "Ẩn Script" : "Script"}
          </button>
        )}

        {!lesson.hasScript && <div className="nf-listening-script-empty">Script unavailable</div>}

        {showScript && <ListeningScript lesson={lesson} />}

        <div className="nf-modal-actions">
          <button type="button" className="nf-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
