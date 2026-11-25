import { useState } from "react";
import type { Route } from "../App";
import { CapyChip } from "../components/CapyChip";
import { StepSwitcher, TopBar } from "../components/TopBar";

export function NewPost({ navigate }: { navigate: (route: Route) => void }) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  async function create() {
    const id = await window.api.createPost(title, notes);
    navigate({ name: "post", id });
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar onHome={() => navigate({ name: "home" })} title="New post" center={<StepSwitcher current="notes" />} right={<CapyChip connected={false} />} />
      <main className="flex grow justify-center overflow-y-auto px-6 pt-14 pb-10">
        <div className="flex w-[760px] flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-[34px] leading-tight font-bold tracking-[-0.03em] text-ink">Start with your notes</h1>
            <p className="text-base text-subtle">Paste your notes or an outline. Capy writes the first draft from them.</p>
          </div>
          <div className="card flex flex-col gap-4 p-5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Working title"
              className="bg-transparent text-xl font-semibold tracking-tight text-ink outline-none placeholder:text-faint"
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              autoFocus
              placeholder={"- killed quarterly planning in March\n- one page per team, updated monthly\n- what actually changed for us"}
              className="min-h-[260px] resize-none bg-transparent text-base leading-[1.7] text-ink outline-none placeholder:text-faint"
            />
            <div className="flex justify-end">
              <button
                onClick={create}
                disabled={!notes.trim()}
                className="h-10 rounded-full bg-ink px-[18px] text-sm font-semibold text-surface disabled:opacity-40"
              >
                Create post
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
