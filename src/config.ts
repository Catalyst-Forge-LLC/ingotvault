import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  expandHome,
  normalizeSlashes,
  resolveUserPath,
  urlsMatch,
} from "./paths.js";

export type NamingConfig = {
  style: "path-tree";
  prefix: string;
  suffix: string;
};

export type AppConfig = {
  workspaceRoot: string;
  mirrorRoot: string;
  remoteName: string;
  maxDepth: number;
  excludeDirNames: string[];
  excludeRepoGlobs: string[];
  pushAllBranches: boolean;
  pushTags: boolean;
  dryRun: boolean;
  naming: NamingConfig;
  safeDirectory: "per-mirror" | "off";
  /**
   * When true, CLI `--force-with-lease` is permitted (still requires --repo or
   * --all-repos). Never enables force by itself.
   */
  allowForceWithLease: boolean;
  /** Snapshot dirty worktrees to refs/ingotvault/wip/… and push them */
  captureWorktree: boolean;
  /** Keep the newest N WIP refs per worktree slug (per host) */
  wipRetention: number;
  /**
   * Extra git pathspecs excluded from WIP snapshots (beyond .gitignore).
   * Examples: `".env.local"`, `"secrets/**"`.
   */
  wipExclude: string[];
  logDir: string;
  logRetentionDays: number;
  /** Path of the config file that was loaded, if any */
  configPath: string | null;
};

export type CliOptions = {
  command: "run" | "list" | "init" | "verify" | "safe-dirs" | "relink";
  dryRun: boolean;
  verbose: boolean;
  scheduled: boolean;
  help: boolean;
  forceWithLease: boolean;
  /** Allow --force-with-lease across the whole workspace */
  allRepos: boolean;
  captureWorktree: boolean;
  /** verify: stay silent when everything matches */
  quietIfClean: boolean;
  /** safe-dirs: list | clean */
  safeDirsMode: "list" | "clean" | null;
  repoFilter: string | null;
  configPath: string | null;
  /** init: write to user config dir */
  global: boolean;
  initWorkspace: string | null;
  initMirror: string | null;
  initRemoteName: string | null;
  initMaxDepth: number | null;
};

const fieldDefaults = {
  remoteName: "backup",
  maxDepth: 3,
  excludeDirNames: ["__ARCHIVE", "node_modules", ".git", ".hg"],
  excludeRepoGlobs: [] as string[],
  pushAllBranches: true,
  pushTags: true,
  dryRun: false,
  naming: {
    style: "path-tree" as const,
    prefix: "",
    suffix: ".git",
  },
  safeDirectory: "per-mirror" as const,
  allowForceWithLease: false,
  captureWorktree: false,
  wipRetention: 20,
  wipExclude: [] as string[],
  logDir: "~/.local/share/ingotvault/logs",
  logRetentionDays: 30,
};

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export function getPackageRoot(): string {
  return packageRoot;
}

export function getUserConfigPath(): string {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(homedir(), "AppData", "Roaming");
    return path.join(appData, "ingotvault", "config.json");
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(homedir(), ".config");
  return path.join(xdg, "ingotvault", "config.json");
}

export function getDefaultLogDir(): string {
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA || path.join(homedir(), "AppData", "Local");
    return path.join(local, "ingotvault", "logs");
  }
  return path.join(homedir(), ".local", "share", "ingotvault", "logs");
}

type FileConfig = Partial<Omit<AppConfig, "configPath" | "naming">> & {
  naming?: Partial<NamingConfig>;
  $schema?: string;
};

function readJsonConfig(configPath: string): FileConfig {
  try {
    return JSON.parse(readFileSync(configPath, "utf8")) as FileConfig;
  } catch (err) {
    throw new Error(
      `Failed to read config ${configPath}: ${(err as Error).message}`,
    );
  }
}

