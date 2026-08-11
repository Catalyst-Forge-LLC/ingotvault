# ingotvault

Local spare remotes for a folder full of Git repos. Push committed history to bare mirrors on another drive. **Never touches `origin`.**

Use it when you keep many repos in a workspace folder and want a second, local Git remote (encrypted USB/SD, NAS path, extra disk) without replacing GitHub/GitLab — or without using a forge at all.

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

Requires Node 20+ and `git` on PATH.

## Quick start

```bash
ingotvault init
# prompts for workspace + mirror roots; writes ./ingotvault.config.json

ingotvault list          # discover repos → planned mirror paths
ingotvault --dry-run     # no writes
ingotvault               # ensure bare mirrors + backup remote + push
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

Legacy filenames `ingot.config.json` / `.ingot.json` are still recognized in the cwd.

`workspaceRoot` and `mirrorRoot` are required. `~` is expanded. See [`config.example.json`](config.example.json) and [`schema/ingotvault.config.schema.json`](schema/ingotvault.config.schema.json).

Mirror naming (v1): relative path with `/` → `-`, e.g. `acme/widgets` → `acme-widgets.git`.

## Safety

| Concern | Behavior |
|---------|----------|
| `origin` / other remotes | Never modified |
| Force push | Never |
| Existing `backup` with wrong URL | Fail that repo; continue others |
| Mirror volume missing/locked | Exit `2` |
| Uncommitted work | Not backed up (commits only) |

## CLI

```text
ingotvault init [--global] [--workspace <path>] [--mirror <path>]
                [--remote-name backup] [--max-depth 3]
ingotvault [run] [--config <path>] [--repo <name>] [--dry-run] [--verbose] [--scheduled]
ingotvault list  [--config <path>] [--repo <name>]
```

`--scheduled` writes a timestamped log under `logDir` (no interactive pause; pair with your OS task scheduler).

## How it differs

- **myrepos / gita** — run arbitrary git across many repos; you still invent the local spare remote.
- **Host mirror tools** — clone *from* GitHub/GitLab onto disk.
- **ingotvault** — scan a workspace → ensure a local `backup` remote → push into bare mirrors on a path you choose.

## Publish (maintainers)

```bash
pnpm run build
pnpm pack          # sanity-check tarball
pnpm publish       # requires npm login; package name: ingotvault
```

## License

Apache-2.0
