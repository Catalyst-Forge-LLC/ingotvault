import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { migrateMirrorOnDisk } from "./relink.js";

const temps: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  temps.push(dir);
  return dir;
}

function fakeBare(dir: string): void {
  mkdirSync(dir, { recursive: true });
  mkdirSync(path.join(dir, "objects"), { recursive: true });
  writeFileSync(path.join(dir, "HEAD"), "ref: refs/heads/main\n");
}

afterEach(() => {
  while (temps.length) {
    const dir = temps.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("migrateMirrorOnDisk", () => {
  it("moves a flat bare mirror into the path-tree location", () => {
    const root = tempDir("ingotvault-relink-");
    const flat = path.join(root, "chilon-Whisper.git");
    const nested = path.join(root, "chilon", "Whisper.git");
    fakeBare(flat);

    const result = migrateMirrorOnDisk(flat, nested, false);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.moved, true);
    assert.equal(existsSync(flat), false);
    assert.equal(existsSync(path.join(nested, "HEAD")), true);
  });

  it("refuses when both locations already hold history", () => {
    const root = tempDir("ingotvault-relink-both-");
    const flat = path.join(root, "a-b.git");
    const nested = path.join(root, "a", "b.git");
    fakeBare(flat);
    fakeBare(nested);
    mkdirSync(path.join(nested, "refs", "heads"), { recursive: true });
    writeFileSync(path.join(nested, "refs", "heads", "main"), `${"a".repeat(40)}\n`);

    const result = migrateMirrorOnDisk(flat, nested, false);
    assert.equal(result.ok, false);
    assert.equal(existsSync(flat), true);
  });

  it("replaces an empty destination and moves the mirror that has history", () => {
    const root = tempDir("ingotvault-relink-empty-");
    const oldPath = path.join(root, "forge-kit.git");
    const desired = path.join(root, "forgetrail.git");
    fakeBare(oldPath);
    mkdirSync(path.join(oldPath, "refs", "heads"), { recursive: true });
    writeFileSync(path.join(oldPath, "refs", "heads", "main"), `${"b".repeat(40)}\n`);
    fakeBare(desired);

    const result = migrateMirrorOnDisk(oldPath, desired, false);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.moved, true);
    assert.equal(existsSync(oldPath), false);
    assert.equal(
      existsSync(path.join(desired, "refs", "heads", "main")),
      true,
    );
  });

  it("dry-run does not move", () => {
    const root = tempDir("ingotvault-relink-dry-");
    const flat = path.join(root, "x-y.git");
    const nested = path.join(root, "x", "y.git");
    fakeBare(flat);

    const result = migrateMirrorOnDisk(flat, nested, true);
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.moved, true);
    assert.equal(existsSync(flat), true);
    assert.equal(existsSync(nested), false);
  });
});