/** Resolution: --config, ./ingotvault.config.json, then user config. */
export function resolveConfigPath(cliPath: string | null): string | null {
  if (cliPath) {
    const resolved = resolveUserPath(cliPath);
    if (!existsSync(resolved)) {
      throw new Error(`Config not found: ${resolved}`);
    }
    return resolved;
  }

  const cwdConfig = path.resolve("ingotvault.config.json");
  if (existsSync(cwdConfig)) return cwdConfig;

  const userPath = getUserConfigPath();
  if (existsSync(userPath)) return userPath;

  return null;
}

export function loadConfig(cliPath: string | null): AppConfig {
  const configPath = resolveConfigPath(cliPath);
  if (!configPath) {
    throw new Error(
      "No config found. Run `ingotvault init` or pass --config <path>. See config.example.json.",
    );
  }

  const fileConfig = readJsonConfig(configPath);
  if (!fileConfig.workspaceRoot || !fileConfig.mirrorRoot) {
    throw new Error(
      `Config ${configPath} must set workspaceRoot and mirrorRoot.`,
    );
  }

  const naming: NamingConfig = {
    ...fieldDefaults.naming,
    ...fileConfig.naming,
    style: "path-tree",
  };

  const logDirRaw = fileConfig.logDir ?? fieldDefaults.logDir;
  const logDir =
    logDirRaw === fieldDefaults.logDir && process.platform === "win32"
      ? getDefaultLogDir()
      : resolveUserPath(logDirRaw);

  const logRetentionDays =
    fileConfig.logRetentionDays ?? fieldDefaults.logRetentionDays;

  return {
    workspaceRoot: normalizeSlashes(resolveUserPath(fileConfig.workspaceRoot)),
    mirrorRoot: normalizeSlashes(resolveUserPath(fileConfig.mirrorRoot)),
    remoteName: fileConfig.remoteName ?? fieldDefaults.remoteName,
    maxDepth: fileConfig.maxDepth ?? fieldDefaults.maxDepth,
    excludeDirNames: fileConfig.excludeDirNames ?? [
      ...fieldDefaults.excludeDirNames,
    ],
    excludeRepoGlobs: fileConfig.excludeRepoGlobs ?? [
      ...fieldDefaults.excludeRepoGlobs,
    ],
    pushAllBranches: fileConfig.pushAllBranches ?? fieldDefaults.pushAllBranches,
    pushTags: fileConfig.pushTags ?? fieldDefaults.pushTags,
    dryRun: fileConfig.dryRun ?? fieldDefaults.dryRun,
    naming,
    safeDirectory: fileConfig.safeDirectory ?? fieldDefaults.safeDirectory,
    allowForceWithLease:
      fileConfig.allowForceWithLease ?? fieldDefaults.allowForceWithLease,
    captureWorktree:
      fileConfig.captureWorktree ?? fieldDefaults.captureWorktree,
    wipRetention: (() => {
      const n = fileConfig.wipRetention ?? fieldDefaults.wipRetention;
      return Number.isFinite(n) && n >= 1 ? n : fieldDefaults.wipRetention;
    })(),
    wipExclude: Array.isArray(fileConfig.wipExclude)
      ? fileConfig.wipExclude.filter((x: unknown): x is string => typeof x === "string")
      : [...fieldDefaults.wipExclude],
    logDir: normalizeSlashes(logDir),
    logRetentionDays:
      Number.isFinite(logRetentionDays) && logRetentionDays >= 0
        ? logRetentionDays
        : fieldDefaults.logRetentionDays,
    configPath: normalizeSlashes(configPath),
  };
}

/**
 * Mirror path relative to mirrorRoot: preserve workspace dirs, append suffix.
 * e.g. acme/widgets → acme/widgets.git
 */
export function mirrorNameFromRelative(
  relativePosix: string,
  naming: NamingConfig,
): string {
  const base = relativePosix.replace(/\\/g, "/");
  return `${naming.prefix}${base}${naming.suffix}`;
}

