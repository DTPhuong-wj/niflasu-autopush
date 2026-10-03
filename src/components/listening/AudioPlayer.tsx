import { ExternalLink, Loader2, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { loadLocalAudioFile } from "../../services/localAudioStorage";

interface Props {
  src: string;
  localAudioFileId?: string | undefined;
  fallbackSrc?: string | undefined;
  sourceUrl?: string | undefined;
  errorMessage?: string;
  resolveErrorMessage?: (() => Promise<string | undefined>) | undefined;
  onDurationChange?: ((duration: number) => void) | undefined;
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "00:00";
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

export default function AudioPlayer({ src, localAudioFileId, fallbackSrc, sourceUrl, errorMessage = "Không thể phát bài nghe.", resolveErrorMessage, onDurationChange }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastVolume = useRef(1);
  const [localAudioUrl, setLocalAudioUrl] = useState("");
  const [localLoadAttempt, setLocalLoadAttempt] = useState(0);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [displayErrorMessage, setDisplayErrorMessage] = useState(errorMessage);
  const playbackUrl = localAudioFileId ? localAudioUrl : src;
  const sources = fallbackSrc && fallbackSrc !== playbackUrl ? [playbackUrl, fallbackSrc] : [playbackUrl];
  const activeSrc = sources[sourceIndex] ?? playbackUrl;

  useEffect(() => {
    const audio = audioRef.current;
    let cancelled = false;
    let generatedUrl = "";
    setSourceIndex(0);
    setRetryCount(0);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setHasError(false);
    setIsLoading(Boolean(src || localAudioFileId));
    setDisplayErrorMessage(errorMessage);
    setLocalAudioUrl("");
    if (localAudioFileId) {
      void loadLocalAudioFile(localAudioFileId).then((file) => {
        if (cancelled) return;
        if (!file) throw new Error("Không tìm thấy file audio trong bộ nhớ thiết bị.");
        generatedUrl = URL.createObjectURL(file);
        setLocalAudioUrl(generatedUrl);
      }).catch(() => {
        if (cancelled) return;
        setIsLoading(false);
        setHasError(true);
      });
    } else if (!src) {
      setIsLoading(false);
      setHasError(true);
    }
    return () => {
      cancelled = true;
      audio?.pause();
      if (generatedUrl) URL.revokeObjectURL(generatedUrl);
    };
  }, [src, fallbackSrc, localAudioFileId, errorMessage, localLoadAttempt]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || hasError) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    try {
      await audio.play();
    } catch {
      setIsPlaying(false);
    }
  };

  const seek = (time: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const next = Math.min(Math.max(0, time), duration);
    audio.currentTime = next;
    setCurrentTime(next);
  };

  const changeVolume = (value: number) => {
    const audio = audioRef.current;
    setVolume(value);
    if (value > 0) lastVolume.current = value;
    setIsMuted(value === 0);
    if (audio) {
      audio.volume = value;
      audio.muted = value === 0;
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isMuted) {
      const restored = lastVolume.current || 1;
      audio.muted = false;
      audio.volume = restored;
      setVolume(restored);
      setIsMuted(false);
    } else {
      audio.muted = true;
      setIsMuted(true);
    }
  };

  const retry = () => {
    const audio = audioRef.current;
    if (!audio || (!src && !localAudioFileId)) return;
    setHasError(false);
    setIsLoading(true);
    if (localAudioFileId && !localAudioUrl) {
      setLocalLoadAttempt((attempt) => attempt + 1);
      return;
    }
    if (sourceIndex !== 0) {
      setSourceIndex(0);
      setRetryCount((count) => count + 1);
    } else {
      setRetryCount((count) => count + 1);
      audio.load();
    }
  };

  const handleError = async () => {
    if (sourceIndex + 1 < sources.length) {
      setSourceIndex((index) => index + 1);
      setIsLoading(true);
      return;
    }
    setHasError(true);
    setIsLoading(false);
    setIsPlaying(false);
    if (resolveErrorMessage) {
      const message = await resolveErrorMessage();
      if (message) setDisplayErrorMessage(message);
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const audio = audioRef.current;
      if (event.key === " ") {
        event.preventDefault();
        void toggle();
      } else if (event.key === "ArrowLeft" && audio) {
        event.preventDefault();
        seek(audio.currentTime - 5);
      } else if (event.key === "ArrowRight" && audio) {
        event.preventDefault();
        seek(audio.currentTime + 5);
      } else if (event.key.toLowerCase() === "m") {
        toggleMute();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const percent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="nf-audio">
      <audio
        ref={audioRef}
        key={`${activeSrc}-${retryCount}`}
        src={activeSrc || undefined}
        preload="metadata"
        onLoadStart={() => { setIsLoading(true); setHasError(false); }}
        onLoadedMetadata={(e) => {
          const loadedDuration = e.currentTarget.duration;
          if (Number.isFinite(loadedDuration) && loadedDuration > 0) {
            setDuration(loadedDuration);
            onDurationChange?.(loadedDuration);
          }
          setIsLoading(false);
        }}
        onCanPlay={() => setIsLoading(false)}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime || 0)}
        onEnded={(e) => { e.currentTarget.currentTime = 0; setIsPlaying(false); setCurrentTime(0); }}
        onError={() => { if (activeSrc) handleError(); }}
      />

      {hasError ? (
        <div className="nf-audio-error">
          <div>{displayErrorMessage}</div>
          <div className="nf-audio-error-actions">
            {(src || localAudioFileId) && <button type="button" className="nf-btn" onClick={retry}><RotateCcw size={14} /> Thử lại</button>}
            {sourceUrl && <a className="nf-btn" href={sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Mở nguồn</a>}
          </div>
        </div>
      ) : (
        <>
          <div className="nf-audio-row">
            <button type="button" className="nf-btn nf-btn-square" onClick={toggle} disabled={isLoading && !duration} aria-label={isPlaying ? "Tạm dừng" : "Phát"}>
              {isLoading && !duration ? <Loader2 size={18} className="nf-spin" /> : isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <div className="nf-audio-progress">
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={(e) => seek(Number(e.target.value))}
                style={{ background: `linear-gradient(to right, var(--nf-accent) ${percent}%, var(--nf-border) ${percent}%)` }}
                aria-label="Tiến trình bài nghe"
              />
              <div className="nf-audio-time"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
            </div>
          </div>
          <div className="nf-audio-row nf-audio-volume">
            <button type="button" className="nf-btn nf-btn-square" onClick={toggleMute} aria-label={isMuted ? "Bật tiếng" : "Tắt tiếng"}>
              {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <input type="range" min={0} max={1} step={0.01} value={isMuted ? 0 : volume} onChange={(e) => changeVolume(Number(e.target.value))} aria-label="Âm lượng" />
            <span className="nf-audio-status">{isLoading && !duration ? "Đang tải bài nghe..." : isPlaying ? "Đang phát" : "Nhấn để phát"}</span>
          </div>
        </>
      )}
    </div>
  );
}
