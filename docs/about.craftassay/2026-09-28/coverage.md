# Coverage: IngotVault home page

Review date: 2026-09-28. Specification v1.1.

**Subject identity:** `site/pages/about.md` at commit `185e72a`.
**Audience:** a developer with local Git repos who has not installed IngotVault.
**Included surface:** the home page only.

This is an initial CraftAssay review. No local run folder already contained `report.md` for this identity.

Skill check: npm `craftassay@0.1.11` and `z:\workspace\craftassay\skills\craftassay` match for `SKILL.md` and the six reference files.

Output path: `docs/about.craftassay/2026-09-28/`. The skill's default parent is `site/pages/about.craftassay/`. This run is under `docs/` so a site publish does not include it. Search here for the baseline next time.

Imported source, not a CraftAssay baseline: `docs/about.cold-eye.md`, coldeye 0.1.14, 2026-09-28, verdict close, written against the home page before commit `185e72a`.

| Surface | Coverage | Notes |
| --- | --- | --- |
| `site/pages/about.md` | inspected | Full source of the current revision. |
| Local render `http://localhost:5183/` | inspected | Desktop 1440×900. Content column about 960px. Headline computed at 58px. `documentElement.scrollWidth` matched the viewport. |
| Local render, narrow | inspected | 390×844, `mobile: true`. Command block and table fit. No horizontal overflow (`scrollWidth` 390). Lede wraps so ORIGIN is alone on the second line. |
| `src/verify.ts` | inspected | Clean detail is `refs match`. Status label is `ok`. |
| `src/init.ts` | inspected | Prompts for workspace, mirror, remote name (default `backup`), and max scan depth (default `3`). Writes `ingotvault.config.json` in the current directory unless `--global`. |
| `site/pages/safety.md` | partially inspected | Coverage table, force update, and missing-vault exit. Not a full reread of divergence recovery. |
| `site/pages/install.md` | partially inspected | First-run comments, schedule section, and the restore anchor the home page links to. |
| `https://ingotvault.dev/` | partially inspected | Fetched. Still contains "vault lock" and "Get started". Not the revision under review, so it was not scored. |
| A live `ingotvault init` or `ingotvault verify` run | not inspected | Claims were checked against source and Install, not by executing them. |
| Posts, README, scheduler implementation | not inspected | Out of scope except where a home-page sentence required a check. |

Screenshot captures from the browser tool were left-cropped relative to the 1440 viewport. Layout measurements above came from `getBoundingClientRect` and `scrollWidth`, not from those crops.
