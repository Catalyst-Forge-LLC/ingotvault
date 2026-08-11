import { accessSync, constants, mkdirSync } from "node:fs";
import path from "node:path";
import { type AppConfig, urlsMatch } from "./config.js";
import type { DiscoveredRepo } from "./discover.js";
import { combinedOutput, isDubiousOwnership, runGit } from "./git.js";
import type { Logger } from "./log.js";
import { assertMirrorRootAvailable, MirrorUnavailableError } from "./vault.js";

export type EnsureResult =
  | { status: "ready" }
  | { status: "skip"; reason: string }
  | { status: "fail"; reason: string };

export { assertMirrorRootAvailable, MirrorUnavailableError };

export async function ensureSafeDirectory(
  mirrorPath: string,
  config: AppConfig,
  log: Logger,
): Promise<void> {
  if (config.safeDirectory === "off") return;

  const listed = await runGit([
    "config",
    "--global",
    "--get-all",
    "safe.directory",
  ]);
  const existing = listed.ok
    ? listed.stdout
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
    : [];

  if (existing.some((e) => urlsMatch(e, mirrorPath) || e === "*")) {
    return;
  }

  log.verbose(`Adding safe.directory ${mirrorPath}`);
  const add = await runGit([
    "config",
    "--global",
    "--add",
    "safe.directory",
    mirrorPath,
  ]);
  if (!add.ok) {
    throw new Error(
      `Failed to add safe.directory for ${mirrorPath}: ${combinedOutput(add)}`,
    );
  }
}

function pathLooksLikeBareRepo(mirrorPath: string): boolean {
  try {
    accessSync(path.join(mirrorPath, "HEAD"), constants.R_OK);
    accessSync(path.join(mirrorPath, "objects"), constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export async function ensureBareMirror(
  repo: DiscoveredRepo,
  config: AppConfig,
  dryRun: boolean,
  log: Logger,
): Promise<EnsureResult> {
  const probe = await runGit(["rev-parse", "--git-dir"], repo.repoPath);
  if (!probe.ok) {
    return { status: "fail", reason: `not a git repo: ${combinedOutput(probe)}` };
  }

  const head = await runGit(["rev-parse", "--verify", "HEAD"], repo.repoPath);
  if (!head.ok) {
    return { status: "skip", reason: "no commits" };
  }

  if (pathLooksLikeBareRepo(repo.mirrorPath)) {
    log.verbose(`Bare mirror exists: ${repo.mirrorPath}`);
    await ensureSafeDirectory(repo.mirrorPath, config, log).catch(() => {
      /* best-effort */
    });
    return { status: "ready" };
  }

  if (dryRun) {
    log.verbose(`[dry-run] would git init --bare ${repo.mirrorPath}`);
    return { status: "ready" };
  }

  mkdirSync(path.dirname(path.resolve(repo.mirrorPath)), { recursive: true });
  const init = await runGit(["init", "--bare", repo.mirrorPath]);
  if (!init.ok) {
    if (isDubiousOwnership(init)) {
      await ensureSafeDirectory(repo.mirrorPath, config, log);
    }
    if (!pathLooksLikeBareRepo(repo.mirrorPath)) {
      return {
        status: "fail",
        reason: `git init --bare failed: ${combinedOutput(init)}`,
      };
    }
  }

  await ensureSafeDirectory(repo.mirrorPath, config, log);
  return { status: "ready" };
}

export async function ensureBackupRemote(
  repo: DiscoveredRepo,
  config: AppConfig,
  dryRun: boolean,
  log: Logger,
): Promise<EnsureResult> {
  const remoteName = config.remoteName;
  const desired = repo.mirrorPath;

  const getUrl = await runGit(
    ["remote", "get-url", remoteName],
    repo.repoPath,
  );

  if (getUrl.ok) {
    const current = getUrl.stdout.trim();
    if (urlsMatch(current, desired)) {
      log.verbose(`${repo.relativePath}: ${remoteName} already -> ${desired}`);
      return { status: "ready" };
    }
    return {
      status: "fail",
      reason: `${remoteName} remote points at ${current}; expected ${desired}`,
    };
  }

  const remotes = await runGit(["remote"], repo.repoPath);
  const names = remotes.ok
    ? remotes.stdout
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
    : [];

  if (names.includes(remoteName)) {
    return {
      status: "fail",
      reason: `${remoteName} remote exists but URL could not be read: ${combinedOutput(getUrl)}`,
    };
  }

  if (dryRun) {
    log.verbose(
      `[dry-run] would git remote add ${remoteName} ${desired} in ${repo.relativePath}`,
    );
    return { status: "ready" };
  }

  const add = await runGit(
    ["remote", "add", remoteName, desired],
    repo.repoPath,
  );
  if (!add.ok) {
    return {
      status: "fail",
      reason: `remote add failed: ${combinedOutput(add)}`,
    };
  }

  log.verbose(`${repo.relativePath}: added ${remoteName} -> ${desired}`);
  return { status: "ready" };
}
