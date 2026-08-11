#!/usr/bin/env node
import path from "node:path";
import {
  loadConfig,
  parseCli,
  printHelp,
  type CliOptions,
} from "./config.js";
import { discoverRepos, filterRepos } from "./discover.js";
import {
  assertMirrorRootAvailable,
  MirrorUnavailableError,
} from "./ensureBackup.js";
import { runInit } from "./init.js";
import { createLogger, timestampForFilename } from "./log.js";
import { formatOutcome, processRepo, type RepoOutcome } from "./push.js";

async function runMain(cli: CliOptions): Promise<number> {
  if (cli.help) {
    printHelp();
    return 0;
  }

  if (cli.command === "init") {
    return runInit(cli);
  }

  let config;
  try {
    config = loadConfig(cli.configPath);
  } catch (err) {
    console.error((err as Error).message);
    return 1;
  }

  const dryRun = cli.dryRun || config.dryRun;
  const log = createLogger(cli.verbose);
  const started = Date.now();

  log.line(
    `ingot  workspace=${config.workspaceRoot}  mirror=${config.mirrorRoot}`,
  );
  log.verbose(`config=${config.configPath}`);
  if (dryRun) log.line("(dry-run: no writes)");
  if (cli.command === "list") log.line("(list only)");

  try {
    if (cli.command !== "list") {
      assertMirrorRootAvailable(config.mirrorRoot);
    }
  } catch (err) {
    if (err instanceof MirrorUnavailableError) {
      log.line(`ERROR: ${err.message}`);
      maybeWriteScheduledLog(cli, config.logDir, log);
      return err.exitCode;
    }
    throw err;
  }

  let repos = discoverRepos(config);
  repos = filterRepos(repos, cli.repoFilter);

  if (cli.repoFilter && repos.length === 0) {
    log.line(`No repos matched --repo ${cli.repoFilter}`);
    maybeWriteScheduledLog(cli, config.logDir, log);
    return 1;
  }

  log.line(`Found ${repos.length} repo(s)`);
  log.line("");

  if (cli.command === "list") {
    for (const repo of repos) {
      log.line(`${repo.relativePath.padEnd(28)}  -> ${repo.mirrorPath}`);
    }
    maybeWriteScheduledLog(cli, config.logDir, log);
    return 0;
  }

  const outcomes: RepoOutcome[] = [];
  for (const repo of repos) {
    const outcome = await processRepo(repo, config, dryRun, log);
    outcomes.push(outcome);
    log.line(formatOutcome(outcome));
  }

  const ok = outcomes.filter((o) => o.status === "ok").length;
  const skip = outcomes.filter((o) => o.status === "skip").length;
  const fail = outcomes.filter((o) => o.status === "fail").length;
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  log.line("---");
  log.line(`${ok} ok, ${skip} skip, ${fail} fail  (${seconds}s)`);

  maybeWriteScheduledLog(cli, config.logDir, log);
  return fail > 0 ? 1 : 0;
}

function maybeWriteScheduledLog(
  cli: CliOptions,
  logDir: string,
  log: ReturnType<typeof createLogger>,
): void {
  if (!cli.scheduled) return;
  const logFile = path.join(logDir, `${timestampForFilename()}.log`);
  log.flushToFile(logFile);
  console.log(`Log: ${logFile}`);
}

async function main(): Promise<number> {
  let cli: CliOptions;
  try {
    cli = parseCli(process.argv.slice(2));
  } catch (err) {
    console.error((err as Error).message);
    printHelp();
    return 1;
  }

  return runMain(cli);
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
