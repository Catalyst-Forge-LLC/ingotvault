---
title: Install
description: Install ingotvault from npm or a clone.
order: 1
---

Requires **Node.js 22+** and `git` on PATH.

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

ingotvault list          # planned mirror paths
ingotvault --dry-run     # no writes
ingotvault               # ensure bare mirrors + push
ingotvault verify        # compare tips
```

Mirror naming preserves workspace paths under `mirrorRoot` (`acme/widgets` → `…/acme/widgets.git`).

### Agents / session boundaries

```bash
# Snapshot dirty trees (untracked included; .gitignore respected) → refs/ingotvault/wip/…
ingotvault --capture-worktree

# Silent when the vault matches; noise only on drift
ingotvault verify --quiet-if-clean
```

Or set `"captureWorktree": true` in config. Gitignored files are **not** captured; use `wipExclude` for extra pathspecs. See [An undo layer for autonomous edits](/posts/undo-layer-for-agents).

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

Encrypt the volume that holds `mirrorRoot` — git does not encrypt at rest. OS guides: [docs/encryption.md](https://github.com/Catalyst-Forge-LLC/ingotvault/blob/main/docs/encryption.md).

### Full reference

Flags, exit codes, and divergence recovery live in the [GitHub README](https://github.com/Catalyst-Forge-LLC/ingotvault#readme). Coverage details: [Safety](/safety).
