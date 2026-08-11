import {
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

export type Logger = {
  line: (msg: string) => void;
  verbose: (msg: string) => void;
  flushToFile: (logFile: string) => void;
  getLines: () => string[];
};

export function createLogger(verboseEnabled: boolean): Logger {
  const lines: string[] = [];

  const write = (msg: string) => {
    lines.push(msg);
    console.log(msg);
  };

  return {
    line: write,
    verbose: (msg: string) => {
      if (verboseEnabled) write(msg);
    },
    flushToFile: (logFile: string) => {
      mkdirSync(path.dirname(logFile), { recursive: true });
      writeFileSync(logFile, `${lines.join("\n")}\n`, "utf8");
    },
    getLines: () => lines,
  };
}

export function timestampForFilename(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** Delete *.log files in logDir older than retentionDays. 0 = keep forever. */
export function pruneOldLogs(logDir: string, retentionDays: number): number {
  if (retentionDays <= 0) return 0;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  let entries;
  try {
    entries = readdirSync(logDir);
  } catch {
    return 0;
  }
  for (const name of entries) {
    if (!name.endsWith(".log")) continue;
    const full = path.join(logDir, name);
    try {
      const st = statSync(full);
      if (st.isFile() && st.mtimeMs < cutoff) {
        unlinkSync(full);
        removed += 1;
      }
    } catch {
      /* ignore */
    }
  }
  return removed;
}
