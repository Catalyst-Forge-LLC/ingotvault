---
title: Safety
description: What IngotVault covers, what it refuses to do, and what is deliberately out of scope.
order: 2
---

The product is this guarantee set: what a late-night bash loop usually gets wrong. Same facts as the [README Safety table](https://github.com/Catalyst-Forge-LLC/ingotvault#safety); this page is the readable form.

**Every commit you've made lands in a second place you control:** local branches, tags, `refs/notes/*`, `refs/replace/*`, and `refs/ingotvault/*` (WIP snapshots and preforce rescues). Optionally, a dirty-tree snapshot too.

### `origin` / other remotes

Never modified.

### What gets pushed

All local branches + tags + `refs/notes/*` + `refs/replace/*` + `refs/ingotvault/*` (WIP snapshots under `refs/ingotvault/wip/…`, preforce rescues under `refs/ingotvault/preforce/…`).

### Force update

Never by default. Requires `allowForceWithLease: true` in config **and** CLI `--force-with-lease` with `--repo` or `--all-repos`. Uses `ls-remote` tips and explicit `--force-with-lease=<ref>:<oid>`; if a mirror tip is missing locally, fetches it into `refs/ingotvault/preforce/…` first so history is not orphaned, then that namespace is pushed to the spare remote with the rest of `refs/ingotvault/*`.

### Non-fast-forward (rebase / amend)

Fail that repo with `DIVERGED:` (branches and tags); other repos continue. **Do not delete** the stale mirror — see [Divergence recovery](#divergence-recovery).

### Existing `backup` with wrong URL

Fail that repo; continue others.

### Concurrent runs

Lock file `mirrorRoot/.ingotvault.lock`.

### Mirror volume missing / locked / not a vault

Exit `2` (scheduled: expected skip). `init` writes `mirrorRoot/.ingotvault-vault`; normal runs never create the tree if that marker is absent — so an unplugged volume cannot silently land mirrors on the boot disk. See [Exit codes](#exit-codes).

### Deleted local branches

**Not pruned** from the mirror — intentional ratchet: history only accumulates (valuable when an agent "cleans up" a branch).

### Uncommitted work / stashes

Not covered by default. Opt-in `captureWorktree` / `--capture-worktree` snapshots dirty trees (incl. untracked that are **not** gitignored) to `refs/ingotvault/wip/<host>/…` without mutating the worktree; keeps newest `wipRetention` (default 20) per worktree slug on this host. Prune/push is host-scoped so a shared vault does not wipe another machine's WIP. That rolling window is the only thing IngotVault deletes from a mirror. Use `wipExclude` for extra pathspecs.

### Git LFS

Not covered — bare push stores pointer files only; warned when `.gitattributes` has `filter=lfs`.

### Linked worktrees

Discovery skips dirs whose `.git` is a file, but their **branches** live in the parent repo — `push --all` from the parent already covers committed work. With `captureWorktree`, dirty state is snapshotted for each path from `git worktree list`.

### Submodules

Skipped (`.git` is a file). Parent stores only the gitlink SHA; submodule objects are not pushed. Restore needs each submodule's own remote (or its own IngotVault mirror).

### Drive pulled mid-push

Push may be partial; remount and re-run — Git usually recovers; `verify` helps confirm.

## Exit codes

| Code | When |
|------|------|
| `0` | Success (verify with `--quiet-if-clean` stays silent when clean) |
| `1` | Setup/config broken, missing `git`, bad flags (e.g. `--force-with-lease` without `--repo` / `--all-repos`) |
| `2` | Mirror volume missing or locked — expected skip for scheduled runs; prefer not alerting |
| `3` | One or more repos failed, or `verify` found drift (`behind` / `diverged` / `missing-mirror`) |

## Divergence recovery

By default IngotVault **never** force-pushes. After a rebase or amend, the bare mirror may reject updates. That repo fails with a loud `DIVERGED:` message while other repos continue.

The stale mirror may be the **only** copy of pre-rebase history. **Do not delete it.**

**Option A — aimed force update** (keeps missing mirror tips under `refs/ingotvault/preforce/…` on the laptop, then pushes that namespace to the spare remote):

```bash
ingotvault --force-with-lease --repo notes
```

**Option B — quarantine the old mirror and start fresh** (prefer `_diverged/` so the live tree stays clean):

```bash
mkdir -p "$mirrorRoot/_diverged"
mv "$mirrorRoot/notes.git" \
   "$mirrorRoot/_diverged/notes.diverged-2026-08-11.git"
ingotvault --repo notes
```

Commands and restore recipes: [Install](/install). CLI flags, config resolution, and discovery: [README on GitHub](https://github.com/Catalyst-Forge-LLC/ingotvault#readme).
