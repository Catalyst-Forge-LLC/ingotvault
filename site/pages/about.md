---
title: Back up local Git branches and tags, including work you haven't pushed.
description: Push covered local Git history to bare mirrors on a drive you control. Never touches origin.
order: 1
---

**IngotVault** scans a workspace, adds a local `backup` remote, and pushes local branches and tags into bare mirrors on a path you choose: USB, SD, NAS, or another disk. It never modifies `origin`.

It does not run in the background, and it does not hook `git push`.

## Quick start

```bash
pnpm add -g ingotvault
ingotvault init
ingotvault list
ingotvault schedule install
ingotvault
ingotvault verify
```

`init` asks for the workspace and the mirror path. Remote name and scan depth have defaults (`backup` and `3`). It writes `ingotvault.config.json` in the current directory and the vault marker. `schedule install` registers a daily job at 18:00 local. You are done when `verify` prints `ok` and `refs match`.

Run `ingotvault` again whenever you want another capture. An agent can run `ingotvault --repo .` in one repo. That is optional. The daily job and that command can both be on. If the drive is unplugged, a scheduled run skips and a manual run stops.

Clone, another time of day (`--at`), WIP, restore, and encrypt are on [Install](/install). Force update is on [Safety](/safety).

Agents rebase, amend, reset, and delete a branch that looked stale. A branch that was already captured stays on the spare remote. [An undo layer for autonomous edits](/posts/undo-layer-for-agents).

<p class="kicker">npm · pnpm · Node 22+ · Apache-2.0</p>

<div class="cta-row">
  <a class="cta cta-primary" href="/install">Install IngotVault →</a>
  <a class="cta cta-secondary" href="https://github.com/Catalyst-Forge-LLC/ingotvault">View on GitHub</a>
</div>

### Coverage on a successful run

| Included | Not included by default |
| --- | --- |
| Local branches and tags | Uncommitted files and stashes |
| `refs/notes/*`, `refs/replace/*`, `refs/ingotvault/*` | Git LFS object bytes (pointer files only) |
| Opt-in WIP snapshot of a dirty tree that is not gitignored | Submodule object stores |

A run captures the refs that exist at that moment. Later edits wait for the next successful run. Stashes, uncommitted files, and commits that sit on no covered ref are not protected. Deleted branches stay on the mirror. If one repo fails, the others continue.

A vault on the same physical disk as the workspace is a second Git copy on that disk. It is not protection against that disk failing.

[What is covered](/safety) · [Restore a lost branch](/install#restore-a-lost-branch)

## Why it exists

Forge remotes cover what you pushed upstream. File backups cover bytes on disk, including a torn `.git` mid-rebase. Between those two you still lose:

- Repos with no forge remote
- Unpushed branches and tags in repos you thought were safe because `main` is on origin
- NDA'd or unfinished work that should not leave the machine
- Offline or intermittent network
- Forge outage, lost 2FA, or losing org access

A push into a bare mirror is a git operation: validated on receipt, atomic at the ref level, restorable with `git clone`, checkable with `ingotvault verify`.

Built by [Catalyst Forge LLC](https://www.catalystforge.com).
