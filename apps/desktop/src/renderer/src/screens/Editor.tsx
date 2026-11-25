import { useEffect, useState } from "react";
import { isFlagged, type Paragraph, type Post } from "@draft/core/types";
import type { Route } from "../App";
import { CapyChip } from "../components/CapyChip";
import { ExportMenu } from "../components/ExportMenu";
import { StepSwitcher, TopBar, type Step } from "../components/TopBar";
import { errorText, pct, useLive } from "../lib";

function stepOf(post: Post): Step {
  if (post.paragraphs.length === 0) return "notes";
  if (!post.score || post.paragraphs.some((p) => p.aiScore === null)) return "draft";
  return post.paragraphs.some(isFlagged) ? "humanize" : "export";
}

function ParagraphBlock({ postId, paragraph, active, onFocus }: { postId: number; paragraph: Paragraph; active: boolean; onFocus: () => void }) {
  const [text, setText] = useState(paragraph.text);
  useEffect(() => setText(paragraph.text), [paragraph.text]);
  const flagged = isFlagged(paragraph);

  return (
    <div
      id={`p-${paragraph.id}`}
      className={`rounded-xl px-4 py-3.5 transition ${flagged ? "bg-flag" : ""} ${active ? "ring-2 ring-blue/50" : ""}`}
    >
      <textarea
        value={text}
        onFocus={onFocus}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text.trim() !== paragraph.text && window.api.updateParagraph(postId, paragraph.id, text)}
        className="w-full resize-none bg-transparent text-[17px] leading-[1.7] text-ink-soft outline-none [field-sizing:content]"
      />
    </div>
  );
}

function ScoreCard({ post, checking, onCheck, pangram }: { post: Post; checking: boolean; onCheck: () => void; pangram: boolean }) {
  const score = post.score;
  const flagged = post.paragraphs.filter(isFlagged).length;
  const stale = post.paragraphs.some((p) => p.aiScore === null);
  const delta = score ? pct(score.human) - pct(score.firstHuman) : 0;

  return (
    <div className="card flex flex-col gap-3.5 p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-subtle">Pangram human score</span>
        {score && score.checks > 1 && delta !== 0 && (
          <span className={`text-[13px] font-medium ${delta > 0 ? "text-human" : "text-subtle"}`}>
            {delta > 0 ? "+" : ""}
            {delta} since first check
          </span>
        )}
      </div>
      {score ? (
        <>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[44px] leading-none font-bold tracking-[-0.04em] text-ink">{pct(score.human)}</span>
            <span className="text-lg font-semibold text-faint">%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-track">
            <div className="h-2 rounded-full bg-ink" style={{ width: `${pct(score.human)}%` }} />
          </div>
          <span className="text-[13px] leading-normal text-subtle">
            {stale
              ? "The post changed since the last check."
              : flagged === 0
                ? "No paragraphs flagged."
                : `${flagged} of ${post.paragraphs.length} paragraphs still read as AI-written.`}
          </span>
        </>
      ) : (
        <span className="text-[13px] leading-normal text-subtle">Not checked yet. Score the draft to see which paragraphs sound generic.</span>
      )}
      {(!score || stale) && post.paragraphs.length > 0 && (
        <button onClick={onCheck} disabled={checking} className="h-9 self-start rounded-full bg-ink px-4 text-[13px] font-semibold text-surface disabled:opacity-50">
          {checking ? "Scoring with Pangram…" : score ? "Check again" : "Check with Pangram"}
        </button>
      )}
      {(score?.demo || (!score && !pangram)) && (
        <span className="rounded-lg bg-sunk px-3 py-2 text-xs leading-normal text-subtle">
          Demo scores. Add PANGRAM_API_KEY to .env for real Pangram results.
        </span>
      )}
    </div>
  );
}

