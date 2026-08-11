import { homedir } from "node:os";
import path from "node:path";

export function normalizeSlashes(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Expand leading ~ or ~/ to the user home directory. */
export function expandHome(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) {
    return path.join(homedir(), p.slice(2));
  }
  return p;
}

export function resolveUserPath(p: string): string {
  return path.resolve(expandHome(p));
}

export function urlsMatch(a: string, b: string): boolean {
  const norm = (u: string) =>
    normalizeSlashes(u)
      .replace(/\/+$/, "")
      .toLowerCase();
  return norm(a) === norm(b);
}
