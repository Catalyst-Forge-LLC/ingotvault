import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { AppConfig } from "./config.js";
import type { DiscoveredRepo } from "./discover.js";
import {
  ensureBackupRemote,
  ensureBareMirror,
  ensureSafeDirectory,
} from "./ensureBackup.js";
import { combinedOutput, isDubiousOwnership, runGit } from "./git.js";
import type { Logger } from "./log.js";

export type RepoOutcome = {
  relativePath: string;
  mirrorPath: string;
  status: "ok" | "skip" | "fail";
  detail: string;
};

function isNonFastForward(result: Awaited<ReturnType<typeof runGit>>): boolean {
  const text = combinedOutput(result).toLowerCase();
  return (
    text.includes("non-fast-forward") ||
    text.includes("fetch first") ||
    text.includes("stale info") ||
    (text.includes("rejected") && text.includes("! [rejected]")) ||
    text.includes("failed to push some refs")
  );
}

function divergedDetail(forceEnabled: boolean): string {
  if (forceEnabled) {
    return (
      "DIVERGED: push rejected even with --force-with-lease. " +
      "Inspect the bare mirror; do not delete it (it may hold pre-rebase history). " +
      "Rename it aside (e.g. mv foo.git foo.diverged-YYYY-MM-DD.git) and re-run to create a fresh mirror, " +
      "or git fetch backup then recover old tips locally before retrying."
    );
  }
  return (
    "DIVERGED: mirror rejected a non-fast-forward update (rebase/amend?). " +
    "Mirror is stale and may hold history you no longer have locally — do not delete it. " +
    "Re-run with --force-with-lease (fetches backup first), or rename the mirror aside " +
    "(e.g. mv foo.git foo.diverged-YYYY-MM-DD.git) and re-run so a fresh mirror is created."
  );
}

export function repoUsesLfs(repoPath: string): boolean {
  const attrPath = path.join(repoPath, ".gitattributes");
  if (!existsSync(attrPath)) return false;
  try {
    const text = readFileSync(attrPath, "utf8");
    return /filter\s*=\s*lfs/i.test(text);
  } catch {
    return false;
  }
}

async function pushWithSafeRetry(
  repo: DiscoveredRepo,
  config: AppConfig,
  args: string[],
  log: Logger,
): Promise<Awaited<ReturnType<typeof runGit>>> {
  let result = await runGit(args, repo.repoPath);
  if (!result.ok && isDubiousOwnership(result)) {
    await ensureSafeDirectory(repo.mirrorPath, config, log);
    result = await runGit(args, repo.repoPath);
  }
  return result;
}

/** Point bare mirror HEAD at the source repo's current branch so clone checks out cleanly. */
export async function syncMirrorHead(
  repo: DiscoveredRepo,
  log: Logger,
): Promise<void> {
  const sym = await runGit(
    ["symbolic-ref", "--short", "HEAD"],
    repo.repoPath,
  );
  if (!sym.ok) {
    log.verbose(
      `${repo.relativePath}: skip mirror HEAD sync (detached HEAD or no symbolic ref)`,
    );
    return;
  }
  const branch = sym.stdout.trim();
  if (!branch) return;

  const set = await runGit(
    ["symbolic-ref", "HEAD", `refs/heads/${branch}`],
    repo.mirrorPath,
  );
  if (!set.ok) {
    log.verbose(
      `${repo.relativePath}: could not set mirror HEAD to ${branch}: ${combinedOutput(set)}`,
    );
    return;
  }
  log.verbose(`${repo.relativePath}: mirror HEAD -> refs/heads/${branch}`);
}

/**
 * --force-with-lease needs up-to-date remote-tracking refs.
 * Without a prior fetch, refs/remotes/<backup>/* is often missing and the lease fails oddly.
 */
