# IngotVault.dev

Marketing + notes site for [IngotVault](https://github.com/Catalyst-Forge-LLC/ingotvault), built with [FilePress](https://getfilepress.com) ([`getfilepress`](https://www.npmjs.com/package/getfilepress) on npm).

```bash
pnpm install
pnpm dev          # local preview
pnpm build        # → build/
```

Optional: edit `theme.css` next to `filepress.config.ts`.

## Deploy (Cloudflare Pages)

**Use one pipeline only.** Dual deploys overwrite each other when asset hashes disagree.

```bash
pnpm deploy
# = pnpm build && wrangler pages deploy build --project-name=ingotvault
```

Then attach **ingotvault.dev** in the Cloudflare dashboard.

### Git-connected Pages

| Setting | Value |
| --- | --- |
| Root directory | `site` |
| Build command | `pnpm install && pnpm build` |
| Output directory | `build` |

Dependency is already the public npm package:

```json
"getfilepress": "^0.1.1"
```

## Content sync

**Site** = product narrative (home, Install, Safety, posts). **Root README** = CLI / config reference. Same promise sentence, Safety facts, exit codes, and WIP rules in both; when behavior changes, update README + `site/pages/*` (+ the agents post if it restates those facts).

## Launch checklist

- [ ] Make the GitHub repo **public** (nav + “View on GitHub” 404 for everyone else until then)
- [ ] `pnpm deploy` (or git-connected Pages) and confirm `https://ingotvault.dev`
- [ ] Confirm `og:image` / Twitter card in a debugger (logo is wired; needs a public URL)
- [ ] Publish a real npm release past the `0.0.0` placeholder when ready
