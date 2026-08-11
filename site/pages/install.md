---
title: Install
description: Install ingotvault from npm or a clone.
order: 1
---

Requires **Node.js 22+** and `git` on PATH. What the tool covers (and refuses) is on [Safety](/safety) — worth a skim before you schedule it.

### From npm / pnpm

```bash
pnpm add -g ingotvault
# or: npm i -g ingotvault
ingotvault init
ingotvault list
ingotvault
```

Until a real release is published, npm may still serve a placeholder. Prefer a clone for review builds.

### From a clone

```bash
git clone https://github.com/Catalyst-Forge-LLC/ingotvault.git
cd ingotvault
pnpm install
pnpm run build
pnpm link --global
```

(Needs a **public** GitHub repo, or SSH access if it is still private.)

### First run

```bash
ingotvault init
# workspace + mirror roots → ./ingotvault.config.json

ingotvault list          # planned mirror paths
ingotvault --dry-run     # no writes
ingotvault               # ensure bare mirrors + push
ingotvault verify        # compare tips
```

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

Restore a WIP snapshot (fetch from the mirror if needed):

```bash
git fetch backup 'refs/ingotvault/wip/*:refs/ingotvault/wip/*'
git restore --source=refs/ingotvault/wip/<host>/<slug>/<timestamp> --worktree --staged .
```

### Encrypt the vault volume

Git does **not** encrypt repositories at rest. Encrypt the volume (or container) that holds `mirrorRoot`, then point config at a path inside the unlocked volume.

| OS | Typical option |
|----|----------------|
| Windows | BitLocker To Go on the removable drive |
| macOS | APFS encrypted volume or encrypted disk image |
| Linux | LUKS (`cryptsetup`) |
| Cross-platform | VeraCrypt container |

More detail in [`docs/encryption.md`](https://github.com/Catalyst-Forge-LLC/ingotvault/blob/main/docs/encryption.md) once the repo is public.

### Full reference

Exit codes and divergence recovery: [Safety](/safety). Flags and scheduling notes also live in the [GitHub README](https://github.com/Catalyst-Forge-LLC/ingotvault#readme) once the repo is public.
