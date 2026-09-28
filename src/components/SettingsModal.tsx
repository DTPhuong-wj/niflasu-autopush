import { useState } from "react";
import { X } from "lucide-react";
import type { Settings } from "../types/kanji";

interface Props {
  settings: Settings;
  onSave: (next: Settings) => void;
  onClose: () => void;
}

const LEVELS: Settings["targetLevel"][] = ["N5", "N4", "N3", "N2", "N1"];

export default function SettingsModal({ settings, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<Settings>(settings);

  return (
    <div className="nf-overlay" onClick={onClose}>
      <div className="nf-card nf-modal" onClick={(e) => e.stopPropagation()}>
        <div className="nf-modal-head">
          <h2 className="nf-modal-title">Cài đặt</h2>
          <button className="nf-btn nf-btn-square" onClick={onClose} aria-label="Đóng">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <label className="nf-field">
          <span>Ngày thi</span>
          <input
            type="datetime-local"
            value={draft.examDate}
            onChange={(e) => setDraft({ ...draft, examDate: e.target.value })}
          />
        </label>

        <label className="nf-field">
          <span>Mục tiêu JLPT</span>
          <select
            value={draft.targetLevel}
            onChange={(e) =>
              setDraft({ ...draft, targetLevel: e.target.value as Settings["targetLevel"] })
            }
          >
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>

        <label className="nf-field">
          <span>Điểm mục tiêu</span>
          <input
            type="number"
            min={0}
            max={180}
            value={draft.targetScore}
            onChange={(e) => setDraft({ ...draft, targetScore: Number(e.target.value) })}
          />
        </label>

        <div className="nf-modal-actions">
          <button className="nf-btn is-active" onClick={() => onSave(draft)}>
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
}
