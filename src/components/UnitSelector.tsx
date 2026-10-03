export type StudyMode = "study" | "flashcard" | "practice";
export type UnitValue = number | string;

interface Props {
  units: UnitValue[];
  currentWeek: UnitValue;
  mode: StudyMode;
  onSelectUnit: (week: UnitValue) => void;
  onSelectMode: (mode: StudyMode) => void;
}

export default function UnitSelector({
  units,
  currentWeek,
  mode,
  onSelectUnit,
  onSelectMode,
}: Props) {
  return (
    <div className="nf-units">
      <label className="nf-unit-select">
        <span>Unit</span>
        <select
          value={currentWeek}
          onChange={(event) => {
            const selectedUnit = units.find((unit) => String(unit) === event.target.value);
            if (selectedUnit !== undefined) onSelectUnit(selectedUnit);
          }}
        >
          {units.map((week) => (
            <option key={week} value={week}>
              {week}
            </option>
          ))}
        </select>
      </label>

      <span className="nf-units-divider" aria-hidden="true" />

      <button
        className={`nf-btn${mode === "study" ? " is-active" : ""}`}
        onClick={() => onSelectMode("study")}
      >
        Danh sách
      </button>
      <button
        className={`nf-btn${mode === "flashcard" ? " is-active" : ""}`}
        onClick={() => onSelectMode("flashcard")}
      >
        Flashcard
      </button>
      <button
        className={`nf-btn${mode === "practice" ? " is-active" : ""}`}
        onClick={() => onSelectMode("practice")}
      >
        Luyện tập
      </button>
    </div>
  );
}
