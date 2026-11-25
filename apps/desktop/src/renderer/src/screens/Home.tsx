import type { PostSummary } from "@draft/core/types";
import type { Route } from "../App";
import { CapyChip } from "../components/CapyChip";
import { TopBar } from "../components/TopBar";
import { edited, pct, useLive } from "../lib";

function Tile({ post, onOpen }: { post: PostSummary; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="card flex flex-col overflow-hidden text-left transition hover:-translate-y-0.5">
      <div className="flex h-[200px] flex-col overflow-hidden bg-sunk px-5 pt-5">
        <div className="flex grow flex-col gap-2 rounded-t-[10px] bg-surface px-2 py-4">
          <span className="px-2 text-sm leading-tight font-bold tracking-tight text-ink">{post.title}</span>
          {post.preview.length === 0 ? (
            <span className="px-2 text-[11px] leading-relaxed whitespace-pre-line text-faint">{post.notes || "No notes yet"}</span>
          ) : (
            post.preview.map((p, i) => (
              <span key={i} className={`rounded-md text-[11px] leading-relaxed text-muted ${p.flagged ? "bg-flag px-2 py-1.5" : "px-2"}`}>
                {p.text}
              </span>
            ))
          )}
        </div>
      </div>
      <div className="flex grow flex-col justify-between gap-3 px-5 pt-4 pb-[18px]">
        <span className="text-[15px] leading-snug font-semibold text-ink">{post.title}</span>
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-subtle">{edited(post.updatedAt)}</span>
          {post.human === null ? (
            <span className="text-xs text-subtle">Not scored</span>
          ) : (
            <span className="flex items-baseline gap-1">
              <span className="text-lg font-bold tracking-tight text-ink">{pct(post.human)}%</span>
              <span className="text-xs text-subtle">human</span>
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export function Home({ navigate }: { navigate: (route: Route) => void }) {
  const [posts] = useLive(() => window.api.listPosts(), []);
  const [connected] = useLive(() => window.api.agentStatus(), []);

  return (
    <div className="flex h-full flex-col">
      <TopBar onHome={() => navigate({ name: "home" })} right={<CapyChip connected={Boolean(connected)} />} />
      <main className="flex grow justify-center overflow-y-auto px-6 pt-14 pb-10">
        <div className="flex w-[1104px] flex-col gap-9">
          <div className="flex flex-col gap-3">
            <h1 className="text-[44px] leading-[1.08] font-bold tracking-[-0.035em] text-ink">
              Your posts
            </h1>
            <p className="text-[17px] leading-normal text-subtle">
              Capy drafts from your notes. Pangram flags paragraphs that read as AI. You answer a question for each one.
            </p>
          </div>
          <div className="flex items-center justify-end">
            <button onClick={() => navigate({ name: "new" })} className="flex h-[38px] items-center gap-2 rounded-full bg-ink px-4">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FCFCF9" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="text-sm font-semibold text-surface">New post</span>
            </button>
          </div>
          {posts && posts.length === 0 && (
            <div className="card flex flex-col items-start gap-3 p-8">
              <span className="text-lg font-semibold text-ink">No posts yet</span>
              <span className="text-sm text-subtle">Create one from your notes.</span>
            </div>
          )}
          <div className="grid grid-cols-3 gap-6">
            {posts?.map((post) => <Tile key={post.id} post={post} onOpen={() => navigate({ name: "post", id: post.id })} />)}
          </div>
        </div>
      </main>
    </div>
  );
}
