import { NextResponse } from "next/server";
import {
  GroqApiError,
  GroqConfigError,
  resolveApiKey,
  transcribeAudio,
} from "@/lib/groq";
import { DEFAULT_SETTINGS } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function pickKey(req: Request, form: FormData): string {
  const headerKey = req.headers.get("x-groq-key")?.trim();
  if (headerKey) return headerKey;
  const formKey = form.get("apiKey");
  return typeof formKey === "string" ? formKey : "";
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const model =
      (form.get("model") as string | null) ?? DEFAULT_SETTINGS.transcribeModel;

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing 'file' field in multipart form." },
        { status: 400 }
      );
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Empty audio file." }, { status: 400 });
    }

    const apiKey = resolveApiKey(pickKey(req, form));
    const text = await transcribeAudio(file, apiKey, model);
    return NextResponse.json({ text });
  } catch (err) {
    if (err instanceof GroqConfigError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof GroqApiError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
