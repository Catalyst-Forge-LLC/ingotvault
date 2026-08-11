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

  it("refuses when both locations already hold bare repos", () => {
    const root = tempDir("ingotvault-relink-both-");
    const flat = path.join(root, "a-b.git");
    const nested = path.join(root, "a", "b.git");
    fakeBare(flat);
    fakeBare(nested);

    const result = migrateMirrorOnDisk(flat, nested, false);
    assert.equal(result.ok, false);
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
