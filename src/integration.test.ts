import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import type { AppConfig } from "./config.js";
import { discoverRepos } from "./discover.js";
import { runGit } from "./git.js";
import { createLogger } from "./log.js";
import { processRepo } from "./push.js";
import {
  assertMirrorRootAvailable,
  initializeVault,
  MirrorUnavailableError,
} from "./vault.js";
import { wipHostPrefix } from "./wip.js";

const temps: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

afterEach(() => {
  while (temps.length) {
    const dir = temps.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

async function git(args: string[], cwd: string): Promise<void> {
  const result = await runGit(args, cwd);
  assert.equal(result.ok, true, `${args.join(" ")}: ${result.stderr}`);
}

function baseConfig(workspaceRoot: string, mirrorRoot: string): AppConfig {
  return {
    workspaceRoot,
    mirrorRoot,
    remoteName: "backup",
    maxDepth: 3,
    excludeDirNames: ["node_modules", ".git"],
    excludeRepoGlobs: [],
    pushAllBranches: true,
    pushTags: true,
    dryRun: false,
    naming: { style: "path-tree", prefix: "", suffix: ".git" },
    safeDirectory: "off",
    allowForceWithLease: true,
    captureWorktree: false,
    wipRetention: 20,
    wipExclude: [],
    logDir: path.join(mirrorRoot, "logs"),
    logRetentionDays: 30,
    configPath: null,
  };
}

describe("integration fixtures", () => {
  it("does not create a mirror tree when the vault marker is missing", () => {
    const root = tempDir("ingotvault-int-");
    const mirrorRoot = path.join(root, "Volumes", "Backup", "git-mirrors");
    mkdirSync(path.dirname(mirrorRoot), { recursive: true });

    assert.throws(
      () => assertMirrorRootAvailable(mirrorRoot),
      (err: unknown) =>
        err instanceof MirrorUnavailableError && err.exitCode === 2,
    );
    assert.equal(existsSync(mirrorRoot), false);
  });

  it("keeps a gitignored .env out of WIP trees", async () => {
    const root = tempDir("ingotvault-wip-");
    const workspace = path.join(root, "ws");
    const mirrorRoot = path.join(root, "mirrors");
    mkdirSync(workspace, { recursive: true });
    initializeVault(mirrorRoot);

    const repoPath = path.join(workspace, "app");
    mkdirSync(repoPath);
    await git(["init"], repoPath);
    await git(["config", "user.email", "test@example.com"], repoPath);
    await git(["config", "user.name", "Test"], repoPath);
    writeFileSync(path.join(repoPath, ".gitignore"), ".env\n");
    writeFileSync(path.join(repoPath, "readme.md"), "ok\n");
    await git(["add", "."], repoPath);
    await git(["commit", "-m", "init"], repoPath);
    writeFileSync(path.join(repoPath, ".env"), "SECRET=1\n");
    writeFileSync(path.join(repoPath, "dirty.txt"), "work\n");

    const config = {
      ...baseConfig(workspace, mirrorRoot),
      captureWorktree: true,
    };
    const repos = discoverRepos(config);
    assert.equal(repos.length, 1);
    const repo = repos[0]!;
    const log = createLogger(false);
    const pushed = await processRepo(repo, config, false, log, false);
    assert.equal(pushed.status, "ok", pushed.detail);

    const listed = await runGit(
      [
        "for-each-ref",
        "--format=%(refname)",
        wipHostPrefix(),
      ],
      repoPath,
    );
    assert.equal(listed.ok, true, listed.stderr);
    const refs = listed.stdout.split(/\r?\n/).filter(Boolean);
    assert.ok(refs.length >= 1, "expected a WIP ref");
    const show = await runGit(
      ["ls-tree", "-r", "--name-only", refs[0]!],
      repoPath,
    );
    assert.equal(show.ok, true, show.stderr);
    const names = show.stdout.split(/\r?\n/).filter(Boolean);
    assert.ok(names.includes("dirty.txt"));
    assert.ok(!names.includes(".env"), `tree contained .env: ${names.join(",")}`);
  });

  it("fails a diverged repo and leaves a sibling ok", async () => {
    const root = tempDir("ingotvault-div-");
    const workspace = path.join(root, "ws");
    const mirrorRoot = path.join(root, "mirrors");
    mkdirSync(workspace, { recursive: true });
    initializeVault(mirrorRoot);

    async function makeRepo(name: string): Promise<string> {
      const repoPath = path.join(workspace, name);
      mkdirSync(repoPath);
      await git(["init"], repoPath);
      await git(["config", "user.email", "test@example.com"], repoPath);
      await git(["config", "user.name", "Test"], repoPath);
      writeFileSync(path.join(repoPath, "a.txt"), `${name}\n`);
      await git(["add", "."], repoPath);
      await git(["commit", "-m", "init"], repoPath);
      return repoPath;
    }

    const badPath = await makeRepo("bad");
    await makeRepo("good");
    const config = baseConfig(workspace, mirrorRoot);
    const log = createLogger(false);

    for (const repo of discoverRepos(config)) {
      const first = await processRepo(repo, config, false, log, false);
      assert.equal(first.status, "ok", first.detail);
    }

    writeFileSync(path.join(badPath, "a.txt"), "rewritten\n");
    await git(["add", "."], badPath);
    await git(["commit", "--amend", "-m", "amended"], badPath);

    const after = [];
    for (const repo of discoverRepos(config)) {
      after.push(await processRepo(repo, config, false, log, false));
    }
    const byName = Object.fromEntries(
      after.map((o) => [o.relativePath.replace(/\\/g, "/"), o]),
    );
    assert.equal(byName["good"]?.status, "ok", byName["good"]?.detail);
    assert.equal(byName["bad"]?.status, "fail");
    assert.match(byName["bad"]?.detail ?? "", /DIVERGED/);
  });
});
