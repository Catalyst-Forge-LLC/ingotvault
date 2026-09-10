---
title: Safety
description: What IngotVault covers, what it refuses to do, and what is deliberately out of scope.
order: 2
---

The product is this guarantee set: what a late-night bash loop usually gets wrong. Same facts as the [README Safety table](https://github.com/Catalyst-Forge-LLC/ingotvault#safety). This page is the readable form.

**Back up covered local Git branches and tags to a second location you control, including work you have not pushed upstream.** A successful run pushes local branches, tags, `refs/notes/*`, `refs/replace/*`, and `refs/ingotvault/*` (WIP snapshots and preforce rescues). Optionally, a dirty-tree snapshot too. Work must be captured before it is lost. The tool does not automatically protect every historical object, stash, uncommitted file, or change made after the last successful capture.

### Coverage at a glance

| Included on a successful run | Not included by default |
| --- | --- |
| Local branches and tags | Uncommitted files and stashes |
| `refs/notes/*`, `refs/replace/*`, `refs/ingotvault/*` | Git LFS object bytes (pointer files only) |
| Opt-in WIP snapshot of a dirty tree that is not gitignored | Submodule object stores (parent keeps the gitlink SHA) |

Capture happens when a run succeeds. Later edits wait for the next successful run. Detached commits still push if a local branch or tag points at them. Commits that sit on no covered ref are not pushed. Custom namespaces (for example Gerrit `refs/changes`) are not covered.

A vault on the same physical disk as the workspace is a second Git copy on that disk. It is not protection against that disk failing.

### `origin` / other remotes

Never modified.

### What gets pushed

All local branches + tags + `refs/notes/*` + `refs/replace/*` + `refs/ingotvault/*` (WIP snapshots under `refs/ingotvault/wip/…`, preforce rescues under `refs/ingotvault/preforce/…`).

### Force update

Never by default. Requires `allowForceWithLease: true` in config **and** CLI `--force-with-lease` with `--repo` or `--all-repos`. Uses `ls-remote` tips and explicit `--force-with-lease=<ref>:<oid>`. If a mirror tip is missing locally, fetches it into `refs/ingotvault/preforce/…` first so history is not orphaned, then that namespace is pushed to the spare remote with the rest of `refs/ingotvault/*`.

### Non-fast-forward (rebase / amend)

Fail that repo with `DIVERGED:` (branches and tags). Other repos continue. **Do not delete** the stale mirror. See [Divergence recovery](#divergence-recovery).

### Existing `backup` with wrong URL

Fail that repo. Continue others.

### Concurrent runs

Lock file `mirrorRoot/.ingotvault.lock`.

### Mirror volume missing / locked / not a vault

Exit `2` (scheduled: expected skip). `init` writes `mirrorRoot/.ingotvault-vault`. Normal runs never create the tree if that marker is absent, so an unplugged volume cannot silently land mirrors on the boot disk. See [Exit codes](#exit-codes).

### Deleted local branches

**Not pruned** from the mirror. Intentional ratchet: history only accumulates (valuable when an agent "cleans up" a branch).

### Uncommitted work / stashes

Not covered by default. Opt-in `captureWorktree` / `--capture-worktree` snapshots dirty trees (including untracked files that are **not** gitignored) to `refs/ingotvault/wip/<host>/…` without mutating the worktree. Keeps newest `wipRetention` (default 20) per worktree slug on this host. Prune/push is host-scoped so a shared vault does not wipe another machine's WIP. That rolling window is the only thing IngotVault deletes from a mirror. Use `wipExclude` for extra pathspecs. Ignored files stay out of WIP snapshots.

### Git LFS

Not covered. Bare push stores pointer files only. Warned when `.gitattributes` has `filter=lfs`.

### Linked worktrees

Discovery skips dirs whose `.git` is a file, but their **branches** live in the parent repo. `push --all` from the parent already covers committed work. With `captureWorktree`, dirty state is snapshotted for each path from `git worktree list`.

### Submodules

Skipped (`.git` is a file). Parent stores only the gitlink SHA. Submodule objects are not pushed. Restore needs each submodule's own remote (or its own IngotVault mirror).

### Drive pulled mid-push

Push may be partial. Remount and re-run. Git usually recovers. `verify` helps confirm.

## Exit codes

| Code | When |
|------|------|
| `0` | Success (verify with `--quiet-if-clean` stays silent when clean) |
| `1` | Setup/config broken, missing `git`, bad flags (for example `--force-with-lease` without `--repo` / `--all-repos`) |
| `2` | Mirror volume missing or locked. Expected skip for scheduled runs. Prefer not alerting |
| `3` | One or more repos failed, or `verify` found drift (`behind` / `diverged` / `missing-mirror`) |

## Divergence recovery

By default IngotVault **never** force-pushes. After a rebase or amend, the bare mirror may reject updates. That repo fails with a loud `DIVERGED:` message while other repos continue.

### Timeline

1. **Successful capture.** A run pushes the current covered tips. The mirror now holds that history.
2. **Local rewrite.** You rebase, amend, or otherwise replace a tip. The laptop now has the new history. The mirror still has the pre-rewrite tips.
3. **Diverged run.** The next run fails that repo with `DIVERGED:` and leaves the old mirror in place. Sibling repos still push.
4. **Recovery.** Keep the old mirror. It may be the only copy of the pre-rewrite commits. Then choose Option A or Option B below.

Which copy has which history after step 3: the laptop has the rewritten tips, the live mirror has the pre-rewrite tips. A later force update or a fresh mirror after quarantine can capture the rewritten tips. That does not erase the need to keep the old copy.

**Do not delete the stale mirror.**

**Option A: aimed force update** (keeps missing mirror tips under `refs/ingotvault/preforce/…` on the laptop, then pushes that namespace to the spare remote):

```bash
ingotvault --force-with-lease --repo notes
```

Force update is never the default. It still requires `allowForceWithLease: true` in config and an aimed `--repo` or `--all-repos`.

**Option B: quarantine the old mirror and start fresh** (prefer `_diverged/` so the live tree stays clean):

```bash
mkdir -p "$mirrorRoot/_diverged"
mv "$mirrorRoot/notes.git" \
   "$mirrorRoot/_diverged/notes.diverged-2026-08-11.git"
ingotvault --repo notes
```

After Option B, `_diverged/notes.diverged-2026-08-11.git` still holds the pre-rewrite history. The new `notes.git` receives the rewritten tips on the next successful run.

Commands and restore recipes: [Install](/install). Disposable restore fixture: [restore demonstration](https://github.com/Catalyst-Forge-LLC/ingotvault/blob/main/docs/restore-demo.md). CLI flags, config resolution, and discovery: [README on GitHub](https://github.com/Catalyst-Forge-LLC/ingotvault#readme).