async function fetchBackupForLease(
  repo: DiscoveredRepo,
  config: AppConfig,
  log: Logger,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  log.verbose(`${repo.relativePath}: fetch ${config.remoteName} before force-with-lease`);
  const fetch = await pushWithSafeRetry(
    repo,
    config,
    ["fetch", config.remoteName],
    log,
  );
  if (!fetch.ok) {
    return {
      ok: false,
      detail: `fetch ${config.remoteName} failed (needed for --force-with-lease): ${combinedOutput(fetch)}`,
    };
  }
  return { ok: true };
}

export async function processRepo(
  repo: DiscoveredRepo,
  config: AppConfig,
  dryRun: boolean,
  log: Logger,
  forceWithLease: boolean,
): Promise<RepoOutcome> {
  const base = {
    relativePath: repo.relativePath,
    mirrorPath: repo.mirrorPath,
  };

  const bare = await ensureBareMirror(repo, config, dryRun, log);
  if (bare.status === "skip") {
    return { ...base, status: "skip", detail: bare.reason };
  }
  if (bare.status === "fail") {
    return { ...base, status: "fail", detail: bare.reason };
  }

  const remote = await ensureBackupRemote(repo, config, dryRun, log);
  if (remote.status === "fail") {
    return { ...base, status: "fail", detail: remote.reason };
  }
  if (remote.status === "skip") {
    return { ...base, status: "skip", detail: remote.reason };
  }

  if (repoUsesLfs(repo.repoPath)) {
    log.line(
      `warn  ${repo.relativePath.padEnd(28)}  Git LFS detected — bare push stores pointer files only, not LFS objects`,
    );
  }

  if (dryRun) {
    const forceNote = forceWithLease
      ? " fetch + push --force-with-lease"
      : " push";
    return {
      ...base,
      status: "ok",
      detail: `[dry-run] would${forceNote} ${config.remoteName}`,
    };
  }

  if (forceWithLease) {
    const fetched = await fetchBackupForLease(repo, config, log);
    if (!fetched.ok) {
      return { ...base, status: "fail", detail: fetched.detail };
    }
  }

  const forceArgs = forceWithLease ? ["--force-with-lease"] : [];

  if (config.pushAllBranches) {
    const pushAll = await pushWithSafeRetry(
      repo,
      config,
      ["push", ...forceArgs, config.remoteName, "--all"],
      log,
    );
    if (!pushAll.ok) {
      if (isNonFastForward(pushAll)) {
        return {
          ...base,
          status: "fail",
          detail: divergedDetail(forceWithLease),
        };
      }
      return {
        ...base,
        status: "fail",
        detail: `push --all failed: ${combinedOutput(pushAll)}`,
      };
    }
  }

  if (config.pushTags) {
    // Tags: lease applies to branch updates; for tags use --force when opted in.
    const tagForce = forceWithLease ? ["--force"] : [];
    const pushTags = await pushWithSafeRetry(
      repo,
      config,
      ["push", ...tagForce, config.remoteName, "--tags"],
      log,
    );
    if (!pushTags.ok) {
      const out = combinedOutput(pushTags).toLowerCase();
      if (!out.includes("no tags") && !out.includes("everything up-to-date")) {
        if (isNonFastForward(pushTags) || out.includes("already exists")) {
          return {
            ...base,
            status: "fail",
            detail: forceWithLease
              ? `push --tags failed: ${combinedOutput(pushTags)}`
              : divergedDetail(false),
          };
        }
        return {
          ...base,
          status: "fail",
          detail: `push --tags failed: ${combinedOutput(pushTags)}`,
        };
      }
    }
  }

  await syncMirrorHead(repo, log);

  return { ...base, status: "ok", detail: `-> ${repo.mirrorPath}` };
}

export function formatOutcome(o: RepoOutcome): string {
  const label = o.status.padEnd(4);
  const name = o.relativePath.padEnd(28);
  if (o.status === "ok") {
    return `${label}  ${name}  ${o.detail}`;
  }
  if (o.status === "skip") {
    return `${label}  ${name}  (${o.detail})`;
  }
  return `${label}  ${name}  ${o.detail}`;
}
