import { AlertTriangle, Cloud, ExternalLink } from "lucide-react";
import { getGoogleDriveDirectUrl } from "../../services/listeningSources";
import type { ListeningLesson } from "../../types/listening";
import AudioPlayer from "./AudioPlayer";

interface Props {
  lesson: ListeningLesson;
}

export default function GoogleDriveAudioSource({ lesson }: Props) {
  const originalUrl = lesson.googleDriveUrl ?? lesson.sourceUrl;
  // Always play the direct URL, never the Drive viewer page.
  const directUrl = lesson.directUrl ?? getGoogleDriveDirectUrl(originalUrl);

  if (!directUrl) {
    return (
      <div className="nf-listening-drive-error">
        <div className="nf-listening-source-status"><AlertTriangle size={16} /> Không thể tạo direct link để phát file này.</div>
        <a href={originalUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Mở nguồn</a>
      </div>
    );
  }

  return (
    <div className="nf-listening-drive-player">
      <div className="nf-listening-embedded-label"><Cloud size={16} /> Google Drive</div>
      <AudioPlayer
        src={directUrl}
        sourceUrl={originalUrl}
        errorMessage="Không thể phát trực tiếp file Google Drive này. Google Drive không cung cấp audio stream trực tiếp cho trình phát web."
      />
    </div>
  );
}
