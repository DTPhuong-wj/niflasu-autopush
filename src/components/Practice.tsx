import { useEffect, useMemo, useRef, useState } from "react";
import type { Kanji } from "../types/kanji";
import KanjiBack from "./KanjiBack";

type Ask = "on" | "kun" | "both";
type Scope = "all" | "range" | "pick";

interface Question {
  item: Kanji;
  ask: Ask;
}

/** Katakana -> hiragana, bỏ khoảng trắng / dấu chấm okurigana. */
function norm(s: string) {
  return s
    .trim()
    .replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[\s.．・\-－]/g, "");
}
function variants(reading: string) {
  return reading.split(/[、,，/／;；]/).map(norm).filter(Boolean);
}
function matches(input: string, reading: string) {
  const v = norm(input);
  return v !== "" && variants(reading).includes(v);
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function pickAsk(item: Kanji): Ask {
  if (item.on && item.kun) return (["on", "kun", "both"] as Ask[])[Math.floor(Math.random() * 3)]!;
  return item.on ? "on" : "kun";
}

const ASK_LABEL: Record<Ask, string> = { on: "Nhập âm On", kun: "Nhập âm Kun", both: "Nhập cả âm On và Kun" };

export default function Practice({ items, currentWeek }: { items: Kanji[]; currentWeek: number }) {
  const [scope, setScope] = useState<Scope>("all");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(items.length);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [queue, setQueue] = useState<Question[] | null>(null);

  useEffect(() => {
    setQueue(null);
    setFrom(1);
    setTo(items.length);
    setPicked(new Set());
  }, [currentWeek, items.length]);

  const selected = useMemo(() => {
    if (scope === "all") return items;
    if (scope === "range") return items.filter((_, i) => i + 1 >= from && i + 1 <= to);
    return items.filter((k) => picked.has(k.id));
  }, [scope, items, from, to, picked]);

  function start() {
    setQueue(shuffle(selected.filter((k) => k.on || k.kun)).map((item) => ({ item, ask: pickAsk(item) })));
  }

  if (items.length === 0) return <p className="nf-empty">Unit này chưa có dữ liệu Kanji.</p>;
  if (queue) return <Session queue={queue} onRestart={start} onBack={() => setQueue(null)} />;

  return (
    <div className="nf-card nf-practice-setup">
      <h2>Luyện tập Unit {currentWeek}</h2>
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
        <>
          <div className="nf-pick-grid">
            {items.map((k, i) => (
              <button
                key={k.id}
                className={`nf-pick${picked.has(k.id) ? " is-active" : ""}`}
                onClick={() => {
                  const next = new Set(picked);
                  if (next.has(k.id)) next.delete(k.id);
                  else next.add(k.id);
                  setPicked(next);
                }}
              >
                <small>{i + 1}</small>
                {k.kanji}
              </button>
            ))}
          </div>
          <div className="nf-flash-actions">
            <button className="nf-btn" onClick={() => setPicked(new Set(items.map((k) => k.id)))}>Chọn tất cả</button>
            <button className="nf-btn" onClick={() => setPicked(new Set())}>Bỏ chọn</button>
          </div>
        </>
      )}

      <p className="nf-muted">Đã chọn {selected.length} chữ. Mỗi chữ sẽ ngẫu nhiên hỏi âm On, âm Kun hoặc cả hai.</p>
      <button className="nf-btn is-active" disabled={selected.length === 0} onClick={start}>Bắt đầu</button>
    </div>
  );
}

function Session({ queue, onRestart, onBack }: { queue: Question[]; onRestart: () => void; onBack: () => void }) {
  const [i, setI] = useState(0);
  const [onIn, setOnIn] = useState("");
  const [kunIn, setKunIn] = useState("");
  const [result, setResult] = useState<null | { on?: boolean; kun?: boolean }>(null);
  const [score, setScore] = useState(0);
  const firstRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const q = queue[i];

  useEffect(() => {
    if (result) nextRef.current?.focus();
    else firstRef.current?.focus();
  }, [result, i]);

  if (!q) {
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

  const askOn = q.ask !== "kun";
  const askKun = q.ask !== "on";

  function submit() {
    const r: { on?: boolean; kun?: boolean } = {};
    if (askOn) r.on = matches(onIn, q!.item.on);
    if (askKun) r.kun = matches(kunIn, q!.item.kun);
    if (Object.values(r).every(Boolean)) setScore((s) => s + 1);
    setResult(r);
  }
  function next() {
    setResult(null);
    setOnIn("");
    setKunIn("");
    setI((x) => x + 1);
  }

  const allOk = result && Object.values(result).every(Boolean);

  return (
    <div className="nf-flash">
      <div className="nf-flash-meta">
        Câu {i + 1}/{queue.length} · Đúng {score}
        <div className="nf-progress"><div style={{ width: `${((i + 1) / queue.length) * 100}%` }} /></div>
      </div>
      <div className="nf-card nf-practice-card">
        <div className={`nf-flash-kanji${result ? " is-small" : ""}`}>{q.item.kanji}</div>
        {!result ? (
          <form
            className="nf-answer"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <p className="nf-ask">{ASK_LABEL[q.ask]}</p>
            {askOn && (
              <input ref={firstRef} placeholder="Âm On (vd: ほう)" value={onIn} onChange={(e) => setOnIn(e.target.value)} />
            )}
            {askKun && (
              <input
                ref={askOn ? undefined : firstRef}
                placeholder="Âm Kun (vd: つげる)"
                value={kunIn}
                onChange={(e) => setKunIn(e.target.value)}
              />
            )}
            <button className="nf-btn is-active" type="submit">Kiểm tra (Enter)</button>
          </form>
        ) : (
          <>
            <p className={`nf-verdict ${allOk ? "is-ok" : "is-bad"}`}>
              {allOk ? "Chính xác!" : "Chưa đúng"}
              {result.on !== undefined && ` · On: ${result.on ? "✓" : `✗ (${onIn || "trống"})`}`}
              {result.kun !== undefined && ` · Kun: ${result.kun ? "✓" : `✗ (${kunIn || "trống"})`}`}
            </p>
            <KanjiBack item={q.item} />
          </>
        )}
      </div>
      {result && (
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
