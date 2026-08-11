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
    (text.includes("rejected") && text.includes("! [rejected]")) ||
    text.includes("failed to push some refs")
  );
}

function divergedDetail(forceEnabled: boolean): string {
  if (forceEnabled) {
    return "DIVERGED: push rejected even with --force-with-lease (remote tip moved unexpectedly). Inspect the bare mirror before deleting it.";
  }
  return (
    "DIVERGED: mirror rejected a non-fast-forward update (rebase/amend?). " +
    "Mirror is stale. Re-run with --force-with-lease, set allowForceWithLease in config, " +
    "or delete the bare mirror and re-run to recreate it."
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
    const forceNote = forceWithLease ? " --force-with-lease" : "";
    return {
      ...base,
      status: "ok",
      detail: `[dry-run] would push${forceNote} ${config.remoteName}`,
    };
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
    // Tags: --force-with-lease applies to branch updates; for tags use --force when opted in.
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
