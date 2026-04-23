"use client";

import { SuggestionCard } from "@/components/SuggestionCard";
import { formatTime } from "@/lib/utils";
import type { Suggestion, SuggestionBatch } from "@/types";

interface Props {
  batches: SuggestionBatch[];
  isRefreshing: boolean;
  isChatBusy: boolean;
  error?: string | null;
  onSuggestionClick: (s: Suggestion) => void;
}

export function SuggestionsPanel({
  batches,
  isRefreshing,
  isChatBusy,
  error,
  onSuggestionClick,
}: Props) {
  return (
    <section className="flex h-full flex-col overflow-hidden rounded-lg border border-white/5 bg-surface-soft">
      <header className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-200">Live suggestions</h2>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {isRefreshing ? (
            <span className="inline-flex items-center gap-1 text-accent-soft">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent-soft" />
              Refreshing…
            </span>
          ) : (
            <span>{batches.length} batch{batches.length === 1 ? "" : "es"}</span>
          )}
        </div>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {error && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
            {error}
          </div>
        )}
        {batches.length === 0 && !isRefreshing && !error && (
          <p className="text-sm text-slate-500">
            Suggestions will appear here ~every 30 seconds while recording. A fresh batch
            of exactly 3 is pinned at the top; older batches stay below for review.
          </p>
        )}
        {batches.map((batch, idx) => (
          <div key={batch.id} className="space-y-2">
            <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-500">
              <span>
                {idx === 0 ? "Latest · " : ""}Batch @ {formatTime(batch.createdAt)}
              </span>
              <span>{batch.items.length} suggestions</span>
            </div>
            <div className="space-y-2">
              {batch.items.slice(0, 3).map((item, i) => (
                <SuggestionCard
                  key={`${batch.id}-${i}`}
                  suggestion={item}
                  onClick={onSuggestionClick}
                  disabled={isChatBusy}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
