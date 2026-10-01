import { Youtube } from "lucide-react";
import { useState } from "react";
import { detectListeningSource } from "../../services/listeningSources";
import type { ListeningLesson } from "../../types/listening";

interface Props {
  lesson: ListeningLesson;
}

export default function YouTubePlayer({ lesson }: Props) {
  const [hasError, setHasError] = useState(false);
  const source = detectListeningSource(lesson.sourceUrl, "youtube");
  if (!source.isValid) return <div className="nf-listening-player-unavailable">Không thể tải video. Hãy kiểm tra URL.</div>;
  if (hasError) return <div className="nf-listening-player-unavailable">Không thể phát video YouTube. Video có thể đã bị xóa, đặt riêng tư hoặc không cho phép nhúng.</div>;

  return (
    <div className="nf-listening-embedded-player">
      <div className="nf-listening-embedded-label"><Youtube size={16} /> YouTube</div>
      <iframe
        title={`YouTube: ${lesson.title}`}
        src={source.previewUrl}
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        onError={() => {
          setHasError(true);
          if (import.meta.env.DEV) {
            console.warn("[Listening Source Check]", {
              sourceType: "youtube",
              sourceUrl: lesson.sourceUrl,
              requestUrl: source.previewUrl,
              responseStatus: null,
              error: { name: "EmbedLoadError", message: "YouTube embed could not be loaded." },
              timeout: false,
            });
          }
        }}
      />
    </div>
  );
}
