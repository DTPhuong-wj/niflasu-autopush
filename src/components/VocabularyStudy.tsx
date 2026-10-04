import { useCallback, useEffect, useRef, useState } from "react";
import type { Vocabulary } from "../types/vocabulary";

const EMPTY = <p className="nf-empty">Unit này chưa có dữ liệu từ vựng.</p>;
type VocabularyUnit = Vocabulary["unit"];

/** Màu nhẹ cho từng loại từ (class CSS tương ứng trong styles.css). */
function typeClass(type?: string) {
  if (!type) return "";
  if (type.includes("名")) return "is-noun";
  if (type.includes("動")) return "is-verb";
  if (type.includes("形")) return "is-adj";
  if (type.includes("副")) return "is-adv";
  return "is-other";
}

/** Chỉ lấy related word có nội dung (JSON có thể chứa {} rỗng). */
const relatedOf = (item: Vocabulary) => (item.relatedWords ?? []).filter((r) => r && r.word);

/* ---------- Trang tổng hợp ---------- */
export function VocabularyGrid({ items, onSelect }: { items: Vocabulary[]; onSelect: (item: Vocabulary) => void }) {
  if (items.length === 0) return EMPTY;
  const longestWordLength = items.reduce(
    (longest, item) => Math.max(longest, [...item.word].length),
    0,
  );
  const minColumnWidth = longestWordLength * 22 + 88;

  return (
    <div
      className="nf-vgrid"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minColumnWidth}px), 1fr))` }}
    >
      {items.map((item) => (
        <button key={item.id} className="nf-vtile" onClick={() => onSelect(item)}>
          <span className="nf-tile-number">{String(item.number).padStart(2, "0")}</span>
          <span className="nf-vtile-row">
            <span className="nf-vtile-word">{item.word}</span>
            {item.type && <span className={`nf-vtype ${typeClass(item.type)}`}>{item.type}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Mặt sau (dùng cho flashcard và luyện tập) ---------- */
function VocabularyBack({ item }: { item: Vocabulary }) {
  return (
    <div className="nf-vback">
      <div className="nf-vback-word">{item.word}</div>
      <dl>
        <dt>Cách đọc</dt><dd>{item.reading || "—"}</dd>
        <dt>Hán Việt</dt><dd>{item.hanViet || "—"}</dd>
        <dt>Nghĩa</dt><dd>{item.meaning || "—"}</dd>
      </dl>
      {item.example && (
        <div className="nf-vexample">
          <p className="nf-vexample-jp">{item.example.sentence}</p>
          <p className="nf-muted">{item.example.reading}</p>
          <p>{item.example.meaning}</p>
        </div>
      )}
    </div>
  );
}

/* ---------- Flashcard ---------- */
export function VocabularyFlashcard({
  items, currentUnit, startIndex, onExit,
}: { items: Vocabulary[]; currentUnit: VocabularyUnit; startIndex: number; onExit: () => void }) {
  const [currentVocabularyIndex, setIndex] = useState(startIndex);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);

  useEffect(() => {
    setIndex(startIndex);
    setIsFlipped(false);
    setIsAutoPlaying(false);
  }, [startIndex, currentUnit]);

  // Chuyển thẻ luôn quay về mặt trước; cho phép tới items.length = màn hoàn thành.
  const go = useCallback((step: number) => {
    setIsFlipped(false);
    setIndex((i) => Math.max(0, Math.min(items.length, i + step)));
  }, [items.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      if (["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(tag)) return;
      if (e.code === "Space" || e.key === "Enter") { e.preventDefault(); setIsFlipped((v) => !v); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        if (isAutoPlaying) {
          setIsAutoPlaying(false);
        } else {
          setIsFlipped(false);
          setIsAutoPlaying(true);
        }
      }
      else if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, isAutoPlaying, onExit]);

  useEffect(() => {
    if (!isAutoPlaying || currentVocabularyIndex >= items.length) return;
    const timer = setTimeout(() => {
      if (!isFlipped) setIsFlipped(true);
      else go(1);
    }, 2000);
    return () => clearTimeout(timer);
  }, [currentVocabularyIndex, go, isAutoPlaying, isFlipped, items.length]);

  useEffect(() => {
    if (currentVocabularyIndex >= items.length) setIsAutoPlaying(false);
  }, [currentVocabularyIndex, items.length]);

  if (items.length === 0) return EMPTY;
  const item = items[currentVocabularyIndex];

  if (!item) {
    return (
      <div className="nf-flash">
        <div className="nf-card nf-flash-done">
          <p className="nf-flash-done-text">Đã hoàn thành Unit {currentUnit}</p>
          <div className="nf-flash-actions">
            <button className="nf-btn" onClick={() => { setIndex(0); setIsFlipped(false); }}>Học lại</button>
            <button className="nf-btn" onClick={onExit}>Về danh sách</button>
          </div>
        </div>
      </div>
    );
  }

  const related = relatedOf(item);

  return (
    <div className="nf-flash">
      <div className="nf-flash-meta">
        Unit {currentUnit} · {currentVocabularyIndex + 1}/{items.length}
        <div className="nf-progress"><div style={{ width: `${((currentVocabularyIndex + 1) / items.length) * 100}%` }} /></div>
      </div>

      <div
        key={item.id}
        className="nf-flash-scene"
        role="button"
        tabIndex={0}
        aria-pressed={isFlipped}
        aria-label={`${item.word}. Nhấn để lật thẻ.`}
        onClick={() => setIsFlipped((v) => !v)}
      >
        {/* Cả 2 mặt luôn tồn tại; chỉ xoay bằng CSS 3D. */}
        <div className={`nf-flash-card${isFlipped ? " is-flipped" : ""}`}>
          <div className="nf-card nf-flash-face nf-flash-front" aria-hidden={isFlipped}>
            <div className="nf-vfront-word">{item.word}</div>
            {related.length > 0 && (
              <div className="nf-vrelated">
                {related.map((r, i) => (
                  <div key={i} className="nf-vrelated-item">
                    <div className="nf-vrelated-word">{r.word}</div>
                    {r.formula && <div className="nf-vrelated-formula">{r.formula}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="nf-card nf-flash-face nf-flash-back-face" aria-hidden={!isFlipped}>
            <VocabularyBack item={item} />
          </div>
        </div>
      </div>

      <div className="nf-flash-nav">
        <button className="nf-btn" onClick={() => go(-1)} disabled={currentVocabularyIndex === 0}>← Trước</button>
        <span className="nf-flash-count">{currentVocabularyIndex + 1} / {items.length}</span>
        <button className="nf-btn" onClick={() => go(1)}>Tiếp →</button>
      </div>
    </div>
  );
}

/* ---------- Luyện tập: xem từ, nhập cách đọc, Enter để kiểm tra ---------- */
const norm = (s: string) =>
  s.trim().replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/[\s.・]/g, "");

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function VocabularyPractice({ items, currentUnit }: { items: Vocabulary[]; currentUnit: VocabularyUnit }) {
  const [scope, setScope] = useState<"all" | "range" | "pick">("all");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(items.length);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [queue, setQueue] = useState<Vocabulary[] | null>(null);

  useEffect(() => { setQueue(null); setFrom(1); setTo(items.length); setPicked(new Set()); }, [currentUnit, items.length]);

  const selected =
    scope === "all" ? items
    : scope === "range" ? items.filter((_, i) => i + 1 >= from && i + 1 <= to)
    : items.filter((v) => picked.has(v.id));

  const start = () => setQueue(shuffle(selected));

  if (items.length === 0) return EMPTY;
  if (queue) return <VocabularySession queue={queue} onRestart={start} onBack={() => setQueue(null)} />;

  return (
    <div className="nf-card nf-practice-setup">
      <h2>Luyện tập Unit {currentUnit}</h2>
      <div className="nf-units">
        <button className={`nf-btn${scope === "all" ? " is-active" : ""}`} onClick={() => setScope("all")}>Tổng thể</button>
        <button className={`nf-btn${scope === "range" ? " is-active" : ""}`} onClick={() => setScope("range")}>Theo khoảng STT</button>
        <button className={`nf-btn${scope === "pick" ? " is-active" : ""}`} onClick={() => setScope("pick")}>Chọn từ bất kỳ</button>
      </div>
      {scope === "range" && (
        <div className="nf-range">
          Từ STT
          <input type="number" min={1} max={items.length} value={from} onChange={(e) => setFrom(Number(e.target.value))} />
          đến
          <input type="number" min={1} max={items.length} value={to} onChange={(e) => setTo(Number(e.target.value))} />
          <span className="nf-muted">(1–{items.length})</span>
        </div>
      )}
      {scope === "pick" && (
        <div className="nf-pick-grid">
          {items.map((v, i) => (
            <button
              key={v.id}
              className={`nf-pick${picked.has(v.id) ? " is-active" : ""}`}
              onClick={() => {
                const next = new Set(picked);
                if (next.has(v.id)) next.delete(v.id); else next.add(v.id);
                setPicked(next);
              }}
            >
              <small>{i + 1}</small>{v.word}
            </button>
          ))}
        </div>
      )}
      <p className="nf-muted">Đã chọn {selected.length} từ. Nhập cách đọc (hiragana) của từng từ.</p>
      <button className="nf-btn is-active" disabled={selected.length === 0} onClick={start}>Bắt đầu</button>
    </div>
  );
}

function VocabularySession({ queue, onRestart, onBack }: { queue: Vocabulary[]; onRestart: () => void; onBack: () => void }) {
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const item = queue[i];

  useEffect(() => { (result === null ? inputRef : nextRef).current?.focus(); }, [result, i]);

  if (!item) {
    return (
      <div className="nf-card nf-flash-done">
        <p className="nf-flash-done-text">Hoàn thành: đúng {score}/{queue.length}</p>
        <div className="nf-flash-actions">
          <button className="nf-btn" onClick={onRestart}>Làm lại</button>
          <button className="nf-btn" onClick={onBack}>Chọn lại phạm vi</button>
        </div>
      </div>
    );
  }

  function submit() {
    const ok = norm(answer) !== "" && norm(answer) === norm(item!.reading);
    if (ok) setScore((s) => s + 1);
    setResult(ok);
  }
  function next() { setResult(null); setAnswer(""); setI((x) => x + 1); }

  return (
    <div className="nf-flash">
      <div className="nf-flash-meta">
        Câu {i + 1}/{queue.length} · Đúng {score}
        <div className="nf-progress"><div style={{ width: `${((i + 1) / queue.length) * 100}%` }} /></div>
      </div>
      <div className="nf-flash-scene" style={{ cursor: "default" }}>
        <div className={`nf-flash-card${result !== null ? " is-flipped" : ""}`}>
          <div className="nf-card nf-flash-face nf-flash-front" aria-hidden={result !== null}>
            <div className="nf-vfront-word">{item.word}</div>
            <form className="nf-answer" onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <input ref={inputRef} placeholder="Cách đọc (vd: かいぜん)" value={answer} onChange={(e) => setAnswer(e.target.value)} />
              <button className="nf-btn is-active" type="submit">Kiểm tra (Enter)</button>
            </form>
          </div>
          <div className="nf-card nf-flash-face nf-flash-back-face" aria-hidden={result === null}>
            {result !== null && (
              <p className={`nf-verdict ${result ? "is-ok" : "is-bad"}`}>
                {result ? "Chính xác" : `Chưa đúng (${answer || "trống"})`}
              </p>
            )}
            <VocabularyBack item={item} />
          </div>
        </div>
      </div>
      {result !== null && (
        <div className="nf-flash-actions">
          <button ref={nextRef} className="nf-btn is-active" onClick={next}>Tiếp theo (Enter)</button>
        </div>
      )}
      <div className="nf-flash-actions">
        <button className="nf-btn" onClick={onBack}>Thoát luyện tập</button>
      </div>
    </div>
  );
}
