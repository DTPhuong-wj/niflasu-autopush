import { Pause, Play, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatDuration, isAudioPlayable, resolveAudioSourceUrl } from "../../services/listeningService";
import type { ListeningLesson } from "../../types/listening";
import GoogleDriveAudioSource from "./GoogleDriveAudioSource";
import YouTubePlayer from "./YouTubePlayer";

interface Props {
  lesson: ListeningLesson;
  bookName: string;
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "00:00";
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
}

function DirectAudioPlayer({ lesson }: { lesson: ListeningLesson }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const playbackUrl = resolveAudioSourceUrl(lesson);
  const normalizedDuration = formatDuration(lesson.duration ?? 0);

  useEffect(() => {
    audioRef.current?.pause();
    setCurrentTime(0);
    setDurationSeconds(0);
    setIsPlaying(false);
  }, [lesson.id]);

  const handleTogglePlay = async () => {
    if (!audioRef.current) return;
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

  return (
    <>
      <div className="nf-listening-player-controls">
        <button type="button" className="nf-btn nf-btn-square" onClick={handleTogglePlay} aria-label={isPlaying ? "Tạm dừng bài nghe" : "Phát bài nghe"}>
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <div className="nf-listening-progress-wrap">
          <input type="range" min={0} max={durationSeconds || 0} value={currentTime} onChange={(event) => { if (audioRef.current) audioRef.current.currentTime = Number(event.target.value); setCurrentTime(Number(event.target.value)); }} aria-label="Chỉnh thời lượng nghe" />
          <div className="nf-listening-progress-meta"><span>{formatTime(currentTime)}</span><span>{durationSeconds ? formatTime(durationSeconds) : normalizedDuration}</span></div>
        </div>
      </div>
      <audio ref={audioRef} src={playbackUrl} preload="metadata" onLoadedMetadata={(event) => setDurationSeconds(event.currentTarget.duration || 0)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)} onEnded={() => setIsPlaying(false)} />
    </>
  );
}

export default function ListeningPlayer({ lesson, bookName }: Props) {
  const sourceType = lesson.source === "local" ? "local" : lesson.sourceType === "audio" ? "directAudio" : lesson.sourceType;
  const normalizedDuration = formatDuration(lesson.duration ?? 0);

  return (
    <div className="nf-listening-player-panel">
      <div className="nf-listening-player-header"><div><div className="nf-listening-eyebrow">Book</div><div className="nf-listening-book-name small">{bookName}</div></div><div className="nf-listening-badge">Unit {lesson.unit}</div></div>
      <div className="nf-listening-player-body">
        <div className="nf-listening-player-main"><div className="nf-listening-player-icon" aria-hidden="true"><Volume2 size={28} /></div><div className="nf-listening-player-name">{lesson.title}</div><div className="nf-listening-player-duration">Duration: {normalizedDuration}</div></div>
        {sourceType === "youtube" ? <YouTubePlayer lesson={lesson} /> : sourceType === "googleDrive" || sourceType === "drive" ? <GoogleDriveAudioSource lesson={lesson} /> : sourceType === "local" || isAudioPlayable(lesson) ? <DirectAudioPlayer lesson={lesson} /> : <div className="nf-listening-player-unavailable">Audio cần kết nối Internet hoặc URL trực tiếp hợp lệ.</div>}
      </div>
    </div>
  );
}
