# Twinmind — Live Audio Suggestions

A Next.js (App Router) + TypeScript + Tailwind web app that listens to your microphone, transcribes audio in ~30 second chunks using Groq Whisper, and continuously surfaces **exactly 3 fresh, context-aware suggestions** every ~30 seconds from `openai/gpt-oss-120b`. Click a suggestion (or type a question) to get a detailed answer in the chat panel on the right.

Three-column layout: **Transcript · Live suggestions · Chat**. No database. No auth. No persistence across reloads — only your local settings (prompts, windows, and your own Groq API key) live in `localStorage`.

---

## Quick start

```bash
git clone <this-repo>
cd Twinmind
npm install
npm run dev
# open http://localhost:3000
```

On first load, open **Settings**, paste your Groq API key (get one at <https://console.groq.com/keys>), and hit **Save**. Then go back to the main page and click **Start listening**.

No server-side environment variables are required. The app is fully BYO-key.

---

## Deploy to Vercel

1. Push this folder to a public GitHub repo.
2. Import it in [Vercel](https://vercel.com/new) — no environment variables needed.
3. Open the deployed URL, paste your key in Settings, and start.

> Optional: you can set `GROQ_API_KEY` on Vercel as a **fallback** for local-dev convenience. Any key supplied by the browser via the `x-groq-key` header takes precedence, so the per-user BYO-key flow still works on the deployed app.

---

## How the API key is handled

- Entered in `/settings`, stored **only in the browser's `localStorage`**.
- Sent on every API call via a custom `x-groq-key` request header.
- Forwarded only to Groq (`https://api.groq.com/...`) from the Next.js route handlers.
- Never logged, never persisted server-side, never written to any database.

This matches the assignment's "Settings screen where the user pastes their own Groq API key. Do not hard-code or ship a key."

---

## Stack choices

| Area | Choice | Why |
|------|--------|-----|
| Framework | Next.js 15 App Router | Unified frontend + server routes, easy Vercel deploy. |
| Language | TypeScript (strict) | Safer refactors. |
| Styling | Tailwind CSS | Fast, zero-runtime. |
| Transcription | `whisper-large-v3` via Groq | Required by the assignment. |
| Suggestions + chat | `openai/gpt-oss-120b` via Groq | Required by the assignment; supports strict JSON output. |
| Audio capture | `MediaRecorder` w/ rotating segments | Each 30s chunk is a standalone WebM file. |
| State | React `useState` / refs | No DB, no persistence required. |

---

## Prompt strategy

Defaults live in [`lib/prompts.ts`](lib/prompts.ts); every prompt is overridable in `/settings`.

- **Live suggestions prompt** enforces a strict JSON shape (`{"suggestions":[…3…]}`), explicit rules for the 5 allowed `type` values (`question_to_ask`, `concise_answer`, `talking_point`, `fact_check`, `clarification`), a ban on generic filler ("keep the conversation going", "ask more questions"), and a requirement to vary types across the batch. The recent transcript window is passed as a fenced block. Previously-surfaced suggestion titles are passed so the model avoids repeats.
- **Detailed-answer prompt** biases toward a tight opening sentence + 2–3 short bullets, explicit uncertainty when the transcript lacks evidence, and one follow-up question suggestion. It is stacked on top of a concise chat persona.
- **Chat prompt** resolves pronouns against the most recent transcript context and treats a clicked suggestion's `title` + `preview` as the user's intent rather than something to re-explain.

Parsing is defensive ([`lib/validators.ts`](lib/validators.ts)): `JSON.parse` → code-fence strip → `[…]` extraction → `{…}` extraction → coerce to the allowed `type` enum → dedupe by title → require ≥ 3. The render layer also slices to 3.

## Context-window strategy

- **Live suggestions** use a short rolling window (default **180 s**). Short window = timely, specific suggestions grounded in what was *just* said.
- **Detailed answers & chat** use a larger window (default **600 s**) so clicked suggestions and typed questions get enough depth.
- Windows are built from transcript chunk timestamps ([`lib/transcriptWindow.ts`](lib/transcriptWindow.ts)), not token counts, since Whisper chunks are ~30 s of real speech each.
- Both windows are capped before sending to the model to bound request size.

Both windows are editable in `/settings`.

---

## Audio chunking — the tricky part

Naïve `MediaRecorder.start(30000)` emits chunks that **only include the WebM container header in the first chunk**. Every later chunk is a raw fragment Whisper (or any decoder) rejects with `"could not process file — is it a valid media file?"`.

The [`ChunkRecorder`](lib/audio.ts) in this project solves that by **overlapping** `MediaRecorder` instances on the same `MediaStream`:

1. Every 30 s, start a **new** `MediaRecorder` on the existing mic stream first.
2. *Then* stop the previous one. Its `onstop` handler flushes a complete, self-contained WebM blob (full header + body).
3. Starting before stopping guarantees no audio is dropped across the handoff — a subtle bug if you stop-then-start.

Each flushed blob is shipped to `/api/transcribe`, appended to the transcript, and triggers a `/api/suggestions` refresh.

---

## Tradeoffs

- **Per-chunk batches** mean a long session produces multiple batches pinned top-to-bottom. This matches the assignment (“refreshes automatically every ~30 seconds, new batch appears at the top, older batches stay visible below”).
- **Strict JSON validation at 3 items.** If the model returns fewer than 3 valid items, the route returns 502 and the UI keeps the previous batch and surfaces a banner. Skipping a batch is preferable to rendering junk.
- **No WebSocket streaming** for chat — answers arrive in one response. Simpler and fast enough at `gpt-oss-120b` latencies on Groq.
- **No dedicated `/api/export` route.** Export is built client-side from in-memory state; the server has nothing the client doesn't already have.
- **No persistence.** Reload clears transcript, suggestions, and chat. Settings (including your API key) persist in `localStorage`.

---

## Project structure

```
app/
  layout.tsx
  page.tsx                      # main 3-column UI
  settings/page.tsx             # prompts + params + API key
  api/
    transcribe/route.ts
    suggestions/route.ts
    chat/route.ts
components/                     # TranscriptPanel, SuggestionsPanel, ChatPanel,
                                # MicControls, SuggestionCard, SettingsForm,
                                # ExportButton
lib/
  groq.ts                       # Single source of Groq calls
  prompts.ts                    # Default prompts + settings
  validators.ts                 # JSON parsing & suggestion normalization
  audio.ts                      # Rotating MediaRecorder
  transcriptWindow.ts           # Rolling time-window helper
  export.ts                     # Client-side JSON export
  markdown.ts                   # Tiny safe markdown renderer for chat bubbles
  utils.ts
types/index.ts
```

---

## Scripts

```bash
npm run dev      # local dev on http://localhost:3000
npm run build    # production build
npm run start    # run production build
npm run lint     # next lint
```

---

## Sample screenshots

> _Add screenshots here before submitting:_
> - `docs/screenshot-main.png` — 3-column layout while recording
> - `docs/screenshot-suggestion-click.png` — clicked suggestion producing a detailed answer
> - `docs/screenshot-settings.png` — settings page with the API key field
