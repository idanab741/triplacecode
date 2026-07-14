const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-5";
const TIMEOUT_MS = 15000;

export interface ClaudeCallResult {
  text: string | null;
  error: string | null;
}

/**
 * קריאה גולמית ל-Claude. מטפלת ב-timeout ורושמת כל שגיאה ללוג השרת
 * (console.error - נלכד אוטומטית בלוגים של Vercel).
 */
export async function callClaude(prompt: string, maxTokens = 2048): Promise<ClaudeCallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logAiError("ANTHROPIC_API_KEY אינו מוגדר", { prompt: prompt.slice(0, 200) });
    return { text: null, error: "ANTHROPIC_API_KEY אינו מוגדר" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Claude API החזיר שגיאה (${response.status}): ${errorBody.slice(0, 300)}`);
    }

    const data = await response.json();
    const text: string | undefined = data.content?.[0]?.text;
    if (!text) {
      throw new Error("תשובת Claude לא הכילה טקסט");
    }

    return { text, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא ידועה בקריאה ל-Claude";
    logAiError(message, { prompt: prompt.slice(0, 200) });
    return { text: null, error: message };
  } finally {
    clearTimeout(timeoutId);
  }
}

/** רישום שגיאות AI ללוג השרת (Vercel לוכד console.error אוטומטית). */
export function logAiError(message: string, context?: Record<string, unknown>) {
  console.error("[AI Error]", {
    timestamp: new Date().toISOString(),
    message,
    ...context,
  });
}
