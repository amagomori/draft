import { getDb } from "./db.ts";
import { isFlagged, type Paragraph, type Post, type PostSummary, type Score, type Source } from "./types.ts";

type ParagraphRow = {
  id: number;
  position: number;
  text: string;
  source: Source;
  ai_score: number | null;
  question: string | null;
  answer: string | null;
};

const AGENT_TIMEOUT_MS = 30_000;

function toParagraph(r: ParagraphRow): Paragraph {
  return { id: r.id, position: r.position, text: r.text, source: r.source, aiScore: r.ai_score, question: r.question, answer: r.answer };
}

function touch(postId: number): void {
  getDb().prepare("UPDATE posts SET updated_at = ? WHERE id = ?").run(Date.now(), postId);
}

function paragraphsOf(postId: number): Paragraph[] {
  const rows = getDb().prepare("SELECT * FROM paragraphs WHERE post_id = ? ORDER BY position").all(postId) as ParagraphRow[];
  return rows.map(toParagraph);
}

function scoreOf(postId: number): Score | null {
  const rows = getDb()
    .prepare("SELECT fraction_human, fraction_ai, fraction_ai_assisted, demo FROM scores WHERE post_id = ? ORDER BY id")
    .all(postId) as { fraction_human: number; fraction_ai: number; fraction_ai_assisted: number; demo: number }[];
  if (rows.length === 0) return null;
  const last = rows[rows.length - 1];
  return { human: last.fraction_human, ai: last.fraction_ai, assisted: last.fraction_ai_assisted, demo: last.demo === 1, firstHuman: rows[0].fraction_human, checks: rows.length };
}

export function listPosts(): PostSummary[] {
  const posts = getDb().prepare("SELECT id, title, notes, updated_at FROM posts ORDER BY updated_at DESC").all() as {
    id: number;
    title: string;
    notes: string;
    updated_at: number;
  }[];
  return posts.map((p) => ({
    id: p.id,
    title: p.title,
    notes: p.notes,
    updatedAt: p.updated_at,
    human: scoreOf(p.id)?.human ?? null,
    preview: paragraphsOf(p.id)
      .slice(0, 3)
      .map((para) => ({ text: para.text, flagged: isFlagged(para) })),
  }));
}

export function getPost(id: number): Post | null {
  const row = getDb().prepare("SELECT * FROM posts WHERE id = ?").get(id) as
    | { id: number; title: string; notes: string; created_at: number; updated_at: number }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paragraphs: paragraphsOf(id),
    score: scoreOf(id),
    agentConnected: agentConnected(id),
  };
}

export function requirePost(id: number): Post {
  const post = getPost(id);
  if (!post) throw new Error(`Post ${id} does not exist.`);
  return post;
}

export function createPost(title: string, notes: string): number {
  const now = Date.now();
  const result = getDb()
    .prepare("INSERT INTO posts (title, notes, created_at, updated_at) VALUES (?, ?, ?, ?)")
    .run(title.trim() || "Untitled post", notes, now, now);
  return Number(result.lastInsertRowid);
}

export function deletePost(id: number): void {
  getDb().prepare("DELETE FROM posts WHERE id = ?").run(id);
}

export function setTitle(postId: number, title: string): void {
  getDb().prepare("UPDATE posts SET title = ?, updated_at = ? WHERE id = ?").run(title.trim() || "Untitled post", Date.now(), postId);
}

export function setNotes(postId: number, notes: string): void {
  getDb().prepare("UPDATE posts SET notes = ?, updated_at = ? WHERE id = ?").run(notes, Date.now(), postId);
}

