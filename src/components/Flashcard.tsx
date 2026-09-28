import { useEffect, useState } from "react";
import type { Kanji } from "../types/kanji";

interface Props {
  items: Kanji[];
  currentWeek: number;
  startIndex: number;
  onExit: () => void;
}

export default function Flashcard({ items, currentWeek, startIndex, onExit }: Props) {
  const [index, setIndex] = useState(startIndex);
  const [revealed, setRevealed] = useState(false);

  // Đổi Unit hoặc chọn card khác từ grid -> quay lại card tương ứng.
  useEffect(() => {
    setIndex(startIndex);
    setRevealed(false);
  }, [startIndex, currentWeek]);

  if (items.length === 0) {
    return <p className="nf-empty">Unit này chưa có dữ liệu Kanji.</p>;
  }

  // Hết bộ card: KHÔNG tự chuyển sang Unit khác.
  if (index >= items.length) {
    return (
      <div className="nf-card nf-flash-done">
        <p className="nf-flash-done-text">Đã hoàn thành Unit {currentWeek}</p>
        <div className="nf-flash-actions">
          <button
            className="nf-btn"
            onClick={() => {
              setIndex(0);
              setRevealed(false);
            }}
          >
            Học lại
          </button>
          <button className="nf-btn" onClick={onExit}>
            Về danh sách
          </button>
        </div>
      </div>
    );
  }

  const item = items[index]!;

  return (
    <div className="nf-flash">
      <div className="nf-flash-meta">
        Unit {currentWeek} · {index + 1}/{items.length}
      </div>

      <div className="nf-card nf-flash-card" onClick={() => setRevealed((v) => !v)}>
        <div className="nf-flash-kanji">{item.kanji}</div>

        {revealed ? (
          <div className="nf-flash-back">
            <div className="nf-flash-reading">
              {item.on && <span>On: {item.on}</span>}
              {item.kun && <span>Kun: {item.kun}</span>}
              <span>Hán Việt: {item.hanViet}</span>
            </div>
            <ul className="nf-word-list">
              {item.words.map((w) => (
                <li key={w.word}>
                  <span className="nf-word">{w.word}</span>
                  <span className="nf-reading">{w.reading}</span>
                  <span className="nf-meaning">{w.meaning}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="nf-flash-hint">Nhấn vào thẻ để xem nghĩa</p>
        )}
      </div>

      <div className="nf-flash-actions">
        <button
          className="nf-btn"
          onClick={() => {
            setIndex((i) => Math.max(0, i - 1));
            setRevealed(false);
          }}
          disabled={index === 0}
        >
          Thẻ trước
        </button>
        <button
          className="nf-btn"
          onClick={() => {
            setIndex((i) => i + 1);
            setRevealed(false);
          }}
        >
          Thẻ sau
        </button>
        <button className="nf-btn" onClick={onExit}>
          Thoát
        </button>
      </div>
    </div>
  );
}
