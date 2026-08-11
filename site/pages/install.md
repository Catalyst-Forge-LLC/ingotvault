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
# Snapshot dirty trees (incl. untracked) to refs/ingotvault/wip/…
ingotvault --capture-worktree

# Silent when the vault matches; noise only on drift
ingotvault verify --quiet-if-clean
```

Or set `"captureWorktree": true` in config. See [An undo layer for autonomous edits](/posts/undo-layer-for-agents).

### Restore

```bash
git clone /path/to/mirrors/notes.git notes-restored
```

Other branches appear as `origin/<name>` until you check them out. Encrypt the volume that holds `mirrorRoot` — git does not encrypt at rest. OS guides: [docs/encryption.md](https://github.com/Catalyst-Forge-LLC/ingotvault/blob/main/docs/encryption.md).

### Full reference

Flags, exit codes, divergence recovery, and the Safety table live in the [GitHub README](https://github.com/Catalyst-Forge-LLC/ingotvault#readme).
