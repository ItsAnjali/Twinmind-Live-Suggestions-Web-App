import type { TranscriptChunk } from "@/types";

export function buildTranscriptWindow(
  chunks: TranscriptChunk[],
  windowSec: number
): string {
  if (!Array.isArray(chunks) || chunks.length === 0) return "";
  const last = chunks[chunks.length - 1];
  if (!last) return "";
  const now = last.endedAt;
  const cutoff = now - Math.max(30, windowSec) * 1000;
  const picked: TranscriptChunk[] = [];
  for (let i = chunks.length - 1; i >= 0; i--) {
    const c = chunks[i];
    if (c.endedAt < cutoff && picked.length > 0) break;
    picked.unshift(c);
  }
  return picked.map((c) => c.text.trim()).filter(Boolean).join("\n");
}
