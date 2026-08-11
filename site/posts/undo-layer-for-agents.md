---
title: "An undo layer for autonomous edits"
date: 2026-08-11
description: Why an append-only spare remote fits agent-assisted development better than most backup tools — and how WIP capture closes the dirty-tree gap.
tags: [agents, guides]
---

Coding agents fail differently than humans. They don't usually delete your project folder. They **rewrite**: squash commits, `git reset --hard`, amend history, delete a branch that "looked stale," rebase away a commit. An append-only spare remote that never force-pushes and never prunes deleted branches is exactly the shape that survives that class of failure. The mirror is a **ratchet** — history only accumulates.

That inverts a row that used to read like a mild caveat. When an agent deletes a branch, the mirror still has it. That is the feature.

## The gap that matters most

The single most common agent-caused loss is **uncommitted** work: `git checkout .`, `git clean -fd`, `git reset --hard` on a dirty tree. Commits-only coverage misses all of it, and unlike a human, an agent can do it thirty seconds after you stepped away.

ingotvault closes that without breaking the headline promise. Opt in with `--capture-worktree` (or `"captureWorktree": true` in config). Dirty index + worktree — including untracked files, including linked worktrees from `git worktree list` — become commits under:

```text
refs/ingotvault/wip/<host>/<slug>/<timestamp>
```

Nothing in your working tree is mutated. Newest `wipRetention` snapshots are kept (default 20); older ones prune locally and on the mirror. The default promise stays: every commit you've made lands in a second place you control. Optionally, a snapshot of your dirty tree too.

```bash
ingotvault --capture-worktree
# restore later:
git show refs/ingotvault/wip/<host>/<slug>/<timestamp>
```

That single feature is what makes the tool specifically valuable for agent-assisted development rather than incidentally compatible with it.

## Worktrees already mostly work

Agent harnesses increasingly run parallel tasks in `git worktree add` directories. Discovery skips directories whose `.git` is a file — correct for scan roots — but those branches live in the **parent** repo's `refs/heads`. `push --all` from the parent already covers the committed work. With `captureWorktree` on, dirty state is snapshotted for each path from `git worktree list`.

## A mounted vault is inside the blast radius

If the drive is unlocked and writable while an agent has a shell, the agent can `rm -rf` the mirrors, run `ingotvault --force-with-lease --all-repos`, or point `mirrorRoot` somewhere useless. The encryption section already says this: not covered when the volume is unlocked on a logged-in machine.

Practical mitigations, ascending effort:

1. Mount the vault **read-only** for the agent's user, or run ingotvault as a different user / scheduled task the agent cannot invoke. This is the real answer; it is an OS concern, but it belongs next to the tool.
2. Keep config outside anything the agent works in. Do not put `ingotvault` on the agent's shell allowlist.
3. Physically unplug between runs — crude, effective, and already the theft story.

Also: `safeDirectory: "per-mirror"` writes to global `~/.gitconfig`. In a sandbox where you are constraining what an agent can reach, that mutation is one more thing to reason about. Use `ingotvault unsafe-directory --clean` to remove only entries under your `mirrorRoot`.

## Where verify becomes interesting

In a human workflow, `verify` is a health check. In an agent workflow it is a **detector**. `diverged` on a repo you did not personally rebase means something rewrote history — the signal you want after an unattended session.

Wire it at session boundaries rather than only on a weekday timer:

```bash
ingotvault --capture-worktree          # before / after a long agent run
ingotvault verify --quiet-if-clean     # silent when clean; noise on drift
```

`--quiet-if-clean` makes that cheap enough for a wrapper script or harness hook.

## Framing

Not "backup" (you lose to restic on coverage) and not only "spare remote" — for this audience it is also an **undo layer for autonomous edits**. People who let an agent commit freely because reviewing every diff defeats the point, and who want to reconstruct what existed before the session started. That group is growing fast. The existing guarantee set — never force by default, never prune, never touch origin — is already almost exactly the right answer.

The [install](/install) page has the commands. The [GitHub README](https://github.com/Catalyst-Forge-LLC/ingotvault#readme) has the Safety table.
