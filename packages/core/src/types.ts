export type Source = "ai" | "agent" | "answer" | "human";

export type Paragraph = {
  id: number;
  position: number;
  text: string;
  source: Source;
  aiScore: number | null;
  question: string | null;
  answer: string | null;
};

export type Score = {
  human: number;
  ai: number;
  assisted: number;
  demo: boolean;
  firstHuman: number;
  checks: number;
};

export type Post = {
  id: number;
  title: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
  paragraphs: Paragraph[];
  score: Score | null;
  agentConnected: boolean;
};

export type PostSummary = {
  id: number;
  title: string;
  updatedAt: number;
  human: number | null;
  preview: { text: string; flagged: boolean }[];
  notes: string;
};

export type ExportFormat = "markdown" | "docx" | "pdf";

export const FLAG_THRESHOLD = 0.5;

export function isFlagged(p: Pick<Paragraph, "aiScore">): boolean {
  return p.aiScore !== null && p.aiScore >= FLAG_THRESHOLD;
}
