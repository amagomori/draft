import { requirePost, saveScores } from "./posts.ts";
import { isFlagged, type Paragraph, type Post } from "./types.ts";

const BASE_URL = "https://text.external-api.pangram.com";
const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 90_000;
const SEPARATOR = "\n\n";

type Window = { start: number; end: number; score: number };
type Detection = { human: number; ai: number; assisted: number; windows: Window[] };

type PangramResult = {
  stage: string;
  headline?: string;
  fraction_human?: number;
  fraction_ai?: number;
  fraction_ai_assisted?: number;
  windows?: { start_index: number; end_index: number; ai_assistance_score: number }[];
};

const MAX_PARALLEL = 3;
const RATE_LIMIT_RETRIES = 5;

async function createTask(text: string, headers: Record<string, string>): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE_URL}/task`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text, model: process.env.PANGRAM_MODEL ?? "pangram-4", public_dashboard_link: false }),
    });
    if (res.status !== 429 || attempt >= RATE_LIMIT_RETRIES) return res;
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
  }
}

async function pangram(text: string, key: string): Promise<Detection> {
  const headers = { "Content-Type": "application/json", "x-api-key": key };
  const created = await createTask(text, headers);
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
      human: result.fraction_human ?? 0,
      ai: result.fraction_ai ?? 0,
      assisted: result.fraction_ai_assisted ?? 0,
      windows: (result.windows ?? []).map((w) => ({ start: w.start_index, end: w.end_index, score: w.ai_assistance_score })),
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

function demoScore(text: string): number {
  const lower = text.toLowerCase();
  const hits = GENERIC_PHRASES.filter((phrase) => lower.includes(phrase)).length;
  const specific = /\d/.test(text) || /\b(I|we|our)\b/.test(text);
  return hits >= 2 ? 0.94 : hits === 1 ? (specific ? 0.42 : 0.86) : specific ? 0.06 : 0.31;
}

function averageScore(detection: Detection): number | null {
  let weighted = 0;
  let covered = 0;
  for (const w of detection.windows) {
    const length = Math.max(0, w.end - w.start);
    weighted += w.score * length;
    covered += length;
  }
  return covered > 0 ? weighted / covered : null;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function detectWithPangram(paragraphs: Paragraph[], key: string) {
  const texts = [paragraphs.map((p) => p.text).join(SEPARATOR), ...paragraphs.map((p) => p.text)];
  const [whole, ...parts] = await mapLimit(texts, MAX_PARALLEL, (text) => pangram(text, key));
  return { totals: { human: whole.human, ai: whole.ai, assisted: whole.assisted, demo: false }, scores: parts.map(averageScore) };
}

function detectDemo(paragraphs: Paragraph[]) {
  const scores = paragraphs.map((p) => demoScore(p.text));
  const total = Math.max(1, paragraphs.reduce((n, p) => n + p.text.length, 0));
  const ai = paragraphs.reduce((n, p, i) => n + (scores[i] >= 0.5 ? p.text.length : 0), 0) / total;
  return { totals: { human: 1 - ai, ai, assisted: 0, demo: true }, scores };
}

export async function scorePost(postId: number): Promise<Post> {
  const post = requirePost(postId);
  if (post.paragraphs.length === 0) throw new Error("This post has no paragraphs to score yet.");
  const key = process.env.PANGRAM_API_KEY;
  const { totals, scores } = key ? await detectWithPangram(post.paragraphs, key) : detectDemo(post.paragraphs);
  saveScores(postId, totals, new Map(post.paragraphs.map((p, i) => [p.id, scores[i]])));
  return requirePost(postId);
}

export function flaggedParagraphs(post: Post): Paragraph[] {
  return post.paragraphs.filter(isFlagged);
}
