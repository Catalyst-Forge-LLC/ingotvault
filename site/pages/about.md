---
title: Spare remotes for a folder of Git repos.
description: Push committed history to bare mirrors on a drive you control. Never touches origin.
order: 1
---

**IngotVault** scans a workspace, adds a local `backup` remote, and pushes every local branch and tag into bare mirrors on a path you choose: USB, SD, NAS, or another disk. It never modifies `origin`. Force-push is never the default.

**Every commit you've made lands in a second place you control.** Optionally, a snapshot of your dirty tree too.

[What is covered](/safety)

<div class="cta-row">
  <a class="cta cta-primary" href="/install">Install IngotVault →</a>
  <a class="cta cta-secondary" href="https://github.com/Catalyst-Forge-LLC/ingotvault">View on GitHub</a>
</div>

<p class="kicker">npm · pnpm · Node 22+ · Apache-2.0</p>

## When an agent rewrites history

<div class="mesh-panel">
  <p>Agents rebase, amend, reset, and delete a branch that looked stale. An append-only spare remote keeps the branch they removed. Opt-in WIP capture snapshots dirty trees (respecting <code>.gitignore</code>) before an unattended session can wipe them.</p>
  <p>The argument: <a href="/posts/undo-layer-for-agents"><strong>An undo layer for autonomous edits</strong></a>.</p>
</div>

## Why it exists

Forge remotes cover what you pushed upstream. File backups cover bytes on disk, including a torn `.git` mid-rebase. Between those two you still lose:

- Repos with no forge remote
- Unpushed branches and tags in repos you thought were safe because `main` is on origin
- NDA'd or unfinished work that should not leave the machine
- Offline or intermittent network
- Forge outage, lost 2FA, or losing org access

A push into a bare mirror is a git operation: validated on receipt, atomic at the ref level, restorable with `git clone`, checkable with `ingotvault verify`.

## Guarantees

- Never touches `origin` or other remotes
- Never force-pushes unless you aim `--force-with-lease` at a repo
- Never prunes deleted branches. History refs only accumulate. WIP snapshots are a separate rolling window.
- One repo fails; the others continue
- Locked or missing vault → exit `2` (scheduled runs can skip quietly)

Details and edge cases: [Safety](/safety). CLI, config resolution, and discovery: [README on GitHub](https://github.com/Catalyst-Forge-LLC/ingotvault#readme).

## Quick start

```bash
pnpm add -g ingotvault
ingotvault init
ingotvault list
ingotvault
ingotvault verify
```

More install paths (clone, WIP, restore, encrypt): [Install](/install).

<div class="cta-row">
  <a class="cta cta-primary" href="/install">Get started →</a>
  <a class="cta cta-secondary" href="/safety">Safety</a>
  <a class="cta cta-secondary" href="/writing">Read the posts</a>
</div>

Built by [Catalyst Forge LLC](https://www.catalystforge.com).
