import { Volume2 } from "lucide-react";
import AudioPlayer from "./AudioPlayer";
import { formatDuration, isAudioPlayable, resolveAudioSourceUrl } from "../../services/listeningService";
import type { ListeningLesson } from "../../types/listening";
import GoogleDriveAudioSource from "./GoogleDriveAudioSource";
import YouTubePlayer from "./YouTubePlayer";

interface Props {
  lesson: ListeningLesson;
  bookName: string;
}

export default function ListeningPlayer({ lesson, bookName }: Props) {
  const sourceType = lesson.source === "local" ? "local" : lesson.sourceType === "audio" ? "directAudio" : lesson.sourceType;
  const normalizedDuration = formatDuration(lesson.duration ?? 0);

  return (
    <div className="nf-listening-player-panel">
      <div className="nf-listening-player-header"><div><div className="nf-listening-eyebrow">Book</div><div className="nf-listening-book-name small">{bookName}</div></div><div className="nf-listening-badge">Unit {lesson.unit}</div></div>
      <div className="nf-listening-player-body">
        <div className="nf-listening-player-main"><div className="nf-listening-player-icon" aria-hidden="true"><Volume2 size={28} /></div><div className="nf-listening-player-name">{lesson.title}</div><div className="nf-listening-player-duration">Duration: {normalizedDuration}</div></div>
        {sourceType === "youtube" ? <YouTubePlayer lesson={lesson} /> : sourceType === "googleDrive" || sourceType === "drive" ? <GoogleDriveAudioSource lesson={lesson} /> : sourceType === "local" || isAudioPlayable(lesson) ? <AudioPlayer src={resolveAudioSourceUrl(lesson)} sourceUrl={lesson.sourceType === "audio" || lesson.sourceType === "directAudio" ? lesson.sourceUrl : undefined} /> : <div className="nf-listening-player-unavailable">Audio cần kết nối Internet hoặc URL trực tiếp hợp lệ.</div>}
      </div>
    </div>
  );
}
