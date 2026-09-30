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
import vocabularyData from "../data/vocabulary.json";
import vocabSenmonData from "../data/senmon.json";
import type { Vocabulary } from "../types/vocabulary";
import type { Vocabulary as Senmon } from "../types/vocab_senmon";
import { VocabularyFlashcard, VocabularyGrid, VocabularyPractice } from "../components/VocabularyStudy";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
const allVocabulary = vocabularyData as Vocabulary[];
const allSenmon = vocabSenmonData as Senmon[];
const senmonVocabulary: Vocabulary[] = allSenmon.map((item) => ({
  ...item,
  hanViet: null,
  relatedWords: [],
}));

/** Danh sách sách: Kanji (theo `source` trong kanji.json) + Từ vựng (vocabulary.json). */
function buildBooks(): BookInfo[] {
  const sources = [...new Set(allKanji.map((item) => item.source))];
  const kanjiBooks = sources.map((source) => {
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
  const vocabBooks = [...new Set(allVocabulary.map((v) => v.source))].map((source) => {
    const items = allVocabulary.filter((v) => v.source === source);
    return {
      source,
      title: source.replace(/\s?N[1-5]$/, ""),
      totalWords: items.length,
      totalWeeks: new Set(items.map((v) => v.unit)).size,
      daysPerWeek: 0,
      isVocabulary: true,
    };
  });
  const senmonBooks = [...new Set(allSenmon.map((item) => item.source))].map((source) => {
    const items = allSenmon.filter((item) => item.source === source);
    const weeks = [...new Set(items.map((item) => item.unit))];
    return {
      source,
      title: source.replace(/\s?N[1-5]$/, ""),
      totalWords: items.length,
      totalWeeks: weeks.length,
      daysPerWeek: 0,
      isVocabulary: true,
      isSenmon: true,
    };
  });
  return [...kanjiBooks, ...vocabBooks, ...senmonBooks].sort((a, b) => a.title.localeCompare(b.title));
}

/** Unit của một sách, lấy trực tiếp từ JSON. */
function unitsOf(book: BookInfo | undefined): number[] {
  if (!book) return [];
  const list = book.isSenmon
    ? allSenmon.filter((s) => s.source === book.source).map((s) => s.unit)
    : book.isVocabulary
    ? allVocabulary.filter((v) => v.source === book.source).map((v) => v.unit)
    : allKanji.filter((k) => k.source === book.source).map((k) => k.week);
  return [...new Set(list)].sort((a, b) => a - b);
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
  const [showBookList, setShowBookList] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const currentBook = books[bookIndex]?.source ?? "";
  const currentBookInfo = books[bookIndex];
  const isVocabulary = !!currentBookInfo?.isVocabulary || !!currentBookInfo?.isSenmon;

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
  const units = useMemo(() => unitsOf(books[bookIndex]), [books, bookIndex]);

  // LOGIC QUAN TRỌNG: mọi chức năng học đều dùng chung filter này.
  const filteredKanji = useMemo(
    () =>
      allKanji
        .filter((item) => item.source === currentBook)
        .filter((item) => item.week === currentWeek)
        .sort((a, b) => a.number - b.number),
    [currentBook, currentWeek],
  );

  // Tương tự cho từ vựng: cùng sách + cùng Unit.
  const filteredVocabulary = useMemo(
    () =>
      allVocabulary
        .filter((item) => item.source === currentBook)
        .filter((item) => item.unit === currentWeek)
        .sort((a, b) => a.number - b.number),
    [currentBook, currentWeek],
  );

  const filteredSenmon = useMemo(
    () =>
      senmonVocabulary
        .filter((item) => item.source === currentBook)
        .filter((item) => item.unit === currentWeek)
        .sort((a, b) => a.number - b.number),
    [currentBook, currentWeek],
  );

  const studyVocabulary = currentBookInfo?.isSenmon ? filteredSenmon : filteredVocabulary;

  function saveSettings(next: Settings) {
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setShowSettings(false);
  }

  function selectBook(index: number) {
    setBookIndex(index);
    setCurrentMode("study");
    setFlashStart(0);
    // Giữ Unit hợp lệ trong sách mới.
    const nextUnits = unitsOf(books[index]);
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
                    books={books}
                    bookIndex={bookIndex}
                    showBookList={showBookList}
                    onPrev={() => setShowBookList(true)}
                    onNext={() => setShowBookList(true)}
                    onSelect={(index) => {
                      selectBook(index);
                      setShowBookList(false);
                    }}
                    onClose={() => setShowBookList(false)}
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

              {isVocabulary ? (
                currentMode === "practice" ? (
                  <VocabularyPractice items={studyVocabulary} currentUnit={currentWeek} />
                ) : currentMode === "flashcard" ? (
                  <VocabularyFlashcard
                    items={studyVocabulary}
                    currentUnit={currentWeek}
                    startIndex={flashStart}
                    onExit={() => setCurrentMode("study")}
                  />
                ) : (
                  <VocabularyGrid
                    items={studyVocabulary}
                    onSelect={(item) => {
                      setFlashStart(studyVocabulary.findIndex((v) => v.id === item.id));
                      setCurrentMode("flashcard");
                    }}
                  />
                )
              ) : currentMode === "practice" ? (
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
