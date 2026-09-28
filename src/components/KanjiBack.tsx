import type { Kanji } from "../types/kanji";

/** Mặt sau thẻ: âm đọc, Hán Việt, từ ghép (+ mẹo ghi nhớ nếu bật). */
export default function KanjiBack({ item, showMnemonic }: { item: Kanji; showMnemonic?: boolean }) {
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
            {showMnemonic && w.mnemonic && <span className="nf-mnemonic">💡 {w.mnemonic}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
