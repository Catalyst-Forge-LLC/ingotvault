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
    text.includes("already exists") ||
    text.includes("failed to push some refs")
  );
}

function divergedDetail(forceEnabled: boolean): string {
  const renameHint =
    "Rename the mirror under mirrorRoot/_diverged/ " +
    "(e.g. mkdir -p \"$mirrorRoot/_diverged\" && mv notes.git _diverged/notes.diverged-YYYY-MM-DD.git) " +
    "and re-run so a fresh mirror is created while old history survives.";
  if (forceEnabled) {
    return (
      "DIVERGED: force update rejected (mirror tip changed during the run, or lease mismatch). " +
      "Do not delete the bare mirror. " +
      renameHint
    );
  }
  return (
    "DIVERGED: mirror rejected a non-fast-forward update (rebase/amend?). " +
    "Mirror may hold history you no longer have locally — do not delete it. " +
    "Re-run with --force-with-lease --repo <path> (preserves missing mirror tips under " +
    "refs/ingotvault/preforce/… then leases against ls-remote tips), or " +
    renameHint
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

async function objectExistsLocally(
  repoPath: string,
  oid: string,
): Promise<boolean> {
  const r = await runGit(["cat-file", "-e", `${oid}^{object}`], repoPath);
  return r.ok;
}

async function lsRemoteRefs(
  repo: DiscoveredRepo,
  config: AppConfig,
  log: Logger,
): Promise<Map<string, string>> {
  const result = await pushWithSafeRetry(
    repo,
    config,
    ["ls-remote", config.remoteName],
    log,
  );
  const map = new Map<string, string>();
  if (!result.ok) return map;
  for (const line of result.stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const tab = trimmed.indexOf("\t");
    const space = trimmed.indexOf(" ");
    const sep = tab >= 0 ? tab : space;
    if (sep <= 0) continue;
    const oid = trimmed.slice(0, sep).trim();
    let ref = trimmed.slice(sep + 1).trim();
    if (ref.endsWith("^{}")) continue; // peel lines
    map.set(ref, oid);
  }
  return map;
}

async function listLocalRefs(
  repoPath: string,
  pattern: string,
): Promise<{ ref: string; sha: string }[]> {
  const result = await runGit(
    ["for-each-ref", "--format=%(refname) %(objectname)", pattern],
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

function keepRefName(ref: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const short = ref.replace(/^refs\//, "").replace(/\//g, "-");
  return `refs/ingotvault/preforce/${stamp}/${short}`;
}

/**
 * Ensure the mirror's current tip OID is reachable locally before force-updating.
 * Fetches into refs/ingotvault/preforce/… when missing.
 */
async function preserveMirrorTip(
  repo: DiscoveredRepo,
  config: AppConfig,
  ref: string,
  remoteOid: string,
  log: Logger,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  if (await objectExistsLocally(repo.repoPath, remoteOid)) {
    return { ok: true };
  }
  const keep = keepRefName(ref);
  log.line(
    `warn  ${repo.relativePath.padEnd(28)}  preserving mirror tip ${remoteOid.slice(0, 8)}… at ${keep}`,
  );
  const fetch = await pushWithSafeRetry(
    repo,
    config,
    ["fetch", config.remoteName, `+${ref}:${keep}`],
    log,
  );
  if (!fetch.ok) {
    // Fallback: fetch by OID if the remote still serves it
    const byOid = await pushWithSafeRetry(
      repo,
      config,
      ["fetch", config.remoteName, remoteOid],
      log,
    );
    if (!byOid.ok) {
      return {
        ok: false,
        detail: `cannot fetch mirror tip ${remoteOid} for ${ref} before force: ${combinedOutput(fetch)}`,
      };
    }
    await runGit(["update-ref", keep, remoteOid], repo.repoPath);
  }
  if (!(await objectExistsLocally(repo.repoPath, remoteOid))) {
    return {
      ok: false,
      detail: `mirror tip ${remoteOid} for ${ref} still missing locally after fetch`,
    };
  }
  return { ok: true };
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

/**
 * Force-update one ref with an explicit lease against the ls-remote tip
 * (never refresh remote-tracking refs first — that would defeat the lease).
 */
async function forcePushRef(
  repo: DiscoveredRepo,
  config: AppConfig,
  ref: string,
  localSha: string,
  remoteOid: string,
  log: Logger,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  const preserved = await preserveMirrorTip(
    repo,
    config,
    ref,
    remoteOid,
    log,
  );
  if (!preserved.ok) return preserved;

  const push = await pushWithSafeRetry(
    repo,
    config,
    [
      "push",
      `--force-with-lease=${ref}:${remoteOid}`,
      config.remoteName,
      `${localSha}:${ref}`,
    ],
    log,
  );
  if (!push.ok) {
    if (isNonFastForward(push)) {
      return { ok: false, detail: divergedDetail(true) };
    }
    return {
      ok: false,
      detail: `force push ${ref} failed: ${combinedOutput(push)}`,
    };
  }
  return { ok: true };
}

async function pushForceWithRealLease(
  repo: DiscoveredRepo,
  config: AppConfig,
  log: Logger,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  const remote = await lsRemoteRefs(repo, config, log);
  const heads = config.pushAllBranches
    ? await listLocalRefs(repo.repoPath, "refs/heads")
    : [];
  const tags = config.pushTags
    ? await listLocalRefs(repo.repoPath, "refs/tags")
    : [];
  const notes = await listLocalRefs(repo.repoPath, "refs/notes");
  const replace = await listLocalRefs(repo.repoPath, "refs/replace");

  for (const { ref, sha } of [...heads, ...tags, ...notes, ...replace]) {
    const remoteOid = remote.get(ref);
    if (!remoteOid) {
      const push = await pushWithSafeRetry(
        repo,
        config,
        ["push", config.remoteName, `${sha}:${ref}`],
        log,
      );
      if (!push.ok) {
        return {
          ok: false,
          detail: `push ${ref} failed: ${combinedOutput(push)}`,
        };
      }
      continue;
    }
    if (remoteOid === sha) continue;

    const ff = await isAncestor(repo.repoPath, remoteOid, sha);
    if (ff) {
      const push = await pushWithSafeRetry(
        repo,
        config,
        ["push", config.remoteName, `${sha}:${ref}`],
        log,
      );
      if (!push.ok) {
        if (isNonFastForward(push)) {
          // Race: tip moved; fall through to leased force after re-ls-remote
          const again = await lsRemoteRefs(repo, config, log);
          const tip = again.get(ref) ?? remoteOid;
          const forced = await forcePushRef(repo, config, ref, sha, tip, log);
          if (!forced.ok) return forced;
          continue;
        }
        return {
          ok: false,
          detail: `push ${ref} failed: ${combinedOutput(push)}`,
        };
      }
      continue;
    }

    // Diverged: preserve tip if needed, then explicit lease
    const forced = await forcePushRef(repo, config, ref, sha, remoteOid, log);
    if (!forced.ok) return forced;
  }

  return { ok: true };
}

/** Prefer origin's default branch, then common names, then current branch. */
export async function resolveCloneBranch(
  repoPath: string,
): Promise<string | null> {
  const originHead = await runGit(
    ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"],
    repoPath,
  );
  if (originHead.ok) {
    const short = originHead.stdout.trim().replace(/^origin\//, "");
    if (short) {
      const exists = await runGit(
        ["rev-parse", "--verify", `refs/heads/${short}`],
        repoPath,
      );
      if (exists.ok) return short;
    }
  }

  for (const name of ["main", "master"]) {
    const exists = await runGit(
      ["rev-parse", "--verify", `refs/heads/${name}`],
      repoPath,
    );
    if (exists.ok) return name;
  }

  const cfg = await runGit(["config", "--get", "init.defaultBranch"], repoPath);
  if (cfg.ok) {
    const name = cfg.stdout.trim();
    if (name) {
      const exists = await runGit(
        ["rev-parse", "--verify", `refs/heads/${name}`],
        repoPath,
      );
      if (exists.ok) return name;
    }
  }

  const sym = await runGit(["symbolic-ref", "--quiet", "--short", "HEAD"], repoPath);
  if (sym.ok) {
    const name = sym.stdout.trim();
    if (name) return name;
  }

  return null;
}

/** Point bare mirror HEAD at a stable default branch for clean clones. */
export async function syncMirrorHead(
  repo: DiscoveredRepo,
  log: Logger,
): Promise<void> {
  const branch = await resolveCloneBranch(repo.repoPath);
  if (!branch) {
    log.verbose(
      `${repo.relativePath}: leave mirror HEAD unchanged (no default branch resolved)`,
    );
    return;
  }

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

async function pushNotesAndReplace(
  repo: DiscoveredRepo,
  config: AppConfig,
  log: Logger,
): Promise<{ ok: true } | { ok: false; detail: string }> {
  for (const spec of [
    "refs/notes/*:refs/notes/*",
    "refs/replace/*:refs/replace/*",
  ] as const) {
    const push = await pushWithSafeRetry(
      repo,
      config,
      ["push", config.remoteName, spec],
      log,
    );
    if (!push.ok) {
      const out = combinedOutput(push).toLowerCase();
      // Empty namespace is fine
      if (
        out.includes("src refspec") ||
        out.includes("does not match") ||
        out.includes("no refs in common") ||
        out.includes("everything up-to-date")
      ) {
        continue;
      }
      if (isNonFastForward(push)) {
        return { ok: false, detail: divergedDetail(false) };
      }
      // Some git versions error when the glob matches nothing — treat as ok
      if (out.includes("no such ref") || out.includes("not found")) continue;
      log.verbose(`${repo.relativePath}: push ${spec}: ${combinedOutput(push)}`);
    }
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
      ? " ls-remote + leased force-push (keep missing tips)"
      : " push";
    return {
      ...base,
      status: "ok",
      detail: `[dry-run] would${forceNote} ${config.remoteName}`,
    };
  }

  if (forceWithLease) {
    const forced = await pushForceWithRealLease(repo, config, log);
    if (!forced.ok) {
      return { ...base, status: "fail", detail: forced.detail };
    }
  } else {
    if (config.pushAllBranches) {
      const pushAll = await pushWithSafeRetry(
        repo,
        config,
        ["push", config.remoteName, "--all"],
        log,
      );
      if (!pushAll.ok) {
        if (isNonFastForward(pushAll)) {
          return {
            ...base,
            status: "fail",
            detail: divergedDetail(false),
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
      const pushTags = await pushWithSafeRetry(
        repo,
        config,
        ["push", config.remoteName, "--tags"],
        log,
      );
      if (!pushTags.ok) {
        const out = combinedOutput(pushTags).toLowerCase();
        if (!out.includes("no tags") && !out.includes("everything up-to-date")) {
          if (isNonFastForward(pushTags)) {
            return {
              ...base,
              status: "fail",
              detail: divergedDetail(false),
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

    const notes = await pushNotesAndReplace(repo, config, log);
    if (!notes.ok) {
      return { ...base, status: "fail", detail: notes.detail };
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
