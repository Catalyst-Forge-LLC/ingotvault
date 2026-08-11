import type { AppConfig } from "./config.js";
import type { DiscoveredRepo } from "./discover.js";
import { combinedOutput, runGit } from "./git.js";
import type { Logger } from "./log.js";
import { urlsMatch } from "./paths.js";

export type RelinkOutcome = {
  relativePath: string;
  status: "ok" | "skip" | "fail";
  detail: string;
};

/**
 * Point the managed backup remote at the current mirror path when it still
 * targets an old mirrorRoot. Requires an initialized vault (caller asserts).
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

  if (dryRun) {
    log.verbose(
      `[dry-run] would set-url ${remoteName} ${desired} (was ${current})`,
    );
    return {
      ...base,
      status: "ok",
      detail: `[dry-run] ${current} -> ${desired}`,
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

  return {
    ...base,
    status: "ok",
    detail: `${current} -> ${desired}`,
  };
}
