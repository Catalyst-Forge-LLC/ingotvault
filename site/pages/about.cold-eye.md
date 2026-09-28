# Cold-eye — ingotvault.dev home (`site/pages/about.md`)

Read against [coldeye@0.1.14](https://www.npmjs.com/package/coldeye) and `z:\workspace\coldeye\skills\cold-eye`. Those skill files match. Subject is the shipped home page: [ingotvault.dev](https://ingotvault.dev/).

**Verdict:** close

## Ranked changes

1. **F-001** · test 4 — invisible_step
   > After `init`, a run starts when you run `ingotvault`, when `ingotvault schedule install` fires the daily OS job, or when an agent runs `ingotvault --repo .` in one repo.
   Cold reader: runs the Quick start block (`init`, `list`, `ingotvault`, `verify`) and never registers a daily job, and has no step that makes an agent run `--repo .`.
   Put: One procedure in Quick start. If the daily job is part of setup, the next command is `ingotvault schedule install` and one line for what it registers. If the agent path is optional, say so and point at the rule that runs `ingotvault --repo .`. Do not list three starters above a block that only performs one.

2. **F-002** · test 1 — pitch
   > **Back up covered local Git branches and tags to a second location you control, including work you have not pushed upstream.**
   Cold reader: already read the heading "Back up local Git branches and tags, including work you haven't pushed." and the paragraph that starts "IngotVault scans a workspace." This bold line is a third description of the same product, still before a step.
   Put: One sentence for what it is, then the Quick start commands. Leave the coverage table under that, or on Safety.

3. **F-003** · test 8 — maintainer
   > Locked or missing vault → exit `2` (scheduled runs can skip quietly)
   Cold reader: does not know what exit 2 is, or who would be alerted.
   Put: "If the drive is unplugged, that run skips." Save exit codes for Safety.

4. **F-004** · test 3 — drift
   > Never force-pushes unless you aim `--force-with-lease` at a repo
   Cold reader: passes `--force-with-lease` and expects a force update. Safety requires `allowForceWithLease: true` in config and `--repo` or `--all-repos` as well.
   Put: Do not shorten that rule on the home page. Point at Safety.

5. **F-005** · test 10 — no_close
   Absent: after the Quick start block — what `ingotvault verify` showing a match means, and that the reader can stop.
   Cold reader: continues into "Read the posts" because nothing says the backup hour is finished.
   Put: One line after the commands: you are done when `verify` reports the tips match.

6. **F-006** · test 6 — sibling_mix
   > When an agent rewrites history
   Cold reader: has not installed or run anything yet. This section starts a second job (read the essay) in the middle of the first (back up the repos).
   Put: Quick start first. One sentence and the link to the post, after the commands.

7. **F-007** · test 2 — invented
   > Local branches, tags, notes, replace refs, and IngotVault refs
   Cold reader: does not know what an "IngotVault ref" is, or whether it is one of their branches.
   Put: Use the same names as Safety (`refs/notes/*`, `refs/replace/*`, `refs/ingotvault/*`), or drop this table and link to Safety.

## What to cut

- The bold promise that repeats the heading.
- "The vault lock keeps them from overlapping" on this page. The lock is not something a buyer operates.
- The second button row. Install, Safety, and the post are already linked above it.

## Protect

- "It does not run in the background, and it does not hook `git push`."
- "CLI · bare mirrors · never touches origin."
- "A vault on the same physical disk as the workspace is a second Git copy on that disk. It is not protection against that disk failing."
- The split between what a successful run includes and what it leaves out, once the names are the ones Safety uses.
