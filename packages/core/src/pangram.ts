import { requirePost, saveScores } from "./posts.ts";
import { isFlagged, type Paragraph, type Post } from "./types.ts";

const BASE_URL = "https://text.external-api.pangram.com";
const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 90_000;
const SEPARATOR = "\n\n";

type Window = { start: number; end: number; score: number };
type Detection = { text: string; human: number; ai: number; assisted: number; windows: Window[]; demo: boolean };

type PangramResult = {
  stage: string;
  headline?: string;
  text?: string;
  fraction_human?: number;
  fraction_ai?: number;
  fraction_ai_assisted?: number;
  windows?: { start_index: number; end_index: number; ai_assistance_score: number }[];
};

async function pangram(text: string, key: string): Promise<Detection> {
  const headers = { "Content-Type": "application/json", "x-api-key": key };
  const created = await fetch(`${BASE_URL}/task`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text, model: process.env.PANGRAM_MODEL ?? "pangram-4", public_dashboard_link: false }),
  });
  if (!created.ok) throw new Error(`Pangram rejected the request (${created.status}): ${await created.text()}`);
  const { task_id } = (await created.json()) as { task_id: string };

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const res = await fetch(`${BASE_URL}/task/${task_id}`, { headers });
    if (!res.ok) throw new Error(`Pangram task lookup failed (${res.status}): ${await res.text()}`);
    const result = (await res.json()) as PangramResult;
    if (result.stage === "STAGE_FAILED") throw new Error(`Pangram could not score this post: ${result.headline ?? "unknown error"}`);
    if (result.stage !== "STAGE_SUCCESS") continue;
    return {
      text: result.text ?? text,
      human: result.fraction_human ?? 0,
      ai: result.fraction_ai ?? 0,
      assisted: result.fraction_ai_assisted ?? 0,
      windows: (result.windows ?? []).map((w) => ({ start: w.start_index, end: w.end_index, score: w.ai_assistance_score })),
      demo: false,
    };
  }
  throw new Error("Pangram did not finish scoring within 90 seconds.");
}

const GENERIC_PHRASES = [
  "fast-paced",
  "landscape",
  "unlock",
  "leverage",
  "game-changer",
  "transformative",
  "empower",
  "meaningful impact",
  "in today's",
  "more important than ever",
  "seamless",
  "robust",
  "delve",
  "navigate",
  "embrace",
  "elevate",
  "across the board",
  "at the end of the day",
  "synergy",
  "journey",
];

function demoDetect(paragraphs: Paragraph[]): Detection {
  const text = paragraphs.map((p) => p.text).join(SEPARATOR);
  const windows: Window[] = [];
  let offset = 0;
  let aiChars = 0;
  for (const p of paragraphs) {
    const lower = p.text.toLowerCase();
    const hits = GENERIC_PHRASES.filter((phrase) => lower.includes(phrase)).length;
    const specific = /\d/.test(p.text) || /\b(I|we|our)\b/.test(p.text);
    const score = hits >= 2 ? 0.94 : hits === 1 ? (specific ? 0.42 : 0.86) : specific ? 0.06 : 0.31;
    windows.push({ start: offset, end: offset + p.text.length, score });
    if (score >= 0.5) aiChars += p.text.length;
    offset += p.text.length + SEPARATOR.length;
  }
  const total = Math.max(1, paragraphs.reduce((n, p) => n + p.text.length, 0));
  return { text, human: 1 - aiChars / total, ai: aiChars / total, assisted: 0, windows, demo: true };
}

function locateParagraphs(paragraphs: Paragraph[], scored: string): { start: number; end: number }[] {
  const original = paragraphs.map((p) => p.text).join(SEPARATOR);
  const ratio = scored.length / Math.max(1, original.length);
  let cursor = 0;
  let originalOffset = 0;
  return paragraphs.map((p) => {
    const needle = p.text.trim().slice(0, 48);
    const found = needle ? scored.indexOf(needle, cursor) : -1;
    const start = found >= 0 ? found : Math.round(originalOffset * ratio);
    const end = start + Math.round(p.text.length * (found >= 0 ? 1 : ratio));
    cursor = Math.max(cursor, end);
    originalOffset += p.text.length + SEPARATOR.length;
    return { start, end };
  });
}

function paragraphScore(range: { start: number; end: number }, windows: Window[]): number | null {
  let weighted = 0;
  let covered = 0;
  for (const w of windows) {
    const overlap = Math.min(range.end, w.end) - Math.max(range.start, w.start);
    if (overlap <= 0) continue;
    weighted += w.score * overlap;
    covered += overlap;
  }
  return covered > 0 ? weighted / covered : null;
}

export async function scorePost(postId: number): Promise<Post> {
  const post = requirePost(postId);
  if (post.paragraphs.length === 0) throw new Error("This post has no paragraphs to score yet.");
  const key = process.env.PANGRAM_API_KEY;
  const detection = key ? await pangram(post.paragraphs.map((p) => p.text).join(SEPARATOR), key) : demoDetect(post.paragraphs);
  const ranges = locateParagraphs(post.paragraphs, detection.text);
  const perParagraph = new Map(post.paragraphs.map((p, i) => [p.id, paragraphScore(ranges[i], detection.windows)]));
  saveScores(postId, detection, perParagraph);
  return requirePost(postId);
}

export function flaggedParagraphs(post: Post): Paragraph[] {
  return post.paragraphs.filter(isFlagged);
}
