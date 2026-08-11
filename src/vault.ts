import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { hostname } from "node:os";
import path from "node:path";
import { normalizeSlashes } from "./paths.js";

/** Written by `init` into mirrorRoot; required on every normal run. */
export const VAULT_MARKER_NAME = ".ingotvault-vault";

export class MirrorUnavailableError extends Error {
  readonly exitCode = 2;
  constructor(message: string) {
    super(message);
    this.name = "MirrorUnavailableError";
  }
}

export type VaultMarker = {
  version: 1;
  createdAt: string;
  host: string;
};

export function vaultMarkerPath(mirrorRoot: string): string {
  return path.join(path.resolve(mirrorRoot), VAULT_MARKER_NAME);
}

export function vaultMarkerPresent(mirrorRoot: string): boolean {
  return existsSync(vaultMarkerPath(mirrorRoot));
}

/**
 * Create mirrorRoot (if needed) and write the vault marker.
 * Only `init` (and explicit migration) should create the tree.
 */
export function initializeVault(mirrorRoot: string): string {
  const root = path.resolve(mirrorRoot);
  mkdirSync(root, { recursive: true });
  const markerPath = vaultMarkerPath(root);
  if (!existsSync(markerPath)) {
    const payload: VaultMarker = {
      version: 1,
      createdAt: new Date().toISOString(),
      host: hostname(),
    };
    writeFileSync(markerPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }
  return normalizeSlashes(root);
}

/**
 * Refuse to run unless mirrorRoot already contains the vault marker.
 * Never mkdir here — an unplugged volume must exit 2, not silently create
 * mirrors on the boot disk under /Volumes, /media, or a reassigned letter.
 */
export function assertMirrorRootAvailable(mirrorRoot: string): void {
  const root = path.resolve(mirrorRoot);
  const markerPath = vaultMarkerPath(root);

  if (!existsSync(markerPath)) {
    throw new MirrorUnavailableError(
      `Mirror root is not an initialized vault (missing ${VAULT_MARKER_NAME}): ${normalizeSlashes(root)}. ` +
        `Unlock the volume, or run \`ingotvault init\` with this --mirror path to create the vault marker.`,
    );
  }

  try {
    accessSync(root, constants.R_OK | constants.W_OK);
    readFileSync(markerPath, "utf8");
  } catch {
    throw new MirrorUnavailableError(
      `Mirror root not available: ${normalizeSlashes(root)}. Unlock the volume or check the path.`,
    );
  }
}
