import { AlertTriangle, Cloud, ExternalLink, Play, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import { createGoogleDriveMediaUrl, extractGoogleDriveFileId } from "../../services/listeningSources";
import type { ListeningLesson } from "../../types/listening";

type AudioStatus = "idle" | "ready" | "playing" | "error";

interface Props {
  lesson: ListeningLesson;
}

export default function GoogleDriveAudioSource({ lesson }: Props) {
  const legacyUrl = lesson.googleDriveUrl ?? lesson.sourceUrl;
  const fileId = lesson.googleDriveId ?? lesson.sourceId ?? extractGoogleDriveFileId(legacyUrl) ?? extractGoogleDriveFileId(lesson.directUrl ?? "");
  const mediaUrl = fileId ? createGoogleDriveMediaUrl(fileId) : null;
  const originalUrl = fileId ? `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view` : legacyUrl;
  const fallbackUrl = fileId
    ? `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download`
    : null;
  const sourceUrls = [...new Set([mediaUrl, fallbackUrl].filter((url): url is string => Boolean(url)))];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<AudioStatus>(mediaUrl ? "idle" : "error");
  const [sourceIndex, setSourceIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);

  if (import.meta.env.DEV && mediaUrl) {
    console.log("Google Drive original:", originalUrl);
    console.log("Google Drive ID:", fileId);
    console.log("Resolved audio source:", mediaUrl);
  }

  const handleError = (event: React.SyntheticEvent<HTMLAudioElement>) => {
    event.currentTarget.pause();
    if (import.meta.env.DEV) {
      console.log("Audio error:", audioRef.current?.error);
    }
    if (sourceIndex + 1 < sourceUrls.length) {
      setSourceIndex((index) => index + 1);
      setStatus("idle");
      return;
    }
    setStatus("error");
  };

  if (!mediaUrl) {
    return (
      <div className="nf-listening-drive-error">
        <div className="nf-listening-source-status"><AlertTriangle size={16} /> Không thể lấy File ID từ liên kết Google Drive. Vui lòng kiểm tra lại liên kết.</div>
        {originalUrl && <a href={originalUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Mở nguồn</a>}
      </div>
    );
  }

  return (
    <div className="nf-listening-drive-player">
      <div className="nf-listening-embedded-label"><Cloud size={16} /> Google Drive</div>
      {status === "error" ? (
        <div className="nf-listening-drive-error">
          <div className="nf-listening-source-status"><AlertTriangle size={16} /> Không thể phát trực tiếp file Google Drive.</div>
          <button type="button" className="nf-btn" onClick={() => { setSourceIndex(0); setStatus("idle"); setRetryCount((count) => count + 1); }}><RotateCcw size={14} /> Thử lại</button>
          <a className="nf-listening-source-link" href={originalUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Mở nguồn</a>
        </div>
      ) : (
        <>
          <audio
            ref={audioRef}
            key={`${sourceIndex}-${retryCount}`}
            controls
            preload="metadata"
            src={sourceUrls[sourceIndex]}
            onLoadedMetadata={() => setStatus("ready")}
            onCanPlay={() => setStatus("ready")}
            onPlaying={() => setStatus("playing")}
            onPause={() => setStatus((current) => current === "playing" ? "ready" : current)}
            onEnded={() => setStatus("ready")}
            onError={handleError}
          />
          {status === "ready" || status === "playing" ? <div className="nf-listening-player-status"><Play size={15} /> {status === "playing" ? "Đang phát" : "Có thể phát"}</div> : null}
          <a className="nf-listening-source-link" href={originalUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Mở nguồn</a>
        </>
      )}
    </div>
  );
}
