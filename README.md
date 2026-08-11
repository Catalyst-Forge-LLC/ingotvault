# ingot (`git-ingot`)

Local spare remotes for a folder full of Git repos. Push committed history to bare mirrors on another drive. **Never touches `origin`.**

Use it when you keep many repos in a workspace folder and want a second, local Git remote (encrypted USB/SD, NAS path, extra disk) without replacing GitHub/GitLab — or without using a forge at all.

## Install

```bash
pnpm add -g git-ingot
# or: npm i -g git-ingot
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
ingot init
# prompts for workspace + mirror roots; writes ./ingot.config.json

ingot list          # discover repos → planned mirror paths
ingot --dry-run     # no writes
ingot               # ensure bare mirrors + backup remote + push
```

User-wide config (instead of cwd):

```bash
ingot init --global --workspace ~/code --mirror /Volumes/Backup/git-mirrors
```

## Config

Resolution order (first found wins):

1. `--config <path>`
2. `./ingot.config.json`
3. `./.ingot.json`
4. User config: `~/.config/ingot/config.json` (Windows: `%APPDATA%\ingot\config.json`)

`workspaceRoot` and `mirrorRoot` are required. `~` is expanded. See [`config.example.json`](config.example.json) and [`schema/ingot.config.schema.json`](schema/ingot.config.schema.json).

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
ingot init [--global] [--workspace <path>] [--mirror <path>]
           [--remote-name backup] [--max-depth 3]
ingot [run] [--config <path>] [--repo <name>] [--dry-run] [--verbose] [--scheduled]
ingot list  [--config <path>] [--repo <name>]
```

`--scheduled` writes a timestamped log under `logDir` (no interactive pause; pair with your OS task scheduler).

## How it differs

- **myrepos / gita** — run arbitrary git across many repos; you still invent the local spare remote.
- **Host mirror tools** — clone *from* GitHub/GitLab onto disk.
- **ingot** — scan a workspace → ensure a local `backup` remote → push into bare mirrors on a path you choose.

## License

Apache-2.0
