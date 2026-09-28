import { useCallback, useEffect, useRef, useState } from "react";
import type { Kanji } from "../types/kanji";
import KanjiBack from "./KanjiBack";

interface Props {
  items: Kanji[];
  currentWeek: number;
  startIndex: number;
  onExit: () => void;
}

export default function Flashcard({ items, currentWeek, startIndex, onExit }: Props) {
  const [index, setIndex] = useState(startIndex);
  const [revealed, setRevealed] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [auto, setAuto] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIndex(startIndex);
    setRevealed(false);
  }, [startIndex, currentWeek]);

  const go = useCallback(
    (step: number) => {
      setRevealed(false);
      setIndex((i) => Math.max(0, Math.min(items.length, i + step)));
    },
    [items.length],
  );

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void wrapRef.current?.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onChange = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Phím tắt.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      if (e.key === " ") {
        e.preventDefault();
        setRevealed((v) => !v);
      } else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (k === "h") setShowMnemonic((v) => !v);
      else if (k === "a") setAuto((v) => !v);
      else if (k === "f") toggleFull();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, toggleFull]);

  // Tự động: mặt trước 2s -> lật -> 2s -> thẻ kế.
  useEffect(() => {
    if (!auto || index >= items.length) return;
    const timer = setTimeout(() => {
      if (!revealed) setRevealed(true);
      else go(1);
    }, 2000);
    return () => clearTimeout(timer);
  }, [auto, revealed, index, items.length, go]);

  useEffect(() => {
    if (index >= items.length) setAuto(false);
  }, [index, items.length]);

  if (items.length === 0) return <p className="nf-empty">Unit này chưa có dữ liệu Kanji.</p>;

  const item = items[index];

  return (
    <div ref={wrapRef} className={`nf-flash${isFull ? " is-full" : ""}`}>
      {!item ? (
        <div className="nf-card nf-flash-done">
          <p className="nf-flash-done-text">Đã hoàn thành Unit {currentWeek}</p>
          <div className="nf-flash-actions">
            <button className="nf-btn" onClick={() => { setIndex(0); setRevealed(false); }}>
              Học lại
            </button>
            <button className="nf-btn" onClick={onExit}>Về danh sách</button>
          </div>
        </div>
      ) : (
        <>
          <div className="nf-flash-meta">
            Unit {currentWeek} · {index + 1}/{items.length}
            <div className="nf-progress"><div style={{ width: `${((index + 1) / items.length) * 100}%` }} /></div>
          </div>

          <div
            className={`nf-card nf-flash-card${revealed ? " is-back" : ""}`}
            onClick={() => setRevealed((v) => !v)}
          >
            {!revealed ? (
              <>
                <div className="nf-flash-kanji">{item.kanji}</div>
                <p className="nf-flash-hint">Nhấn Space hoặc click để lật thẻ</p>
              </>
            ) : (
              <>
                <div className="nf-flash-kanji is-small">{item.kanji}</div>
                <KanjiBack item={item} showMnemonic={showMnemonic} />
              </>
            )}
          </div>

          <div className="nf-flash-actions">
            <button className="nf-btn" onClick={() => go(-1)} disabled={index === 0}>← Trước</button>
            <button className="nf-btn" onClick={() => setRevealed((v) => !v)}>Lật thẻ</button>
            <button className="nf-btn" onClick={() => go(1)}>Sau →</button>
            <button className={`nf-btn${showMnemonic ? " is-active" : ""}`} onClick={() => setShowMnemonic((v) => !v)}>Mẹo</button>
            <button className={`nf-btn${auto ? " is-active" : ""}`} onClick={() => setAuto((v) => !v)}>
              {auto ? "Dừng tự động" : "Tự động"}
            </button>
            <button className="nf-btn" onClick={toggleFull}>{isFull ? "Thoát toàn màn hình" : "Toàn màn hình"}</button>
            {!isFull && <button className="nf-btn" onClick={onExit}>Thoát</button>}
          </div>

          <div className="nf-shortcuts">
            <span><kbd>Space</kbd> Lật thẻ</span>
            <span><kbd>←</kbd><kbd>→</kbd> Chuyển thẻ</span>
            <span><kbd>H</kbd> Mẹo ghi nhớ</span>
            <span><kbd>A</kbd> Tự động: lật 2s → thẻ kế 2s</span>
            <span><kbd>F</kbd> Toàn màn hình</span>
          </div>
        </>
      )}
    </div>
  );
}
