import { NextResponse } from "next/server";
import {
  generateDetailedAnswer,
  GroqApiError,
  GroqConfigError,
  resolveApiKey,
} from "@/lib/groq";
import { mergeSettings } from "@/lib/prompts";
import { genId } from "@/lib/utils";
import type { ChatMessage, Settings, Suggestion } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  transcriptWindow?: string;
  chatHistory?: ChatMessage[];
  userMessage?: string;
  selectedSuggestion?: Suggestion;
  settings?: Partial<Settings>;
  apiKey?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const settings = mergeSettings(body.settings);

    if (!body.userMessage && !body.selectedSuggestion) {
      return NextResponse.json(
        { error: "Provide 'userMessage' or 'selectedSuggestion'." },
        { status: 400 }
      );
    }

    const apiKey = resolveApiKey(
      req.headers.get("x-groq-key") || body.apiKey || settings.apiKey
    );

    const content = await generateDetailedAnswer({
      transcriptWindow: (body.transcriptWindow ?? "").slice(-24000),
      chatHistory: body.chatHistory ?? [],
      userMessage: body.userMessage,
      selectedSuggestion: body.selectedSuggestion,
      settings,
      apiKey,
    });

    const safeContent =
      content && content.trim().length > 0
        ? content
        : "_The model returned an empty response. Try rephrasing the question or click the suggestion again._";

    const message: ChatMessage = {
      id: genId("msg"),
      role: "assistant",
      content: safeContent,
      createdAt: Date.now(),
    };

    return NextResponse.json({ message });
  } catch (err) {
    if (err instanceof GroqConfigError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof GroqApiError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
