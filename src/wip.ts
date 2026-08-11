import { unlinkSync } from "node:fs";
import { hostname } from "node:os";
import path from "node:path";
import type { AppConfig } from "./config.js";
import type { DiscoveredRepo } from "./discover.js";
import { combinedOutput, runGit } from "./git.js";
import type { Logger } from "./log.js";

function sanitizeRefSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "x";
}

async function worktreeDirty(worktreePath: string): Promise<boolean> {
  const status = await runGit(["status", "--porcelain"], worktreePath);
  return status.ok && status.stdout.trim().length > 0;
}

async function listWorktreePaths(repoPath: string): Promise<string[]> {
  const listed = await runGit(["worktree", "list", "--porcelain"], repoPath);
  if (!listed.ok) return [repoPath];
  const paths: string[] = [];
  for (const line of listed.stdout.split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      paths.push(line.slice("worktree ".length).trim());
    }
  }
  return paths.length > 0 ? paths : [repoPath];
}

/**
 * Snapshot dirty index + worktree (including untracked, excluding .gitignore
 * and optional wipExclude pathspecs) as a commit at
 * refs/ingotvault/wip/<host>/<slug>/<timestamp> without mutating the worktree.
 *
 * Uses `git add -A`, which respects ignore rules — secrets that stay gitignored
 * are not swept into the append-only mirror.
 */
async function createWipCommit(
  worktreePath: string,
  message: string,
  wipExclude: string[],
): Promise<{ ok: true; oid: string } | { ok: false; detail: string }> {
  const gitDir = await runGit(["rev-parse", "--git-common-dir"], worktreePath);
  if (!gitDir.ok) {
    return { ok: false, detail: `git-common-dir: ${combinedOutput(gitDir)}` };
  }
  const common = gitDir.stdout.trim();
  const indexPath = path.resolve(
    worktreePath,
    common,
    `ingotvault-wip-${process.pid}.index`,
  );
  const env = { GIT_INDEX_FILE: indexPath };

  try {
    const head = await runGit(["rev-parse", "--verify", "HEAD"], worktreePath);
    if (!head.ok) {
      return { ok: false, detail: "no HEAD for WIP capture" };
    }

    const read = await runGit(["read-tree", "HEAD"], worktreePath, env);
    if (!read.ok) {
      return { ok: false, detail: `read-tree: ${combinedOutput(read)}` };
    }

    const addArgs = ["add", "-A", "--", "."];
    for (const pattern of wipExclude) {
      const p = pattern.trim();
      if (!p) continue;
      // Extra pathspec excludes beyond .gitignore / .git/info/exclude.
      addArgs.push(
        p.startsWith(":(") || p.startsWith(":!") ? p : `:(exclude)${p}`,
      );
    }
    const add = await runGit(addArgs, worktreePath, env);
    if (!add.ok) {
      return { ok: false, detail: `add -A: ${combinedOutput(add)}` };
    }

    const tree = await runGit(["write-tree"], worktreePath, env);
    if (!tree.ok) {
      return { ok: false, detail: `write-tree: ${combinedOutput(tree)}` };
    }

    const commit = await runGit(
      [
        "commit-tree",
        tree.stdout.trim(),
        "-p",
        head.stdout.trim(),
        "-m",
        message,
      ],
      worktreePath,
    );
    if (!commit.ok) {
      return { ok: false, detail: `commit-tree: ${combinedOutput(commit)}` };
    }
    return { ok: true, oid: commit.stdout.trim() };
  } finally {
    try {
      unlinkSync(indexPath);
    } catch {
      /* ignore */
    }
  }
}

async function listWipRefs(
  repoPath: string,
): Promise<{ ref: string; sha: string }[]> {
  const result = await runGit(
    [
      "for-each-ref",
      "--format=%(refname) %(objectname)",
      "refs/ingotvault/wip",
    ],
    repoPath,
  );
  if (!result.ok) return [];
  return result.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const space = line.lastIndexOf(" ");
      if (space <= 0) return null;
      return { ref: line.slice(0, space), sha: line.slice(space + 1) };
    })
    .filter((x): x is { ref: string; sha: string } => x != null);
}

async function pruneWipRefs(
  repoPath: string,
  keep: number,
  log: Logger,
  relativePath: string,
): Promise<number> {
  if (keep <= 0) return 0;
  const refs = await listWipRefs(repoPath);
  refs.sort((a, b) => b.ref.localeCompare(a.ref));
  const drop = refs.slice(keep);
  for (const r of drop) {
    log.verbose(`${relativePath}: prune WIP ${r.ref}`);
    await runGit(["update-ref", "-d", r.ref], repoPath);
  }
  return drop.length;
}

export type WipCaptureResult =
  | { status: "skipped"; detail: string }
  | { status: "ok"; detail: string; refs: string[] }
  | { status: "fail"; detail: string };

/**
 * Opt-in dirty-tree snapshots for agent-assisted workflows.
 * Does not change the headline commits-only promise when disabled.
 */
export async function captureAndPushWip(
  repo: DiscoveredRepo,
  config: AppConfig,
  log: Logger,
): Promise<WipCaptureResult> {
  const host = sanitizeRefSegment(hostname());
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace(/Z$/, "Z");
  const worktrees = await listWorktreePaths(repo.repoPath);
  const created: string[] = [];

  for (const wt of worktrees) {
    if (!(await worktreeDirty(wt))) continue;

    const slug = sanitizeRefSegment(
      path.basename(wt) === path.basename(repo.repoPath)
        ? "main"
        : path.relative(repo.repoPath, wt) || path.basename(wt),
    );
    const ref = `refs/ingotvault/wip/${host}/${slug}/${stamp}`;
    const message = `ingotvault wip ${host} ${slug} ${stamp}`;
    const commit = await createWipCommit(wt, message, config.wipExclude);
    if (!commit.ok) {
      return { status: "fail", detail: `WIP capture (${slug}): ${commit.detail}` };
    }
    const upd = await runGit(
      ["update-ref", ref, commit.oid],
      repo.repoPath,
    );
    if (!upd.ok) {
      return {
        status: "fail",
        detail: `update-ref ${ref}: ${combinedOutput(upd)}`,
      };
    }
    created.push(ref);
    log.verbose(`${repo.relativePath}: WIP ${ref} -> ${commit.oid.slice(0, 8)}`);
  }

  if (created.length === 0) {
    return { status: "skipped", detail: "worktree clean (no WIP snapshot)" };
  }

  await pruneWipRefs(
    repo.repoPath,
    config.wipRetention,
    log,
    repo.relativePath,
  );

  const push = await runGit(
    [
      "push",
      "--prune",
      config.remoteName,
      "refs/ingotvault/wip/*:refs/ingotvault/wip/*",
    ],
    repo.repoPath,
  );
  if (!push.ok) {
    const out = combinedOutput(push).toLowerCase();
    if (!out.includes("everything up-to-date")) {
      return {
        status: "fail",
        detail: `push WIP refs failed: ${combinedOutput(push)}`,
      };
    }
  }

  return {
    status: "ok",
    detail: `WIP ${created.length} snapshot(s)`,
    refs: created,
  };
}
