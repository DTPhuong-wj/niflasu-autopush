import { Settings as SettingsIcon } from "lucide-react";
import type { Settings } from "../types/kanji";

interface Props {
  now: Date;
  settings: Settings;
  onOpenSettings: () => void;
}

/** Đồng hồ HH:MM:SS AM/PM */
function formatClock(now: Date) {
  return now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

/** Tính countdown đến ngày thi dựa trên thời gian hiện tại. */
function formatCountdown(examDate: string, now: Date) {
  if (!examDate) return "Chưa đặt ngày thi";
  const target = new Date(examDate).getTime();
  if (Number.isNaN(target)) return "Chưa đặt ngày thi";
  const diff = target - now.getTime();
  if (diff <= 0) return "Đã đến ngày thi";
  const minutes = Math.floor(diff / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  return `${days} ngày ${hours} tiếng ${minutes % 60} phút`;
}

export default function Header({ now, settings, onOpenSettings }: Props) {
  return (
    <header className="nf-header">
      <div className="nf-logo">
        <div className="nf-logo-mark" aria-hidden="true">
          日
        </div>
        <div>
          <div className="nf-logo-title">NIFLASU</div>
          <div className="nf-logo-sub">JAPANESE FLASHCARDS</div>
        </div>
      </div>

      <div className="nf-header-meta">
        <button className="nf-btn nf-btn-icon" onClick={onOpenSettings}>
          <SettingsIcon size={16} strokeWidth={1.75} />
          <span>Cài đặt</span>
        </button>
        <div className="nf-clock">{formatClock(now)}</div>
        <div className="nf-meta-line">{formatCountdown(settings.examDate, now)}</div>
        <div className="nf-meta-line">
          Mục tiêu: {settings.targetLevel} &gt;= {settings.targetScore}
        </div>
      </div>
    </header>
  );
}
