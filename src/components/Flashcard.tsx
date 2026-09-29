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

  const handleKeyNavigation = useCallback(
    (e: KeyboardEvent | React.KeyboardEvent<HTMLElement>) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "SELECT", "TEXTAREA", "BUTTON", "A"].includes(target.tagName)) return;

      if (e.key === " " || e.key === "Spacebar" || e.code === "Space") {
        e.preventDefault();
        setRevealed((v) => !v);
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        setRevealed((v) => !v);
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
        return;
      }

      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        setAuto((v) => !v);
        return;
      }

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFull();
        return;
      }

      if (e.key === "Escape") {
        if (document.fullscreenElement) {
          e.preventDefault();
          void document.exitFullscreen();
          return;
        }

        e.preventDefault();
        onExit();
      }
    },
    [go, onExit, toggleFull],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => handleKeyNavigation(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleKeyNavigation]);

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
            key={item.id}
            className="nf-flash-scene"
            role="button"
            tabIndex={0}
            aria-label={`${item.kanji}. ${revealed ? "Đang hiển thị mặt sau" : "Đang hiển thị mặt trước"}. Nhấn để lật thẻ.`}
            aria-pressed={revealed}
            onClick={() => setRevealed((v) => !v)}
            onKeyDown={(e) => handleKeyNavigation(e)}
          >
            <div className={`nf-flash-card${revealed ? " is-flipped" : ""}`}>
              <div className="nf-card nf-flash-face nf-flash-front" aria-hidden={revealed}>
                <div className="nf-flash-kanji">{item.kanji}</div>
                <p className="nf-flash-hint">Nhấn để lật</p>
              </div>
              <div className="nf-card nf-flash-face nf-flash-back-face" aria-hidden={!revealed}>
                <div className="nf-flash-kanji is-small">{item.kanji}</div>
                <KanjiBack item={item} />
              </div>
            </div>
          </div>

          <div className="nf-flash-nav" aria-label="Điều hướng flashcard">
            <button className="nf-btn" onClick={() => go(-1)} disabled={index === 0}>← Trước</button>
            <span className="nf-flash-count">{index + 1} / {items.length}</span>
            <button className="nf-btn" onClick={() => go(1)}>Tiếp →</button>
          </div>

          <div className="nf-flash-help" aria-label="Phím tắt flashcard">
            <span className="nf-kbd">[Space]</span> lật thẻ
            <span className="nf-kbd">A</span> tự động
            <span className="nf-kbd">F</span> toàn màn hình
            <span className="nf-kbd">Esc</span> thoát
          </div>
        </>
      )}
    </div>
  );
}
