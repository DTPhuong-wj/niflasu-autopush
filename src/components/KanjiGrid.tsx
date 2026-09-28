import type { Kanji } from "../types/kanji";

interface Props {
  items: Kanji[];
  onSelect: (item: Kanji) => void;
}

export default function KanjiGrid({ items, onSelect }: Props) {
  if (items.length === 0) {
    return <p className="nf-empty">Unit này chưa có dữ liệu Kanji.</p>;
  }

  return (
    <div className="nf-grid">
      {items.map((item) => (
        <button
          key={item.id}
          className="nf-tile"
          onClick={() => onSelect(item)}
          aria-label={`${item.number}. ${item.kanji}`}
        >
          <span className="nf-tile-number">{item.number}</span>
          {item.kanji}
        </button>
      ))}
    </div>
  );
}
