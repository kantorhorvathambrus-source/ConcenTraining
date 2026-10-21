# ConcenTraining – rules for Claude Code

## Stack
- Plain HTML, CSS and vanilla JS. No frameworks, no build step, no npm toolchain for the frontend.
- The website is the public/ folder. Backend: Netlify Functions in netlify/functions/ and Netlify Database migrations in netlify/database/migrations/.
- Hosted on Netlify (project "concentraining"), which deploys automatically from the main branch.

## Git workflow
- main is the only long-lived branch and the source of truth.
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

## Communication
- I'm not a professional developer. When you use a technical term or tool, explain it in one sentence.
- Show me the plan first for any feature, and wait for my "go".
- Update the README when behaviour changes.
