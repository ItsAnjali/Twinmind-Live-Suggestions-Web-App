"use client";

export const CHUNK_MS = 30_000;

const PREFERRED_MIMES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

export function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const mime of PREFERRED_MIMES) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      /* noop */
    }
  }
  return undefined;
}

export function mimeToExtension(mime?: string): string {
  if (!mime) return "webm";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("mpeg")) return "mp3";
  return "webm";
}

export interface ChunkRecorderHandlers {
  onChunk: (blob: Blob, startedAt: number, endedAt: number) => void;
  onError?: (err: Error) => void;
}

interface Segment {
  recorder: MediaRecorder;
  parts: Blob[];
  startedAt: number;
}

// Overlaps MediaRecorder instances on one MediaStream so each emitted Blob is
// a complete webm file (timeslice chunks lose the container header after #1)
// and no audio is lost in the stop/start handoff.
export class ChunkRecorder {
  private stream: MediaStream | null = null;
  private current: Segment | null = null;
  private mimeType: string | undefined;
  private rotateTimer: ReturnType<typeof setTimeout> | null = null;
  private active = false;

  constructor(private readonly handlers: ChunkRecorderHandlers) {}

  async start(): Promise<void> {
    if (this.active) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    this.mimeType = pickSupportedMimeType();
    this.active = true;
    this.current = this.spawnSegment();
    this.scheduleRotate();
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    if (this.rotateTimer) {
      clearTimeout(this.rotateTimer);
      this.rotateTimer = null;
    }
    const final = this.current;
    this.current = null;
    try {
      final?.recorder.stop();
    } catch {
      /* noop */
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  get isActive() {
    return this.active;
  }

  flushNow(): void {
    if (!this.active || !this.stream) return;
    if (this.rotateTimer) {
      clearTimeout(this.rotateTimer);
      this.rotateTimer = null;
    }
    this.rotate();
  }

  private spawnSegment(): Segment {
    if (!this.stream) throw new Error("No active stream");
    const rec = new MediaRecorder(
      this.stream,
      this.mimeType ? { mimeType: this.mimeType } : undefined
    );
    const segment: Segment = {
      recorder: rec,
      parts: [],
      startedAt: Date.now(),
    };
    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) segment.parts.push(ev.data);
    };
    rec.onerror = (ev) => {
      this.handlers.onError?.(
        new Error(
          (ev as unknown as { error?: { message?: string } }).error?.message ||
            "MediaRecorder error"
        )
      );
    };
    rec.onstop = () => this.emit(segment);
    rec.start();
    return segment;
  }

  private scheduleRotate() {
    this.rotateTimer = setTimeout(() => this.rotate(), CHUNK_MS);
  }

  private rotate() {
    if (!this.active || !this.stream) return;
    const outgoing = this.current;
    // start the next segment BEFORE stopping the old one, otherwise we lose
    // ~50-200ms of audio in the handoff
    this.current = this.spawnSegment();
    this.scheduleRotate();
    try {
      outgoing?.recorder.stop();
    } catch (err) {
      this.handlers.onError?.(err as Error);
    }
  }

  private emit(segment: Segment) {
    const endedAt = Date.now();
    const type = segment.recorder.mimeType || this.mimeType || "audio/webm";
    const blob = new Blob(segment.parts, { type });
    segment.parts = [];
    if (blob.size > 0) {
      try {
        this.handlers.onChunk(blob, segment.startedAt, endedAt);
      } catch (err) {
        this.handlers.onError?.(err as Error);
      }
    }
  }
}
