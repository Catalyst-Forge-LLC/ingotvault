/**
 * JSON status for the LocalHelm plugin. Does not push.
 * Backup-worthy: mirror behind, or no mirror yet. Diverged stays a skip.
 */
import { discoverRepos } from "../src/discover.ts";
import { loadConfig } from "../src/config.ts";
import type { Logger } from "../src/log.ts";
import { verifyAll, type VerifyStatus } from "../src/verify.ts";
import { assertMirrorRootAvailable, MirrorUnavailableError } from "../src/vault.ts";

const quiet: Logger = {
  line() {},
  verbose() {},
  flushToFile() {},
  getLines: () => [],
};

export function backupWrites(status: VerifyStatus): boolean {
  return status === "behind" || status === "missing-mirror";
}

async function main(): Promise<void> {
  const config = loadConfig(null);
  try {
    assertMirrorRootAvailable(config.mirrorRoot);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err instanceof MirrorUnavailableError ? err.exitCode : 1;
    process.stdout.write(`${JSON.stringify({ error: message })}\n`);
    process.exitCode = code;
    return;
  }
  const repos = discoverRepos(config);
  const { outcomes, clean } = await verifyAll(repos, config, quiet);
  process.stdout.write(
    `${JSON.stringify({
      clean,
      workspace: config.workspaceRoot,
      mirror: config.mirrorRoot,
      outcomes: outcomes.map((row) => ({
        id: row.relativePath,
        status: row.status,
        detail: row.detail,
        writes: backupWrites(row.status),
      })),
    })}\n`,
  );
}

const isDirect = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isDirect) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(`${JSON.stringify({ error: message })}\n`);
    process.exitCode = 1;
  });
}
