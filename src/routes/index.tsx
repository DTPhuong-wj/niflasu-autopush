import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import kanjiData from "../data/kanji.json";
import type { Kanji, Settings } from "../types/kanji";
import Header from "../components/Header";
import Sidebar, { type Section } from "../components/Sidebar";
import BookSelector, { type BookInfo } from "../components/BookSelector";
import UnitSelector, { type StudyMode } from "../components/UnitSelector";
import Practice from "../components/Practice";
import KanjiGrid from "../components/KanjiGrid";
import Flashcard from "../components/Flashcard";
import SettingsModal from "../components/SettingsModal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NiFlasu — Japanese Flashcards cho JLPT" },
      {
        name: "description",
        content:
          "NiFlasu là công cụ học Kanji theo sách và Unit: grid Kanji, flashcard, đếm ngược ngày thi JLPT và mục tiêu điểm.",
      },
      { property: "og:title", content: "NiFlasu — Japanese Flashcards cho JLPT" },
      {
        property: "og:description",
        content: "Học Kanji theo Unit với grid và flashcard, kèm đếm ngược ngày thi JLPT.",
      },
    ],
  }),
  component: App,
});

const STORAGE_KEY = "niflasu-settings";

const DEFAULT_SETTINGS: Settings = {
  examDate: "",
  targetLevel: "N3",
  targetScore: 120,
};

const allKanji = kanjiData as Kanji[];

/** Danh sách sách được suy ra từ trường `source` trong JSON. */
function buildBooks(): BookInfo[] {
  const sources = [...new Set(allKanji.map((item) => item.source))];
  return sources.map((source) => {
    const items = allKanji.filter((item) => item.source === source);
    const weeks = [...new Set(items.map((item) => item.week))];
    const days = [...new Set(items.map((item) => item.day))];
    return {
      source,
      title: source.replace(/\s?N[1-5]$/, ""),
      totalWords: items.reduce((sum, item) => sum + item.words.length, 0),
      totalWeeks: weeks.length,
      daysPerWeek: days.length,
    };
  });
}

function App() {
  const books = useMemo(buildBooks, []);
  const [bookIndex, setBookIndex] = useState(0);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [currentMode, setCurrentMode] = useState<StudyMode>("study");
  const [section, setSection] = useState<Section>("review");
  const [flashStart, setFlashStart] = useState(0);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const currentBook = books[bookIndex]?.source ?? "";

  // Đồng hồ + countdown realtime.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Đọc thiết lập đã lưu (chạy sau khi hydrate để tránh lệch SSR).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      const savedWeek = localStorage.getItem("niflasu-week");
      if (savedWeek) setCurrentWeek(Number(savedWeek));
    } catch {
      /* bỏ qua dữ liệu lỗi */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("niflasu-week", String(currentWeek));
  }, [currentWeek]);

  // Unit lấy trực tiếp từ JSON, không hard-code.
  const units = useMemo(
    () => [
      ...new Set(allKanji.filter((item) => item.source === currentBook).map((item) => item.week)),
    ].sort((a, b) => a - b),
    [currentBook],
  );

  // LOGIC QUAN TRỌNG: mọi chức năng học đều dùng chung filter này.
  const filteredKanji = useMemo(
    () =>
      allKanji
        .filter((item) => item.source === currentBook)
        .filter((item) => item.week === currentWeek)
        .sort((a, b) => a.number - b.number),
    [currentBook, currentWeek],
  );

  function saveSettings(next: Settings) {
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setShowSettings(false);
  }

  function changeBook(step: number) {
    const nextIndex = (bookIndex + step + books.length) % books.length;
    setBookIndex(nextIndex);
    setCurrentMode("study");
    // Giữ Unit hợp lệ trong sách mới.
    const nextUnits = [
      ...new Set(
        allKanji.filter((item) => item.source === books[nextIndex]!.source).map((i) => i.week),
      ),
    ].sort((a, b) => a - b);
    if (!nextUnits.includes(currentWeek)) setCurrentWeek(nextUnits[0] ?? 1);
  }

  return (
    <div className="nf-app">
      <Header now={now} settings={settings} onOpenSettings={() => setShowSettings(true)} />

      <div className="nf-body">
        <Sidebar current={section} onChange={setSection} />

        <main className="nf-main">
          {section !== "review" ? (
            <div className="nf-card nf-placeholder">Tính năng đang phát triển</div>
          ) : (
            <>
              <div className="nf-toolbar">
                {books[bookIndex] && (
                  <BookSelector
                    book={books[bookIndex]}
                    onPrev={() => changeBook(-1)}
                    onNext={() => changeBook(1)}
                    disabled={books.length < 2}
                  />
                )}
                <UnitSelector
                  units={units}
                  currentWeek={currentWeek}
                  mode={currentMode}
                  onSelectUnit={(week) => {
                    setCurrentWeek(week);
                    setFlashStart(0);
                  }}
                  onSelectMode={(mode) => {
                    setFlashStart(0);
                    setCurrentMode(mode);
                  }}
                />
              </div>

              {currentMode === "practice" ? (
                <Practice items={filteredKanji} currentWeek={currentWeek} />
              ) : currentMode === "flashcard" ? (
                <Flashcard
                  items={filteredKanji}
                  currentWeek={currentWeek}
                  startIndex={flashStart}
                  onExit={() => setCurrentMode("study")}
                />
              ) : (
                <KanjiGrid
                  items={filteredKanji}
                  onSelect={(item) => {
                    setFlashStart(filteredKanji.findIndex((k) => k.id === item.id));
                    setCurrentMode("flashcard");
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={saveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
