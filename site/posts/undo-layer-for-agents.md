---
title: "An undo layer for autonomous edits"
date: 2026-08-11
description: Why an append-only spare remote fits agent-assisted development better than most backup tools — and how WIP capture closes the dirty-tree gap.
tags: [agents, guides]
---

Coding agents fail differently than humans. They don't usually delete your project folder. They **rewrite**: squash commits, `git reset --hard`, amend history, delete a branch that "looked stale," rebase away a commit. An append-only spare remote that never force-pushes and never prunes deleted branches is exactly the shape that survives that class of failure. The mirror is a **ratchet** — history only accumulates. When an agent deletes a branch, the mirror still has it.

## The gap that matters most

The single most common agent-caused loss is **uncommitted** work: `git checkout .`, `git clean -fd`, `git reset --hard` on a dirty tree. Commits-only coverage misses all of it, and unlike a human, an agent can do it thirty seconds after you stepped away.

ingotvault closes that without breaking the headline promise. Opt in with `--capture-worktree` (or `"captureWorktree": true` in config). Dirty index + worktree — including **untracked** files, including linked worktrees from `git worktree list` — become commits under:

```text
refs/ingotvault/wip/<host>/<slug>/<timestamp>
```

Those WIP refs are pushed with an explicit refspec (`refs/ingotvault/wip/*`) so they land on the mirror, not only on the laptop.

**.gitignore is respected.** Capture uses `git add -A` against a temporary index; ignored paths (`.env`, `service-account.json`, `.venv/`, …) are not swept into the snapshot. For anything further, set `wipExclude` pathspecs in config.

Nothing in your working tree is mutated. **History refs are append-only; WIP snapshots are a rolling window** — newest `wipRetention` (default 20) are kept, older ones prune locally and on the mirror. That window is the only thing ingotvault ever deletes from a mirror. The default promise stays: every commit you've made lands in a second place you control. Optionally, a snapshot of your dirty tree too.

```bash
ingotvault --capture-worktree
```

Restore later (fetch the WIP ref from the mirror first if you are not on the original machine):

```bash
# from a clone of the bare mirror, or with backup already configured:
git fetch backup 'refs/ingotvault/wip/*:refs/ingotvault/wip/*'

# overlay the snapshot onto the worktree (keeps HEAD where it is):
git restore --source=refs/ingotvault/wip/<host>/<slug>/<timestamp> --worktree --staged .

# or inspect without writing files:
git show refs/ingotvault/wip/<host>/<slug>/<timestamp>
```

## Linked worktrees

Agent harnesses increasingly run parallel tasks in `git worktree add` directories. Discovery skips directories whose `.git` is a file as scan roots — those branches live in the **parent** repo's `refs/heads`. `push --all` from the parent already covers the committed work. With `captureWorktree` on, dirty state is snapshotted for each path from `git worktree list`.

## A mounted vault is inside the blast radius

If the drive is unlocked and writable while an agent has a shell, the agent can `rm -rf` the mirrors, run `ingotvault --force-with-lease --all-repos`, or point `mirrorRoot` somewhere useless. The encryption docs already say this: not covered when the volume is unlocked on a logged-in machine.

Practical mitigations, ascending effort:

1. Mount the vault **read-only** for the agent's user, or run ingotvault as a different user / scheduled task the agent cannot invoke. This is the real answer; it is an OS concern next to the tool, not inside it.
2. Keep config outside anything the agent works in. Do not put `ingotvault` on the agent's shell allowlist.
3. Physically unplug between runs — crude, effective, and already the theft story.

Also: `safeDirectory: "per-mirror"` writes to global `~/.gitconfig`. In a sandbox where you are constraining what an agent can reach, that mutation is one more thing to reason about. Use `ingotvault safe-dirs --clean` to remove only entries under your `mirrorRoot`.

## Where verify becomes interesting

In a human workflow, `verify` is a health check. In an agent workflow it is a **detector**. `diverged` on a repo you did not personally rebase means something rewrote history — the signal you want after an unattended session.

Wire it at session boundaries rather than only on a weekday timer:

```bash
ingotvault --capture-worktree          # before / after a long agent run
ingotvault verify --quiet-if-clean     # silent when clean; noise on drift
```

`--quiet-if-clean` makes that cheap enough for a wrapper script or harness hook.

The [install](/install) page has the commands. The [Safety](/safety) page has the full coverage table — including what is deliberately not covered.
