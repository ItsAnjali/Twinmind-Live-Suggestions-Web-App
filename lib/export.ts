"use client";

import type { ChatMessage, ExportBundle, SuggestionBatch, TranscriptChunk } from "@/types";

export function buildExportBundle(state: {
  transcript: TranscriptChunk[];
  suggestionBatches: SuggestionBatch[];
  chat: ChatMessage[];
}): ExportBundle {
  return {
    exportedAt: Date.now(),
    transcript: state.transcript,
    suggestionBatches: state.suggestionBatches,
    chat: state.chat,
  };
}

export function downloadExport(bundle: ExportBundle): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const ts = new Date(bundle.exportedAt)
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);
  a.href = url;
  a.download = `twinmind-session-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
