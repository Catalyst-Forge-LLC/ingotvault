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
): Promise<GitResult> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
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
