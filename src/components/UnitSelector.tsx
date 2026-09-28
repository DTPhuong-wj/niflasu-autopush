interface Props {
  units: number[];
  currentWeek: number;
  mode: "study" | "flashcard";
  onSelectUnit: (week: number) => void;
  onSelectMode: (mode: "study" | "flashcard") => void;
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
      {units.map((week) => (
        <button
          key={week}
          className={`nf-btn${currentWeek === week ? " is-active" : ""}`}
          onClick={() => onSelectUnit(week)}
        >
          Unit {week}
        </button>
      ))}

      <span className="nf-units-divider" aria-hidden="true" />

      <button
        className={`nf-btn${mode === "flashcard" ? " is-active" : ""}`}
        onClick={() => onSelectMode(mode === "flashcard" ? "study" : "flashcard")}
      >
        Flashcard
      </button>
      <button className="nf-btn" disabled>
        Luyện tập
      </button>
    </div>
  );
}
