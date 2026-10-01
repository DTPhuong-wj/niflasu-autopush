import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Upload, X } from "lucide-react";
import type { Vocabulary } from "../types/vocabulary";

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
  onImport: (items: Vocabulary[]) => string | null;
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
  onImport,
  onClose,
  disabled,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState("");

  function importFile(file?: File) {
    if (!file) return;
    void file.text().then((text) => {
      try {
        const items: unknown = JSON.parse(text);
        if (!Array.isArray(items)) throw new Error("JSON phải là một mảng các mục từ.");
        const message = onImport(items as Vocabulary[]);
        setImportMessage(message ?? "Đã thêm sách.");
      } catch (error) {
        setImportMessage(error instanceof Error ? error.message : "Không đọc được file JSON.");
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  function downloadTemplate() {
    const template = [{
      id: 1,
      source: "Tên sách mới",
      unit: 1,
      number: 1,
      word: "",
      reading: "",
      meaning: "",
      example: { sentence: "", reading: "", meaning: "" },
      type: "名詞",
    }];
    const url = URL.createObjectURL(new Blob([JSON.stringify(template, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "gki-book-template.json";
    link.click();
    URL.revokeObjectURL(url);
  }

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
          <div className="nf-card nf-modal nf-book-modal" onClick={(e) => e.stopPropagation()}>
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
            <div className="nf-book-import-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                aria-label="Chọn file JSON"
                onChange={(event) => importFile(event.target.files?.[0])}
              />
              <button className="nf-btn" onClick={() => fileInputRef.current?.click()}>
                <Upload size={15} /> Thêm sách từ JSON
              </button>
              <button className="nf-btn" onClick={downloadTemplate}>
                <Download size={15} /> Tải mẫu JSON
              </button>
              {importMessage && <p className="nf-import-message" role="status">{importMessage}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
