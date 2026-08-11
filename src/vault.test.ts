import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  assertMirrorRootAvailable,
  initializeVault,
  MirrorUnavailableError,
  VAULT_MARKER_NAME,
  vaultMarkerPresent,
} from "./vault.js";

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

describe("vault marker", () => {
  it("exits unavailable when marker is missing and creates nothing under a fake volume parent", () => {
    const boot = tempDir("ingotvault-boot-");
    const volumes = path.join(boot, "Volumes");
    mkdirSync(volumes, { recursive: true });
    const mirrorRoot = path.join(volumes, "Backup", "git-mirrors");

    assert.equal(vaultMarkerPresent(mirrorRoot), false);
    assert.throws(
      () => assertMirrorRootAvailable(mirrorRoot),
      (err: unknown) =>
        err instanceof MirrorUnavailableError && err.exitCode === 2,
    );
    assert.equal(existsSync(mirrorRoot), false);
  });

  it("accepts an initialized vault and refuses a writable parent without a marker", () => {
    const root = tempDir("ingotvault-vault-");
    initializeVault(root);
    assert.equal(existsSync(path.join(root, VAULT_MARKER_NAME)), true);
    assert.doesNotThrow(() => assertMirrorRootAvailable(root));

    const sibling = path.join(path.dirname(root), "not-a-vault");
    mkdirSync(sibling, { recursive: true });
    writeFileSync(path.join(sibling, "readme.txt"), "nope\n");
    assert.throws(
      () => assertMirrorRootAvailable(sibling),
      MirrorUnavailableError,
    );
  });
});
