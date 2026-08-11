# ingotvault.dev

Marketing + notes site for [ingotvault](https://github.com/Catalyst-Forge-LLC/ingotvault), built with [Downpress](https://github.com/Catalyst-Forge-LLC/downpress).

```bash
# once in the engine (sibling checkout)
cd ../../downpress && pnpm install

# in this folder
pnpm install
pnpm dev          # local preview
pnpm build        # → build/
```

Optional: edit `theme.css` next to `downpress.config.ts`.

## Deploy (Cloudflare Pages)

**Use one pipeline only.** Dual deploys overwrite each other when asset hashes disagree.

Until Downpress is public, deploy only from a machine with the sibling engine:

```bash
pnpm deploy
# = pnpm build && wrangler pages deploy build --project-name=ingotvault
```

Then attach **ingotvault.dev** in the Cloudflare dashboard.

## Launch checklist

- [ ] Make the GitHub repo **public** (nav + “View on GitHub” 404 for everyone else until then)
- [ ] `pnpm deploy` (or git-connected Pages) and confirm `https://ingotvault.dev`
- [ ] Confirm `og:image` / Twitter card in a debugger (logo is wired; needs a public URL)
- [ ] Publish a real npm release past the `0.0.0` placeholder when ready

### Git-connected Pages (later)

| Setting | Value |
| --- | --- |
| Root directory | `site` |
| Build command | `pnpm install && pnpm build` |
| Output directory | `build` |

Switch the dependency to a **git pin** first:

```json
"downpress": "github:Catalyst-Forge-LLC/downpress#v0.1.0"
```
