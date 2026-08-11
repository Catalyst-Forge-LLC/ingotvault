import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type GitResult = {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
};

export async function runGit(
  args: string[],
  cwd?: string,
  env?: Record<string, string>,
): Promise<GitResult> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
      env: env ? { ...process.env, ...env } : undefined,
    });
    return { ok: true, code: 0, stdout: stdout ?? "", stderr: stderr ?? "" };
  } catch (err) {
    const e = err as {
      code?: number;
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    return {
      ok: false,
      code: typeof e.code === "number" ? e.code : null,
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? e.message ?? String(err),
    };
  }
}

export function combinedOutput(result: GitResult): string {
  return `${result.stdout}\n${result.stderr}`.trim();
}

export function isDubiousOwnership(result: GitResult): boolean {
  const text = combinedOutput(result).toLowerCase();
  return text.includes("dubious ownership");
}

/** Ensure git is on PATH. Returns version string (e.g. "git version 2.45.0"). */
export async function requireGit(): Promise<string> {
  const result = await runGit(["--version"]);
  if (!result.ok) {
    throw new Error(
      "git not found on PATH (or failed to run). Install Git and ensure `git --version` works.",
    );
  }
  const version = result.stdout.trim() || result.stderr.trim();
  if (!version.toLowerCase().includes("git version")) {
    throw new Error(
      `Unexpected output from git --version: ${version || "(empty)"}`,
    );
  }
  return version;
}
