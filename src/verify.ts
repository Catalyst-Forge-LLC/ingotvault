import type { AppConfig } from "./config.js";
import type { DiscoveredRepo } from "./discover.js";
import { runGit } from "./git.js";
import type { Logger } from "./log.js";
import { accessSync, constants } from "node:fs";
import path from "node:path";

export type VerifyStatus =
  | "ok"
  | "behind"
  | "diverged"
  | "missing-mirror"
  | "no-commits"
  | "fail";

export type VerifyOutcome = {
  relativePath: string;
  mirrorPath: string;
  status: VerifyStatus;
  detail: string;
};

function mirrorExists(mirrorPath: string): boolean {
  try {
    accessSync(path.join(mirrorPath, "HEAD"), constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function listLocalBranches(
  repoPath: string,
): Promise<{ name: string; sha: string }[]> {
  const result = await runGit(
    ["for-each-ref", "--format=%(refname:short) %(objectname)", "refs/heads"],
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
      return {
        name: line.slice(0, space),
        sha: line.slice(space + 1),
      };
    })
    .filter((x): x is { name: string; sha: string } => x != null);
}

async function mirrorTip(
  mirrorPath: string,
  branch: string,
): Promise<string | null> {
  const result = await runGit(
    ["rev-parse", "--verify", `refs/heads/${branch}`],
    mirrorPath,
  );
  if (!result.ok) return null;
  return result.stdout.trim() || null;
}

async function commitsBehind(
  repoPath: string,
  localSha: string,
  mirrorSha: string,
): Promise<number | null> {
  const result = await runGit(
    ["rev-list", "--count", `${mirrorSha}..${localSha}`],
    repoPath,
  );
  if (!result.ok) return null;
  const n = Number(result.stdout.trim());
  return Number.isFinite(n) ? n : null;
}

async function isAncestor(
  repoPath: string,
  maybeAncestor: string,
  commit: string,
): Promise<boolean> {
  const result = await runGit(
    ["merge-base", "--is-ancestor", maybeAncestor, commit],
    repoPath,
  );
  return result.ok;
}

export async function verifyRepo(
  repo: DiscoveredRepo,
  _config: AppConfig,
  log: Logger,
): Promise<VerifyOutcome> {
  const base = {
    relativePath: repo.relativePath,
    mirrorPath: repo.mirrorPath,
  };

  const head = await runGit(["rev-parse", "--verify", "HEAD"], repo.repoPath);
  if (!head.ok) {
    return { ...base, status: "no-commits", detail: "no commits" };
  }

  if (!mirrorExists(repo.mirrorPath)) {
    return { ...base, status: "missing-mirror", detail: "mirror missing" };
  }

  const branches = await listLocalBranches(repo.repoPath);
  if (branches.length === 0) {
    return {
      ...base,
      status: "ok",
      detail: "no local branches (detached HEAD only)",
    };
  }

  let maxBehind = 0;
  let missingBranches = 0;
  let divergedBranches: string[] = [];
  const behindNotes: string[] = [];

  for (const branch of branches) {
    const tip = await mirrorTip(repo.mirrorPath, branch.name);
    if (!tip) {
      missingBranches += 1;
      behindNotes.push(`${branch.name}: missing on mirror`);
      continue;
    }
    if (tip === branch.sha) continue;

    // Only count "behind" when the mirror tip is a known ancestor of local.
    // Otherwise report diverged — do not rev-list across unrelated histories
    // (mirror tip may not even be in the local object store after a rebase).
    const ancestor = await isAncestor(repo.repoPath, tip, branch.sha);
    if (!ancestor) {
      divergedBranches.push(branch.name);
      continue;
    }

    const behind = await commitsBehind(repo.repoPath, branch.sha, tip);
    if (behind != null && behind > 0) {
      maxBehind = Math.max(maxBehind, behind);
      behindNotes.push(`${branch.name}: ${behind} commit(s) behind`);
    } else if (behind === null) {
      divergedBranches.push(branch.name);
    }
  }

  if (divergedBranches.length > 0) {
    log.verbose(
      `${repo.relativePath}: diverged branches: ${divergedBranches.join(", ")}`,
    );
    return {
      ...base,
      status: "diverged",
      detail: `diverged on ${divergedBranches.join(", ")}`,
    };
  }

  if (missingBranches > 0 || maxBehind > 0) {
    const parts: string[] = [];
    if (maxBehind > 0) parts.push(`mirror is up to ${maxBehind} commit(s) behind`);
    if (missingBranches > 0) {
      parts.push(`${missingBranches} branch(es) missing on mirror`);
    }
    return {
      ...base,
      status: "behind",
      detail: behindNotes.length ? behindNotes.join("; ") : parts.join("; "),
    };
  }

  return { ...base, status: "ok", detail: "refs match" };
}

export function formatVerifyOutcome(o: VerifyOutcome): string {
  const label = o.status.padEnd(14);
  const name = o.relativePath.padEnd(28);
  return `${label}  ${name}  ${o.detail}`;
}

export async function verifyAll(
  repos: DiscoveredRepo[],
  config: AppConfig,
  log: Logger,
): Promise<{ outcomes: VerifyOutcome[]; exitCode: number }> {
  const outcomes: VerifyOutcome[] = [];
  for (const repo of repos) {
    try {
      const outcome = await verifyRepo(repo, config, log);
      outcomes.push(outcome);
      log.line(formatVerifyOutcome(outcome));
    } catch (err) {
      const outcome: VerifyOutcome = {
        relativePath: repo.relativePath,
        mirrorPath: repo.mirrorPath,
        status: "fail",
        detail: (err as Error).message,
      };
      outcomes.push(outcome);
      log.line(formatVerifyOutcome(outcome));
    }
  }

  const bad = outcomes.filter((o) =>
    ["behind", "diverged", "missing-mirror", "fail"].includes(o.status),
  );
  // 3 = drift / partial failure (distinct from config errors = 1)
  return { outcomes, exitCode: bad.length > 0 ? 3 : 0 };
}
