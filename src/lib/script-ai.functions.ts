import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  lines: z.array(z.object({ speaker: z.string(), text: z.string() })).max(300),
});

const outputSchema = z.object({
  lines: z.array(
    z.object({
      furigana: z.array(z.object({ text: z.string(), reading: z.string() })),
      translation: z.string(),
      needsReview: z.boolean(),
    }),
  ),
});

export type ProcessedLine = z.infer<typeof outputSchema>["lines"][number];

/** Adds furigana + Vietnamese translation to Japanese script lines. Original text is never modified. */
export const processScript = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<{ lines: ProcessedLine[]; error?: string }> => {
    if (data.lines.length === 0) return { lines: [] };
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { lines: [], error: "AI chưa được cấu hình." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    const provider = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const numbered = data.lines.map((l, i) => `${i + 1}. 【${l.speaker}】${l.text}`).join("\n");
    const prompt = `You annotate a Japanese listening script for Vietnamese learners.
For EACH numbered line (same order, same count = ${data.lines.length}), return:
- furigana: array of {text, reading} for every kanji word in the line. "text" must be an exact substring of the line containing kanji (e.g. "大沢", "担当"), "reading" its hiragana reading in this context. Do not include pure kana words. Order by appearance.
- translation: natural conversational Vietnamese translation of the line (not including the speaker).
- needsReview: true if you are unsure about a reading or the translation.
Never change the Japanese text. Reply ONLY with JSON: {"lines":[{"furigana":[...],"translation":"...","needsReview":false}]}

${numbered}`;
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        prompt,
        providerOptions: {
          openai: {
            store: false,
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const text = await result.text;
      const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      const parsed = outputSchema.parse(JSON.parse(json));
      // Keep only segments that really occur in the original line.
      const lines = data.lines.map((line, i) => {
        const item = parsed.lines[i];
        if (!item) return { furigana: [], translation: "", needsReview: true };
        return { ...item, furigana: item.furigana.filter((s) => s.text && line.text.includes(s.text)) };
      });
      return { lines };
    } catch (error) {
      console.error("processScript failed", error);
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 402) return { lines: [], error: "Hết lượt dùng AI. Hãy nạp thêm credits trong cài đặt workspace." };
      if (status === 429) return { lines: [], error: "AI đang bận, thử lại sau ít phút." };
      return { lines: [], error: "AI không xử lý được script lúc này. Bài vẫn được lưu, bạn có thể tự nhập." };
    }
  });
