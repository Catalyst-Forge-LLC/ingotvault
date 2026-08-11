# Encrypting the vault (OS guides)

Git does **not** encrypt repositories at rest. Encrypt the **volume** (or an encrypted container on it), then point `mirrorRoot` inside that unlocked path. Unlock before running `ingotvault`; if the path is missing or locked, the tool exits with code `2` (expected skip for scheduled runs).

See the main [README → Encrypting the vault](../README.md#encrypting-the-vault) for the covered/not-covered list and `safeDirectory` / exFAT notes. Short OS table also on [Install](https://ingotvault.dev/install#encrypt-the-vault-volume).

## Windows — BitLocker To Go

1. In File Explorer, right-click the drive → **Turn on BitLocker**.
2. Use a strong password; store the recovery key somewhere that is **not** on that drive.
3. Set `mirrorRoot` to a folder on the unlocked drive (e.g. `D:/git-mirrors`).
4. Lock/eject when finished.

Removable BitLocker volumes are often exFAT/FAT. Git may report “dubious ownership”; with `safeDirectory: "per-mirror"` (the default), IngotVault allowlists each mirror path in your global git config and retries.

## macOS

| Approach | When to use |
|----------|-------------|
| **APFS encrypted volume** (Disk Utility) | Dedicated partition or external disk formatted as APFS (Encrypted) |
| **Encrypted disk image** (`.dmg` / sparsebundle) | File-backed vault on an existing disk; mount before runs |
| **FileVault** | Protects the **system** disk; does not by itself encrypt a separate USB unless that volume is also encrypted |

Create an encrypted APFS volume or image in Disk Utility, mount it, then set `mirrorRoot` to e.g. `/Volumes/IngotVault/git-mirrors`.

## Linux

| Approach | When to use |
|----------|-------------|
| **LUKS** (`cryptsetup`) | Whole partition or USB stick; standard on modern distros |
| **Encrypted home / fscrypt** | Fine if mirrors live under an already-encrypted home; weaker story for a detachable vault disk |

Example pattern: LUKS-format the partition, open it (`cryptsetup open …`), mount it, use that mount as `mirrorRoot`. Close/unmount when done.

## Cross-platform container

**[VeraCrypt](https://www.veracrypt.fr/)** (or similar) works if you move the same vault between Windows, macOS, and Linux: create an encrypted file container or partition, mount it before `ingotvault`, unmount after. Slightly more ceremony than native BitLocker/LUKS/APFS; good when the stick has to travel across OSes.