function QuestionCard({ postId, paragraph, index, active, onSelect }: { postId: number; paragraph: Paragraph; index: number; active: boolean; onSelect: () => void }) {
  const [answer, setAnswer] = useState(paragraph.answer ?? "");
  const [editing, setEditing] = useState(!paragraph.answer);
  useEffect(() => {
    setAnswer(paragraph.answer ?? "");
    setEditing(!paragraph.answer);
  }, [paragraph.answer]);

  const header = (
    <div className="flex items-center justify-between">
      <span className={`text-[13px] font-semibold ${active ? "text-ink" : "text-subtle"}`}>Paragraph {index}</span>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold text-blue-ink ${active ? "bg-flag-strong" : "bg-flag"}`}>
        {pct(paragraph.aiScore ?? 0)}% AI
      </span>
    </div>
  );

  if (!active) {
    return (
      <button onClick={onSelect} className="card flex flex-col gap-2.5 px-5 py-[18px] text-left">
        {header}
        <span className="text-[15px] leading-snug font-medium text-muted">
          {paragraph.question ?? "Waiting for Capy to ask about this paragraph."}
        </span>
        {paragraph.answer && <span className="text-xs font-semibold text-human">Answer sent to Capy</span>}
      </button>
    );
  }

  return (
    <div className="card flex flex-col gap-4 p-5 shadow-[0_1px_2px_rgb(24_24_24/0.04),0_12px_32px_rgb(24_24_24/0.08)]">
      {header}
      {paragraph.question ? (
        <>
          <span className="text-[17px] leading-snug font-semibold tracking-[-0.01em] text-ink">{paragraph.question}</span>
          <div className="flex flex-col gap-3 rounded-[14px] bg-cream/70 p-3.5">
            {editing ? (
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Answer in your own words…"
                className="min-h-[72px] resize-none bg-transparent text-[15px] leading-normal text-ink outline-none [field-sizing:content] placeholder:text-faint"
              />
            ) : (
              <span className="text-[15px] leading-normal whitespace-pre-wrap text-ink">{paragraph.answer}</span>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-subtle">{editing ? "" : "Capy will work this in"}</span>
              {editing ? (
                <button
                  onClick={() => window.api.answer(postId, paragraph.id, answer)}
                  disabled={!answer.trim()}
                  className="h-[34px] rounded-full bg-ink px-4 text-[13px] font-semibold text-surface disabled:opacity-40"
                >
                  Send to Capy
                </button>
              ) : (
                <button onClick={() => setEditing(true)} className="h-[34px] rounded-full border border-line px-4 text-[13px] font-semibold text-ink">
                  Edit answer
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <span className="text-[15px] leading-snug text-subtle">Capy hasn't asked about this paragraph yet. Connect Capy and ask it to work through the flagged paragraphs.</span>
      )}
    </div>
  );
}

export function Editor({ id, navigate }: { id: number; navigate: (route: Route) => void }) {
  const [post] = useLive(() => window.api.getPost(id), [id]);
  const [integrations] = useLive(() => window.api.integrations(), []);
  const [title, setTitle] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (post) setTitle(post.title);
  }, [post?.title]);

  if (post === undefined) return null;
  if (post === null) {
    navigate({ name: "home" });
    return null;
  }

  const flagged = post.paragraphs.filter(isFlagged);
  const active = flagged.find((p) => p.id === activeId) ?? flagged[0];

  async function check() {
    setChecking(true);
    setError(null);
    try {
      await window.api.scorePost(id);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setChecking(false);
    }
  }

  function select(p: Paragraph) {
    setActiveId(p.id);
    document.getElementById(`p-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar
        onHome={() => navigate({ name: "home" })}
        title={post.title}
        center={<StepSwitcher current={stepOf(post)} />}
        right={
          <>
            <CapyChip postId={post.id} connected={post.agentConnected} />
            {post.score && (
              <div className="flex h-[38px] items-center gap-2 rounded-full border border-line bg-surface px-3.5">
                <span className="size-2 rounded-full bg-blue" />
                <span className="text-[13px] font-semibold text-ink">{pct(post.score.human)}% human</span>
              </div>
            )}
            <ExportMenu postId={post.id} disabled={post.paragraphs.length === 0} />
          </>
        }
      />
      <div className="flex min-h-0 grow gap-4 px-4 pb-4">
        <main className="card flex grow justify-center overflow-y-auto px-16 py-14">
          <div className="flex w-[640px] flex-col gap-2">
            <textarea
              value={title}
              rows={1}
              onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              onBlur={() => title.trim() && title !== post.title && window.api.setTitle(post.id, title)}
              className="mb-5 resize-none bg-transparent px-4 text-[40px] leading-[1.1] font-bold tracking-[-0.035em] text-ink outline-none [field-sizing:content]"
            />
            {post.paragraphs.length === 0 ? (
              <div className="flex flex-col gap-4 px-4">
                <div className="rounded-2xl bg-sunk p-5">
                  <span className="mb-2 block text-xs font-semibold tracking-[0.08em] text-subtle uppercase">Your notes</span>
                  <p className="text-[15px] leading-[1.7] whitespace-pre-wrap text-muted">{post.notes}</p>
                </div>
                <p className="text-[15px] leading-relaxed text-subtle">
                  Waiting for the first draft. Connect Capy from the chip in the top bar and ask it to write this post from your notes.
                </p>
              </div>
            ) : (
              post.paragraphs.map((p) => (
                <ParagraphBlock key={p.id} postId={post.id} paragraph={p} active={active?.id === p.id} onFocus={() => setActiveId(p.id)} />
              ))
            )}
          </div>
        </main>
        <aside className="flex w-[400px] shrink-0 flex-col gap-3 overflow-y-auto">
          <ScoreCard post={post} checking={checking} onCheck={check} pangram={Boolean(integrations?.pangram)} />
          {error && <div className="rounded-2xl bg-[#F8E1DE] px-4 py-3 text-[13px] leading-normal text-[#8A2A1F]">{error}</div>}
          {flagged.map((p) => (
            <QuestionCard
              key={p.id}
              postId={post.id}
              paragraph={p}
              index={post.paragraphs.indexOf(p) + 1}
              active={active?.id === p.id}
              onSelect={() => select(p)}
            />
          ))}
        </aside>
      </div>
    </div>
  );
}
