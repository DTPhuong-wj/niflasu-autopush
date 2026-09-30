import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface BookInfo {
  source: string;
  title: string;
  totalWords: number;
  totalWeeks: number;
  daysPerWeek: number;
  /** Sách từ vựng (Mimikara) thay vì Kanji. */
  isVocabulary?: boolean;
  isSenmon?: boolean;
}

interface Props {
  book: BookInfo;
  books: BookInfo[];
  bookIndex: number;
  showBookList: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (index: number) => void;
  onClose: () => void;
  disabled: boolean;
}

export default function BookSelector({
  book,
  books,
  bookIndex,
  showBookList,
  onPrev,
  onNext,
  onSelect,
  onClose,
  disabled,
}: Props) {
  return (
    <>
      <div className="nf-book">
        <button className="nf-btn nf-btn-square" onClick={onPrev} disabled={disabled} aria-label="Chọn sách">
          <ChevronLeft size={18} strokeWidth={1.75} />
        </button>

        <div className="nf-book-info">
          <div className="nf-book-title">{book.source}</div>
          <div className="nf-book-row">{book.title}</div>
          <div className="nf-book-row">
            {book.isVocabulary
              ? `${book.totalWords} từ · ${book.totalWeeks} unit`
              : `${book.totalWords} từ · ${book.totalWeeks} tuần · mỗi tuần ${book.daysPerWeek} ngày`}
          </div>
        </div>

        <button className="nf-btn nf-btn-square" onClick={onNext} disabled={disabled} aria-label="Chọn sách">
          <ChevronRight size={18} strokeWidth={1.75} />
        </button>
      </div>

      {showBookList && (
        <div className="nf-overlay" onClick={onClose}>
          <div className="nf-card nf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="nf-modal-head">
              <h2 className="nf-modal-title">Chọn sách</h2>
              <button className="nf-btn nf-btn-square" onClick={onClose} aria-label="Đóng">
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="nf-field">
              {books.map((b, i) => (
                <button
                  key={`${b.source}-${i}`}
                  className={`nf-btn${i === bookIndex ? " is-active" : ""}`}
                  onClick={() => onSelect(i)}
                >
                  <span>{b.source}</span>
                  <span className="nf-book-row">
                    {b.isVocabulary
                      ? `${b.totalWords} từ · ${b.totalWeeks} unit`
                      : `${b.totalWords} từ · ${b.totalWeeks} tuần · mỗi tuần ${b.daysPerWeek} ngày`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
