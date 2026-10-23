# ConcenTraining – rules for Claude Code

## Stack
- Plain HTML, CSS and vanilla JS. No frameworks, no build step, no npm toolchain for the frontend.
- The website is the public/ folder. Backend: Netlify Functions in netlify/functions/ (shared code in netlify/lib/). They store the character pick counts in Netlify Blobs: picks-live for the production deploy, picks-test for Deploy Previews, the main branch deploy and netlify dev.
- Hosted on Netlify (project "concentraining"). The production branch is `live`: Netlify deploys the live site only from `live`.
- main is the development branch. Pushes to main create a free branch deploy at https://main--concentraining.netlify.app, and pull requests into main get free Deploy Previews.
- The owner moves changes from main to live with a main → live pull request.

## Temporary: Netlify is paused (until about 2 November 2026)
- Netlify paused the account (usage limit), so there are no Deploy Previews and no main branch deploy right now.
- Test site meanwhile: GitHub Pages at https://kantorhorvathambrus-source.github.io/ConcenTraining/, published from main by .github/workflows/pages.yml. It has no backend: /api/* (popularity stats) doesn't work there.
- Until Netlify is back, the owner merges pull requests into main without a Deploy Preview and tests them on the GitHub Pages site afterwards. That's safe because main is not the live site.
- The site runs under a subpath there, so paths in public/ must stay relative (no leading "/").
- Remove this section when Netlify is back.

## Git workflow
- main is the source of truth and the base of every branch and pull request.
- Never push to, branch from, open a pull request into, or otherwise touch the `live` branch. Only the owner moves changes to live.
- At the start of every session, make sure your work is based on the latest origin/main. If it isn't, stop and tell me.
- One feature per session and per pull request.
- When the work is done: commit, push, and open a pull request into main. Never merge it yourself; I test it on the Netlify Deploy Preview and merge it (while Netlify is paused: I merge it and test it on GitHub Pages, see above).
- Never create a branch called main, and never change the default branch.
- Never commit screenshots, test scripts or other temporary files; keep them outside the repo.

## Product rules
- Characters react only with poses and facial expressions, never with text.
- UI text is in English.
- Don't break existing localStorage keys (ct_session_v1, ct_prefs_v1, the history key). Old saved data must keep working.
- Never invent data: if a value can't be measured (e.g. focus % in Simple mode), store null instead of estimating.
- New character: besides public/js/data/characters.js, add it with the same id and name to CHARACTERS in netlify/lib/characters.mjs. Only ids listed there are counted and shown on stats.html.
- Offline: whenever a file in public/ that the app needs at startup (a page, CSS, JS, manifest, icon, favicon) is added, removed or renamed, update the PRECACHE list in public/sw.js and raise CACHE_VERSION in the same change.

## Communication
- I'm not a professional developer. When you use a technical term or tool, explain it in one sentence.
- Show me the plan first for any feature, and wait for my "go".
- Update the README when behaviour changes.
- Reply in English. Code, comments, commit messages, PR descriptions and the README stay in English.
