# Findings: IngotVault home page

Review date: 2026-09-28. Subject `site/pages/about.md` at `185e72a`.

```yaml
finding_id: "ingotvault-home-F001"
project_id: "ingotvault-home"
title: "Done line names words verify does not print"
classification: "source-backed-discrepancy"
surface: "site/pages/about.md, Quick start, local render http://localhost:5183/#quick-start"
evidence: "The page says you are done when verify reports the tips match. src/verify.ts sets a clean result to status ok and detail 'refs match'. formatVerifyOutcome prints those fields. site/pages/install.md says confirm with ingotvault verify (ok / refs match)."
observed_at: "2026-09-28T12:49:00Z"
subject_version: "185e72a"
confidence: "high"
consequence: "A reader who runs the block looks for 'tips match' and does not see it, so the procedure does not tell them they are done."
priority: "P1"
recommended_change: "Say you are done when verify prints ok and refs match."
acceptance_criteria:
  - "The Quick start close uses the status and detail strings from formatVerifyOutcome."
verification_needed: ""
status: "open"
prior_finding_id: null
```

```yaml
finding_id: "ingotvault-home-F002"
project_id: "ingotvault-home"
title: "Unplugged drive is described as a skip for every run"
classification: "claim-risk"
surface: "site/pages/about.md, paragraph after the Quick start block"
evidence: "The page says the daily job and ingotvault --repo . can both be on, then 'If the drive is unplugged, that run skips.' site/pages/safety.md says a missing or locked vault is exit 2, and that the scheduled case is the expected skip."
observed_at: "2026-09-28T12:49:00Z"
subject_version: "185e72a"
confidence: "high"
consequence: "A reader can treat a manual run against an unplugged drive as a successful skip."
priority: "P2"
recommended_change: "Say a scheduled run skips when the drive is unplugged, and a manual run stops. Leave the exit code on Safety."
acceptance_criteria:
  - "The home page does not call a manual missing-vault run a skip."
verification_needed: ""
status: "open"
prior_finding_id: null
```

```yaml
finding_id: "ingotvault-home-F003"
project_id: "ingotvault-home"
title: "init and the Install aside leave two prompts and one phrase unnamed"
classification: "presentation-judgment"
surface: "site/pages/about.md, sentences under the Quick start block"
evidence: "The page says init asks for the workspace and the mirror path. src/init.ts also prompts for Remote name with default backup and Max scan depth with default 3. The next sentence sends the reader to Install for 'a different clock', which is schedule install --at on the Install page."
observed_at: "2026-09-28T12:49:00Z"
subject_version: "185e72a"
confidence: "high"
consequence: "The first interactive command asks two questions the page did not mention, and 'a different clock' does not name the flag."
priority: "P3"
recommended_change: "Add that remote name and scan depth have defaults. Say another time of day, or name --at, instead of a different clock."
acceptance_criteria:
  - "A reader who runs init expects the two extra prompts."
  - "The Install aside does not use 'clock' for the time of day."
verification_needed: ""
status: "open"
prior_finding_id: null
```
