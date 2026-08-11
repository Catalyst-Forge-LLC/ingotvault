# ingotvault

A **spare remote** for a folder full of Git repos: push committed history into bare mirrors on a drive you control. **Never touches `origin`.**

The promise is narrow on purpose: **every commit you've made lands in a second place you control.** Not uncommitted work, not LFS objects — commits, on every local branch and tag (default: `git push --all` and `git push --tags`).

That gap is real even if you already have GitHub/GitLab **and** Time Machine/restic:

- Repos with **no forge remote** (scratch experiments, notes-in-git, client work you never uploaded)
- **Unpushed branches and tags** in repos you think are "backed up" because `main` is on origin
- **Confidentiality** (NDA, regulated, or unfinished thinking that shouldn't leave your machine)
- **Offline / intermittent** network (flight, field, air-gapped sites)
- **Account-level risk** (forge outage, lost 2FA, org offboarding) — low odds, total loss

A file backup of a live `.git` copies whatever bytes were on disk (including torn mid-gc/rebase state) and restores as an opaque blob. A push into a bare mirror is a **git** operation: content-addressed, validated on receipt, atomic at the ref level, restorable with `git clone`, checkable with `ingotvault verify`. An **unplugged** encrypted drive also won't cheerfully replicate your `rm -rf` the way a cloud-synced folder can.

"Git is already distributed" only helps if another clone actually exists and is up to date. For most people the laptop workspace is the sole clone of half their repos.

**Not for:** one or two repos you already push everywhere, or a workflow with no unpushed branches and no local-only repos. Use a forge (or a one-off remote) and move on.

The product is the **guarantee set** below — the bits a late-night bash loop usually gets wrong and doesn't notice for months.

## Safety

| Concern | Behavior |
|---------|----------|
| `origin` / other remotes | Never modified |
| What gets pushed | All local branches + tags by default (`pushAllBranches` / `pushTags`) |
| Force push | Never by default; opt-in `--force-with-lease` / `allowForceWithLease` |
| Non-fast-forward (rebase/amend) | Fail that repo with `DIVERGED:`; other repos continue |
| Existing `backup` with wrong URL | Fail that repo; continue others |
| Mirror volume missing/locked | Exit `2` (scheduled: expected skip) |
| Uncommitted work / stashes | Not covered (commits only) |
| Git LFS | Not covered — bare push stores pointer files only; warned when `.gitattributes` has `filter=lfs` |
| Drive pulled mid-push | Push may be partial; remount and re-run — Git usually recovers; `verify` helps confirm |

## Install

```bash
pnpm add -g ingotvault
# or: npm i -g ingotvault
```

From a clone:

```bash
pnpm install
pnpm run build
pnpm link --global
```

Requires Node 20+ and `git` on PATH (`git --version` is checked at startup).

## Quick start

```bash
ingotvault init
# prompts for workspace + mirror roots; writes ./ingotvault.config.json

ingotvault list          # discover repos → planned mirror paths
ingotvault --dry-run     # no writes
ingotvault               # ensure bare mirrors + backup remote + push
ingotvault verify        # compare local branch tips to mirror tips
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
3. `./.ingotvault.json`
4. User config: `~/.config/ingotvault/config.json` (Windows: `%APPDATA%\ingotvault\config.json`)

`workspaceRoot` and `mirrorRoot` are required. `~` is expanded. See [`config.example.json`](config.example.json) (includes `"$schema"` for editor autocomplete) and [`schema/ingotvault.config.schema.json`](schema/ingotvault.config.schema.json).

Mirror naming (`path-tree`): the relative workspace path is preserved under `mirrorRoot`, with `.git` appended — e.g. `acme/widgets` → `acme/widgets.git`. Nested paths avoid collisions that flat renaming would create (`a/b-c` vs `a-b/c`).

## Restore

To recover a working tree from a bare mirror:

```bash
git clone /Volumes/Backup/git-mirrors/acme/widgets.git widgets-restored
cd widgets-restored
```

A normal `git clone` of a bare mirror sets `origin` to that mirror. Local `git branch` may look empty at first if you only expected remote-tracking names — branches appear as `origin/<name>` under `refs/remotes/origin/`. Create a local branch with `git checkout main` (or `git switch main`) once Git can resolve the remote tip, or clone with:

```bash
git clone --mirror /Volumes/Backup/git-mirrors/acme/widgets.git widgets.git
# bare mirror copy; then clone from that if you want a worktree
```

Uncommitted work and stashes were never covered — only commits that were pushed.

## Divergence

By default ingotvault **never** force-pushes. After a rebase or amend, the bare mirror may reject updates. That repo fails with a loud `DIVERGED:` message (mirror is stale), while other repos continue.

Escape hatch (opt-in):

```bash
ingotvault --force-with-lease
# or set "allowForceWithLease": true in config
```

Alternatively delete the stale bare mirror directory and re-run so it is recreated from scratch.

## Encrypting the vault

Git does **not** encrypt repositories at rest. Anyone who can mount `mirrorRoot` can read every bare mirror. Encrypt the **volume** (or an encrypted container on it), then point `mirrorRoot` inside that unlocked path.

Unlock the volume before running `ingotvault`. If the path is missing or locked, ingotvault exits with code `2`. For scheduled runs, treat exit `2` as an expected skip (vault unplugged/locked), not as a backup failure — exit `1` means real errors.

| OS | Typical option |
|----|----------------|
| Windows | BitLocker To Go on the removable drive |
| macOS | APFS encrypted volume or encrypted disk image |
| Linux | LUKS (`cryptsetup`) |
| Cross-platform | VeraCrypt container |

Step-by-step OS setup: [`docs/encryption.md`](docs/encryption.md).

Removable volumes are often exFAT/FAT. Git may report “dubious ownership”. With `safeDirectory: "per-mirror"` (default), ingotvault adds each mirror path via `git config --global --add safe.directory <path>` (writes `~/.gitconfig` / the global gitconfig). Set `"safeDirectory": "off"` to disable. Undo all entries: `git config --global --unset-all safe.directory`.

### What this does and does not cover

- **Covered:** someone walks off with the SD card/USB/disk and tries to read the mirrors cold.
- **Not covered:** the volume is already unlocked on a logged-in machine; uncommitted work in `workspaceRoot` (encrypt that disk too, or commit before you care); recovery keys stored on the same media; Git LFS object bytes (pointers only — see Safety).

## Discovery

- Walks `workspaceRoot` up to `maxDepth` (default 3).
- Skips directory names in `excludeDirNames` (default includes `node_modules`, `.git`, `.hg`, `__ARCHIVE`).
- Only treats a directory as a repo when `.git` is a **directory** (worktrees/submodules with a `.git` **file** are skipped).
- Repos with zero commits are skipped at push time.
- Detached HEAD: commits still push if branches exist via `push --all`; verify reports when there are no local branches.

## CLI

```text
ingotvault init [--global] [--workspace <path>] [--mirror <path>]
                [--remote-name backup] [--max-depth 3]
ingotvault [run] [--config <path>] [--repo <path|name>] [--dry-run]
                [--verbose] [--scheduled] [--force-with-lease]
ingotvault list  [--config <path>] [--repo <path|name>]
ingotvault verify [--config <path>] [--repo <path|name>] [--verbose]
```

`--repo` matches the workspace-relative path (preferred), a unique path suffix, or a unique basename. If several repos share the same leaf name, the command fails and asks for the full relative path.

`--scheduled` writes a timestamped log under `logDir` and prunes logs older than `logRetentionDays` (default 30; `0` = keep forever). No interactive pause; pair with your OS task scheduler. Prefer not alerting on exit `2`.

`ingotvault verify` compares each local branch tip to the bare mirror and reports `ok`, `behind` (e.g. mirror is N commits behind), `diverged`, or `missing-mirror`.

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Config/CLI error, ambiguous `--repo`, or one or more repos failed / verify found drift |
| `2` | Mirror root unavailable (missing, locked, or not writable) |

## How it differs

- **Forge remotes (origin)** — cover what you’ve pushed upstream. ingotvault covers local-only repos and unpushed refs without replacing origin.
- **File backup (Time Machine, restic, Backblaze)** — broader coverage (including dirty worktrees), weaker git semantics. A live `.git` snapshot can be torn; a bare-mirror push is validated and cloneable. Use both if you want; they solve different problems.
- **myrepos / gita** — run arbitrary git across many repos; you still invent the local spare remote and its safety rules.
- **Host mirror tools** — clone *from* GitHub/GitLab onto disk.
- **git bundle** — portable snapshots, but not an incremental spare remote; each update is a new bundle. Bare mirrors take ordinary `git push` and stay updatable in place.
- **ingotvault** — scan a workspace → ensure a local `backup` remote → push all branches/tags into bare mirrors on a path you choose, with the guarantee set above.

## Publish (maintainers)

```bash
pnpm run build
pnpm pack          # sanity-check tarball
pnpm publish       # requires npm login; package name: ingotvault
```

## License

Apache-2.0
