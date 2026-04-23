"use client";

import { cn } from "@/lib/utils";
import type { Suggestion, SuggestionType } from "@/types";

const TYPE_LABELS: Record<SuggestionType, string> = {
  question_to_ask: "Ask next",
  concise_answer: "Quick answer",
  talking_point: "Talking point",
  fact_check: "Fact check",
  clarification: "Clarify",
};

const TYPE_STYLES: Record<SuggestionType, string> = {
  question_to_ask: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  concise_answer: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  talking_point: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  fact_check: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  clarification: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
};

interface Props {
  suggestion: Suggestion;
  onClick: (s: Suggestion) => void;
  disabled?: boolean;
}

export function SuggestionCard({ suggestion, onClick, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={() => onClick(suggestion)}
      disabled={disabled}
      className={cn(
        "group w-full rounded-lg border border-white/5 bg-surface-muted/70 p-3 text-left transition",
        "hover:border-accent/40 hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        "disabled:cursor-not-allowed disabled:opacity-50"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] font-medium uppercase tracking-wide",
            TYPE_STYLES[suggestion.type]
          )}
        >
          {TYPE_LABELS[suggestion.type]}
        </span>
        <span className="text-[10px] text-slate-500 group-hover:text-slate-300">
          Open in chat →
        </span>
      </div>
      <h3 className="mt-2 text-sm font-semibold text-slate-100">
        {suggestion.title}
      </h3>
      <p className="mt-1 text-sm leading-snug text-slate-300">
        {suggestion.preview}
      </p>
      {suggestion.why && (
        <p className="mt-2 text-[11px] italic text-slate-500">
          Why: {suggestion.why}
        </p>
      )}
    </button>
  );
}
