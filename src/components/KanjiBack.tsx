import type { Kanji } from "../types/kanji";
import "../css/KanjiBack.css";

/** Mặt sau thẻ: âm đọc, Hán Việt, nghĩa, và tất cả từ ghép. */
export default function KanjiBack({ item }: { item: Kanji }) {
  const readingText = [item.on, item.kun].filter(Boolean).join(" / ") || "—";

  return (
    <div className="nf-flash-back">
      <div className="nf-flash-back-inner">
        <div className="nf-flash-row is-split">
          <span className="nf-flash-label.onyomi">音読み: {item.on}</span>
          <span className="nf-flash-label.kunyomi">訓読み: {item.kun}</span>
        </div>
        <div className="nf-flash-row is-single">
          <span className="nf-flash-label">Hán việt: {item.hanViet || "—"}</span>
        </div>
        <div className="nf-flash-row is-single">
          <span className="nf-flash-label">Nghĩa: {item.words[0]?.meaning || "—"}</span>
        </div>

        <div className="nf-flash-word-grid" aria-label="Danh sách từ vựng liên quan">
          {item.words.map((word) => (
            <div key={word.word} className="nf-flash-word-cell">
              <div className="nf-flash-word-main">{word.word}</div>
              <div className="nf-flash-word-reading">{word.reading}</div>
              <div className="nf-flash-word-meaning">{word.meaning}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
