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

## Encrypting the vault

Git does **not** encrypt repositories at rest. Anyone who can mount `mirrorRoot` can read every bare mirror. Encrypt the **volume** (or an encrypted container on it), then point `mirrorRoot` inside that unlocked path.

Unlock the volume before running `ingotvault`. If the path is missing or locked, ingotvault exits with code `2`.

### Windows

**BitLocker To Go** on a removable drive (USB/SD) is the usual choice:

1. In File Explorer, right-click the drive → **Turn on BitLocker**.
2. Use a strong password; store the recovery key somewhere that is **not** on that drive.
3. Set `mirrorRoot` to a folder on the unlocked drive (e.g. `D:/git-mirrors`).
4. Lock/eject when finished; stolen media without the password is ciphertext.

Removable BitLocker volumes are often exFAT/FAT. Git may report “dubious ownership”; with `safeDirectory: "per-mirror"` (the default), ingotvault allowlists each mirror path in your global git config and retries.

### macOS

| Approach | When to use |
|----------|-------------|
| **APFS encrypted volume** (Disk Utility) | Dedicated partition or external disk formatted as APFS (Encrypted) |
| **Encrypted disk image** (`.dmg` / sparsebundle) | File-backed vault on an existing disk; mount before runs |
| **FileVault** | Protects the **system** disk; does not by itself encrypt a separate USB unless that volume is also encrypted |

Create an encrypted APFS volume or image in Disk Utility, mount it, then set `mirrorRoot` to e.g. `/Volumes/IngotVault/git-mirrors`.

### Linux

| Approach | When to use |
|----------|-------------|
| **LUKS** (`cryptsetup`) | Whole partition or USB stick; standard on modern distros |
| **Encrypted home / fscrypt** | Fine if mirrors live under an already-encrypted home; weaker story for a detachable vault disk |

Example pattern: LUKS-format the partition, open it (`cryptsetup open …`), mount it, use that mount as `mirrorRoot`. Close/unmount when done.

### Cross-platform container

**[VeraCrypt](https://www.veracrypt.fr/)** (or similar) works if you move the same vault between Windows, macOS, and Linux: create an encrypted file container or partition, mount it before `ingotvault`, unmount after. Slightly more ceremony than native BitLocker/LUKS/APFS; good when the stick has to travel across OSes.

### What this does and does not cover

- **Covered:** someone walks off with the SD card/USB/disk and tries to read the mirrors cold.
- **Not covered:** the volume is already unlocked on a logged-in machine; uncommitted work in `workspaceRoot` (encrypt that disk too, or commit before you care); recovery keys stored on the same media.

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
