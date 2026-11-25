import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function defaultDataDir(): string {
  if (process.platform === "darwin") return join(homedir(), "Library", "Application Support", "Draft");
  if (process.platform === "win32") return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "Draft");
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "Draft");
}

export const dataDir = process.env.DRAFT_DATA_DIR ?? defaultDataDir();

export function loadEnv(extraDirs: string[] = []): void {
  for (const dir of [process.cwd(), ...extraDirs, dataDir]) {
    const file = join(dir, ".env");
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
      if (value && process.env[match[1]] === undefined) process.env[match[1]] = value;
    }
  }
}
