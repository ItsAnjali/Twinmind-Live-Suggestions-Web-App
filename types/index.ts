export type SuggestionType =
  | "question_to_ask"
  | "concise_answer"
  | "talking_point"
  | "fact_check"
  | "clarification";

export interface Suggestion {
  type: SuggestionType;
  title: string;
  preview: string;
  why: string;
}

export interface SuggestionBatch {
  id: string;
  createdAt: number;
  items: Suggestion[];
}

export interface TranscriptChunk {
  id: string;
  text: string;
  startedAt: number;
  endedAt: number;
}

export type ChatRole = "user" | "assistant" | "system-suggestion";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  suggestion?: Suggestion;
}

export interface Settings {
  apiKey: string;
  livePrompt: string;
  detailedPrompt: string;
  chatPrompt: string;
  liveWindowSec: number;
  detailedWindowSec: number;
  maxTokens: number;
  temperature: number;
  suggestionsModel: string;
  chatModel: string;
  transcribeModel: string;
}

export interface ExportBundle {
  exportedAt: number;
  transcript: TranscriptChunk[];
  suggestionBatches: SuggestionBatch[];
  chat: ChatMessage[];
}