export function parseCli(argv: string[]): CliOptions {
  const opts: CliOptions = {
    command: "run",
    dryRun: false,
    verbose: false,
    scheduled: false,
    help: false,
    forceWithLease: false,
    allRepos: false,
    captureWorktree: false,
    quietIfClean: false,
    safeDirsMode: null,
    repoFilter: null,
    configPath: null,
    global: false,
    initWorkspace: null,
    initMirror: null,
    initRemoteName: null,
    initMaxDepth: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "run":
      case "list":
      case "init":
      case "verify":
      case "safe-dirs":
      case "relink":
        opts.command = arg;
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--verbose":
      case "-v":
        opts.verbose = true;
        break;
      case "--scheduled":
        opts.scheduled = true;
        break;
      case "--force-with-lease":
        opts.forceWithLease = true;
        break;
      case "--all-repos":
        opts.allRepos = true;
        break;
      case "--capture-worktree":
        opts.captureWorktree = true;
        break;
      case "--quiet-if-clean":
        opts.quietIfClean = true;
        break;
      case "--clean":
        opts.safeDirsMode = "clean";
        break;
      case "--global":
        opts.global = true;
        break;
      case "--list":
        if (opts.command === "safe-dirs") {
          opts.safeDirsMode = "list";
        } else {
          opts.command = "list";
        }
        break;
      case "--help":
      case "-h":
        opts.help = true;
        break;
      case "--config": {
        const value = argv[++i];
        if (!value || value.startsWith("-")) {
          throw new Error("--config requires a path");
        }
        opts.configPath = value;
        break;
      }
      case "--repo": {
        const value = argv[++i];
        if (!value || value.startsWith("-")) {
          throw new Error("--repo requires a value");
        }
        opts.repoFilter = value.replace(/\\/g, "/");
        break;
      }
      case "--workspace": {
        const value = argv[++i];
        if (!value || value.startsWith("-")) {
          throw new Error("--workspace requires a path");
        }
        opts.initWorkspace = value;
        break;
      }
      case "--mirror": {
        const value = argv[++i];
        if (!value || value.startsWith("-")) {
          throw new Error("--mirror requires a path");
        }
        opts.initMirror = value;
        break;
      }
      case "--remote-name": {
        const value = argv[++i];
        if (!value || value.startsWith("-")) {
          throw new Error("--remote-name requires a value");
        }
        opts.initRemoteName = value;
        break;
      }
      case "--max-depth": {
        const value = argv[++i];
        if (!value || value.startsWith("-")) {
          throw new Error("--max-depth requires a number");
        }
        opts.initMaxDepth = Number(value);
        if (!Number.isFinite(opts.initMaxDepth)) {
          throw new Error("--max-depth must be a number");
        }
        break;
      }
      default:
        if (arg.startsWith("-")) {
          throw new Error(`Unknown flag: ${arg}`);
        }
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return opts;
}

export function printHelp(): void {
  console.log(`ingotvault — local spare remotes for a workspace of Git repos

Usage:
  ingotvault init [--global] [--workspace <path>] [--mirror <path>]
  ingotvault [run] [--config <path>] [--repo <path|name>] [--dry-run]
             [--verbose] [--scheduled] [--capture-worktree]
             [--force-with-lease --repo <path>|--all-repos]
  ingotvault list [--config <path>] [--repo <path|name>]
  ingotvault verify [--config <path>] [--repo <path|name>]
             [--verbose] [--quiet-if-clean]
  ingotvault relink [--config <path>] [--repo <path|name>]
  ingotvault safe-dirs [--config <path>] [--list|--clean]

Never modifies origin. Never force-pushes unless --force-with-lease.
Force requires allowForceWithLease: true in config AND --force-with-lease
with --repo or --all-repos. Uses ls-remote tips + explicit leases, preserving
missing mirror tips under refs/ingotvault/preforce/… first.

init writes a .ingotvault-vault marker under mirrorRoot. Normal runs refuse
(exit 2) if that marker is missing — so an unplugged volume never silently
creates mirrors on the boot disk.

Optional --capture-worktree (or captureWorktree in config) snapshots dirty
trees to refs/ingotvault/wip/<host>/… (respects .gitignore; see wipExclude).

Exit codes: 0 ok · 1 setup/config · 2 mirror unavailable · 3 repo/verify drift
`);
}

export { expandHome, normalizeSlashes, resolveUserPath, urlsMatch };
