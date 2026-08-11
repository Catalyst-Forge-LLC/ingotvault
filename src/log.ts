import { mkdirSync, writeFileSync } from "node:fs";
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
