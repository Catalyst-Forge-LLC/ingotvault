import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  type AppConfig,
  mirrorNameFromRelative,
  normalizeSlashes,
} from "./config.js";

export type DiscoveredRepo = {
  repoPath: string;
  relativePath: string;
  mirrorName: string;
  mirrorPath: string;
};

function matchesGlob(relativePosix: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/\\/g, "/")
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/{{GLOBSTAR}}/g, ".*");
  const re = new RegExp(`^${escaped}$`, "i");
  return re.test(relativePosix);
}

export function discoverRepos(config: AppConfig): DiscoveredRepo[] {
  const root = path.resolve(config.workspaceRoot);
  const excludeNames = new Set(
    config.excludeDirNames.map((n) => n.toLowerCase()),
  );
  const found: DiscoveredRepo[] = [];

  function walk(dir: string, depth: number): void {
    if (depth > config.maxDepth) return;

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const gitEntry = entries.find((e) => e.name === ".git");
    if (gitEntry) {
      const gitPath = path.join(dir, ".git");
      let isRepo = false;
      try {
        const st = statSync(gitPath);
        isRepo = st.isDirectory();
      } catch {
        isRepo = false;
      }

      if (isRepo) {
        const relativePath = normalizeSlashes(path.relative(root, dir));
        if (relativePath && relativePath !== ".") {
          const excluded = config.excludeRepoGlobs.some((g) =>
            matchesGlob(relativePath, g),
          );
          if (!excluded) {
            const mirrorName = mirrorNameFromRelative(
              relativePath,
              config.naming,
            );
            found.push({
              repoPath: dir,
              relativePath,
              mirrorName,
              mirrorPath: normalizeSlashes(
                path.join(config.mirrorRoot, mirrorName),
              ),
            });
          }
        }
      }
    }

    if (depth === config.maxDepth) return;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (excludeNames.has(entry.name.toLowerCase())) continue;
      walk(path.join(dir, entry.name), depth + 1);
    }
  }

  walk(root, 0);
  found.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return found;
}

export function filterRepos(
  repos: DiscoveredRepo[],
  repoFilter: string | null,
): DiscoveredRepo[] {
  if (!repoFilter) return repos;
  const needle = repoFilter.replace(/\\/g, "/").toLowerCase();
  return repos.filter((r) => {
    const rel = r.relativePath.toLowerCase();
    const base = path.posix.basename(rel);
    return rel === needle || base === needle || rel.endsWith(`/${needle}`);
  });
}
