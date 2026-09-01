# IngotVault Smell Check overlay

Point at `smellcheck` (`node_modules/smellcheck/rules/core.md`). Do not fork core.

## Pronouns

| Surface | Voice |
| --- | --- |
| Site pages (`site/pages`) | **you** for the reader. Catalyst Forge is named in the footer, not a corporate we. |
| Agents essay (`site/posts`) | **you**. Do not invent a first-person scene. A checkable scenario is enough. |
| README, CLI, Safety, encryption | **you** / imperative. Terms of art stay. Do not flatten reference into brochure. |
| Chat with the maintainer | **I** is fine. |

## Terms that pass here

- **spare remote / bare mirror / vault** — the product, not a metaphor to ride through headings.
- **origin / backup** — Git remotes. `backup` is the remote IngotVault adds.
- **ratchet** — history refs only accumulate; deleted branches stay on the mirror.
- **force-with-lease / preforce / WIP** — named mechanisms. `refs/ingotvault/*` is the namespace.
- **path-tree** — mirror naming that keeps the workspace-relative path.
- **captureWorktree / wipExclude / wipRetention** — config keys. Allowed in README and Safety.
- **verify / relink / safe-dirs** — commands.
- **forge** — GitHub/GitLab/etc. as a class of remote. Not the company metaphor.

## Protected lines

- Every commit in a second place you control.
- Never touches origin.
- The product is the guarantee set: what a late-night bash loop usually gets wrong.
- Earn the word. / Spray the prose, not the author. (package maxims)

## House extras

- Site copy follows `smellcheck` `landing.md`. The one concrete chant is the lede: "CLI · bare mirrors · never touches origin." Do not stack "No X. No Y. No Z."
- Brand metal (ingot, steel, copper, vault-as-poetry) lives in the theme, not in headings. Two vault/ingot references on a page is the budget; the rest is plain language.
- Hero and "Why it exists" say what a friend would hear first. Refspecs, lock files, `safe.directory`, and exit-code tables belong on Safety / README, not in the brochure lead.
- README may stay technical. Same promise sentence and Safety facts as the site; do not rewrite the Safety table into prose.
- The agents essay needs one checkable instance (a named branch an agent deleted, a `checkout .` on a dirty tree). Do not inject a fake "I".
- "Real" on the landing page: at most twice, and only for a contrast you are actually drawing.
