---
title: Spare remotes for a folder of Git repos.
description: Push committed history to bare mirrors on a drive you control. Never touches origin.
order: 1
---

**ingotvault** scans a workspace, ensures a local `backup` remote, and pushes every local branch and tag into bare mirrors on a path you choose — USB, SD, NAS, or another disk. It never modifies `origin`. Force-push is never the default.

The promise is narrow on purpose: **every commit you've made lands in a second place you control.** Optionally, a snapshot of your dirty tree too.

[What else is covered →](/safety)

<div class="cta-row">
  <a class="cta cta-primary" href="/install">Install ingotvault →</a>
  <a class="cta cta-secondary" href="https://github.com/Catalyst-Forge-LLC/ingotvault">View on GitHub</a>
</div>

<p class="kicker">npm · pnpm · Node 22+ · Apache-2.0</p>

## For agents

<div class="mesh-panel">
  <p>Agents fail by <em>rewriting</em> — rebase, amend, reset, deleting a “stale” branch. An append-only spare remote is a ratchet that survives that class of failure. Opt-in WIP capture snapshots dirty trees (respecting <code>.gitignore</code>) before an unattended session can erase them.</p>
  <p>Read the full argument: <a href="/posts/undo-layer-for-agents"><strong>An undo layer for autonomous edits</strong></a>.</p>
</div>

## Why it exists

Forge remotes cover what you pushed upstream. File backups cover bytes on disk — including a torn `.git` mid-rebase. The gap between them is real:

- Repos with **no forge remote** at all
- **Unpushed branches and tags** in repos you thought were safe because `main` is on origin
- **Confidentiality** — NDA'd or unfinished work that shouldn't leave the machine
- **Offline / intermittent** network
- **Account-level risk** — forge outage, lost 2FA, losing org access

A push into a bare mirror is a **git** operation: validated on receipt, atomic at the ref level, restorable with `git clone`, checkable with `ingotvault verify`.

## Guarantees

- Never touches `origin` or other remotes
- Never force-pushes unless you aim `--force-with-lease` at a repo
- Never prunes deleted branches — history refs only accumulate. WIP snapshots are a separate rolling window.
- One repo fails; the others continue
- Locked / missing vault → exit `2` (scheduled runs can skip quietly)

Details and edge cases: [Safety](/safety).

## Quick start

```bash
pnpm add -g ingotvault
ingotvault init
ingotvault list
ingotvault
ingotvault verify
```

Full flags and restore notes live on the [install](/install) page and in the [README](https://github.com/Catalyst-Forge-LLC/ingotvault#readme).

<div class="cta-row">
  <a class="cta cta-primary" href="/install">Get started →</a>
  <a class="cta cta-secondary" href="/safety">Safety</a>
  <a class="cta cta-secondary" href="/writing">Read the posts</a>
</div>

Built by [Catalyst Forge LLC](https://www.catalystforge.com).
