"use client";

import { useEffect, useRef, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { cn, formatTime } from "@/lib/utils";
import type { ChatMessage } from "@/types";

interface Props {
  chat: ChatMessage[];
  isBusy: boolean;
  error?: string | null;
  onSend: (text: string) => void;
}

export function ChatPanel({ chat, isBusy, error, onSend }: Props) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.length, isBusy]);

  function submit() {
    const text = draft.trim();
    if (!text || isBusy) return;
    setDraft("");
    onSend(text);
  }

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-lg border border-white/5 bg-surface-soft">
      <header className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-200">Chat</h2>
        <span className="text-xs text-slate-500">{chat.length} messages</span>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {chat.length === 0 && (
          <p className="text-sm text-slate-500">
            Click a suggestion on the left to get a detailed answer here, or type a
            question below. The session is kept in memory until you reload.
          </p>
        )}
        {chat.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {isBusy && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent-soft" />
            Thinking…
          </div>
        )}
        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
            {error}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-white/5 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Ask a question about the conversation…"
            rows={2}
            className="flex-1 resize-none rounded-md border border-white/10 bg-surface-muted px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-accent/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={submit}
            disabled={isBusy || !draft.trim()}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-soft disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </section>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSugg = message.role === "system-suggestion";
  const isAssistant = !isUser && !isSugg;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  return (
    <div
      className={cn(
        "group flex flex-col",
        isUser || isSugg ? "items-end" : "items-start"
      )}
    >
      <div
        className={cn(
          "relative max-w-[92%] rounded-lg px-3 py-2 text-sm leading-relaxed",
          isUser && "bg-accent text-white",
          isSugg && "border border-accent/40 bg-accent/15 text-accent-soft",
          isAssistant && "bg-surface-muted text-slate-100"
        )}
      >
        {isSugg && message.suggestion ? (
          <div>
            <div className="text-[10px] uppercase tracking-wide opacity-70">
              Selected suggestion
            </div>
            <div className="mt-1 font-semibold">{message.suggestion.title}</div>
            <div className="text-slate-200/90">{message.suggestion.preview}</div>
          </div>
        ) : isUser ? (
          <div className="whitespace-pre-wrap break-words text-sm">
            {message.content}
          </div>
        ) : (
          <div
            className="prose-chat break-words text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
          />
        )}
        {isAssistant && (
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? "Copied" : "Copy reply"}
            className={cn(
              "absolute -top-2 -right-2 rounded-md border border-white/10 bg-surface-soft px-2 py-0.5 text-[10px] text-slate-300 shadow transition",
              "opacity-0 group-hover:opacity-100 focus:opacity-100",
              copied && "text-emerald-300"
            )}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
      <span className="mt-1 text-[10px] text-slate-500">
        {formatTime(message.createdAt)}
      </span>
    </div>
  );
}
