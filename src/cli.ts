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
import { requireGit } from "./git.js";
import { runInit } from "./init.js";
import { createLogger, pruneOldLogs, timestampForFilename } from "./log.js";
import { formatOutcome, processRepo, type RepoOutcome } from "./push.js";
import { verifyAll } from "./verify.js";

async function runMain(cli: CliOptions): Promise<number> {
  if (cli.help) {
    printHelp();
    return 0;
  }

  if (cli.command === "init") {
    return runInit(cli);
  }

  try {
    const version = await requireGit();
    if (cli.verbose) console.log(version);
  } catch (err) {
    console.error((err as Error).message);
    return 1;
  }

  let config;
  try {
    config = loadConfig(cli.configPath);
  } catch (err) {
    console.error((err as Error).message);
    return 1;
  }

  const dryRun = cli.dryRun || config.dryRun;
  const forceWithLease = cli.forceWithLease || config.allowForceWithLease;
  const log = createLogger(cli.verbose);
  const started = Date.now();

  log.line(
    `ingotvault  workspace=${config.workspaceRoot}  mirror=${config.mirrorRoot}`,
  );
  log.verbose(`config=${config.configPath}`);
  if (dryRun) log.line("(dry-run: no writes)");
  if (forceWithLease && cli.command === "run") {
    log.line("(force-with-lease enabled)");
  }
  if (cli.command === "list") log.line("(list only)");
  if (cli.command === "verify") log.line("(verify)");

  try {
    if (cli.command !== "list") {
      assertMirrorRootAvailable(config.mirrorRoot);
    }
  } catch (err) {
    if (err instanceof MirrorUnavailableError) {
      log.line(`ERROR: ${err.message}`);
      maybeWriteScheduledLog(cli, config.logDir, config.logRetentionDays, log);
      return err.exitCode;
    }
    throw err;
  }

  const allRepos = discoverRepos(config);
  const filtered = filterRepos(allRepos, cli.repoFilter);
  if (!filtered.ok) {
    log.line(filtered.error);
    maybeWriteScheduledLog(cli, config.logDir, config.logRetentionDays, log);
    return 1;
  }
  const repos = filtered.repos;

  if (cli.repoFilter && repos.length === 0) {
    log.line(`No repos matched --repo ${cli.repoFilter}`);
    maybeWriteScheduledLog(cli, config.logDir, config.logRetentionDays, log);
    return 1;
  }

  log.line(`Found ${repos.length} repo(s)`);
  log.line("");

  if (cli.command === "list") {
    for (const repo of repos) {
      log.line(`${repo.relativePath.padEnd(28)}  -> ${repo.mirrorPath}`);
    }
    maybeWriteScheduledLog(cli, config.logDir, config.logRetentionDays, log);
    return 0;
  }

  if (cli.command === "verify") {
    const { exitCode } = await verifyAll(repos, config, log);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    log.line("---");
    log.line(`verify done (${seconds}s)`);
    maybeWriteScheduledLog(cli, config.logDir, config.logRetentionDays, log);
    return exitCode;
  }

  const outcomes: RepoOutcome[] = [];
  for (const repo of repos) {
    const outcome = await processRepo(
      repo,
      config,
      dryRun,
      log,
      forceWithLease,
    );
    outcomes.push(outcome);
    log.line(formatOutcome(outcome));
  }

  const ok = outcomes.filter((o) => o.status === "ok").length;
  const skip = outcomes.filter((o) => o.status === "skip").length;
  const fail = outcomes.filter((o) => o.status === "fail").length;
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  log.line("---");
  log.line(`${ok} ok, ${skip} skip, ${fail} fail  (${seconds}s)`);

  maybeWriteScheduledLog(cli, config.logDir, config.logRetentionDays, log);
  // 3 = one or more repos failed (setup/config errors use 1; vault absent uses 2)
  return fail > 0 ? 3 : 0;
}

function maybeWriteScheduledLog(
  cli: CliOptions,
  logDir: string,
  logRetentionDays: number,
  log: ReturnType<typeof createLogger>,
): void {
  if (!cli.scheduled) return;
  const logFile = path.join(logDir, `${timestampForFilename()}.log`);
  log.flushToFile(logFile);
  const pruned = pruneOldLogs(logDir, logRetentionDays);
  console.log(`Log: ${logFile}`);
  if (pruned > 0) {
    console.log(`Pruned ${pruned} log file(s) older than ${logRetentionDays} day(s)`);
  }
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
