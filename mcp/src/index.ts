#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  clearAgent,
  deleteParagraph,
  exportPost,
  fileName,
  getParagraph,
  insertParagraph,
  isFlagged,
  loadEnv,
  markAgentSeen,
  replaceParagraphs,
  requirePost,
  scorePost,
  setQuestion,
  setTitle,
  toMarkdown,
  updateParagraph,
  type Post,
} from "@draft/core";

loadEnv([join(dirname(fileURLToPath(import.meta.url)), "..", "..")]);

const flag = process.argv.indexOf("--post");
const postId = Number(flag >= 0 ? process.argv[flag + 1] : process.env.DRAFT_POST);
if (!Number.isInteger(postId) || postId <= 0) {
  console.error("Usage: draft-mcp --post <id>   (the id is shown under Connect Capy in the app)");
  process.exit(1);
}
const title = requirePost(postId).title;

function view(post: Post) {
  return {
    id: post.id,
    title: post.title,
    notes: post.notes,
    human_score: post.score ? Math.round(post.score.human * 100) : null,
    demo_scores: post.score?.demo ?? false,
    paragraphs: post.paragraphs.map((p) => ({
      id: p.id,
      text: p.text,
      source: p.source,
      ai_score: p.aiScore === null ? null : Math.round(p.aiScore * 100),
      flagged: isFlagged(p),
      question: p.question,
      answer: p.answer,
    })),
  };
}

function reply(value: unknown) {
  markAgentSeen(postId);
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

const server = new McpServer(
  { name: "draft", version: "0.1.0" },
  {
    instructions: `You are editing one Draft blog post: "${title}" (id ${postId}).
Your job is to draft the post and revise flagged paragraphs using the author's answers. Workflow:
1. get_post to read the author's notes and the current paragraphs.
2. If there are no paragraphs, write_draft from the notes.
3. score_post runs Pangram and flags paragraphs that read as AI-written.
4. For each flagged paragraph without a question, ask_question with one short, specific question that only the author can answer (an example, a number, an opinion). Do not rewrite flagged paragraphs on your own to get past the detector.
5. The author answers in the Draft app. get_post shows answers; work each answer into its paragraph with update_paragraph (used_answer: true), keeping the author's own words and details.
6. score_post again and repeat until no paragraphs are flagged, then export_post if asked.`,
  },
);

server.registerTool(
  "get_post",
  { description: "Read the post: title, the author's notes, every paragraph with its id, Pangram AI score, question and the author's answer." },
  async () => reply(view(requirePost(postId))),
);

server.registerTool(
  "set_title",
  { description: "Change the post title.", inputSchema: { title: z.string().min(1) } },
  async ({ title }) => {
    setTitle(postId, title);
    return reply(view(requirePost(postId)));
  },
);

server.registerTool(
  "write_draft",
  {
    description: "Replace all paragraphs with a new draft, one string per paragraph. Use this for the first draft from the author's notes.",
    inputSchema: { paragraphs: z.array(z.string().min(1)).min(1) },
  },
  async ({ paragraphs }) => {
    replaceParagraphs(postId, paragraphs, "ai");
    return reply(view(requirePost(postId)));
  },
);

server.registerTool(
  "update_paragraph",
  {
    description:
      "Replace one paragraph's text. Set used_answer to true when the new text works in the author's answer to that paragraph's question. This clears the paragraph's score, question and answer until the next score_post.",
    inputSchema: { paragraph_id: z.number().int(), text: z.string().min(1), used_answer: z.boolean().default(false) },
  },
  async ({ paragraph_id, text, used_answer }) => {
    const current = getParagraph(postId, paragraph_id);
    if (used_answer && !current.answer) throw new Error(`Paragraph ${paragraph_id} has no answer from the author yet.`);
    updateParagraph(postId, paragraph_id, text, used_answer ? "answer" : "agent");
    return reply(view(requirePost(postId)));
  },
);

server.registerTool(
  "insert_paragraph",
  {
    description: "Add a paragraph after the given paragraph id, or at the end when after_paragraph_id is omitted.",
    inputSchema: { text: z.string().min(1), after_paragraph_id: z.number().int().optional() },
  },
  async ({ text, after_paragraph_id }) => {
    insertParagraph(postId, text, "agent", after_paragraph_id);
    return reply(view(requirePost(postId)));
  },
);

server.registerTool(
  "delete_paragraph",
  { description: "Remove a paragraph from the post.", inputSchema: { paragraph_id: z.number().int() } },
  async ({ paragraph_id }) => {
    deleteParagraph(postId, paragraph_id);
    return reply(view(requirePost(postId)));
  },
);

server.registerTool(
  "score_post",
  { description: "Score the whole post with Pangram. Returns the human score and which paragraphs are flagged as AI-written." },
  async () => {
    const post = await scorePost(postId);
    const flagged = post.paragraphs.filter(isFlagged);
    return reply({
      human_score: Math.round((post.score?.human ?? 0) * 100),
      demo_scores: post.score?.demo ?? false,
      flagged: flagged.map((p) => ({ id: p.id, ai_score: Math.round((p.aiScore ?? 0) * 100), text: p.text, question: p.question })),
    });
  },
);

server.registerTool(
  "ask_question",
  {
    description: "Ask the author one short, specific question about a flagged paragraph. It appears next to that paragraph in the app.",
    inputSchema: { paragraph_id: z.number().int(), question: z.string().min(1) },
  },
  async ({ paragraph_id, question }) => {
    setQuestion(postId, paragraph_id, question);
    return reply(view(requirePost(postId)));
  },
);

server.registerTool(
  "export_post",
  {
    description: "Export the post text (no scores). Markdown is returned inline when no path is given; Word and PDF need an absolute output path.",
    inputSchema: { format: z.enum(["markdown", "docx", "pdf"]), path: z.string().optional() },
  },
  async ({ format, path }) => {
    const post = requirePost(postId);
    if (!path && format === "markdown") return reply(toMarkdown(post));
    if (!path) throw new Error(`An absolute path is required for ${format} export, for example ~/Desktop/${fileName(post, format)}.`);
    const target = resolve(path.replace(/^~(?=\/)/, process.env.HOME ?? "~"));
    await writeFile(target, await exportPost(post, format));
    return reply(`Exported to ${target}`);
  },
);

markAgentSeen(postId);
const heartbeat = setInterval(() => markAgentSeen(postId), 10_000);
const shutdown = () => {
  clearInterval(heartbeat);
  clearAgent(postId);
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.stdin.on("close", shutdown);

await server.connect(new StdioServerTransport());
