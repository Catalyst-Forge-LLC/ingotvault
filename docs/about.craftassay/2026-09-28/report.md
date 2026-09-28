# CraftAssay Review: IngotVault home page

Review date: 2026-09-28. Specification v1.1. Rubric v1.0.

**Subject identity:** `site/pages/about.md` at commit `185e72a`, rendered at `http://localhost:5183/`.
**Audience:** a developer with local Git repos who has not installed IngotVault and needs to see what a run does and how to start one.
**Scope:** that home page. Install and Safety were opened only to check claims the home page makes. This is an initial review. No earlier CraftAssay run matches this identity.

## Main judgment

The page now has one job and a command block that performs it. A reader can install, mark a vault, register the daily job, run a capture, and know where the limits are. The proposition is distinct from a forge remote and from a file backup, and the coverage table matches the Safety rows.

The principal gap is the success line. The page says `verify` reports that the tips match. The tool prints `ok` and `refs match`. A second line says an unplugged drive means that run skips, after the page has just described both a manual run and the daily job. Only the scheduled run is the one Safety calls a skip.

## Coverage and limits

Inspected the source page, the local render at 1440×900 and 390×844, `src/verify.ts`, `src/init.ts`, and the Safety and Install passages the home page points at. npm `craftassay@0.1.11` matches `z:\workspace\craftassay\skills\craftassay`.

The public page at `https://ingotvault.dev/` still contains "vault lock" and "Get started", which this revision removed. This review does not score that URL.

The run folder is `docs/about.craftassay/2026-09-28/` rather than `site/pages/about.craftassay/`, so FilePress does not publish it. A later baseline search should look here.

A Cold-eye review of the previous home page is at `docs/about.cold-eye.md` (coldeye 0.1.14, 2026-09-28, verdict close). Those findings describe the page before this revision. They are a source, not current defects. The command block, the single button row, the Safety ref names, and the pointer to Safety for force update are now on the page. The done line took the Cold-eye wording "tips match", which does not match the tool.

## Scoring definitions

Utility, Accuracy, Uniqueness, Quality, Clarity, Aesthetics, and Overall appeal. Whole numbers from 1 to 10. Higher is better. Accuracy is freedom from misleading claims in the inspected presentation, not a measured bug rate. Overall appeal is a holistic judgment, not an average.

## Project scorecard

| Dimension | Score | Confidence | Rationale |
| --- | ---: | --- | --- |
| Utility | 8 | high | The lost-unpushed-branch job is real, and the commands to start a capture are on the page. |
| Accuracy | 6 | high | The limits are mostly the Safety facts. The done line and the unplugged-drive line do not match the tool. |
| Uniqueness | 8 | high | Forge remotes, file backups, and a bare mirror you control are separated on the page. |
| Quality | 7 | high | Coverage, the same-disk limit, and the restore link are in place. The close of the procedure is uneven. |
| Clarity | 7 | high | The steps come before the argument. A few phrases still need Install or Safety to decode. |
| Aesthetics | 7 | high | The command block and table are readable at both inspected widths, with no horizontal overflow. |
| Overall appeal | 7 | high | Strong enough to try. The first screen is still mostly the headline, and the success words are off. |

## Per-project critique

### IngotVault home (`ingotvault-home`)

**Subject identity:** `site/pages/about.md` at `185e72a`, local URL `http://localhost:5183/`.
**User and job:** decide whether a second Git copy of local branches and tags is worth setting up, then run the first capture.
**What works and should remain:** one command block that includes `init`, `schedule install`, a manual run, and `verify`. The sentence that it does not run in the background and does not hook `git push`. The coverage split, the same-disk warning, and the force-update pointer to Safety.
**Review:** After the headline, the page says what IngotVault pushes, then shows the commands, then says when you are done. That order is usable. The coverage table uses the same ref names as Safety. The agent path is one sentence and a link, after the commands. What fails is the last instruction in that procedure, and the sentence about an unplugged drive, which covers more runs than Safety does.
**Material findings:** `ingotvault-home-F001`, `ingotvault-home-F002`, `ingotvault-home-F003`.
**Recommended changes, in order:**
1. Say you are done when `verify` prints `ok` and `refs match`.
2. Say a scheduled run skips when the drive is unplugged, and a manual run stops.
3. Mention that `init` also asks for a remote name and a scan depth, both with defaults, and replace "a different clock" with the time-of-day flag.
**Boundary to preserve:** do not shorten the force-update rule on this page. Do not put exit codes or the lock file back in the brochure. Keep the coverage names aligned with Safety.
**Evidence and limits:** local render and the sources named above. The live site is a previous revision. No full run of `init` or `verify` was executed in this review.

| Dimension | Score | Confidence | Rationale |
| --- | ---: | --- | --- |
| Utility | 8 | high | A reader can start a real backup from the page. Extra `init` prompts are the remaining first-use friction. |
| Accuracy | 6 | high | "tips match" and "that run skips" are broader than `src/verify.ts` and Safety. |
| Uniqueness | 8 | high | The gap between origin, a disk backup, and a bare mirror is stated in concrete losses. |
| Quality | 7 | high | Limits and a restore link are present. The procedure's closing words are the weak spot. |
| Clarity | 7 | high | Quick start is the first section. "Vault marker", "covered ref", and "a different clock" still ask the reader to guess. |
| Aesthetics | 7 | high | At 1440×900 the column is 960px and the headline is 58px. At 390×844 the commands fit. The lede leaves "ORIGIN" on its own line. |
| Overall appeal | 7 | high | Worth installing from this page. The mismatch on the done line is what would make someone re-read. |

## Highest-confidence errors and claim issues

`verify` does not report that the tips match. `formatVerifyOutcome` prints the status `ok` and the detail `refs match` (`src/verify.ts`). Install already says `ok` / `refs match`.

"If the drive is unplugged, that run skips" follows a paragraph about a manual run, an agent command, and the daily job. Safety reserves the expected skip for the scheduled case, and calls the condition exit `2`.

## Prioritized actions

1. Align the done line with the words `verify` prints.
2. Limit the skip sentence to the daily job.
3. Name the two `init` defaults, and say "another time of day" instead of "a different clock".

## Evidence appendix

See `coverage.md`, `scorecard.md`, and `findings.md` in this folder.
