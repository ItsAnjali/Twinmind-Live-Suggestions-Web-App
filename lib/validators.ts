import type { Suggestion, SuggestionType } from "@/types";

const ALLOWED_TYPES: SuggestionType[] = [
  "question_to_ask",
  "concise_answer",
  "talking_point",
  "fact_check",
  "clarification",
];

function coerceType(raw: unknown): SuggestionType {
  if (typeof raw === "string") {
    const norm = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
    if ((ALLOWED_TYPES as string[]).includes(norm)) return norm as SuggestionType;
    if (norm.includes("question")) return "question_to_ask";
    if (norm.includes("answer")) return "concise_answer";
    if (norm.includes("fact")) return "fact_check";
    if (norm.includes("clari")) return "clarification";
    if (norm.includes("talk") || norm.includes("point")) return "talking_point";
  }
  return "talking_point";
}

function isSuggestionLike(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

function normalize(item: unknown): Suggestion | null {
  if (!isSuggestionLike(item)) return null;
  const title = typeof item.title === "string" ? item.title.trim() : "";
  const preview = typeof item.preview === "string" ? item.preview.trim() : "";
  const why = typeof item.why === "string" ? item.why.trim() : "";
  if (!title || !preview) return null;
  return {
    type: coerceType(item.type),
    title: title.slice(0, 120),
    preview: preview.slice(0, 400),
    why: (why || "Grounded in recent transcript.").slice(0, 240),
  };
}

export function parseSuggestions(raw: string): Suggestion[] {
  const attempts: unknown[] = [];
  const text = (raw ?? "").trim();

  try {
    attempts.push(JSON.parse(text));
  } catch {
    /* noop */
  }

  if (attempts.length === 0) {
    const stripped = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    try {
      attempts.push(JSON.parse(stripped));
    } catch {
      /* noop */
    }
  }

  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      attempts.push(JSON.parse(arrMatch[0]));
    } catch {
      /* noop */
    }
  }

  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      attempts.push(JSON.parse(objMatch[0]));
    } catch {
      /* noop */
    }
  }

  for (const candidate of attempts) {
    const list = Array.isArray(candidate)
      ? candidate
      : isSuggestionLike(candidate) && Array.isArray(candidate.suggestions)
        ? (candidate.suggestions as unknown[])
        : null;
    if (!list) continue;
    const normalized = list.map(normalize).filter((x): x is Suggestion => !!x);
    // dedupe before the length check or two colliding titles collapse to 2
    const deduped = dedupeByTitle(normalized);
    if (deduped.length >= 3) {
      return deduped.slice(0, 3);
    }
  }

  throw new Error("Could not parse 3 valid suggestions from model output.");
}

export function dedupeByTitle(items: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const item of items) {
    const key = item.title.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function recentTitles(batches: { items: Suggestion[] }[], limit = 9): string[] {
  const titles: string[] = [];
  for (const b of batches) {
    for (const s of b.items) {
      titles.push(s.title);
      if (titles.length >= limit) return titles;
    }
  }
  return titles;
}
