import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { findConfigWalkingUp, resolveConfigPath, type AppConfig } from "./config.js";
import { discoverRepos, filterRepos } from "./discover.js";

const temps: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

function touchRepo(dir: string): void {
  mkdirSync(path.join(dir, ".git"), { recursive: true });
}

function config(workspaceRoot: string): AppConfig {
  return {
    workspaceRoot,
    mirrorRoot: path.join(workspaceRoot, "vault"),
    remoteName: "backup",
    maxDepth: 3,
    excludeDirNames: ["node_modules", ".git"],
    excludeRepoGlobs: [],
    pushAllBranches: true,
    pushTags: true,
    dryRun: false,
    naming: { style: "path-tree", prefix: "", suffix: ".git" },
    safeDirectory: "off",
    allowForceWithLease: false,
    captureWorktree: false,
    wipRetention: 20,
    wipExclude: [],
    logDir: path.join(workspaceRoot, "logs"),
    logRetentionDays: 30,
    configPath: path.join(workspaceRoot, "ingotvault.config.json"),
  };
}

afterEach(() => {
  while (temps.length) {
    const dir = temps.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("config walk-up", () => {
  it("uses the nearest ingotvault.config.json above the current directory", () => {
    const root = tempDir("ingotvault-cfg-");
    const child = path.join(root, "forgetrail");
    mkdirSync(child, { recursive: true });
    writeFileSync(path.join(root, "ingotvault.config.json"), "{}\n");
    writeFileSync(path.join(child, "ingotvault.config.json"), "{}\n");

    assert.equal(findConfigWalkingUp(child), path.join(child, "ingotvault.config.json"));
    assert.equal(
      findConfigWalkingUp(path.join(child, "src")),
      path.join(child, "ingotvault.config.json"),
    );
  });

  it("finds a workspace config when the project directory has none", () => {
    const root = tempDir("ingotvault-cfg-");
    const child = path.join(root, "forgetrail", "src");
    mkdirSync(child, { recursive: true });
    const workspaceConfig = path.join(root, "ingotvault.config.json");
    writeFileSync(workspaceConfig, "{}\n");

    assert.equal(resolveConfigPath(null, child), workspaceConfig);
  });
});

describe("--repo .", () => {
  it("selects the repo at fromDir and rejects a directory outside the vault", () => {
    const root = tempDir("ingotvault-repo-");
    const project = path.join(root, "forgetrail");
    touchRepo(project);
    const repos = discoverRepos(config(root));

    const hit = filterRepos(repos, ".", project);
    assert.equal(hit.ok, true);
    if (hit.ok) assert.equal(hit.repos[0]?.relativePath, "forgetrail");

    const outside = tempDir("ingotvault-outside-");
    touchRepo(outside);
    const miss = filterRepos(repos, ".", outside);
    assert.equal(miss.ok, false);
    if (!miss.ok) assert.match(miss.error, /not a repo in this vault/);
  });
});
