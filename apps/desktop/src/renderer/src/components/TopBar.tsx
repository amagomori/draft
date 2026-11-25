import type { ReactNode } from "react";
import { Logo } from "./Logo";

export function TopBar({ title, onHome, center, right }: { title?: string; onHome: () => void; center?: ReactNode; right?: ReactNode }) {
  return (
    <header className="drag relative flex h-[68px] shrink-0 items-center justify-between pr-6 pl-[88px]">
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={onHome} className="no-drag flex items-center gap-3 rounded-lg">
          <Logo />
          <span className="text-base font-bold tracking-tight text-ink">Draft</span>
        </button>
        {title && (
          <>
            <span className="text-sm text-faint">/</span>
            <span className="max-w-[280px] truncate text-sm font-medium text-muted">{title}</span>
          </>
        )}
      </div>
      {center && <div className="no-drag absolute left-1/2 -translate-x-1/2">{center}</div>}
      <div className="no-drag flex items-center gap-2.5">{right}</div>
    </header>
  );
}

export type Step = "notes" | "draft" | "humanize" | "export";

const STEPS: { id: Step; label: string }[] = [
  { id: "notes", label: "Notes" },
  { id: "draft", label: "Draft" },
  { id: "humanize", label: "Revise" },
  { id: "export", label: "Export" },
];

export function StepSwitcher({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-stone p-1">
      {STEPS.map((step) => (
        <span
          key={step.id}
          className={
            step.id === current
              ? "rounded-full bg-surface px-3.5 py-1.5 text-[13px] font-semibold text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]"
              : "px-3.5 py-1.5 text-[13px] font-medium text-subtle"
          }
        >
          {step.label}
        </span>
      ))}
    </div>
  );
}
