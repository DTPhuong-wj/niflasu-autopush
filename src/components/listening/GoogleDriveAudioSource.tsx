import { AlertTriangle, Cloud, ExternalLink } from "lucide-react";
import { createGoogleDriveStreamUrl, detectGoogleDriveFileId, getGoogleDrivePlaybackError } from "../../services/listeningSources";
import type { ListeningLesson } from "../../types/listening";
import AudioPlayer from "./AudioPlayer";

interface Props {
  lesson: ListeningLesson;
}

export default function GoogleDriveAudioSource({ lesson }: Props) {
  const originalUrl = lesson.googleDriveUrl ?? lesson.sourceUrl;
  const fileId = lesson.googleDriveId ?? lesson.sourceId ?? detectGoogleDriveFileId(originalUrl).fileId;
  const streamUrl = fileId ? createGoogleDriveStreamUrl(fileId) : null;

  if (!streamUrl) {
    return (
      <div className="nf-listening-drive-error">
        <div className="nf-listening-source-status"><AlertTriangle size={16} /> Link Google Drive không hợp lệ.</div>
        {originalUrl && <a href={originalUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Mở nguồn</a>}
      </div>
    );
  }

  return (
    <div className="nf-listening-drive-player">
      <div className="nf-listening-embedded-label"><Cloud size={16} /> Google Drive</div>
      <AudioPlayer
        src={streamUrl}
        sourceUrl={originalUrl}
        errorMessage="Không thể phát file âm thanh từ Google Drive."
        resolveErrorMessage={() => getGoogleDrivePlaybackError(streamUrl)}
      />
    </div>
  );
}
