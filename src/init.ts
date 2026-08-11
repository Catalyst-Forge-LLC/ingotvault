import { createInterface } from "node:readline/promises";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import type { CliOptions } from "./config.js";
import { getUserConfigPath, normalizeSlashes } from "./config.js";
import { resolveUserPath } from "./paths.js";

async function prompt(rl: ReturnType<typeof createInterface>, question: string, fallback?: string): Promise<string> {
  const suffix = fallback ? ` [${fallback}]` : "";
  const answer = (await rl.question(`${question}${suffix}: `)).trim();
  if (!answer && fallback !== undefined) return fallback;
  return answer;
}

export async function runInit(cli: CliOptions): Promise<number> {
  const rl =
    cli.initWorkspace && cli.initMirror
      ? null
      : createInterface({ input, output });

  try {
    const workspace =
      cli.initWorkspace ??
      (rl
        ? await prompt(rl, "Workspace root (folder of git repos)")
        : "");
    const mirror =
      cli.initMirror ??
      (rl ? await prompt(rl, "Mirror root (bare repos destination)") : "");
    const remoteName =
      cli.initRemoteName ??
      (rl ? await prompt(rl, "Remote name", "backup") : "backup");
    const maxDepthRaw =
      cli.initMaxDepth != null
        ? String(cli.initMaxDepth)
        : rl
          ? await prompt(rl, "Max scan depth", "3")
          : "3";

    if (!workspace || !mirror) {
      console.error(
        "workspace and mirror are required. Pass --workspace and --mirror, or run interactively.",
      );
      return 1;
    }

    const maxDepth = Number(maxDepthRaw);
    if (!Number.isFinite(maxDepth) || maxDepth < 1) {
      console.error("max depth must be a positive number");
      return 1;
    }

    const config = {
      $schema: "./schema/ingotvault.config.schema.json",
      workspaceRoot: normalizeSlashes(workspace),
      mirrorRoot: normalizeSlashes(mirror),
      remoteName: remoteName || "backup",
      maxDepth,
      excludeDirNames: ["__ARCHIVE", "node_modules", ".git", ".hg"],
      excludeRepoGlobs: [],
      pushAllBranches: true,
      pushTags: true,
      naming: {
        style: "path-tree",
        prefix: "",
        suffix: ".git",
      },
      safeDirectory: "per-mirror",
      allowForceWithLease: false,
      concurrency: 1,
      logRetentionDays: 30,
    };

    const outPath = cli.global
      ? getUserConfigPath()
      : path.resolve("ingotvault.config.json");

    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

    // Validate paths expand
    resolveUserPath(workspace);
    resolveUserPath(mirror);

    console.log(`Wrote ${normalizeSlashes(outPath)}`);
    console.log(
      "Next: ingotvault list   then   ingotvault --dry-run   then   ingotvault",
    );
    return 0;
  } finally {
    rl?.close();
  }
}
