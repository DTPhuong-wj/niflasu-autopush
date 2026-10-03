import { CheckCircle2, ExternalLink, FileAudio, Plus, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { detectListeningSource, extractDroppedUrl, extractGoogleDriveFileId, getGoogleDrivePlaybackError, inspectListeningSource, type ListeningSourceInspection } from "../../services/listeningSources";
import { formatDuration, parseDurationToSeconds } from "../../services/listeningService";
import { processScript } from "../../lib/script-ai.functions";
import { saveLocalAudioFile } from "../../services/localAudioStorage";
import { getScriptLineText, type ListeningBook, type ListeningBookSet, type ListeningLesson, type ListeningSource, type ListeningSourceType } from "../../types/listening";

interface Props {
  books: ListeningBookSet[];
  selectedBookId: string;
  editingLesson: ListeningLesson | null;
  onClose: () => void;
  onSave: (payload: { bookId: string; lesson: ListeningLesson; audioFile: File | null }) => Promise<void>;
  onCreateBook: (book: ListeningBook) => Promise<void>;
}

function parseScriptText(text: string, previousLines: ListeningLesson["script"] = []): ListeningLesson["script"] {
  const availablePrevious = new Set(previousLines.map((_, index) => index));
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const match = line.match(/^([^：]+)[:：]\s*(.*?)(?:\s*\|\|\s*(.*))?$/);
    const speaker = match?.[1]?.trim() ?? "";
    const japanese = (match?.[2]?.trim() || line).trim();
    const translation = match?.[3]?.trim() || undefined;
    const matchingIndex = previousLines.findIndex((previous, previousIndex) => availablePrevious.has(previousIndex)
      && previous.speaker === speaker
      && getScriptLineText(previous) === japanese);
    const previousIndex = matchingIndex >= 0 ? matchingIndex : availablePrevious.has(index) ? index : -1;
    const previous = previousIndex >= 0 ? previousLines[previousIndex] : undefined;
    if (previousIndex >= 0) availablePrevious.delete(previousIndex);
    const lineId = previous?.id ?? `line-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${index}`}`;
    return {
      id: lineId,
      speaker,
      text: japanese,
      japanese,
      translation,
      furigana: previous && getScriptLineText(previous) === japanese ? previous.furigana ?? [] : [],
    };
  });
}

function formatFuriganaLine(furigana: ListeningLesson["script"][number]["furigana"]): string {
  if (typeof furigana === "string") return furigana;
  return (furigana ?? []).map((segment) => `${segment.text}=${segment.reading}`).join("; ");
}

function parseFuriganaLine(value: string): NonNullable<ListeningLesson["script"][number]["furigana"]> {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const segments = trimmed.split(/[;,，；]/).map((segment) => {
    const [text, ...readingParts] = segment.split("=");
    const reading = readingParts.join("=").trim();
    return text?.trim() && reading ? { text: text.trim(), reading } : null;
  }).filter((segment): segment is { text: string; reading: string } => segment !== null);
  return segments.length > 0 ? segments : trimmed;
}

function sourceLabel(type: ListeningSourceType | "unknown" | FormSource): string {
  if (type === "local") return "File máy tính";
  if (type === "google-drive") return "Google Drive";
  if (type === "youtube") return "YouTube";
  if (type === "googleDrive" || type === "drive") return "Google Drive";
  return "Audio trực tiếp";
}

type FormSource = ListeningSource | "directAudio";

function sourceToFormSource(lesson: ListeningLesson | null): FormSource {
  if (lesson?.source) return lesson.source;
  if (lesson?.sourceType === "youtube") return "youtube";
  if (lesson?.sourceType === "googleDrive" || lesson?.sourceType === "drive") return "google-drive";
  return "local";
}

export default function ListeningFormModal({ books, selectedBookId, editingLesson, onClose, onSave, onCreateBook }: Props) {
  const defaultBookId = books.some((book) => book.book.id === selectedBookId) ? selectedBookId : books[0]?.book.id ?? "";
  const editingGoogleDriveId = editingLesson?.googleDriveId ?? editingLesson?.sourceId ?? extractGoogleDriveFileId(editingLesson?.googleDriveUrl ?? editingLesson?.sourceUrl ?? "");
  const initialSourceUrl = editingLesson && sourceToFormSource(editingLesson) === "google-drive" && editingGoogleDriveId
    ? editingLesson.sourceUrl || editingLesson.googleDriveUrl || `https://drive.google.com/file/d/${encodeURIComponent(editingGoogleDriveId)}/view`
    : editingLesson?.sourceUrl ?? "";
  const [bookId, setBookId] = useState(editingLesson?.bookId ?? defaultBookId);
  const [unit, setUnit] = useState<number | string>(editingLesson?.unit ?? "");
  const [number, setNumber] = useState<number | string>(editingLesson?.number ?? "");
  const [title, setTitle] = useState(editingLesson?.title ?? "");
  const [sourceUrl, setSourceUrl] = useState(initialSourceUrl);
  const [sourceChoice, setSourceChoice] = useState<FormSource>(sourceToFormSource(editingLesson));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [level, setLevel] = useState(editingLesson?.level ?? "");
  const [description, setDescription] = useState(editingLesson?.description ?? "");
  const [duration, setDuration] = useState(editingLesson?.duration ? formatDuration(editingLesson.duration) : "");
  const [hasScript, setHasScript] = useState(editingLesson?.hasScript ?? false);
  const [scriptText, setScriptText] = useState(editingLesson?.script?.map((line) => `${line.speaker}${line.speaker ? "：" : ""}${getScriptLineText(line)}${line.translation ? ` || ${line.translation}` : ""}`).join("\n") ?? "");
  const [scriptLines, setScriptLines] = useState<ListeningLesson["script"]>(editingLesson?.script ?? []);
  const [furiganaText, setFuriganaText] = useState(editingLesson?.script?.map((line) => formatFuriganaLine(line.furigana)).join("\n") ?? "");
  const [inspection, setInspection] = useState<ListeningSourceInspection | null>(() => {
    if (!editingLesson) return null;
    if (editingLesson.source === "local") return { type: "directAudio", sourceId: editingLesson.sourceId ?? editingLesson.fileName ?? null, sourceUrl: editingLesson.sourceUrl, previewUrl: editingLesson.sourceUrl, isValid: true, message: "File audio chỉ được phát trong phiên hiện tại." };
    return detectListeningSource(initialSourceUrl, editingLesson.sourceType);
  });
  const [isChecking, setIsChecking] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [error, setError] = useState("");
  const [showAddBookForm, setShowAddBookForm] = useState(false);
  const [newBookName, setNewBookName] = useState("");
  const [newBookDescription, setNewBookDescription] = useState("");
  const objectUrlRef = useRef<string | null>(editingLesson?.sourceUrl?.startsWith("blob:") ? editingLesson.sourceUrl : null);

  const currentBook = useMemo(() => books.find((item) => item.book.id === bookId) ?? books[0], [bookId, books]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  const isLinkSource = sourceChoice === "google-drive" || sourceChoice === "youtube";
  const expectedLinkType = sourceChoice === "google-drive" ? "googleDrive" : "youtube";
  const sourceReady = Boolean(
    inspection?.isValid &&
    (!isLinkSource || (inspection.type === expectedLinkType && inspection.sourceUrl === sourceUrl.trim())),
  );

  const handleFile = (file: File | null) => {
    if (!file) return;
    const supportedMimeTypes = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/mp4"]);
    const supportedExtension = /\.(mp3|wav|m4a|aac|ogg|flac|webm)$/i.test(file.name);
    if (!supportedMimeTypes.has(file.type.toLowerCase()) && !file.type.toLowerCase().startsWith("audio/") && !supportedExtension) {
      setError("Vui lòng chọn file audio hợp lệ.");
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setSelectedFile(file);
    setSourceUrl(objectUrl);
    setInspection({ type: "directAudio", sourceId: file.name, sourceUrl: objectUrl, previewUrl: objectUrl, isValid: true, message: "File sẽ được tải lên máy chủ khi lưu bài." });
    if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ""));
    setError("");
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const dataTransfer = event.dataTransfer;
    const droppedUrl = extractDroppedUrl(dataTransfer);

    if (import.meta.env.DEV) {
      console.log("Drag types:", [...dataTransfer.types]);
      console.log("URI:", dataTransfer.getData("text/uri-list"));
      console.log("Text:", dataTransfer.getData("text/plain"));
      console.log("HTML:", dataTransfer.getData("text/html"));
    }

    const file = dataTransfer.files?.[0] ?? null;
    if (file) {
      setSourceChoice("local");
      handleFile(file);
      return;
    }

    if (droppedUrl) {
      const detected = detectListeningSource(droppedUrl);
      if (detected.type === "googleDrive") setSourceChoice("google-drive");
      if (detected.type === "youtube") setSourceChoice("youtube");
      setSourceUrl(droppedUrl);
      setInspection(detected);
      setError(detected.isValid ? "" : "Link không được hỗ trợ. Vui lòng dùng link Google Drive hoặc YouTube.");
      return;
    }

    setError("Trình duyệt không cung cấp link khi kéo. Trên Google Drive, chọn Chia sẻ → Sao chép đường liên kết rồi dán vào ô bên dưới.");
  };

  const dropZoneProps = {
    onDragOver: (event: React.DragEvent<HTMLDivElement>) => { event.preventDefault(); setIsDragging(true); },
    onDragLeave: () => setIsDragging(false),
    onDrop: handleDrop,
  };

  const handleCheckLink = () => {
    setError("");
    if (!sourceUrl.trim()) {
      setInspection(null);
      setError("Vui lòng nhập link bài nghe.");
      return;
    }
    setIsChecking(true);
    const nextInspection = inspectListeningSource(sourceUrl, sourceChoice === "google-drive" ? "googleDrive" : sourceChoice === "youtube" ? "youtube" : "directAudio");
    setInspection(nextInspection);
    if (!nextInspection.isValid || (isLinkSource && nextInspection.type !== expectedLinkType)) {
      const sourceError = sourceChoice === "google-drive"
        ? "Link Google Drive không hợp lệ."
        : sourceChoice === "youtube"
          ? "Link YouTube không hợp lệ."
          : nextInspection.message;
      setError(sourceError);
      if (import.meta.env.DEV) {
        console.warn("[Listening Source Check]", {
          sourceType: sourceChoice,
          sourceUrl: sourceUrl.trim(),
          requestUrl: null,
          responseStatus: null,
          error: { name: "UnsupportedSource", message: sourceError },
          timeout: false,
          note: "Source check is parse-only; no browser fetch was attempted.",
        });
      }
    }
    if (nextInspection.duration && !duration) setDuration(formatDuration(nextInspection.duration));
    setIsChecking(false);
  };

  const handleUrlChange = (value: string) => {
    setSourceUrl(value);
    const detected = detectListeningSource(value);
    if (detected.type === "googleDrive") setSourceChoice("google-drive");
    if (detected.type === "youtube") setSourceChoice("youtube");
    setInspection(value.trim() ? detected : null);
    const sourceError = sourceChoice === "google-drive" ? "Link Google Drive không hợp lệ." : sourceChoice === "youtube" ? "Link YouTube không hợp lệ." : detected.message;
    setError(value.trim() && !detected.isValid ? sourceError : "");
  };

  const handleCreateBook = async () => {
    const name = newBookName.trim();
    if (!name) {
      setError("Tên sách không được để trống.");
      return;
    }
    const book: ListeningBook = { id: `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`, name, description: newBookDescription.trim() || undefined };
    setIsSaving(true);
    try {
      await onCreateBook(book);
      setBookId(book.id);
      setNewBookName("");
      setNewBookDescription("");
      setShowAddBookForm(false);
      setError("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu sách.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAiProcessScript = async () => {
    const parsedLines = parseScriptText(scriptText, scriptLines);
    if (parsedLines.length === 0) {
      setError("Nhập script tiếng Nhật trước khi AI xử lý.");
      return;
    }

    setIsAiProcessing(true);
    setError("");

    try {
      const result = await processScript({
        data: { lines: parsedLines.map((line) => ({ speaker: line.speaker, text: getScriptLineText(line) })) },
      });

      if (result.error) {
        throw new Error(result.error);
      }

      const nextScript = parsedLines.map((line, index) => {
        const processed = result.lines[index];
        const japanese = getScriptLineText(line);
        const translation = processed?.translation?.trim() || line.translation || undefined;
        return {
          ...line,
          japanese,
          text: japanese,
          furigana: processed?.furigana ?? [],
          translation,
          needsReview: processed?.needsReview ?? line.needsReview ?? false,
        };
      });

      setScriptLines(nextScript);
      setFuriganaText(nextScript.map((line) => formatFuriganaLine(line.furigana)).join("\n"));
      setScriptText(nextScript
        .map((line) => `${line.speaker ? `${line.speaker}：` : ""}${getScriptLineText(line)}${line.translation ? ` || ${line.translation}` : ""}`)
        .join("\n"));
      setHasScript(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "AI không xử lý được script lúc này.");
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleSubmit = async () => {
    if (isSaving) return;
    const nextUnit = Number(unit);
    const nextNumber = Number(number);
    if (!bookId && !currentBook?.book.id) return setError("Vui lòng chọn sách.");
    if (!Number.isFinite(nextUnit) || nextUnit <= 0) return setError("Unit phải là số hợp lệ.");
    if (!Number.isFinite(nextNumber) || nextNumber <= 0) return setError("Số thứ tự phải là số hợp lệ.");
    if (!title.trim()) return setError("Tên bài nghe không được để trống.");
    if (!inspection?.isValid || (isLinkSource && inspection.sourceUrl !== sourceUrl.trim())) return setError(isLinkSource ? "Hãy kiểm tra link trước khi lưu bài nghe." : "Vui lòng chọn file audio.");

    const source: ListeningSource = sourceChoice === "google-drive" ? "google-drive" : sourceChoice === "youtube" ? "youtube" : "local";
    const sourceType: ListeningSourceType = source === "google-drive" ? "googleDrive" : source === "youtube" ? "youtube" : "directAudio";
    const googleDriveId = source === "google-drive" ? inspection.fileId ?? extractGoogleDriveFileId(inspection.sourceUrl) ?? undefined : undefined;
    if (source === "google-drive" && !googleDriveId) return setError("Link Google Drive không hợp lệ.");

    const now = new Date().toISOString();
    const lessonId = String(editingLesson?.id ?? `lesson-${Date.now()}`);
    const lessonAudioFileId = source === "local" ? (selectedFile ? `${lessonId}-${Date.now()}` : editingLesson?.audioFileId) : undefined;

    if (source === "local" && selectedFile && lessonAudioFileId) {
      try {
        await saveLocalAudioFile(lessonAudioFileId, selectedFile);
      } catch (fileError) {
        setError(fileError instanceof Error ? fileError.message : "Không thể lưu file audio trên thiết bị.");
        setIsSaving(false);
        return;
      }
    }

    const lesson: ListeningLesson = {
      id: lessonId,
      bookId: bookId || currentBook!.book.id,
      unit: nextUnit,
      number: nextNumber,
      title: title.trim(),
      level: level.trim() || undefined,
      description: description.trim() || undefined,
      source,
      sourceType,
      sourceUrl: source === "local" && selectedFile ? "" : inspection.sourceUrl,
      sourceId: source === "google-drive" ? googleDriveId : inspection.sourceId ?? undefined,
      googleDriveUrl: source === "google-drive" ? inspection.sourceUrl : undefined,
      googleDriveId,
      audioFileId: lessonAudioFileId,
      fileName: selectedFile?.name ?? editingLesson?.fileName,
      duration: parseDurationToSeconds(duration),
      thumbnailUrl: inspection.thumbnailUrl,
      hasScript,
      script: hasScript
        ? parseScriptText(scriptText, scriptLines).map((line, index) => {
          const furiganaLine = furiganaText.split(/\r?\n/)[index] ?? "";
          return { ...line, furigana: furiganaLine.trim() ? parseFuriganaLine(furiganaLine) : line.furigana };
        })
        : [],
      createdAt: editingLesson?.createdAt ?? now,
      updatedAt: now,
    };
    setIsSaving(true);
    try {
      await onSave({ bookId: lesson.bookId, lesson, audioFile: selectedFile });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu bài nghe trên máy chủ.");
      setIsSaving(false);
    }
  };

  return (
    <div className="nf-overlay" onClick={onClose}>
      <div className="nf-listening-form-modal" role="dialog" aria-modal="true" aria-label={editingLesson ? "Chỉnh sửa bài nghe" : "Thêm bài nghe"} onClick={(event) => event.stopPropagation()}>
        <div className="nf-listening-form-header">
          <h2 className="nf-modal-title">{editingLesson ? "Chỉnh sửa bài nghe" : "Thêm bài nghe"}</h2>
          <button type="button" className="nf-btn nf-btn-square" onClick={onClose} aria-label="Đóng form"><X size={16} /></button>
        </div>

        <div className="nf-listening-form-grid">
          <label className="nf-field"><span>Sách</span><select value={bookId} onChange={(event) => setBookId(event.target.value)}>{books.map((item) => <option key={item.book.id} value={item.book.id}>{item.book.name}</option>)}</select></label>
          <div className="nf-listening-inline-actions"><button type="button" className="nf-btn" onClick={() => setShowAddBookForm((current) => !current)}><Plus size={15} /> Thêm sách mới</button></div>
          {showAddBookForm && <div className="nf-listening-create-book"><label className="nf-field"><span>Tên sách</span><input value={newBookName} onChange={(event) => setNewBookName(event.target.value)} /></label><label className="nf-field"><span>Mô tả</span><input value={newBookDescription} onChange={(event) => setNewBookDescription(event.target.value)} /></label><button type="button" className="nf-btn" onClick={handleCreateBook}>Tạo sách</button></div>}

          <div className="nf-listening-two-col"><label className="nf-field"><span>Unit</span><input type="number" min={1} value={unit} onChange={(event) => setUnit(event.target.value)} /></label><label className="nf-field"><span>Số thứ tự</span><input type="number" min={1} value={number} onChange={(event) => setNumber(event.target.value)} /></label></div>
          <label className="nf-field"><span>Tên bài nghe</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ví dụ: モデル会話" /></label>
          <div className="nf-listening-two-col"><label className="nf-field"><span>Cấp độ</span><input value={level} onChange={(event) => setLevel(event.target.value)} placeholder="Ví dụ: N3" /></label><label className="nf-field"><span>Mô tả</span><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Tùy chọn" /></label></div>

          <div className="nf-field"><span>Nguồn bài nghe</span><div className="nf-listening-radio-row">{(["local", "google-drive", "youtube"] as FormSource[]).map((type) => <label key={type}><input type="radio" checked={sourceChoice === type} onChange={() => { setSourceChoice(type); setInspection(null); setError(""); if (type !== "local") setSourceUrl(""); }} />{sourceLabel(type)}</label>)}</div></div>

          {sourceChoice === "local" ? (
            <div className={`nf-listening-dropzone${isDragging ? " is-dragging" : ""}`} {...dropZoneProps}>
              <FileAudio size={26} />
              <strong>{selectedFile?.name ?? editingLesson?.fileName ?? "Kéo file audio vào đây hoặc chọn file"}</strong>
              {selectedFile && <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>}
              <span>MP3, WAV, M4A, OGG. File được tải lên máy chủ khi lưu bài.</span>
              <label className="nf-btn"><Upload size={15} /> Chọn file<input type="file" hidden accept="audio/*,.mp3,.wav,.m4a,.ogg" onChange={(event) => handleFile(event.target.files?.[0] ?? null)} /></label>
            </div>
          ) : (
            <div className={`nf-listening-link-dropzone${isDragging ? " is-dragging" : ""}`} {...dropZoneProps}>
              <span>Kéo link {sourceChoice === "google-drive" ? "Google Drive" : "YouTube"} vào đây hoặc dán link bên dưới</span>
              <div className="nf-listening-link-row"><label className="nf-field"><span>{sourceChoice === "google-drive" ? "Link Google Drive" : "Link YouTube"}</span><input value={sourceUrl} onChange={(event) => handleUrlChange(event.target.value)} placeholder={sourceChoice === "google-drive" ? "https://drive.google.com/file/d/..." : "https://www.youtube.com/watch?v=..."} /></label><button type="button" className="nf-btn" onClick={handleCheckLink} disabled={isChecking}>{isChecking ? "Đang kiểm tra..." : "Kiểm tra link"}</button></div>
            </div>
          )}

          {inspection?.isValid && <div className="nf-listening-source-preview"><div className="nf-listening-source-status"><CheckCircle2 size={16} /> Link hợp lệ <span>{sourceLabel(inspection.type)}</span></div>{inspection.type === "youtube" ? <iframe title="YouTube preview" src={inspection.previewUrl} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /> : <audio controls preload="metadata" src={inspection.previewUrl} onLoadedMetadata={(event) => {
            const loadedDuration = event.currentTarget.duration;
            if (Number.isFinite(loadedDuration) && loadedDuration > 0) setDuration(formatDuration(loadedDuration));
          }} onError={() => {
            if (inspection.type === "googleDrive") {
              void getGoogleDrivePlaybackError(inspection.previewUrl).then((message) => setError(message ?? "Không thể phát file âm thanh từ Google Drive."));
            } else {
              setError("Không thể tải bản xem trước audio trực tiếp.");
            }
          }} />}{inspection.thumbnailUrl && <img src={inspection.thumbnailUrl} alt="YouTube thumbnail" />}{inspection.sourceId && inspection.type !== "directAudio" && <small>{inspection.type === "youtube" ? "Video ID" : "File ID"}: {inspection.sourceId}</small>}{inspection.message && <small>{inspection.message}</small>}<a href={inspection.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Mở nguồn</a></div>}

          <label className="nf-field"><span>Thời lượng</span><input value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="02:35 hoặc số giây" /></label>
          <label className="nf-listening-check-row"><input type="checkbox" checked={hasScript} onChange={(event) => setHasScript(event.target.checked)} /><span>Có Script</span></label>
          {hasScript && (
            <>
              <div className="nf-listening-inline-actions">
                <button type="button" className="nf-btn" onClick={handleAiProcessScript} disabled={isAiProcessing}>
                  {isAiProcessing ? "Đang AI xử lý..." : "AI xử lý Script"}
                </button>
              </div>
              <label className="nf-field"><span>Nội dung Script</span><textarea rows={6} value={scriptText} onChange={(event) => setScriptText(event.target.value)} placeholder={'男：こんにちは。\n女：こんにちは。'} /></label>
              <label className="nf-field"><span>Furigana theo từng câu</span><textarea rows={4} value={furiganaText} onChange={(event) => setFuriganaText(event.target.value)} placeholder={'大沢=おおさわ; 担当=たんとう'} /></label>
            </>
          )}
        </div>

        {error && <div className="nf-listening-form-error">{error}</div>}
        <div className="nf-modal-actions"><button type="button" className="nf-btn" onClick={onClose}>Hủy</button><button type="button" className="nf-btn is-active" onClick={handleSubmit} disabled={!sourceReady || isSaving}>{isSaving ? "Đang lưu..." : editingLesson ? "Cập nhật" : "Lưu bài nghe"}</button></div>
      </div>
    </div>
  );
}
