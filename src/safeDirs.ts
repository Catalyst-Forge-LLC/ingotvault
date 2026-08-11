import path from "node:path";
import type { AppConfig } from "./config.js";
import { normalizeSlashes, urlsMatch } from "./paths.js";
import { runGit } from "./git.js";

function underMirrorRoot(entry: string, mirrorRoot: string): boolean {
  const root = normalizeSlashes(path.resolve(mirrorRoot)).replace(/\/+$/, "");
  const e = normalizeSlashes(entry).replace(/\/+$/, "");
  if (urlsMatch(e, root)) return true;
  const prefix = `${root}/`;
  return e.toLowerCase().startsWith(prefix.toLowerCase());
}

export async function listSafeDirectories(): Promise<string[]> {
  const listed = await runGit([
    "config",
    "--global",
    "--get-all",
    "safe.directory",
  ]);
  if (!listed.ok) return [];
  return listed.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Remove global safe.directory entries that live under this config's mirrorRoot.
 * Rewrites the multi-value key so unrelated entries are preserved.
 */
export async function cleanIngotSafeDirectories(
  config: AppConfig,
): Promise<{ removed: string[]; kept: number }> {
  const all = await listSafeDirectories();
  const removed = all.filter((e) => underMirrorRoot(e, config.mirrorRoot));
  const keep = all.filter((e) => !underMirrorRoot(e, config.mirrorRoot));

  if (removed.length === 0) {
    return { removed: [], kept: keep.length };
  }

  await runGit(["config", "--global", "--unset-all", "safe.directory"]);
  for (const entry of keep) {
    await runGit(["config", "--global", "--add", "safe.directory", entry]);
  }

  return { removed, kept: keep.length };
}

export async function runSafeDirs(
  config: AppConfig,
  mode: "list" | "clean",
): Promise<number> {
  const all = await listSafeDirectories();
  const ours = all.filter((e) => underMirrorRoot(e, config.mirrorRoot));

  if (mode === "list") {
    console.log(`mirrorRoot=${normalizeSlashes(config.mirrorRoot)}`);
    console.log(`${ours.length} ingotvault safe.directory entr(y/ies):`);
    for (const e of ours) console.log(`  ${e}`);
    const other = all.length - ours.length;
    if (other > 0) {
      console.log(
        `(${other} other global safe.directory entr(y/ies) left untouched)`,
      );
    }
    return 0;
  }

  const { removed, kept } = await cleanIngotSafeDirectories(config);
  console.log(
    `Removed ${removed.length} safe.directory entr(y/ies) under mirrorRoot.`,
  );
  for (const e of removed) console.log(`  - ${e}`);
  console.log(`${kept} global safe.directory entr(y/ies) remain.`);
  return 0;
}
