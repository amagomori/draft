import { useState } from "react";
import type { ExportFormat } from "@draft/core/types";

const FORMATS: { format: ExportFormat; name: string; hint: string; tile: string; icon: React.ReactNode }[] = [
  {
    format: "markdown",
    name: "Markdown",
    hint: "For your CMS or repo · .md",
    tile: "bg-track",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#181818" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2.5" />
        <path d="M6 15V9l3 3 3-3v6" />
        <path d="M17 9v6m-2-2 2 2 2-2" />
      </svg>
    ),
  },
  {
    format: "docx",
    name: "Word",
    hint: "For editing and review · .docx",
    tile: "bg-[#DDE7F6]",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2B579A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 12.5l1.3 5 1.7-4 1.7 4 1.3-5" />
      </svg>
    ),
  },
  {
    format: "pdf",
    name: "PDF",
    hint: "For sharing as-is · .pdf",
    tile: "bg-[#F8E1DE]",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C8392B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8M8 17h5" />
      </svg>
    ),
  },
];

export function ExportMenu({ postId, disabled }: { postId: number; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="flex h-[38px] items-center gap-2 rounded-full bg-ink pr-4 pl-[18px] disabled:opacity-40"
      >
        <span className="text-sm font-semibold text-surface">Export</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FCFCF9" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d={open ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />
        </svg>
      </button>
      {open && (
        <div className="card absolute top-12 right-0 z-20 flex w-[280px] flex-col rounded-[18px] p-2 shadow-[0_1px_2px_rgb(24_24_24/0.05),0_16px_40px_rgb(24_24_24/0.12)]">
          {FORMATS.map((f) => (
            <button
              key={f.format}
              onClick={async () => {
                setOpen(false);
                const path = await window.api.exportPost(postId, f.format);
                if (path) {
                  setSaved(path);
                  setTimeout(() => setSaved(null), 3000);
                }
              }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-sunk"
            >
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] ${f.tile}`}>{f.icon}</span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-ink">{f.name}</span>
                <span className="text-xs text-subtle">{f.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {saved && (
        <div className="card absolute top-12 right-0 z-20 w-[320px] px-4 py-3 text-[13px] break-all text-muted">Saved to {saved}</div>
      )}
    </div>
  );
}
