import { createPost, replaceParagraphs, saveScores, getPost, listPosts } from "./posts.ts";
import { getDb, dbPath } from "./db.ts";

const samples = [
  {
    title: "Why we stopped doing quarterly planning",
    notes: "- killed quarterly planning in March\n- one page per team, updated monthly\n- what actually changed for us",
    paragraphs: [
      ["For three years we ran a full planning cycle every quarter. Every team wrote goals, every lead defended a roadmap, and by week three most of it was already out of date.", 0.08],
      ["In today's fast-paced landscape, agility is more important than ever. By embracing a more flexible approach, teams can unlock new levels of productivity and stay aligned with evolving priorities.", 0.94],
      ["So in March we killed it. No quarterly offsite, no 40-slide deck. Each team now keeps a single page with what it is working on this month and why.", 0.05],
      ["The results have been transformative. Communication improved across the board, and our team feels more empowered to make decisions that drive meaningful impact.", 0.88],
    ],
    questions: {
      1: "What broke in the old process? Give one moment where the plan fell apart.",
      3: "\"Transformative\" how? Give a number: meetings cut, days saved, anything you measured.",
    },
    scores: [0.44, 0.62],
    ago: 4 * 60_000,
  },
  {
    title: "What 40 customer calls taught us about pricing",
    notes: "- 40 calls in six weeks\n- annual billing surprise\n- what we changed on the pricing page",
    paragraphs: [
      ["We booked 40 calls in six weeks. Half were churned accounts, half were trials that never converted.", 0.04],
      ["The surprise was who asked for annual billing: the smallest teams, not the biggest. A two-person agency told us they budget once a year and forget about it.", 0.07],
      ["So we moved the annual toggle above the fold and dropped the per-seat minimum. Trial-to-paid went from 9% to 13% in the first month.", 0.06],
    ],
    questions: {},
    scores: [0.71, 0.91],
    ago: 6 * 86_400_000,
  },
  {
    title: "The one metric our board actually reads",
    notes: "- board deck used to be 30 slides\n- weekly active writers\n- metrics we dropped",
    paragraphs: [
      ["Our board deck used to be 30 slides. Now the first page is one number: weekly active writers.", 0.05],
      ["Here's how we picked it, and the two metrics we dropped to get there. Signups looked great every month and told us nothing about whether anyone came back.", 0.12],
      ["Revenue lagged by a quarter, so by the time it moved we had already shipped three things that did not matter.", 0.09],
    ],
    questions: {},
    scores: [0.8, 0.88],
    ago: 20 * 86_400_000,
  },
] as const;

if (listPosts().length > 0) {
  console.log(`${dbPath} already has posts; skipping seed.`);
} else {
  for (const sample of [...samples].reverse()) {
    const id = createPost(sample.title, sample.notes);
    replaceParagraphs(id, sample.paragraphs.map(([text]) => text), "ai");
    const post = getPost(id)!;
    const perParagraph = new Map(post.paragraphs.map((p, i) => [p.id, sample.paragraphs[i][1] as number]));
    for (const human of sample.scores) saveScores(id, { human, ai: 1 - human, assisted: 0, demo: true }, perParagraph);
    const q = sample.questions as Record<number, string>;
    for (const [index, question] of Object.entries(q)) getDb().prepare("UPDATE paragraphs SET question = ? WHERE id = ?").run(question, post.paragraphs[Number(index)].id);
    getDb().prepare("UPDATE posts SET updated_at = ? WHERE id = ?").run(Date.now() - sample.ago, id);
  }
  console.log(`Seeded ${samples.length} sample posts into ${dbPath}.`);
}
