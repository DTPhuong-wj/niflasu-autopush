export type StudyMode = "study" | "flashcard" | "practice";

interface Props {
  units: number[];
  currentWeek: number;
  mode: StudyMode;
  onSelectUnit: (week: number) => void;
  onSelectMode: (mode: StudyMode) => void;
}

export default function UnitSelector({ units, currentWeek, mode, onSelectUnit, onSelectMode }: Props) {
  return (
    <div className="nf-units">
      <label className="nf-unit-select">
        <span>Unit</span>
        <select value={currentWeek} onChange={(e) => onSelectUnit(Number(e.target.value))}>
          {units.map((week) => (
            <option key={week} value={week}>
              Unit {week}
            </option>
          ))}
        </select>
      </label>

      <span className="nf-units-divider" aria-hidden="true" />

      <button className={`nf-btn${mode === "study" ? " is-active" : ""}`} onClick={() => onSelectMode("study")}>
        Danh sách
      </button>
      <button className={`nf-btn${mode === "flashcard" ? " is-active" : ""}`} onClick={() => onSelectMode("flashcard")}>
        Flashcard
      </button>
      <button className={`nf-btn${mode === "practice" ? " is-active" : ""}`} onClick={() => onSelectMode("practice")}>
        Luyện tập
      </button>
    </div>
  );
}
