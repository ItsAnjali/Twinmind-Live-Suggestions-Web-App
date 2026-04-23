import { parseSuggestions } from "@/lib/validators";
import type { ChatMessage, Settings, Suggestion } from "@/types";

const GROQ_BASE = "https://api.groq.com/openai/v1";

export class GroqConfigError extends Error {}
export class GroqApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function resolveApiKey(userKey?: string | null): string {
  const candidate = (userKey ?? "").trim() || (process.env.GROQ_API_KEY ?? "").trim();
  if (!candidate) {
    throw new GroqConfigError(
      "Missing Groq API key. Open Settings and paste your Groq API key (starts with gsk_)."
    );
  }
  return candidate;
}

async function groqFetch(
  path: string,
  init: RequestInit,
  apiKey: string
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${apiKey}`);
  const res = await fetch(`${GROQ_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GroqApiError(
      `Groq ${path} failed (${res.status}): ${body.slice(0, 300)}`,
      res.status
    );
  }
  return res;
}

export async function transcribeAudio(
  file: File,
  apiKey: string,
  model = "whisper-large-v3"
): Promise<string> {
  const form = new FormData();
  form.append("file", file, file.name || "audio.webm");
  form.append("model", model);
  form.append("response_format", "json");
  form.append("temperature", "0");

  const res = await groqFetch(
    "/audio/transcriptions",
    { method: "POST", body: form },
    apiKey
  );
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

export async function generateSuggestions(
  transcriptWindow: string,
  previousSuggestions: Suggestion[],
  settings: Settings,
  apiKey: string
): Promise<Suggestion[]> {
  const system = settings.livePrompt;
  const recent = previousSuggestions.slice(0, 9);
  const userContent = [
    "RECENT TRANSCRIPT WINDOW (most recent at the end):",
    "```",
    transcriptWindow.trim() || "(empty — no transcript yet)",
    "```",
    "",
    "PREVIOUS SUGGESTIONS (avoid repeating these ideas or titles):",
    recent.length
      ? JSON.stringify(recent.map((s) => ({ title: s.title, type: s.type })))
      : "(none)",
    "",
    'Return STRICT JSON shaped as {"suggestions":[{...},{...},{...}]} with EXACTLY 3 items.',
  ].join("\n");

  const res = await groqFetch(
    "/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: settings.suggestionsModel,
        temperature: settings.temperature,
        // keep reasoning low so tokens go to the visible JSON, not hidden thinking
        reasoning_effort: "low",
        // floor high enough that a 3-object payload never gets truncated by the strict json validator
        max_tokens: Math.max(1200, Math.min(2000, settings.maxTokens * 3)),
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      }),
    },
    apiKey
  );

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content ?? "";
  return parseSuggestions(raw);
}

interface DetailedAnswerInput {
  transcriptWindow: string;
  chatHistory: ChatMessage[];
  userMessage?: string;
  selectedSuggestion?: Suggestion;
  settings: Settings;
  apiKey: string;
}

export async function generateDetailedAnswer({
  transcriptWindow,
  chatHistory,
  userMessage,
  selectedSuggestion,
  settings,
  apiKey,
}: DetailedAnswerInput): Promise<string> {
  const systemParts = [settings.chatPrompt, "", settings.detailedPrompt];
  const system = systemParts.join("\n\n");

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: system },
    {
      role: "user",
      content: [
        "TRANSCRIPT CONTEXT (most recent at the end):",
        "```",
        transcriptWindow.trim() || "(empty)",
        "```",
      ].join("\n"),
    },
  ];

  for (const m of chatHistory.slice(-12)) {
    if (m.role === "assistant") {
      messages.push({ role: "assistant", content: m.content });
    } else if (m.role === "user") {
      messages.push({ role: "user", content: m.content });
    } else if (m.role === "system-suggestion" && m.suggestion) {
      messages.push({
        role: "user",
        content: `[Previously selected suggestion] ${m.suggestion.title} — ${m.suggestion.preview}`,
      });
    }
  }

  if (selectedSuggestion) {
    messages.push({
      role: "user",
      content: [
        "The listener just clicked the following live suggestion. Respond to its intent in depth:",
        `- type: ${selectedSuggestion.type}`,
        `- title: ${selectedSuggestion.title}`,
        `- preview: ${selectedSuggestion.preview}`,
        `- why: ${selectedSuggestion.why}`,
      ].join("\n"),
    });
  } else if (userMessage) {
    messages.push({ role: "user", content: userMessage });
  } else {
    throw new Error("generateDetailedAnswer requires userMessage or selectedSuggestion.");
  }

  const res = await groqFetch(
    "/chat/completions",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: settings.chatModel,
        temperature: Math.max(0, Math.min(1, settings.temperature)),
        // reasoning model — keep effort low so the budget goes to the answer, not hidden thinking
        reasoning_effort: "low",
        max_tokens: Math.max(800, settings.maxTokens),
        messages,
      }),
    },
    apiKey
  );

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return (data.choices?.[0]?.message?.content ?? "").trim();
}
