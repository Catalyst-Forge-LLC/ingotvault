import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { normalizeSlashes } from "./paths.js";

const LOCK_NAME = ".ingotvault.lock";
/** Treat lock as stale after this many ms (crashed run). */
const STALE_MS = 6 * 60 * 60 * 1000;

export type MirrorLock = {
  lockPath: string;
  release: () => void;
};

function pidAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

type LockPayload = {
  pid: number;
  startedAt: string;
};

/**
 * Exclusive lock under mirrorRoot so scheduled + manual runs don't interleave.
 */
export function acquireMirrorLock(mirrorRoot: string): MirrorLock {
  const root = path.resolve(mirrorRoot);
  mkdirSync(root, { recursive: true });
  const lockPath = path.join(root, LOCK_NAME);

  if (existsSync(lockPath)) {
    let stale = false;
    try {
      const raw = JSON.parse(readFileSync(lockPath, "utf8")) as LockPayload;
      const age = Date.now() - Date.parse(raw.startedAt);
      if (!pidAlive(raw.pid) || (Number.isFinite(age) && age > STALE_MS)) {
        stale = true;
      } else {
        throw new Error(
          `Another ingotvault run holds the lock (${normalizeSlashes(lockPath)}, pid ${raw.pid} started ${raw.startedAt}).`,
        );
      }
    } catch (err) {
      if ((err as Error).message.startsWith("Another ingotvault")) throw err;
      stale = true;
    }
    if (stale) {
      try {
        unlinkSync(lockPath);
      } catch {
        /* continue; write may still fail */
      }
    }
  }

  const payload: LockPayload = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
  };
  try {
    writeFileSync(lockPath, `${JSON.stringify(payload, null, 2)}\n`, {
      flag: "wx",
      encoding: "utf8",
    });
  } catch {
    throw new Error(
      `Could not acquire mirror lock at ${normalizeSlashes(lockPath)}. Is another ingotvault running?`,
    );
  }

  let released = false;
  return {
    lockPath,
    release: () => {
      if (released) return;
      released = true;
      try {
        unlinkSync(lockPath);
      } catch {
        /* ignore */
      }
    },
  };
}
