import { ChevronLeft, ChevronRight } from "lucide-react";

export interface BookInfo {
  source: string;
  title: string;
  totalWords: number;
  totalWeeks: number;
  daysPerWeek: number;
}

interface Props {
  book: BookInfo;
  onPrev: () => void;
  onNext: () => void;
  disabled: boolean;
}

export default function BookSelector({ book, onPrev, onNext, disabled }: Props) {
  return (
    <div className="nf-book">
      <button className="nf-btn nf-btn-square" onClick={onPrev} disabled={disabled} aria-label="Sách trước">
        <ChevronLeft size={18} strokeWidth={1.75} />
      </button>

      <div className="nf-book-info">
        <div className="nf-book-title">{book.source}</div>
        <div className="nf-book-row">{book.title}</div>
        <div className="nf-book-row">
          {book.totalWords} từ · {book.totalWeeks} tuần · mỗi tuần {book.daysPerWeek} ngày
        </div>
      </div>

      <button className="nf-btn nf-btn-square" onClick={onNext} disabled={disabled} aria-label="Sách sau">
        <ChevronRight size={18} strokeWidth={1.75} />
      </button>
    </div>
  );
}
