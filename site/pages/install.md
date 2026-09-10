---
title: Install
description: Install IngotVault from npm or a clone.
order: 1
---

Requires **Node.js 22+** and `git` on PATH. What the tool covers, and what a successful run does not capture, is on [Safety](/safety). Same install path as the [README](https://github.com/Catalyst-Forge-LLC/ingotvault#install).

### From npm / pnpm

```bash
pnpm add -g ingotvault
# or: npm i -g ingotvault
ingotvault init
ingotvault list
ingotvault
```

### From a clone

```bash
git clone https://github.com/Catalyst-Forge-LLC/ingotvault.git
cd ingotvault
pnpm install
pnpm run build
pnpm link --global
```

### First run

```bash
ingotvault init
# workspace + mirror roots → ./ingotvault.config.json
# also writes mirrorRoot/.ingotvault-vault (required on later runs)

ingotvault list          # planned mirror paths
ingotvault --dry-run     # no writes
ingotvault               # ensure bare mirrors + push
ingotvault verify        # compare tips
```

If you change `mirrorRoot`, run `ingotvault init` against the new path (or ensure `.ingotvault-vault` exists there), then `ingotvault relink` so each repo's `backup` remote matches.

Mirror naming preserves workspace paths under `mirrorRoot` (`acme/widgets` → `…/acme/widgets.git`).

### Agents / session boundaries

```bash
# Snapshot dirty trees (untracked that are not gitignored) → refs/ingotvault/wip/…
ingotvault --capture-worktree

# Silent when the vault matches; noise only on drift
ingotvault verify --quiet-if-clean
```

Or set `"captureWorktree": true` in config. Gitignored files are **not** captured; use `wipExclude` for extra pathspecs. Longer write-up: [An undo layer for autonomous edits](/posts/undo-layer-for-agents). Coverage table, exit codes, and divergence recovery: [Safety](/safety).

### Restore

Clone a mirror:

```bash
git clone /path/to/mirrors/notes.git notes-restored
```

Other branches appear as `origin/<name>` until you check them out.

### Restore a lost branch

A disposable two-repo fixture lives in [`docs/restore-demo.md`](https://github.com/Catalyst-Forge-LLC/ingotvault/blob/main/docs/restore-demo.md). The short form:

1. Capture `workspace/notes` with a `feature/parser` branch into `vault/notes.git`.
2. Confirm with `ingotvault verify` (`ok` / `refs match`).
3. Delete the local branch.
4. Clone the mirror and `git switch feature/parser`.

Narrow result: `parser.md` is back because that commit sat on a covered branch during the successful run. The fixture also leaves an uncommitted `scratch.txt` in the source. It is absent from the clone. Default runs do not capture uncommitted files.

Restore a WIP snapshot (fetch from the mirror if needed):

```bash
git fetch backup 'refs/ingotvault/wip/*:refs/ingotvault/wip/*'
git restore --source=refs/ingotvault/wip/<host>/<slug>/<timestamp> --worktree --staged .
# inspect only (does not write the worktree):
git show refs/ingotvault/wip/<host>/<slug>/<timestamp>
```

### Encrypt the vault volume

Git does **not** encrypt repositories at rest. Encrypt the volume (or container) that holds `mirrorRoot`, then point config at a path inside the unlocked volume.

| OS | Typical option |
|----|----------------|
| Windows | BitLocker To Go on the removable drive |
| macOS | APFS encrypted volume or encrypted disk image |
| Linux | LUKS (`cryptsetup`) |
| Cross-platform | VeraCrypt container |

Step-by-step OS setup: [`docs/encryption.md`](https://github.com/Catalyst-Forge-LLC/ingotvault/blob/main/docs/encryption.md). `safeDirectory` / exFAT notes: [README → Encrypting the vault](https://github.com/Catalyst-Forge-LLC/ingotvault#encrypting-the-vault).

### Full reference

| Topic | Where |
|-------|--------|
| Exit codes and divergence | [Safety](/safety) |
| Restore a lost branch (fixture) | [restore demonstration](https://github.com/Catalyst-Forge-LLC/ingotvault/blob/main/docs/restore-demo.md) |
| Flags, config, discovery, scheduling | [README on GitHub](https://github.com/Catalyst-Forge-LLC/ingotvault#cli) |
