<p align="center">
  <img src="site/static/logo.png" alt="IngotVault" width="128" height="128" />
</p>

# IngotVault

**Every commit in a second place you control.**

A **spare remote** for a folder full of Git repos: push committed history into bare mirrors on a drive you control. **Never touches `origin`.**

**Site:** [ingotvault.dev](https://ingotvault.dev) — Install, Safety, and the agents write-up live there. This README is the CLI / config reference; keep both in sync when behavior changes.

| On the site | In this repo |
|-------------|--------------|
| [Install](https://ingotvault.dev/install) | Quick start + full CLI below |
| [Safety](https://ingotvault.dev/safety) | Guarantee summary below (same facts) |
| [An undo layer for autonomous edits](https://ingotvault.dev/posts/undo-layer-for-agents) | [Working with coding agents](#working-with-coding-agents) |
| — | [`docs/encryption.md`](docs/encryption.md), [`config.example.json`](config.example.json) |

The promise is narrow on purpose: **every commit you've made lands in a second place you control.** Not uncommitted work (unless you opt in), not LFS objects — commits on every local branch and tag, plus `refs/notes/*`, `refs/replace/*`, and `refs/ingotvault/*` (default: `git push --all`, `--tags`, and those refspecs). Optionally, a snapshot of your dirty tree too (`captureWorktree`). Custom namespaces (e.g. Gerrit `refs/changes`) are not covered.

That gap is real even if you already have a forge **and** a file backup:

- Repos with **no forge remote** (scratch experiments, notes-in-git, client work you never uploaded)
- **Unpushed branches and tags** in repos you think are "backed up" because `main` is on origin
- **Confidentiality** (NDA, regulated, or unfinished thinking that shouldn't leave your machine)
- **Offline / intermittent** network (flight, field, air-gapped sites)
- **Account-level risk** (forge outage, lost 2FA, org offboarding) — low odds, total loss

Unlike a file copy of a live `.git`, a push into a bare mirror is a **git** operation: validated on receipt, atomic at the ref level, restorable with `git clone`, checkable with `ingotvault verify`. An unplugged drive won't replicate your `rm -rf` the way cloud sync can. ("Git is already distributed" only helps if another up-to-date clone exists — often the laptop is the sole copy.)

**Not for** one or two repos you already push everywhere with no unpushed branches.

The product is the **guarantee set** below — what a late-night bash loop usually gets wrong. Narrative form: [Safety on the site](https://ingotvault.dev/safety).

## Safety

| Concern | Behavior |
|---------|----------|
| `origin` / other remotes | Never modified |
| What gets pushed | All local branches + tags + `refs/notes/*` + `refs/replace/*` + `refs/ingotvault/*` (WIP under `refs/ingotvault/wip/…`, preforce rescues under `refs/ingotvault/preforce/…`) |
| Force update | Never by default. Requires `allowForceWithLease: true` in config **and** CLI `--force-with-lease` with `--repo` or `--all-repos`. Uses `ls-remote` tips and explicit `--force-with-lease=<ref>:<oid>`; if a mirror tip is missing locally, fetches it into `refs/ingotvault/preforce/…` first, then pushes `refs/ingotvault/*` to the spare remote |
| Non-fast-forward (rebase/amend) | Fail that repo with `DIVERGED:` (branches and tags); other repos continue. **Do not delete** the stale mirror — see [Divergence](#divergence) |
| Existing `backup` with wrong URL | Fail that repo; continue others |
| Concurrent runs | Lock file `mirrorRoot/.ingotvault.lock` (records hostname; foreign PIDs are not probed) |
| Mirror volume missing/locked / not a vault | Exit `2` (scheduled: expected skip). `init` writes `mirrorRoot/.ingotvault-vault`; normal runs **never** mkdir the tree — an unplugged `/Volumes/…` must not silently create mirrors on the boot disk |
| Deleted local branches | **Not pruned** from the mirror — intentional ratchet: history only accumulates (valuable when an agent "cleans up" a branch) |
| Uncommitted work / stashes | Not covered by default. Opt-in `captureWorktree` / `--capture-worktree` snapshots dirty trees (incl. untracked that are **not** gitignored) to `refs/ingotvault/wip/<host>/…` without mutating the worktree; keeps newest `wipRetention` (default 20) **per worktree slug on this host**. Prune/push is host-scoped so a shared vault does not wipe another machine's WIP. That rolling window is the **only** thing IngotVault deletes from a mirror. Use `wipExclude` for extra pathspecs |
| Git LFS | Not covered — bare push stores pointer files only; warned when `.gitattributes` has `filter=lfs` |
| Linked worktrees | Discovery skips dirs whose `.git` is a file, but their **branches** live in the parent repo — `push --all` from the parent already covers committed work. With `captureWorktree`, dirty state is snapshotted for each path from `git worktree list` |
| Submodules | Skipped (`.git` is a file). Parent stores only the gitlink SHA; submodule objects are not pushed. Restore needs each submodule's own remote (or its own IngotVault mirror) |
| Drive pulled mid-push | Push may be partial; remount and re-run — Git usually recovers; `verify` helps confirm |

## Install

Requires **Node.js 22+** and `git` on PATH (`git --version` is checked at startup). Same steps: [Install on the site](https://ingotvault.dev/install).

```bash
pnpm add -g ingotvault
# or: npm i -g ingotvault
```

From a clone (dev builds):

```bash
git clone https://github.com/Catalyst-Forge-LLC/ingotvault.git
cd ingotvault
pnpm install
pnpm run build
pnpm link --global
```

## Quick start

```bash
ingotvault init
# prompts for workspace + mirror roots; writes ./ingotvault.config.json
# and creates mirrorRoot/.ingotvault-vault (required on every later run)

ingotvault list          # discover repos → planned mirror paths
ingotvault --dry-run     # no writes
ingotvault               # ensure bare mirrors + backup remote + push
ingotvault verify        # compare local branch/tag tips to mirror tips
ingotvault relink        # after moving mirrorRoot: retarget the backup remote
```

Sample `list` output:

```text
ingotvault  workspace=/Users/you/code  mirror=/Volumes/Backup/git-mirrors
Found 3 repo(s)

acme/widgets             -> /Volumes/Backup/git-mirrors/acme/widgets.git
notes                         -> /Volumes/Backup/git-mirrors/notes.git
tools/scripts                 -> /Volumes/Backup/git-mirrors/tools/scripts.git
```

User-wide config (instead of cwd):

```bash
ingotvault init --global --workspace ~/code --mirror /Volumes/Backup/git-mirrors
```

## Config

Resolution order (first found wins):

1. `--config <path>`
2. `./ingotvault.config.json`
3. User config: `~/.config/ingotvault/config.json` (Windows: `%APPDATA%\ingotvault\config.json`)

`workspaceRoot` and `mirrorRoot` are required. `~` is expanded. See [`config.example.json`](config.example.json) (includes `"$schema"` for editor autocomplete) and [`schema/ingotvault.config.schema.json`](schema/ingotvault.config.schema.json).

Mirror naming (`path-tree`): the relative workspace path is preserved under `mirrorRoot`, with `.git` appended — e.g. `acme/widgets` → `acme/widgets.git`. Nested paths avoid collisions that flat renaming would create (`a/b-c` vs `a-b/c`).

If two machines share one vault drive and the same relative repo paths, they write into the **same** bare mirrors. Scope `mirrorRoot` per machine (e.g. `…/git-mirrors/laptop/`) unless you intentionally want a shared spare.

## Restore

```bash
git clone /Volumes/Backup/git-mirrors/acme/widgets.git widgets-restored
cd widgets-restored
```

That checks out the mirror's default branch. After each successful push, IngotVault sets bare `HEAD` from `origin/HEAD` when present, otherwise `main`/`master` / `init.defaultBranch`, and only then the current branch — so a push while you're on a feature branch does not flip the clone default. Other branches exist as `origin/<name>` until you `git checkout <name>` (or `git switch <name>`).

Uncommitted work is **not** covered unless you opt into `--capture-worktree` (see [Working with coding agents](#working-with-coding-agents) and [Safety](#safety)).

Restore a WIP snapshot (fetch from the mirror first if needed):

```bash
git fetch backup 'refs/ingotvault/wip/*:refs/ingotvault/wip/*'
git restore --source=refs/ingotvault/wip/<host>/<slug>/<timestamp> --worktree --staged .
# inspect only (does not write the worktree):
git show refs/ingotvault/wip/<host>/<slug>/<timestamp>
```

## Divergence

By default IngotVault **never** force-pushes. After a rebase or amend, the bare mirror may reject updates. That repo fails with a loud `DIVERGED:` message (including moved tags) while other repos continue.

The stale mirror may be the **only** copy of pre-rebase history. **Do not delete it.** Same steps: [Safety → Divergence recovery](https://ingotvault.dev/safety#divergence-recovery).

**Option A — aimed force update** (keeps missing mirror tips under `refs/ingotvault/preforce/…`, then pushes `refs/ingotvault/*` to the spare remote):

```bash
ingotvault --force-with-lease --repo notes
```

**Option B — quarantine the old mirror and start fresh** (prefer `_diverged/` so the live tree stays clean):

```bash
mkdir -p /Volumes/Backup/git-mirrors/_diverged
mv /Volumes/Backup/git-mirrors/notes.git \
   /Volumes/Backup/git-mirrors/_diverged/notes.diverged-2026-08-11.git
ingotvault --repo notes
```

## Encrypting the vault

Git does **not** encrypt repositories at rest. Anyone who can mount `mirrorRoot` can read every bare mirror. Encrypt the **volume** (or an encrypted container on it), then point `mirrorRoot` inside that unlocked path.

Unlock the volume before running `ingotvault`. If the path is missing or locked, IngotVault exits with code `2`. For scheduled runs, treat exit `2` as an expected skip (vault unplugged/locked).

| OS | Typical option |
|----|----------------|
| Windows | BitLocker To Go on the removable drive |
| macOS | APFS encrypted volume or encrypted disk image |
| Linux | LUKS (`cryptsetup`) |
| Cross-platform | VeraCrypt container |

Step-by-step OS setup: [`docs/encryption.md`](docs/encryption.md). Short version also on [Install](https://ingotvault.dev/install#encrypt-the-vault-volume).

Removable volumes are often exFAT/FAT. Git may report “dubious ownership”. With `safeDirectory: "per-mirror"` (default), IngotVault adds each mirror path via `git config --global --add safe.directory <path>` (writes `~/.gitconfig` / the global gitconfig). Set `"safeDirectory": "off"` to disable.

Inspect or remove **only** entries under your `mirrorRoot`:

```bash
ingotvault safe-dirs --list
ingotvault safe-dirs --clean
```

Or selectively by hand:

```bash
git config --global --get-all safe.directory
git config --global --unset safe.directory '/Volumes/Backup/git-mirrors/notes.git'
```

Do **not** use `--unset-all safe.directory` — that deletes unrelated entries you may have added for other drives.

### What this does and does not cover

- **Covered:** someone walks off with the SD card/USB/disk and tries to read the mirrors cold.
- **Not covered:** the volume is already unlocked on a logged-in machine; uncommitted work in `workspaceRoot` (encrypt that disk too, or commit / use `--capture-worktree` before you care); recovery keys stored on the same media; Git LFS object bytes; submodule object stores (see Safety).

## Working with coding agents

Agents tend to fail by **rewriting** history (rebase, amend, `reset --hard`, deleting a "stale" branch), not by quietly losing whole directories. An append-only spare remote that never force-pushes and never prunes deleted branches is a **ratchet**: the mirror still has the branch the agent removed.

Longer argument: [An undo layer for autonomous edits](https://ingotvault.dev/posts/undo-layer-for-agents).

The usual agent-shaped loss is **uncommitted** work (`checkout .`, `clean -fd`, hard reset on a dirty tree). Enable WIP capture at session boundaries:

```bash
ingotvault --capture-worktree
# or "captureWorktree": true in config
```

**.gitignore is respected** (`git add -A` on a temporary index). Ignored secrets stay out of the mirror; set `wipExclude` for additional pathspecs. WIP and preforce tips live under `refs/ingotvault/*`, which is pushed to the spare remote with the rest of each run.

`ingotvault verify` is a post-session **detector**: `diverged` on a repo you did not rebase yourself means something rewrote history. Use `--quiet-if-clean` in harness hooks so a clean vault stays silent.

**Blast radius:** if the vault is unlocked and writable while an agent has a shell, the agent can destroy mirrors or invoke `--force-with-lease`. Mitigations (OS/process, not magic in this tool):

- Mount the vault read-only for the agent user, or run IngotVault as a different user/scheduled task the agent cannot invoke
- Keep config outside the agent's working tree; omit `ingotvault` from the agent's shell allowlist
- Unplug between runs (same story as theft)
- Note that `safeDirectory: "per-mirror"` mutates global `~/.gitconfig` — relevant in sandboxes

## Discovery

- Walks `workspaceRoot` up to `maxDepth` (default 3).
- Skips directory names in `excludeDirNames` (default includes `node_modules`, `.git`, `.hg`, `__ARCHIVE`).
- Only treats a directory as a repo when `.git` is a **directory** (linked worktrees and submodules with a `.git` **file** are skipped as scan roots; see Safety for branch/WIP coverage).
- Repos with zero commits are skipped at push time.
- Detached HEAD: commits still push if branches exist via `push --all`; verify reports when there are no local branches.

## CLI

```text
ingotvault init [--global] [--workspace <path>] [--mirror <path>]
                [--remote-name backup] [--max-depth 3]
ingotvault [run] [--config <path>] [--repo <path|name>] [--dry-run]
                [--verbose] [--scheduled] [--capture-worktree]
                [--force-with-lease --repo <path>|--all-repos]
ingotvault list  [--config <path>] [--repo <path|name>]
ingotvault verify [--config <path>] [--repo <path|name>]
                [--verbose] [--quiet-if-clean]
ingotvault relink [--config <path>] [--repo <path|name>]
ingotvault safe-dirs [--config <path>] [--list|--clean]
```

`relink` updates a mismatched `backup` remote URL to the current path-tree mirror location. If the old URL still points at a bare repo on disk (e.g. flat `foo-bar.git` from an earlier naming style) and the new path is empty, it **moves** that bare repo first so history is preserved, then `git remote set-url`. Use `--dry-run` to preview.

`--repo` matches the workspace-relative path (preferred), a unique path suffix, or a unique basename. If several repos share the same leaf name, the command fails and asks for the full relative path.

`--scheduled` writes a timestamped log under `logDir` and prunes logs older than `logRetentionDays` (default 30; `0` = keep forever). No interactive pause; pair with your OS task scheduler. Prefer not alerting on exit `2`.

`ingotvault verify` compares each local branch tip to the bare mirror and reports `ok`, `behind` (mirror tip is an ancestor, N commits behind), `diverged`, or `missing-mirror`. Diverged refs are never counted as "behind." Ends with a summary (`12 ok, 2 diverged, …`). `--quiet-if-clean` prints nothing and exits `0` when everything matches.

## Exit codes

Same table as [Safety → Exit codes](https://ingotvault.dev/safety#exit-codes):

| Code | Meaning |
|------|---------|
| `0` | Success (verify with `--quiet-if-clean` stays silent when clean) |
| `1` | Setup/config/CLI error (bad config, missing git, ambiguous `--repo`, lock held, `--force-with-lease` without `--repo`/`--all-repos`) |
| `2` | Mirror root unavailable (missing marker, locked, or not writable) — expected skip for scheduled runs; prefer not alerting |
| `3` | One or more repos failed on run, or `verify` found drift (`behind` / `diverged` / `missing-mirror`) |

## How it differs

- **Forge remotes (origin)** — cover what you've pushed upstream. IngotVault covers local-only repos and unpushed refs without replacing origin.
- **File backup (Time Machine, restic, Backblaze)** — broader coverage (including dirty worktrees), weaker git semantics. Use both if you want; they solve different problems.
- **myrepos / gita** — run arbitrary git across many repos; you still invent the local spare remote and its safety rules.
- **Host mirror tools** — clone *from* GitHub/GitLab onto disk.
- **git bundle** — portable snapshots, but not an incremental spare remote; each update is a new bundle. Bare mirrors take ordinary `git push` and stay updatable in place.
- **IngotVault** — scan a workspace → ensure a local `backup` remote → push branches/tags/notes/replace/`refs/ingotvault/*` into bare mirrors on a path you choose, with the guarantee set above.

## Publish (maintainers)

```bash
pnpm run build
pnpm pack          # sanity-check tarball
pnpm publish       # requires npm login; package name: ingotvault
```

Site: `pnpm site:deploy` from the repo root (FilePress via npm `getfilepress`). See [`site/README.md`](site/README.md).

## License

Apache-2.0
