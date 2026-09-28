import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import type { AppConfig } from "./config.js";
import type { DiscoveredRepo } from "./discover.js";
import { combinedOutput, runGit } from "./git.js";
import type { Logger } from "./log.js";
import { normalizeSlashes, urlsMatch } from "./paths.js";

export type RelinkOutcome = {
  relativePath: string;
  status: "ok" | "skip" | "fail";
  detail: string;
};

function looksLikeBareRepo(mirrorPath: string): boolean {
  try {
    accessSync(path.join(mirrorPath, "HEAD"), constants.R_OK);
    accessSync(path.join(mirrorPath, "objects"), constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/** True when the bare repo has at least one ref. An `init --bare` with no commits is false. */
function bareRepoHasHistory(mirrorPath: string): boolean {
  const packed = path.join(mirrorPath, "packed-refs");
  if (existsSync(packed)) {
    const text = readFileSync(packed, "utf8");
    if (/^[0-9a-f]{4,}\s+\S/im.test(text)) return true;
  }
  const refsDir = path.join(mirrorPath, "refs");
  const stack = [refsDir];
  while (stack.length) {
    const dir = stack.pop();
    if (!dir || !existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const child = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(child);
      else if (entry.isFile()) return true;
    }
  }
  return false;
}

/**
 * When renaming style changes (flat `foo-bar.git` → path-tree `foo/bar.git`),
 * move the bare mirror on disk if the old path still holds history and the new
 * path is empty.
 */
export function migrateMirrorOnDisk(
  currentUrl: string,
  desiredPath: string,
  dryRun: boolean,
): { ok: true; moved: boolean; detail: string } | { ok: false; detail: string } {
  const currentPath = path.resolve(currentUrl);
  const desired = path.resolve(desiredPath);

  if (urlsMatch(currentPath, desired)) {
    return { ok: true, moved: false, detail: "paths already match" };
  }

  const currentExists = looksLikeBareRepo(currentPath);
  let desiredExists = looksLikeBareRepo(desired);

  if (currentExists && desiredExists && bareRepoHasHistory(desired)) {
    return {
      ok: false,
      detail:
        `both mirrors exist — resolve manually before relink: ` +
        `${normalizeSlashes(currentPath)} and ${normalizeSlashes(desired)}`,
    };
  }

  if (currentExists && desiredExists && !bareRepoHasHistory(desired)) {
    if (dryRun) {
      return {
        ok: true,
        moved: true,
        detail:
          `[dry-run] would replace empty ${normalizeSlashes(desired)} ` +
          `and move ${normalizeSlashes(currentPath)} -> ${normalizeSlashes(desired)}`,
      };
    }
    rmSync(desired, { recursive: true, force: true });
    desiredExists = false;
  }

  if (currentExists && !desiredExists) {
    if (existsSync(desired)) {
      return {
        ok: false,
        detail: `destination exists but is not a bare repo: ${normalizeSlashes(desired)}`,
      };
    }
    if (dryRun) {
      return {
        ok: true,
        moved: true,
        detail: `[dry-run] would move ${normalizeSlashes(currentPath)} -> ${normalizeSlashes(desired)}`,
      };
    }
    mkdirSync(path.dirname(desired), { recursive: true });
    try {
      renameSync(currentPath, desired);
    } catch (err) {
      return {
        ok: false,
        detail: `move failed: ${(err as Error).message}`,
      };
    }
    return {
      ok: true,
      moved: true,
      detail: `moved ${normalizeSlashes(currentPath)} -> ${normalizeSlashes(desired)}`,
    };
  }

  // Old path gone (or never a bare repo): just retarget the remote.
  return { ok: true, moved: false, detail: "no on-disk move needed" };
}

/**
 * Point the managed backup remote at the current mirror path. If the remote
 * still names an old flat-layout mirror that exists on disk, move that bare
 * repo into the path-tree location first so history is preserved.
 */
export async function relinkRepo(
  repo: DiscoveredRepo,
  config: AppConfig,
  dryRun: boolean,
  log: Logger,
): Promise<RelinkOutcome> {
  const base = { relativePath: repo.relativePath };
  const remoteName = config.remoteName;
  const desired = repo.mirrorPath;

  const getUrl = await runGit(["remote", "get-url", remoteName], repo.repoPath);
  if (!getUrl.ok) {
    return {
      ...base,
      status: "skip",
      detail: `no ${remoteName} remote`,
    };
  }

  const current = getUrl.stdout.trim();
  if (urlsMatch(current, desired)) {
    return {
      ...base,
      status: "ok",
      detail: `already -> ${desired}`,
    };
  }

  const migrated = migrateMirrorOnDisk(current, desired, dryRun);
  if (!migrated.ok) {
    return { ...base, status: "fail", detail: migrated.detail };
  }
  if (migrated.moved) {
    log.verbose(`${repo.relativePath}: ${migrated.detail}`);
  }

  if (dryRun) {
    const moveNote = migrated.moved ? `; ${migrated.detail}` : "";
    return {
      ...base,
      status: "ok",
      detail: `[dry-run] ${current} -> ${desired}${moveNote}`,
    };
  }

  const set = await runGit(
    ["remote", "set-url", remoteName, desired],
    repo.repoPath,
  );
  if (!set.ok) {
    return {
      ...base,
      status: "fail",
      detail: `set-url failed: ${combinedOutput(set)}`,
    };
  }

  const moveNote = migrated.moved ? `; ${migrated.detail}` : "";
  return {
    ...base,
    status: "ok",
    detail: `${current} -> ${desired}${moveNote}`,
  };
}
