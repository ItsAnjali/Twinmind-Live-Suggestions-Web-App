"use client";

import { cn } from "@/lib/utils";

interface Props {
  isRecording: boolean;
  isRefreshing: boolean;
  disabled?: boolean;
  micError?: string | null;
  onStart: () => void;
  onStop: () => void;
  onRefresh: () => void;
  statusText?: string;
}

export function MicControls({
  isRecording,
  isRefreshing,
  disabled,
  micError,
  onStart,
  onStop,
  onRefresh,
  statusText,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {!isRecording ? (
        <button
          type="button"
          onClick={onStart}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-accent-soft disabled:opacity-50"
        >
          <span className="h-2 w-2 rounded-full bg-white/90" />
          Start listening
        </button>
      ) : (
        <button
          type="button"
          onClick={onStop}
          className="inline-flex items-center gap-2 rounded-md bg-red-500/90 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-500"
        >
          <span className="h-2 w-2 rounded-sm bg-white" />
          Stop
        </button>
      )}

      <button
        type="button"
        onClick={onRefresh}
        disabled={disabled || isRefreshing}
        className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-surface-soft px-3 py-2 text-sm text-slate-200 hover:bg-surface-muted disabled:opacity-50"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" className={cn(isRefreshing && "animate-spin")}>
          <path
            fill="currentColor"
            d="M12 5V2L7 7l5 5V8a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"
          />
        </svg>
        {isRefreshing ? "Refreshing…" : "Refresh suggestions"}
      </button>

      {isRecording ? (
        <span className="inline-flex items-center gap-2 text-sm text-slate-300">
          <span className="recording-dot" />
          <span>{statusText || "Listening…"}</span>
        </span>
      ) : statusText ? (
        <span className="text-sm text-slate-400">{statusText}</span>
      ) : null}

      {micError && (
        <span className="text-sm text-red-300">{micError}</span>
      )}
    </div>
  );
}