export function replaceParagraphs(postId: number, texts: string[], source: Source): void {
  const db = getDb();
  const now = Date.now();
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM paragraphs WHERE post_id = ?").run(postId);
    const insert = db.prepare("INSERT INTO paragraphs (post_id, position, text, source, updated_at) VALUES (?, ?, ?, ?, ?)");
    texts.map((t) => t.trim()).filter(Boolean).forEach((text, i) => insert.run(postId, i + 1, text, source, now));
    db.prepare("UPDATE posts SET updated_at = ? WHERE id = ?").run(now, postId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function getParagraph(postId: number, paragraphId: number): Paragraph {
  const row = getDb().prepare("SELECT * FROM paragraphs WHERE id = ? AND post_id = ?").get(paragraphId, postId) as ParagraphRow | undefined;
  if (!row) throw new Error(`Paragraph ${paragraphId} is not part of post ${postId}.`);
  return toParagraph(row);
}

export function updateParagraph(postId: number, paragraphId: number, text: string, source: Source): void {
  getParagraph(postId, paragraphId);
  getDb()
    .prepare("UPDATE paragraphs SET text = ?, source = ?, ai_score = NULL, question = NULL, answer = NULL, updated_at = ? WHERE id = ?")
    .run(text.trim(), source, Date.now(), paragraphId);
  touch(postId);
}

export function insertParagraph(postId: number, text: string, source: Source, afterId?: number): number {
  const paragraphs = paragraphsOf(postId);
  let position = (paragraphs.at(-1)?.position ?? 0) + 1;
  if (afterId !== undefined) {
    const index = paragraphs.findIndex((p) => p.id === afterId);
    if (index < 0) throw new Error(`Paragraph ${afterId} is not part of post ${postId}.`);
    const next = paragraphs[index + 1];
    position = next ? (paragraphs[index].position + next.position) / 2 : paragraphs[index].position + 1;
  }
  const result = getDb()
    .prepare("INSERT INTO paragraphs (post_id, position, text, source, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(postId, position, text.trim(), source, Date.now());
  touch(postId);
  return Number(result.lastInsertRowid);
}

export function deleteParagraph(postId: number, paragraphId: number): void {
  getParagraph(postId, paragraphId);
  getDb().prepare("DELETE FROM paragraphs WHERE id = ?").run(paragraphId);
  touch(postId);
}

export function setQuestion(postId: number, paragraphId: number, question: string): void {
  getParagraph(postId, paragraphId);
  getDb().prepare("UPDATE paragraphs SET question = ?, answer = NULL WHERE id = ?").run(question.trim(), paragraphId);
  touch(postId);
}

export function setAnswer(postId: number, paragraphId: number, answer: string): void {
  getParagraph(postId, paragraphId);
  getDb().prepare("UPDATE paragraphs SET answer = ? WHERE id = ?").run(answer.trim() || null, paragraphId);
  touch(postId);
}

export function saveScores(
  postId: number,
  totals: { human: number; ai: number; assisted: number; demo: boolean },
  perParagraph: Map<number, number | null>,
): void {
  const db = getDb();
  const now = Date.now();
  db.exec("BEGIN");
  try {
    const update = db.prepare("UPDATE paragraphs SET ai_score = ? WHERE id = ?");
    for (const [id, score] of perParagraph) update.run(score, id);
    db.prepare("INSERT INTO scores (post_id, fraction_human, fraction_ai, fraction_ai_assisted, demo, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      postId,
      totals.human,
      totals.ai,
      totals.assisted,
      totals.demo ? 1 : 0,
      now,
    );
    db.prepare("UPDATE posts SET updated_at = ? WHERE id = ?").run(now, postId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function markAgentSeen(postId: number): void {
  getDb()
    .prepare("INSERT INTO mcp_sessions (post_id, last_seen) VALUES (?, ?) ON CONFLICT(post_id) DO UPDATE SET last_seen = excluded.last_seen")
    .run(postId, Date.now());
}

export function agentConnected(postId?: number): boolean {
  const since = Date.now() - AGENT_TIMEOUT_MS;
  const row =
    postId === undefined
      ? getDb().prepare("SELECT 1 FROM mcp_sessions WHERE last_seen > ?").get(since)
      : getDb().prepare("SELECT 1 FROM mcp_sessions WHERE post_id = ? AND last_seen > ?").get(postId, since);
  return row !== undefined;
}

export function clearAgent(postId: number): void {
  getDb().prepare("DELETE FROM mcp_sessions WHERE post_id = ?").run(postId);
}
