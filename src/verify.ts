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

async function listLocalRefs(
  repoPath: string,
  namespace: string,
): Promise<{ name: string; sha: string }[]> {
  const result = await runGit(
    ["for-each-ref", "--format=%(refname:short) %(objectname)", namespace],
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

async function mirrorRefTip(
  mirrorPath: string,
  fullRef: string,
): Promise<string | null> {
  const result = await runGit(
    ["rev-parse", "--verify", fullRef],
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

  const branches = await listLocalRefs(repo.repoPath, "refs/heads");
  const tags = await listLocalRefs(repo.repoPath, "refs/tags");

  if (branches.length === 0 && tags.length === 0) {
    return {
      ...base,
      status: "ok",
      detail: "no local branches or tags",
    };
  }

  let maxBehind = 0;
  let missingRefs = 0;
  let divergedRefs: string[] = [];
  const notes: string[] = [];

  for (const branch of branches) {
    const tip = await mirrorRefTip(
      repo.mirrorPath,
      `refs/heads/${branch.name}`,
    );
    if (!tip) {
      missingRefs += 1;
      notes.push(`${branch.name}: missing on mirror`);
      continue;
    }
    if (tip === branch.sha) continue;

    const ancestor = await isAncestor(repo.repoPath, tip, branch.sha);
    if (!ancestor) {
      divergedRefs.push(branch.name);
      continue;
    }

    const behind = await commitsBehind(repo.repoPath, branch.sha, tip);
    if (behind != null && behind > 0) {
      maxBehind = Math.max(maxBehind, behind);
      notes.push(`${branch.name}: ${behind} commit(s) behind`);
    } else if (behind === null) {
      divergedRefs.push(branch.name);
    }
  }

  for (const tag of tags) {
    const tip = await mirrorRefTip(repo.mirrorPath, `refs/tags/${tag.name}`);
    if (!tip) {
      missingRefs += 1;
      notes.push(`tag ${tag.name}: missing on mirror`);
      continue;
    }
    if (tip !== tag.sha) {
      // Tags should be immutable; any tip mismatch is divergence.
      divergedRefs.push(`tag:${tag.name}`);
    }
  }

  if (divergedRefs.length > 0) {
    log.verbose(
      `${repo.relativePath}: diverged: ${divergedRefs.join(", ")}`,
    );
    return {
      ...base,
      status: "diverged",
      detail: `diverged on ${divergedRefs.join(", ")}`,
    };
  }

  if (missingRefs > 0 || maxBehind > 0) {
    const parts: string[] = [];
    if (maxBehind > 0) parts.push(`mirror is up to ${maxBehind} commit(s) behind`);
    if (missingRefs > 0) {
      parts.push(`${missingRefs} ref(s) missing on mirror`);
    }
    return {
      ...base,
      status: "behind",
      detail: notes.length ? notes.join("; ") : parts.join("; "),
    };
  }

  return { ...base, status: "ok", detail: "refs match" };
}

export function formatVerifyOutcome(o: VerifyOutcome): string {
  const label = o.status.padEnd(14);
  const name = o.relativePath.padEnd(28);
  return `${label}  ${name}  ${o.detail}`;
}

export function summarizeVerify(outcomes: VerifyOutcome[]): string {
  const counts = {
    ok: 0,
    behind: 0,
    diverged: 0,
    "missing-mirror": 0,
    "no-commits": 0,
    fail: 0,
  };
  for (const o of outcomes) {
    counts[o.status] += 1;
  }
  const parts = [
    `${counts.ok} ok`,
    counts.diverged ? `${counts.diverged} diverged` : null,
    counts.behind ? `${counts.behind} behind` : null,
    counts["missing-mirror"] ? `${counts["missing-mirror"]} missing` : null,
    counts.fail ? `${counts.fail} fail` : null,
    counts["no-commits"] ? `${counts["no-commits"]} no-commits` : null,
  ].filter(Boolean);
  return parts.join(", ");
}

export async function verifyAll(
  repos: DiscoveredRepo[],
  config: AppConfig,
  log: Logger,
): Promise<{ outcomes: VerifyOutcome[]; exitCode: number; clean: boolean }> {
  const outcomes: VerifyOutcome[] = [];
  for (const repo of repos) {
    try {
      const outcome = await verifyRepo(repo, config, log);
      outcomes.push(outcome);
    } catch (err) {
      outcomes.push({
        relativePath: repo.relativePath,
        mirrorPath: repo.mirrorPath,
        status: "fail",
        detail: (err as Error).message,
      });
    }
  }

  const bad = outcomes.filter((o) =>
    ["behind", "diverged", "missing-mirror", "fail"].includes(o.status),
  );
  const clean = bad.length === 0;

  // 3 = drift / partial failure (distinct from config errors = 1)
  return { outcomes, exitCode: clean ? 0 : 3, clean };
}
