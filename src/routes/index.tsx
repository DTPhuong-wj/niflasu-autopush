import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import kanjiData from "../data/kanji.json";
import giuaKiNounData from "../data/giua-ki-noun.json";
import type { Kanji, Settings } from "../types/kanji";
import Header from "../components/Header";
import Sidebar, { type Section } from "../components/Sidebar";
import BookSelector, { type BookInfo } from "../components/BookSelector";
import UnitSelector, { type StudyMode, type UnitValue } from "../components/UnitSelector";
import Practice from "../components/Practice";
import KanjiGrid from "../components/KanjiGrid";
import Flashcard from "../components/Flashcard";
import SettingsModal from "../components/SettingsModal";
import ListeningPage from "../components/listening/ListeningPage";
import vocabularyData from "../data/vocabulary.json";
import vocabSenmonData from "../data/senmon.json";
import type { Vocabulary } from "../types/vocabulary";
import type { Vocabulary as Senmon } from "../types/vocab_senmon";
import {
  VocabularyFlashcard,
  VocabularyGrid,
  VocabularyPractice,
} from "../components/VocabularyStudy";
import { isGkiBook, loadCustomBooks, saveCustomBooks } from "../services/bookStorage";

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
const giuaKiNounVocabulary = giuaKiNounData as Vocabulary[];
const permanentVocabularyBooks: Vocabulary[][] = [giuaKiNounVocabulary];
const allSenmon = vocabSenmonData as Senmon[];
const senmonVocabulary: Vocabulary[] = allSenmon.map((item) => ({
  ...item,
  hanViet: null,
  relatedWords: [],
}));

