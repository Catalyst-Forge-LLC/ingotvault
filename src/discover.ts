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

export type FilterReposResult =
  | { ok: true; repos: DiscoveredRepo[] }
  | { ok: false; error: string };

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
        // Directory .git only — skip worktrees/submodules where .git is a file.
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

/** `.`, `./…`, `../…`, or an absolute path. Bare names stay name matches. */
export function isPathRepoFilter(repoFilter: string): boolean {
  if (repoFilter === "." || repoFilter === "./") return true;
  if (path.isAbsolute(repoFilter)) return true;
  const normalized = repoFilter.replace(/\\/g, "/");
  return normalized.startsWith("./") || normalized.startsWith("../");
}

function sameDirectory(a: string, b: string): boolean {
  const left = path.resolve(a);
  const right = path.resolve(b);
  if (process.platform === "win32") {
    return left.toLowerCase() === right.toLowerCase();
  }
  return left === right;
}

/**
 * --repo matches a path (`.` or absolute), a workspace-relative path, or a basename.
 * Basename match fails if more than one repo shares that leaf name.
 * `.` means the repo at `fromDir`.
 */
export function filterRepos(
  repos: DiscoveredRepo[],
  repoFilter: string | null,
  fromDir: string = process.cwd(),
): FilterReposResult {
  if (!repoFilter) return { ok: true, repos };

  if (isPathRepoFilter(repoFilter)) {
    const abs = path.resolve(fromDir, repoFilter);
    const hit = repos.filter((r) => sameDirectory(r.repoPath, abs));
    if (hit.length === 1) return { ok: true, repos: hit };
    return {
      ok: false,
      error:
        `--repo ${repoFilter} is not a repo in this vault (${normalizeSlashes(abs)}). ` +
        "It is outside workspaceRoot, deeper than maxDepth, or excluded.",
    };
  }

  const needle = repoFilter.replace(/\\/g, "/").toLowerCase().replace(/\/+$/, "");
  const exact = repos.filter((r) => r.relativePath.toLowerCase() === needle);
  if (exact.length === 1) return { ok: true, repos: exact };
  if (exact.length > 1) {
    return {
      ok: false,
      error: `--repo ${repoFilter} matched multiple paths: ${exact.map((r) => r.relativePath).join(", ")}`,
    };
  }

  const bySuffix = repos.filter(
    (r) => r.relativePath.toLowerCase().endsWith(`/${needle}`),
  );
  if (bySuffix.length === 1) return { ok: true, repos: bySuffix };
  if (bySuffix.length > 1) {
    return {
      ok: false,
      error: `--repo ${repoFilter} is ambiguous; matches: ${bySuffix.map((r) => r.relativePath).join(", ")}. Use the full relative path.`,
    };
  }

  const byBase = repos.filter(
    (r) => path.posix.basename(r.relativePath).toLowerCase() === needle,
  );
  if (byBase.length === 1) return { ok: true, repos: byBase };
  if (byBase.length > 1) {
    return {
      ok: false,
      error: `--repo ${repoFilter} matches multiple repos (${byBase.map((r) => r.relativePath).join(", ")}). Use the full relative path.`,
    };
  }

  return { ok: true, repos: [] };
}
