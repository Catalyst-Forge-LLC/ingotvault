---
title: "Keep a second copy of work you have not pushed."
description: "IngotVault captures local Git branches and tags in bare mirrors on a drive you control. Recover captured history after an unwanted edit or branch deletion, while leaving origin unchanged."
order: 1
---

<section class="value-hero" aria-label="IngotVault overview"><div class="value-intro"><div class="value-headline"><p class="value-kind">Local Git backup command-line tool</p><h1>Keep a second copy of work you have not pushed.</h1></div><div class="value-pitch"><p class="value-lede">IngotVault captures local Git branches and tags in bare mirrors on a drive you control. Recover captured history after an unwanted edit or branch deletion, while leaving origin unchanged.</p><div class="cta-row"><a class="cta cta-primary" href="/install">Install IngotVault</a><a class="cta cta-secondary" href="#recovery-example">See a named branch recovered</a></div><p class="value-limit">Uncommitted files and stashes are excluded by default. A second copy on the same disk does not protect against that disk failing.</p></div></div>
<figure class="value-proof worked-example" id="recovery-example" tabindex="-1">
<figcaption>Recover feature/parser after the local branch is deleted</figcaption>
<p class="example-context">From the disposable restore demonstration. The branch and its committed parser.md were captured successfully before the local branch was deleted.</p>
<section class="example-step" aria-labelledby="example-step-1">
<h2 id="example-step-1"><span>1 · Successful capture</span> The unpushed branch has a second copy</h2>
<pre><code>workspace/notes/&#10;  main&#10;  feature/parser → parser.md&#10;&#10;vault/notes.git&#10;  main&#10;  feature/parser → parser.md</code></pre><p><code>ingotvault</code> captured the covered refs; <code>ingotvault verify</code> reported <code>refs match</code>.</p>
</section>
<section class="example-step example-report" aria-labelledby="example-step-2">
<h2 id="example-step-2"><span>2 · Later branch deletion</span> The vault still has the captured branch</h2>
<pre><code>workspace/notes/&#10;  main&#10;&#10;vault/notes.git&#10;  main&#10;  feature/parser → parser.md</code></pre><p>The source no longer has <code>feature/parser</code>. Its captured history remains in the mirror.</p>
</section>
<section class="example-step" aria-labelledby="example-step-3">
<h2 id="example-step-3"><span>3 · You recover the branch</span> Clone the mirror and switch to it</h2>
<p>From the demonstration’s root folder:</p><pre><code>git clone ./vault/notes.git ./notes-restored&#10;cd ./notes-restored&#10;git switch feature/parser</code></pre><p class="example-payoff"><code>parser.md</code> is present again because its commit was on the captured branch.</p>
</section>
<p class="value-note">The demonstration’s uncommitted scratch.txt is absent from the restored clone: default capture did not include it. Only successfully captured history is recoverable.</p>
<p class="example-links"><a href="/install#restore-a-lost-branch">Follow the complete restore demonstration</a></p>
</figure></section>

Captures run when you invoke the command or install the documented schedule. IngotVault does not hook `git push`.

## Quick start

```bash
pnpm add -g ingotvault
ingotvault init
ingotvault list
ingotvault schedule install
ingotvault
ingotvault verify
```

`init` asks for the workspace and the mirror path. Remote name and scan depth have defaults (`backup` and `3`). It writes `ingotvault.config.json` in the current directory and the vault marker. `schedule install` registers a daily job at 18:00 local. You are done when `verify` prints `ok` and `refs match`.

Run `ingotvault` again whenever you want another capture. An agent can run `ingotvault --repo .` in one repo. That is optional. The daily job and that command can both be on. If the drive is unplugged, a scheduled run skips and a manual run stops.

Clone, another time of day (`--at`), WIP, restore, and encrypt are on [Install](/install). Force update is on [Safety](/safety).

Agents rebase, amend, reset, and delete a branch that looked stale. A branch that was already captured stays on the spare remote. [An undo layer for autonomous edits](/posts/undo-layer-for-agents).

<p class="kicker">npm · pnpm · Node 22+ · Apache-2.0</p>

<div class="cta-row">
  <a class="cta cta-primary" href="/install">Install IngotVault →</a>
  <a class="cta cta-secondary" href="https://github.com/Catalyst-Forge-LLC/ingotvault">View on GitHub</a>
</div>

### Coverage on a successful run

| Included | Not included by default |
| --- | --- |
| Local branches and tags | Uncommitted files and stashes |
| `refs/notes/*`, `refs/replace/*`, `refs/ingotvault/*` | Git LFS object bytes (pointer files only) |
| Opt-in WIP snapshot of a dirty tree that is not gitignored | Submodule object stores |

A run captures the refs that exist at that moment. Later edits wait for the next successful run. Stashes, uncommitted files, and commits that sit on no covered ref are not protected. Deleted branches stay on the mirror. If one repo fails, the others continue.

A vault on the same physical disk as the workspace is a second Git copy on that disk. It is not protection against that disk failing.

[What is covered](/safety) · [Restore a lost branch](/install#restore-a-lost-branch)

## Why it exists

Forge remotes cover what you pushed upstream. File backups cover bytes on disk, including a torn `.git` mid-rebase. Between those two you still lose:

- Repos with no forge remote
- Unpushed branches and tags in repos you thought were safe because `main` is on origin
- NDA'd or unfinished work that should not leave the machine
- Offline or intermittent network
- Forge outage, lost 2FA, or losing org access

A push into a bare mirror is a git operation: validated on receipt, atomic at the ref level, restorable with `git clone`, checkable with `ingotvault verify`.

Built by [Catalyst Forge LLC](https://www.catalystforge.com).
