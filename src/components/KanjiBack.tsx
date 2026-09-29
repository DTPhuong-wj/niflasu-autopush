import type { Kanji } from "../types/kanji";

/** Mặt sau thẻ: âm đọc, Hán Việt và từ ghép. */
export default function KanjiBack({ item }: { item: Kanji }) {
  return (
    <div className="nf-flash-back">
      <div className="nf-flash-reading">
        <span>On: {item.on || "—"}</span>
        <span>Kun: {item.kun || "—"}</span>
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
  );
}
