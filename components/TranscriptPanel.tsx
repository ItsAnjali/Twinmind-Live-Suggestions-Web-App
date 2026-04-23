"use client";

import { useEffect, useRef, useState } from "react";
import { formatClockRange } from "@/lib/utils";
import type { TranscriptChunk } from "@/types";

interface Props {
  chunks: TranscriptChunk[];
  isTranscribing: boolean;
}

const STICK_THRESHOLD_PX = 64;

function formatOffset(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TranscriptPanel({ chunks, isTranscribing }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // don't yank the user to the bottom if they've scrolled up to re-read
  const [stickToBottom, setStickToBottom] = useState(true);

  const origin = chunks[0]?.startedAt ?? 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottom) return;
    el.scrollTop = el.scrollHeight;
  }, [chunks.length, isTranscribing, stickToBottom]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    setStickToBottom(distanceFromBottom <= STICK_THRESHOLD_PX);
  }

  function jumpToBottom() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setStickToBottom(true);
  }

  return (
    <section className="relative flex h-full flex-col overflow-hidden rounded-lg border border-white/5 bg-surface-soft">
      <header className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-200">Transcript</h2>
        <span className="text-xs text-slate-500">
          {chunks.length} chunk{chunks.length === 1 ? "" : "s"}
        </span>
      </header>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="relative flex-1 space-y-3 overflow-y-auto px-4 py-3"
      >
        {chunks.length === 0 && !isTranscribing && (
          <p className="text-sm text-slate-500">
            No transcript yet. Click <span className="text-slate-300">Start listening</span> and
            begin speaking — chunks are transcribed every ~30 seconds.
          </p>
        )}
        {chunks.map((c) => (
          <article key={c.id} className="rounded-md bg-surface-muted/60 px-3 py-2">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-slate-500">
              <span className="rounded bg-surface-soft px-1.5 py-0.5 font-mono text-slate-300">
                {formatOffset(c.startedAt - origin)}
              </span>
              <span>{formatClockRange(c.startedAt, c.endedAt)}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
              {c.text}
            </p>
          </article>
        ))}
        {isTranscribing && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent-soft" />
            Transcribing chunk…
          </div>
        )}
      </div>
      {!stickToBottom && chunks.length > 0 && (
        <button
          type="button"
          onClick={jumpToBottom}
          className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-surface-muted/90 px-3 py-1 text-xs text-slate-200 shadow-lg backdrop-blur hover:bg-surface-muted"
        >
          ↓ Jump to latest
        </button>
      )}
    </section>
  );
}
