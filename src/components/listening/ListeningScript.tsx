import type { ListeningLesson } from "../../types/listening";

interface Props {
  lesson: ListeningLesson;
}

export default function ListeningScript({ lesson }: Props) {
  if (!lesson.hasScript || lesson.script.length === 0) {
    return <div className="nf-listening-script nf-listening-script-empty">Script unavailable</div>;
  }

  return (
    <div className="nf-listening-script" aria-live="polite">
      <div className="nf-listening-script-head">Script</div>
      <div className="nf-listening-script-body">
        {lesson.script.map((line, index) => (
          <div key={`${line.speaker}-${index}`} className="nf-listening-script-line">
            <span className="nf-listening-script-speaker">{line.speaker}</span>
            <span className="nf-listening-script-text">{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