/** Danh sách sách: Kanji (theo `source` trong kanji.json) + Từ vựng (vocabulary.json). */
function buildBooks(customVocabulary: Vocabulary[][] = []): BookInfo[] {
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
  const vocabulary = [
    ...allVocabulary,
    ...permanentVocabularyBooks.flat(),
    ...customVocabulary.flat(),
  ];
  const vocabBooks = [...new Set(vocabulary.map((v) => v.source))].map((source) => {
    const items = vocabulary.filter((v) => v.source === source);
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
  return [...kanjiBooks, ...vocabBooks, ...senmonBooks].sort((a, b) =>
    a.title.localeCompare(b.title),
  );
}

/** Unit của một sách, lấy trực tiếp từ JSON. */
function sortUnits(units: UnitValue[]): UnitValue[] {
  return [...new Set(units)].sort((left, right) =>
    String(left).localeCompare(String(right), undefined, { numeric: true }),
  );
}

function unitsOf(book: BookInfo | undefined, customVocabulary: Vocabulary[][]): UnitValue[] {
  if (!book) return [];
  const list = book.isSenmon
    ? allSenmon.filter((s) => s.source === book.source).map((s) => s.unit)
    : book.isVocabulary
      ? [...allVocabulary, ...permanentVocabularyBooks.flat(), ...customVocabulary.flat()]
          .filter((v) => v.source === book.source)
          .map((v) => v.unit)
      : allKanji.filter((k) => k.source === book.source).map((k) => k.week);
  return sortUnits(list);
}

function App() {
  const [customVocabulary, setCustomVocabulary] = useState<Vocabulary[][]>([]);
  const books = useMemo(() => buildBooks(customVocabulary), [customVocabulary]);
  const [bookIndex, setBookIndex] = useState(0);
  const [currentWeek, setCurrentWeek] = useState<UnitValue>(
    () => unitsOf(books[0], customVocabulary)[0] ?? 1,
  );
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
  const units = useMemo(
    () => unitsOf(books[bookIndex], customVocabulary),
    [books, bookIndex, customVocabulary],
  );
  const activeUnit = units.some((unit) => String(unit) === String(currentWeek))
    ? currentWeek
    : (units[0] ?? 1);
  const currentWeekNumber = typeof activeUnit === "number" ? activeUnit : 1;

  // Đồng hồ + countdown realtime.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setCustomVocabulary(loadCustomBooks());
  }, []);

  // Đọc thiết lập đã lưu (chạy sau khi hydrate để tránh lệch SSR).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {
      /* bỏ qua dữ liệu lỗi */
    }
  }, []);

  useEffect(() => {
    try {
      const savedWeek = localStorage.getItem("niflasu-week");
      if (
        savedWeek &&
        /^\d+$/.test(savedWeek) &&
        units.some((unit) => String(unit) === savedWeek)
      ) {
        setCurrentWeek(Number(savedWeek));
      }
    } catch {
      /* bỏ qua dữ liệu lỗi */
    }
  }, [units]);

  useEffect(() => {
    if (!units.some((unit) => String(unit) === String(currentWeek))) {
      setCurrentWeek(units[0] ?? 1);
    }
  }, [units, currentWeek]);

  useEffect(() => {
    if (typeof currentWeek === "number") {
      localStorage.setItem("niflasu-week", String(currentWeek));
    }
  }, [currentWeek]);

  // LOGIC QUAN TRỌNG: mọi chức năng học đều dùng chung filter này.
  const filteredKanji = useMemo(
    () =>
      allKanji
        .filter((item) => item.source === currentBook)
        .filter((item) => typeof activeUnit === "number" && item.week === activeUnit)
        .sort((a, b) => a.number - b.number),
    [currentBook, activeUnit],
  );

  // Tương tự cho từ vựng: cùng sách + cùng Unit.
  const filteredVocabulary = useMemo(
    () =>
      [...allVocabulary, ...permanentVocabularyBooks.flat(), ...customVocabulary.flat()]
        .filter((item) => item.source === currentBook)
        .filter((item) => String(item.unit) === String(activeUnit))
        .sort((a, b) => a.number - b.number),
    [currentBook, activeUnit, customVocabulary],
  );

  const filteredSenmon = useMemo(
    () =>
      senmonVocabulary
        .filter((item) => item.source === currentBook)
        .filter((item) => String(item.unit) === String(activeUnit))
        .sort((a, b) => a.number - b.number),
    [currentBook, activeUnit],
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
    const nextUnits = unitsOf(books[index], customVocabulary);
    if (!nextUnits.some((unit) => String(unit) === String(currentWeek)))
      setCurrentWeek(nextUnits[0] ?? 1);
  }

  function importBook(items: Vocabulary[]): string | null {
    if (!isGkiBook(items)) {
      return "JSON không đúng cấu trúc GKI: cần id, source, unit, number, word, reading, meaning, example và type.";
    }
    const source = items[0]?.source;
    if (!source) return "Sách JSON cần có ít nhất một mục từ.";
    if ([...allKanji, ...allVocabulary, ...allSenmon].some((item) => item.source === source)) {
      return `Tên sách "${source}" đã tồn tại.`;
    }
    if (
      permanentVocabularyBooks.some((book) => book[0]?.source === source) ||
      customVocabulary.some((book) => book[0]?.source === source)
    ) {
      return `Sách "${source}" đã được nhập.`;
    }
    const next = [...customVocabulary, items];
    try {
      saveCustomBooks(next);
      setCustomVocabulary(next);
      setBookIndex(buildBooks(next).findIndex((book) => book.source === source));
      setCurrentWeek(sortUnits(items.map((item) => item.unit))[0] ?? 1);
      setCurrentMode("study");
      setFlashStart(0);
      return null;
    } catch {
      return "Không thể lưu sách. Bộ nhớ trình duyệt có thể đã đầy.";
    }
  }

  return (
    <div className="nf-app">
      <Header now={now} settings={settings} onOpenSettings={() => setShowSettings(true)} />

      <div className="nf-body">
        <Sidebar current={section} onChange={setSection} />

        <main className="nf-main">
          {section === "listening" ? (
            <ListeningPage />
          ) : section !== "review" ? (
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
                    onImport={importBook}
                    onClose={() => setShowBookList(false)}
                    disabled={books.length < 2}
                  />
                )}
                <UnitSelector
                  units={units}
                  currentWeek={activeUnit}
                  mode={currentMode}
                  onSelectUnit={(unit) => {
                    setCurrentWeek(unit);
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
                  <VocabularyPractice items={studyVocabulary} currentUnit={activeUnit} />
                ) : currentMode === "flashcard" ? (
                  <VocabularyFlashcard
                    items={studyVocabulary}
                    currentUnit={activeUnit}
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
                <Practice items={filteredKanji} currentWeek={currentWeekNumber} />
              ) : currentMode === "flashcard" ? (
                <Flashcard
                  items={filteredKanji}
                  currentWeek={currentWeekNumber}
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

          {section === "review" && currentMode === "flashcard" && (
            <div className="nf-flash-help" aria-label="Phím tắt flashcard">
              <span className="nf-kbd">[Space]</span> lật thẻ
              <span className="nf-kbd">A</span> tự động
              <span className="nf-kbd">F</span> toàn màn hình
              <span className="nf-kbd">Esc</span> thoát
            </div>
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
