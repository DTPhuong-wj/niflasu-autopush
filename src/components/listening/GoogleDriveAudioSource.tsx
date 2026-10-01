import { AlertTriangle, Cloud, ExternalLink, Play } from "lucide-react";
import { useState } from "react";
import { detectListeningSource, getGoogleDriveDirectUrl } from "../../services/listeningSources";
import type { ListeningLesson } from "../../types/listening";

type AudioStatus = "idle" | "checking" | "ready" | "playing" | "error";

interface Props {
  lesson: ListeningLesson;
}

export default function GoogleDriveAudioSource({ lesson }: Props) {
  const originalUrl = lesson.googleDriveUrl ?? lesson.sourceUrl;
  const source = detectListeningSource(originalUrl, "googleDrive");
  const directUrl = lesson.directUrl ?? getGoogleDriveDirectUrl(originalUrl) ?? source.previewUrl;
  const [status, setStatus] = useState<AudioStatus>(source.isValid ? "checking" : "error");

  const handleError = (event: React.SyntheticEvent<HTMLAudioElement>) => {
    event.currentTarget.pause();
    setStatus("error");
    if (import.meta.env.DEV) {
      console.warn("[Listening Google Drive Playback]", {
        sourceType: "googleDrive",
        sourceUrl: lesson.sourceUrl,
        requestUrl: directUrl,
        responseStatus: null,
        error: { name: "MediaLoadError", message: "Google Drive did not provide a playable audio stream." },
        timeout: false,
      });
    }
  };

  if (source.isValid && status === "error" && source.sourceId) {
    return (
      <div className="nf-listening-drive-player">
        <div className="nf-listening-embedded-label"><Cloud size={16} /> Google Drive</div>
        <iframe title="Google Drive audio" src={`https://drive.google.com/file/d/${encodeURIComponent(source.sourceId)}/preview`} allow="autoplay" style={{ width: "100%", height: 80, border: 0 }} />
        <div className="nf-listening-player-status">Nếu không phát được: không thể truy cập file Google Drive. Hãy kiểm tra quyền chia sẻ của file.</div>
        <a className="nf-listening-source-link" href={lesson.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Mở nguồn</a>
      </div>
    );
  }

  if (!source.isValid) {
    return (
      <div className="nf-listening-drive-error">
        <div className="nf-listening-source-status"><AlertTriangle size={16} /> Link Google Drive không hợp lệ</div>
        <a href={lesson.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Mở nguồn</a>
      </div>
    );
  }

  return (
    <div className="nf-listening-drive-player">
      <div className="nf-listening-embedded-label"><Cloud size={16} /> Google Drive</div>
      {status === "checking" && <div className="nf-listening-player-status">Đang kiểm tra nguồn âm thanh...</div>}
      <audio
        controls
        preload="metadata"
        src={directUrl}
        onLoadStart={() => setStatus("checking")}
        onLoadedMetadata={() => setStatus("ready")}
        onPlay={() => setStatus("playing")}
        onPause={() => setStatus((current) => current === "playing" ? "ready" : current)}
        onError={handleError}
      />
      {status === "ready" || status === "playing" ? <div className="nf-listening-player-status"><Play size={15} /> {status === "playing" ? "Đang phát" : "Có thể phát"}</div> : null}
      <a className="nf-listening-source-link" href={lesson.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Mở nguồn</a>
    </div>
  );
}
