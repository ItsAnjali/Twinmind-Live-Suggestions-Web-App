"use client";

import { buildExportBundle, downloadExport } from "@/lib/export";
import type { ChatMessage, SuggestionBatch, TranscriptChunk } from "@/types";

interface Props {
  transcript: TranscriptChunk[];
  suggestionBatches: SuggestionBatch[];
  chat: ChatMessage[];
}

export function ExportButton({ transcript, suggestionBatches, chat }: Props) {
  const empty =
    transcript.length === 0 && suggestionBatches.length === 0 && chat.length === 0;

  function onClick() {
    const bundle = buildExportBundle({ transcript, suggestionBatches, chat });
    downloadExport(bundle);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={empty}
      className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-surface-soft px-3 py-2 text-sm text-slate-200 hover:bg-surface-muted disabled:opacity-50"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Export JSON
    </button>
  );
}
