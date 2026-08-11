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

  if (dryRun) {
    return {
      ...base,
      status: "ok",
      detail: `[dry-run] would push ${config.remoteName}`,
    };
  }

  if (config.pushAllBranches) {
    const pushAll = await pushWithSafeRetry(
      repo,
      config,
      ["push", config.remoteName, "--all"],
      log,
    );
    if (!pushAll.ok) {
      return {
        ...base,
        status: "fail",
        detail: `push --all failed: ${combinedOutput(pushAll)}`,
      };
    }
  }

  if (config.pushTags) {
    const pushTags = await pushWithSafeRetry(
      repo,
      config,
      ["push", config.remoteName, "--tags"],
      log,
    );
    if (!pushTags.ok) {
      const out = combinedOutput(pushTags).toLowerCase();
      if (!out.includes("no tags") && !out.includes("everything up-to-date")) {
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
