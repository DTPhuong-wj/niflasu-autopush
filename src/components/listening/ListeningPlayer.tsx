import { Pause, Play, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatDuration, isAudioPlayable, resolveAudioSourceUrl } from "../../services/listeningService";
import type { ListeningLesson } from "../../types/listening";

interface Props {
  lesson: ListeningLesson;
  bookName: string;
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return "00:00";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function ListeningPlayer({ lesson, bookName }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const canPlay = isAudioPlayable(lesson);
  const playbackUrl = resolveAudioSourceUrl(lesson);
  const normalizedDuration = formatDuration(lesson.duration);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setDurationSeconds(0);
    setIsPlaying(false);
  }, [lesson.id]);

  const handleTogglePlay = async () => {
    if (!audioRef.current) {
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const handleRangeChange = (value: number) => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.currentTime = value;
    setCurrentTime(value);
  };

  return (
    <div className="nf-listening-player-panel">
      <div className="nf-listening-player-header">
        <div>
          <div className="nf-listening-eyebrow">Book</div>
          <div className="nf-listening-book-name small">{bookName}</div>
        </div>
        <div className="nf-listening-badge">Unit {lesson.unit}</div>
      </div>

      <div className="nf-listening-player-body">
        <div className="nf-listening-player-main">
          <div className="nf-listening-player-icon" aria-hidden="true">
            <Volume2 size={28} strokeWidth={1.8} />
          </div>

          <div className="nf-listening-player-name">{lesson.title}</div>
          <div className="nf-listening-player-duration">Duration: {normalizedDuration}</div>
        </div>

        {canPlay ? (
          <>
            <div className="nf-listening-player-controls">
              <button
                type="button"
                className="nf-btn nf-btn-square"
                onClick={handleTogglePlay}
                aria-label={isPlaying ? "Tạm dừng bài nghe" : "Phát bài nghe"}
              >
                {isPlaying ? <Pause size={18} strokeWidth={1.8} /> : <Play size={18} strokeWidth={1.8} />}
              </button>

              <div className="nf-listening-progress-wrap">
                <input
                  type="range"
                  min={0}
                  max={durationSeconds || 0}
                  value={currentTime}
                  onChange={(event) => handleRangeChange(Number(event.target.value))}
                  aria-label="Chỉnh thời lượng nghe"
                />
                <div className="nf-listening-progress-meta">
                  <span>{formatTime(currentTime)}</span>
                  <span>{durationSeconds ? formatTime(durationSeconds) : normalizedDuration}</span>
                </div>
              </div>
            </div>

            <audio
              ref={audioRef}
              src={playbackUrl}
              preload="metadata"
              onLoadedMetadata={(event) => setDurationSeconds(event.currentTarget.duration || 0)}
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
              onEnded={() => setIsPlaying(false)}
            />
          </>
        ) : (
          <div className="nf-listening-player-unavailable">
            Không thể phát file audio. Vui lòng kiểm tra URL hoặc định dạng file.
          </div>
        )}
      </div>
    </div>
  );
}
