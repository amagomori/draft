import { useCallback, useEffect, useState } from "react";

export function useLive<T>(load: () => Promise<T>, deps: unknown[]): [T | undefined, () => Promise<void>] {
  const [value, setValue] = useState<T>();
  const refresh = useCallback(async () => setValue(await load()), deps);
  useEffect(() => {
    refresh();
    return window.api.onChange(refresh);
  }, [refresh]);
  return [value, refresh];
}

export function pct(value: number): number {
  return Math.round(value * 100);
}

export function edited(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60_000);
  if (minutes < 1) return "Edited just now";
  if (minutes < 60) return `Edited ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Edited ${hours}h ago`;
  return `Edited ${new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function errorText(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
}
