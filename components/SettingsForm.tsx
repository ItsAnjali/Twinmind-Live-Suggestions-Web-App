"use client";

import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS } from "@/lib/prompts";
import type { Settings } from "@/types";

const STORAGE_KEY = "twinmind.settings";

export function loadSettings(): Settings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function SettingsForm() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function onSave() {
    saveSettings(settings);
    setStatus("Saved. New requests will use these settings.");
    setTimeout(() => setStatus(null), 2500);
  }

  function onReset() {
    setSettings({ ...DEFAULT_SETTINGS });
    saveSettings({ ...DEFAULT_SETTINGS });
    setStatus("Defaults restored.");
    setTimeout(() => setStatus(null), 2500);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-sky-500/20 bg-sky-500/5 p-3 text-xs text-sky-200">
        <strong className="font-semibold">Bring your own Groq API key.</strong> It is
        stored in this browser&apos;s <code className="font-mono">localStorage</code> only
        and sent to our server on each request via the <code className="font-mono">x-groq-key</code> header.
        It is never logged and never persisted server-side. Get a key at{" "}
        <a
          href="https://console.groq.com/keys"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-sky-100"
        >
          console.groq.com/keys
        </a>
        .
      </div>

      <label className="block space-y-1">
        <div className="text-sm font-medium text-slate-200">Groq API key</div>
        <div className="text-xs text-slate-500">
          Starts with <code className="font-mono">gsk_</code>. Required.
        </div>
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={settings.apiKey}
          onChange={(e) => update("apiKey", e.target.value.trim())}
          placeholder="gsk_..."
          className="w-full rounded-md border border-white/10 bg-surface-muted px-3 py-2 font-mono text-xs text-slate-100 focus:border-accent/50 focus:outline-none"
        />
      </label>

      <PromptField
        label="Live suggestions prompt"
        value={settings.livePrompt}
        onChange={(v) => update("livePrompt", v)}
        hint="Controls how the 3 live suggestions are generated every ~30 seconds."
      />
      <PromptField
        label="Detailed answer prompt"
        value={settings.detailedPrompt}
        onChange={(v) => update("detailedPrompt", v)}
        hint="Used when a suggestion is clicked for an in-depth answer."
      />
      <PromptField
        label="Chat prompt"
        value={settings.chatPrompt}
        onChange={(v) => update("chatPrompt", v)}
        hint="Base persona for the chat panel — applied to both clicks and typed questions."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NumberField
          label="Live suggestion transcript window (seconds)"
          value={settings.liveWindowSec}
          min={30}
          max={900}
          step={30}
          onChange={(v) => update("liveWindowSec", v)}
        />
        <NumberField
          label="Detailed answer transcript window (seconds)"
          value={settings.detailedWindowSec}
          min={60}
          max={3600}
          step={60}
          onChange={(v) => update("detailedWindowSec", v)}
        />
        <NumberField
          label="Max tokens"
          value={settings.maxTokens}
          min={200}
          max={4000}
          step={50}
          onChange={(v) => update("maxTokens", v)}
        />
        <NumberField
          label="Temperature"
          value={settings.temperature}
          min={0}
          max={1}
          step={0.05}
          onChange={(v) => update("temperature", v)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-soft"
        >
          Save settings
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-white/10 bg-surface-soft px-3 py-2 text-sm text-slate-200 hover:bg-surface-muted"
        >
          Reset to defaults
        </button>
        {status && <span className="text-xs text-emerald-300">{status}</span>}
      </div>
    </div>
  );
}

function PromptField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint: string;
}) {
  return (
    <label className="block space-y-2">
      <div>
        <div className="text-sm font-medium text-slate-200">{label}</div>
        <div className="text-xs text-slate-500">{hint}</div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        className="w-full resize-y rounded-md border border-white/10 bg-surface-muted p-3 font-mono text-xs text-slate-100 focus:border-accent/50 focus:outline-none"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block space-y-1">
      <div className="text-sm font-medium text-slate-200">{label}</div>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
        className="w-full rounded-md border border-white/10 bg-surface-muted px-3 py-2 text-sm text-slate-100 focus:border-accent/50 focus:outline-none"
      />
    </label>
  );
}
