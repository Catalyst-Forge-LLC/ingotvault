---
title: Safety
description: What ingotvault covers, what it refuses to do, and what is deliberately out of scope.
order: 2
---

The product is this guarantee set — what a late-night bash loop usually gets wrong.

| Concern | Behavior |
|---------|----------|
| `origin` / other remotes | Never modified |
| What gets pushed | All local branches + tags + `refs/notes/*` + `refs/replace/*` |
| Force update | Never by default. Opt-in `--force-with-lease` requires `--repo` or `--all-repos`. Uses `ls-remote` tips and explicit `--force-with-lease=<ref>:<oid>`; if a mirror tip is missing locally, fetches it into `refs/ingotvault/preforce/…` first so history is not orphaned |
| Non-fast-forward (rebase/amend) | Fail that repo with `DIVERGED:` (branches and tags); other repos continue. **Do not delete** the stale mirror — move it under `mirrorRoot/_diverged/` |
| Existing `backup` with wrong URL | Fail that repo; continue others |
| Concurrent runs | Lock file `mirrorRoot/.ingotvault.lock` |
| Mirror volume missing/locked | Exit `2` (scheduled: expected skip) |
| Deleted local branches | **Not pruned** from the mirror — intentional ratchet: history only accumulates (valuable when an agent "cleans up" a branch) |
| Uncommitted work / stashes | Not covered by default. Opt-in `captureWorktree` / `--capture-worktree` snapshots dirty trees (incl. untracked that are **not** gitignored) to `refs/ingotvault/wip/<host>/…` without mutating the worktree; keeps newest `wipRetention` (default 20). That rolling window is the only thing ingotvault deletes from a mirror. Use `wipExclude` for extra pathspecs |
| Git LFS | Not covered — bare push stores pointer files only; warned when `.gitattributes` has `filter=lfs` |
| Linked worktrees | Discovery skips dirs whose `.git` is a file, but their **branches** live in the parent repo — `push --all` from the parent already covers committed work. With `captureWorktree`, dirty state is snapshotted for each path from `git worktree list` |
| Submodules | Skipped (`.git` is a file). Parent stores only the gitlink SHA; submodule objects are not pushed. Restore needs each submodule's own remote (or its own ingotvault mirror) |
| Drive pulled mid-push | Push may be partial; remount and re-run — Git usually recovers; `verify` helps confirm |

Promise sentence (same everywhere): **every commit you've made lands in a second place you control** — local branches, tags, `refs/notes/*`, and `refs/replace/*`. Optionally, a dirty-tree snapshot too.

Full CLI and restore notes: [Install](/install) · [README on GitHub](https://github.com/Catalyst-Forge-LLC/ingotvault#readme).
