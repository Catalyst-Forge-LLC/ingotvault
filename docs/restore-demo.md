# Restore demonstration

Disposable two-repository fixture. It shows one lost local branch coming back from a previously successful backup, and one file that a default run never captured. Paths are fixtures only. Do not point these commands at a real workspace or vault.

The commands match the current CLI: `ingotvault init`, `ingotvault`, `ingotvault verify`, then ordinary `git clone` and `git switch`. From a clone of this repository you can run `pnpm exec tsx src/cli.ts` in place of `ingotvault`. After a global install, use `ingotvault`.

On Windows with Git Bash, `/tmp` is the user temp directory. The layout is the same.

## Fixture layout

```text
/tmp/ingotvault-restore-demo/
  workspace/notes/     source repo
  vault/               spare remotes (created by init)
  notes-restored/      clone of the mirror after the local branch is gone
  ingotvault.config.json
```

`init` writes `ingotvault.config.json` into the current working directory. Run it from the fixture root so it does not overwrite a config in another repo.

## 1. Create the source repo

```bash
mkdir -p /tmp/ingotvault-restore-demo/workspace/notes
cd /tmp/ingotvault-restore-demo/workspace/notes
git init -b main
git config user.email "demo@example.com"
git config user.name "Demo"

printf 'hello\n' > readme.md
git add readme.md
git commit -m "init"

git switch -c feature/parser
printf 'parser notes\n' > parser.md
git add parser.md
git commit -m "parser notes"
git switch main

printf 'scratch, never committed\n' > scratch.txt
```

`scratch.txt` stays uncommitted. Default runs do not capture it. That is the excluded case.

## 2. Initialize the vault and capture

```bash
cd /tmp/ingotvault-restore-demo
ingotvault init --workspace /tmp/ingotvault-restore-demo/workspace \
  --mirror /tmp/ingotvault-restore-demo/vault
ingotvault
ingotvault verify
```

Representative successful output from the checked revision:

```text
ingotvault  workspace=.../workspace  mirror=.../vault
Found 1 repo(s)

ok    notes                         -> .../vault/notes.git
---
1 ok, 0 skip, 0 fail
```

```text
(verify)
Found 1 repo(s)

ok              notes                         refs match
---
1 ok
```

The mirror now holds `main` and `feature/parser` as they existed at that successful run.

## 3. Lose the local branch

```bash
cd /tmp/ingotvault-restore-demo/workspace/notes
git branch -D feature/parser
```

`ingotvault verify` still reports `ok` / `refs match`. Verify compares remaining local branch and tag tips to the mirror. It does not list extra branches that exist only on the mirror. The deleted branch is still in `vault/notes.git`.

## 4. Restore from the vault

```bash
git clone /tmp/ingotvault-restore-demo/vault/notes.git \
  /tmp/ingotvault-restore-demo/notes-restored
cd /tmp/ingotvault-restore-demo/notes-restored
git switch feature/parser
```

Narrow result: the clone checks out `feature/parser` with `parser.md` present. That commit was on a covered local branch during the successful run, so the mirror still has it after the laptop branch is gone.

## 5. What this run did not restore

`scratch.txt` is still in the source worktree and is absent from `notes-restored`. A default run does not snapshot uncommitted files. Opt-in `--capture-worktree` can snapshot a dirty tree that is not gitignored. It still does not capture ignored files, Git LFS object bytes, submodule object stores, stashes, or commits that sit on no covered ref.

A vault on the same physical disk as the workspace is a second Git copy on that disk. It is not protection against that disk failing.

Clean up with `rm -rf /tmp/ingotvault-restore-demo`.
