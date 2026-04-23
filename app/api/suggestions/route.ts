import { NextResponse } from "next/server";
import {
  generateSuggestions,
  GroqApiError,
  GroqConfigError,
  resolveApiKey,
} from "@/lib/groq";
import { mergeSettings } from "@/lib/prompts";
import { genId } from "@/lib/utils";
import type { Suggestion, SuggestionBatch } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  transcriptWindow?: string;
  previousSuggestions?: Suggestion[];
  settings?: Partial<import("@/types").Settings>;
  apiKey?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const settings = mergeSettings(body.settings);
    const transcriptWindow = (body.transcriptWindow ?? "").slice(-12000);
    const previousSuggestions = Array.isArray(body.previousSuggestions)
      ? body.previousSuggestions.slice(0, 12)
      : [];

    const apiKey = resolveApiKey(
      req.headers.get("x-groq-key") || body.apiKey || settings.apiKey
    );

    const items = await generateSuggestions(
      transcriptWindow,
      previousSuggestions,
      settings,
      apiKey
    );

    const batch: SuggestionBatch = {
      id: genId("batch"),
      createdAt: Date.now(),
      items: items.slice(0, 3),
    };

    if (batch.items.length !== 3) {
      return NextResponse.json(
        { error: "Model returned fewer than 3 valid suggestions." },
        { status: 502 }
      );
    }

    return NextResponse.json({ batch });
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
