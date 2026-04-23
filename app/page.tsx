"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { ExportButton } from "@/components/ExportButton";
import { MicControls } from "@/components/MicControls";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { TranscriptPanel } from "@/components/TranscriptPanel";
import { loadSettings } from "@/components/SettingsForm";
import { ChunkRecorder, mimeToExtension } from "@/lib/audio";
import { DEFAULT_SETTINGS } from "@/lib/prompts";
import { buildTranscriptWindow } from "@/lib/transcriptWindow";
import { genId } from "@/lib/utils";
import type {
  ChatMessage,
  Settings,
  Suggestion,
  SuggestionBatch,
  TranscriptChunk,
} from "@/types";

const REFRESH_INTERVAL_MS = 30_000;

export default function HomePage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isRecording, setIsRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const [chunks, setChunks] = useState<TranscriptChunk[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const [batches, setBatches] = useState<SuggestionBatch[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [isChatBusy, setIsChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [globalError, setGlobalError] = useState<string | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const chunksRef = useRef<TranscriptChunk[]>([]);
  const batchesRef = useRef<SuggestionBatch[]>([]);
  const settingsRef = useRef<Settings>(settings);
  useEffect(() => {
    chunksRef.current = chunks;
  }, [chunks]);
  useEffect(() => {
    batchesRef.current = batches;
  }, [batches]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const recorderRef = useRef<ChunkRecorder | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // sync guard — state flag lags a render so rapid triggers could overlap
  const refreshInFlightRef = useRef(false);
  const refreshPendingRef = useRef(false);

  const authHeaders = useCallback((): Record<string, string> => {
    const key = settingsRef.current.apiKey?.trim();
    return key ? { "x-groq-key": key } : {};
  }, []);

  const noKey = !settings.apiKey?.trim();

  const refreshSuggestions = useCallback(
    async (overrideChunks?: TranscriptChunk[]) => {
      // button onClick passes a MouseEvent; only accept real arrays
      const sourceChunks = Array.isArray(overrideChunks)
        ? overrideChunks
        : chunksRef.current;
      const transcriptWindow = buildTranscriptWindow(
        sourceChunks,
        settingsRef.current.liveWindowSec
      );
      if (!transcriptWindow.trim() || sourceChunks.length === 0) {
        return;
      }
      if (refreshInFlightRef.current) {
        refreshPendingRef.current = true;
        return;
      }
      refreshInFlightRef.current = true;
      setIsRefreshing(true);
      setSuggestionsError(null);
      try {
        const prev = batchesRef.current.flatMap((b) => b.items).slice(0, 12);
        const res = await fetch("/api/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            transcriptWindow,
            previousSuggestions: prev,
            settings: settingsRef.current,
          }),
        });
        const data = (await res.json()) as {
          batch?: SuggestionBatch;
          error?: string;
        };
        if (!res.ok || !data.batch) {
          throw new Error(data.error || `Request failed (${res.status})`);
        }
        setBatches((prev) => [data.batch!, ...prev]);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to refresh suggestions.";
        setSuggestionsError(msg);
        if (/groq api key|missing groq/i.test(msg)) setGlobalError(msg);
      } finally {
        setIsRefreshing(false);
        refreshInFlightRef.current = false;
        if (refreshPendingRef.current) {
          refreshPendingRef.current = false;
          void refreshSuggestionsRef.current?.();
        }
      }
    },
    [authHeaders]
  );
  const refreshSuggestionsRef = useRef<typeof refreshSuggestions>(refreshSuggestions);
  useEffect(() => {
    refreshSuggestionsRef.current = refreshSuggestions;
  }, [refreshSuggestions]);

  const transcribeChunk = useCallback(
    async (blob: Blob, startedAt: number, endedAt: number) => {
      setIsTranscribing(true);
      try {
        const ext = mimeToExtension(blob.type);
        const file = new File([blob], `chunk-${startedAt}.${ext}`, {
          type: blob.type || "audio/webm",
        });
        const form = new FormData();
        form.append("file", file);
        form.append("model", settingsRef.current.transcribeModel);
        const res = await fetch("/api/transcribe", {
          method: "POST",
          headers: { ...authHeaders() },
          body: form,
        });
        const data = (await res.json()) as { text?: string; error?: string };
        if (!res.ok)
          throw new Error(data.error || `Transcription failed (${res.status})`);
        const text = (data.text ?? "").trim();
        if (text) {
          const chunk: TranscriptChunk = {
            id: genId("chunk"),
            text,
            startedAt,
            endedAt,
          };
          const nextChunks = [...chunksRef.current, chunk];
          chunksRef.current = nextChunks;
          setChunks(nextChunks);
          void refreshSuggestions(nextChunks);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transcription failed.";
        setSuggestionsError(msg);
        if (/groq api key|missing groq/i.test(msg)) setGlobalError(msg);
      } finally {
        setIsTranscribing(false);
      }
    },
    [authHeaders, refreshSuggestions]
  );

  const start = useCallback(async () => {
    if (noKey) {
      setGlobalError(
        "Paste your Groq API key in Settings before starting the mic."
      );
      return;
    }
    setMicError(null);
    try {
      const rec = new ChunkRecorder({
        onChunk: (blob, startedAt, endedAt) =>
          transcribeChunk(blob, startedAt, endedAt),
        onError: (err) => setMicError(err.message),
      });
      await rec.start();
      recorderRef.current = rec;
      setIsRecording(true);
      // safety net in case a chunk transcription fails
      intervalRef.current = setInterval(() => {
        void refreshSuggestions();
      }, REFRESH_INTERVAL_MS);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Microphone permission denied.";
      setMicError(
        /permission|denied|notallowed/i.test(msg)
          ? "Microphone permission denied. Allow mic access in the browser and retry."
          : msg
      );
    }
  }, [noKey, refreshSuggestions, transcribeChunk]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRecording(false);
  }, []);

  useEffect(
    () => () => {
      recorderRef.current?.stop();
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    []
  );

  const runChat = useCallback(
    async (payload: {
      userMessage?: string;
      selectedSuggestion?: Suggestion;
      prepared?: ChatMessage[];
    }) => {
      const historyBase = payload.prepared ?? chat;
      setIsChatBusy(true);
      setChatError(null);
      try {
        const transcriptWindow = buildTranscriptWindow(
          chunksRef.current,
          settingsRef.current.detailedWindowSec
        );
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            transcriptWindow,
            chatHistory: historyBase,
            userMessage: payload.userMessage,
            selectedSuggestion: payload.selectedSuggestion,
            settings: settingsRef.current,
          }),
        });
        const data = (await res.json()) as {
          message?: ChatMessage;
          error?: string;
        };
        if (!res.ok || !data.message) {
          throw new Error(data.error || `Chat failed (${res.status})`);
        }
        setChat((prev) => [...prev, data.message!]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Chat failed.";
        setChatError(msg);
        if (/groq api key|missing groq/i.test(msg)) setGlobalError(msg);
      } finally {
        setIsChatBusy(false);
      }
    },
    [authHeaders, chat]
  );

  const onSuggestionClick = useCallback(
    (s: Suggestion) => {
      if (isChatBusy) return;
      const entry: ChatMessage = {
        id: genId("msg"),
        role: "system-suggestion",
        content: `${s.title} — ${s.preview}`,
        createdAt: Date.now(),
        suggestion: s,
      };
      const nextHistory = [...chat, entry];
      setChat(nextHistory);
      // pass PRIOR history — the suggestion is sent separately, duplicating it caused empty replies
      runChat({ selectedSuggestion: s, prepared: chat });
    },
    [chat, isChatBusy, runChat]
  );

  // if recording, flush the in-flight audio first so the transcript is up to
  // date before the next suggestion batch fires via the per-chunk pipeline.
  const manualRefresh = useCallback(() => {
    if (recorderRef.current?.isActive) {
      recorderRef.current.flushNow();
    } else {
      void refreshSuggestions();
    }
  }, [refreshSuggestions]);

  const onChatSend = useCallback(
    (text: string) => {
      const entry: ChatMessage = {
        id: genId("msg"),
        role: "user",
        content: text,
        createdAt: Date.now(),
      };
      const nextHistory = [...chat, entry];
      setChat(nextHistory);
      runChat({ userMessage: text, prepared: nextHistory });
    },
    [chat, runChat]
  );

  const statusText = useMemo(() => {
    if (isTranscribing) return "Transcribing chunk…";
    if (isRefreshing) return "Refreshing suggestions…";
    if (isChatBusy) return "Generating answer…";
    if (isRecording) return "Listening…";
    return "Idle";
  }, [isRecording, isRefreshing, isTranscribing, isChatBusy]);

  return (
    <main className="flex min-h-screen flex-col">
      <header className="border-b border-white/5 bg-surface-soft/80 px-6 py-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">
              Twinmind · Live Audio Suggestions
            </h1>
            <p className="text-xs text-slate-500">
              Listens to your mic, transcribes with Whisper, surfaces 3 fresh
              suggestions every ~30s. Bring your own Groq key in Settings.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ExportButton
              transcript={chunks}
              suggestionBatches={batches}
              chat={chat}
            />
            <Link
              href="/settings"
              className="rounded-md border border-white/10 bg-surface-soft px-3 py-2 text-sm text-slate-200 hover:bg-surface-muted"
            >
              Settings
            </Link>
          </div>
        </div>
        <div className="mt-4">
          <MicControls
            isRecording={isRecording}
            isRefreshing={isRefreshing}
            disabled={noKey || (isTranscribing && !isRecording)}
            micError={micError}
            onStart={start}
            onStop={stop}
            onRefresh={manualRefresh}
            statusText={statusText}
          />
        </div>
        {noKey && !globalError && (
          <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            No Groq API key set.{" "}
            <Link
              href="/settings"
              className="font-semibold underline hover:text-amber-100"
            >
              Open Settings
            </Link>{" "}
            and paste your key to begin.
          </div>
        )}
        {globalError && (
          <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {globalError}
          </div>
        )}
      </header>

      <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-h-[60vh] lg:min-h-0">
          <TranscriptPanel chunks={chunks} isTranscribing={isTranscribing} />
        </div>
        <div className="min-h-[60vh] lg:min-h-0">
          <SuggestionsPanel
            batches={batches}
            isRefreshing={isRefreshing}
            isChatBusy={isChatBusy}
            error={suggestionsError}
            onSuggestionClick={onSuggestionClick}
          />
        </div>
        <div className="min-h-[60vh] lg:min-h-0">
          <ChatPanel
            chat={chat}
            isBusy={isChatBusy}
            error={chatError}
            onSend={onChatSend}
          />
        </div>
      </div>
    </main>
  );
}
