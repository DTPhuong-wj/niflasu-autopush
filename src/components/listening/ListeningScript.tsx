import { useMemo, useState } from "react";
import type { ListeningLesson, ListeningScriptLine } from "../../types/listening";
import { getScriptLineText } from "../../types/listening";

interface Props {
  lesson: ListeningLesson;
}

function renderRubyLine(line: ListeningScriptLine) {
  const text = getScriptLineText(line);
  const rubySegments = (line.furigana ?? []).filter((segment) => segment.text && text.includes(segment.text));

  if (rubySegments.length === 0) {
    return <span className="nf-listening-script-japanese">{text}</span>;
  }

  const orderedSegments = [...rubySegments].sort((left, right) => text.indexOf(left.text) - text.indexOf(right.text));
  const parts: Array<{ type: "text"; value: string } | { type: "ruby"; value: string; reading: string }> = [];
  let cursor = 0;

  orderedSegments.forEach((segment) => {
    const segmentIndex = text.indexOf(segment.text, cursor);
    if (segmentIndex > cursor) {
      parts.push({ type: "text", value: text.slice(cursor, segmentIndex) });
    }
    parts.push({ type: "ruby", value: segment.text, reading: segment.reading || segment.text });
    cursor = segmentIndex + segment.text.length;
  });

  if (cursor < text.length) {
    parts.push({ type: "text", value: text.slice(cursor) });
  }

  return (
    <span className="nf-listening-script-japanese nf-listening-script-ruby-text">
      {parts.map((part, index) => part.type === "text" ? (
        <span key={`${part.value}-${index}`}>{part.value}</span>
      ) : (
        <ruby key={`${part.value}-${part.reading}-${index}`}>
          {part.value}
          <rt>{part.reading}</rt>
        </ruby>
      ))}
    </span>
  );
}

export default function ListeningScript({ lesson }: Props) {
  const [showFurigana, setShowFurigana] = useState(false);
  const [openTranslations, setOpenTranslations] = useState<Record<string, boolean>>({});

  const items = useMemo(() => lesson.script.filter((line) => getScriptLineText(line).length > 0), [lesson.script]);

  if (!lesson.hasScript || items.length === 0) {
    return <div className="nf-listening-script nf-listening-script-empty">Script unavailable</div>;
  }

  return (
    <div className="nf-listening-script" aria-live="polite">
      <div className="nf-listening-script-head-wrap">
        <div className="nf-listening-script-head">Script</div>
        <button
          type="button"
          className={`nf-listening-script-toggle ${showFurigana ? "is-on" : ""}`}
          onClick={() => setShowFurigana((current) => !current)}
          aria-pressed={showFurigana}
        >
          Furigana {showFurigana ? "OFF" : "ON"}
        </button>
      </div>
      <div className="nf-listening-script-body">
        {items.map((line, index) => {
          const lineKey = line.id ?? `${line.speaker}-${index}`;
          const lineText = getScriptLineText(line);
          const translation = (line.translation ?? "").trim();
          const isTranslationOpen = Boolean(openTranslations[lineKey]);

          return (
            <div key={lineKey} className="nf-listening-script-line">
              <div className="nf-listening-script-line-row">
                <span className="nf-listening-script-speaker">{line.speaker}</span>
                <div className="nf-listening-script-main">
                  {showFurigana ? renderRubyLine(line) : <span className="nf-listening-script-japanese">{lineText}</span>}
                </div>
                {translation ? (
                  <button
                    type="button"
                    className={`nf-listening-script-translate ${isTranslationOpen ? "is-open" : ""}`}
                    onClick={() => setOpenTranslations((current) => ({ ...current, [lineKey]: !current[lineKey] }))}
                    aria-expanded={isTranslationOpen}
                  >
                    {isTranslationOpen ? "閉じる" : "訳"}
                  </button>
                ) : null}
              </div>
              {translation && isTranslationOpen ? (
                <div className="nf-listening-script-translation">{translation}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
