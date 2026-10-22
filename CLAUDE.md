# ConcenTraining – rules for Claude Code

## Stack
- Plain HTML, CSS and vanilla JS. No frameworks, no build step, no npm toolchain for the frontend.
- The website is the public/ folder. Backend: Netlify Functions in netlify/functions/ and Netlify Database migrations in netlify/database/migrations/.
- Hosted on Netlify (project "concentraining"). The production branch is `live`: Netlify deploys the live site only from `live`.
- main is the development branch. Pushes to main create a free branch deploy at https://main--concentraining.netlify.app, and pull requests into main get free Deploy Previews.
- The owner moves changes from main to live with a main → live pull request.

## Git workflow
- main is the source of truth and the base of every branch and pull request.
- Never push to, branch from, open a pull request into, or otherwise touch the `live` branch. Only the owner moves changes to live.
- At the start of every session, make sure your work is based on the latest origin/main. If it isn't, stop and tell me.
- One feature per session and per pull request.
- When the work is done: commit, push, and open a pull request into main. Never merge it yourself; I test it on the Netlify Deploy Preview and merge it.
- Never create a branch called main, and never change the default branch.
- Never commit screenshots, test scripts or other temporary files; keep them outside the repo.

## Product rules
- Characters react only with poses and facial expressions, never with text.
- UI text is in English.
- Don't break existing localStorage keys (ct_session_v1, ct_prefs_v1, the history key). Old saved data must keep working.
- Never invent data: if a value can't be measured (e.g. focus % in Simple mode), store null instead of estimating.
- Offline: whenever a file in public/ that the app needs at startup (a page, CSS, JS, manifest, icon, favicon) is added, removed or renamed, update the PRECACHE list in public/sw.js and raise CACHE_VERSION in the same change.

## Communication
- I'm not a professional developer. When you use a technical term or tool, explain it in one sentence.
- Show me the plan first for any feature, and wait for my "go".
- Update the README when behaviour changes.
