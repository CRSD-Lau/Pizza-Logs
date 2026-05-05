# Add MVP animation pass

> Imported from local Codex session logs on 2026-05-05. This is a readable chat digest, not the raw JSONL transcript.

## Metadata

- Session date: 2026-05-04
- Thread id: `019df12f-5943-7071-92fe-c404d7f257c5`
- Original cwd: `C:\Users\neil_\OneDrive\Desktop\PizzaLogs`
- Source log: `C:\Users\neil_\.codex\sessions\2026\05\04\rollout-2026-05-04T01-11-45-019df12f-5943-7071-92fe-c404d7f257c5.jsonl`
- Imported user turns: 5
- Imported assistant final replies: 5
- Tool/command events omitted: 292

## Discussion Digest

## User

[@superpowers](plugin://superpowers@openai-curated)

Main rule!!! You MUST push to Main in git inorder for railway to pick up the change and deloy. My local is not setup up because lack of a dB.

With that said... Lets see what you can do!

You are working in my Pizza Logs codebase.

Goal:
Build an MVP animation pass for the app using lightweight, production-safe animations. Do not overbuild. Do not add heavy 3D, WebGL, sound, or large external assets.

Primary MVP ideas to implement:

1. First-visit landing intro
Create a short â€œFrozen Logbookâ€ intro overlay for Pizza Logs.

Behavior:
- Shows only on first visit per browser using localStorage.
- Max duration: 2.5 seconds.
- Must have a visible Skip button.
- Theme: dark ICC / frost / Lich King-inspired, but do not use copyrighted images or actual Blizzard assets.
- Visuals should be CSS-only:
  - dark background
  - subtle snow/frost particles if easy
  - frost glow
  - Pizza Logs title reveal
  - short tagline such as â€œRaid data, forged from combat logs.â€
- After completion or skip, unmount the overlay cleanly.

2. Boss kill order reveal animation
On raid session and leaderboard views, animate boss cards/rows/icons in kill order instead of alphabetical order.

Behavior:
- Preserve actual kill order from parsed encounter/session data.
- Do not sort bosses alphabetically if encounter timestamps/order are available.
- Animate each boss entry with a small stagger:
  - fade in
  - slight upward motion
  - subtle frost pulse on entry
- Keep the animation subtle and fast.
- Ensure sorting logic is centralized or clearly documented.

3. Player / leaderboard row reveal
Add lightweight row reveal animations to player rankings and leaderboards.

Behavior:
- Rows fade/slide in with minor stagger.
- DPS/HPS/damage values may count up only if there is already a safe utility or simple reusable implementation.
- Do not introduce fragile animation logic that affects data accuracy.
- Animation must not block rendering or create layout shift.

Technical requirements:
- First inspect the repo structure before changing files.
- Use existing stack and dependencies where possible.
- If framer-motion is already installed, use it.
- If not installed, prefer CSS animations over adding a dependency.
- Keep components reusable:
  - Intro overlay component
  - Animated list/row utility or CSS class
  - Boss progression animation helper if needed
- Respect existing styling conventions.
- Maintain mobile responsiveness.
- Respect reduced-motion:
  - Use prefers-reduced-motion CSS or equivalent logic.
  - Users with reduced motion should get instant/simple fades only.

Brand/style constraint:
All animation work must stay within the existing Pizza Logs visual identity. Do not redesign the app, change the core theme, replace the layout, or introduce a new visual language.

Use the current:
- color palette
- typography
- spacing
- card styling
- button styles
- border radius
- shadows/glows
- dark theme treatment
- existing WoW-inspired tone

The animations should feel like an enhancement to the current Pizza Logs UI, not a separate landing-page redesign. Any frost/ICC/Lich King-inspired effects must be subtle and blended into the existing brand system.

Before implementing, inspect the current styles/components and reuse existing design tokens, CSS variables, Tailwind classes, or component patterns wherever possible.

Avoid:
- new unrelated colors
- oversized cinematic elements that clash with the app
- fake Blizzard/WoW assets
- changing navigation structure
- changing dashboard/card/table layouts
- making the app feel like a fan-site splash page instead of a log-analysis tool

Files to inspect first:
- package.json
- app/layout, pages layout, or router structure
- homepage / landing page component
- raid sessions page
- leaderboards page
- player components
- boss/encounter parsing or display utilities
- existing CSS/global styles

Implementation constraints:
- Do not rewrite unrelated UI.
- Do not change parser behavior except where boss display ordering is clearly wrong.
- Do not change database schema unless absolutely necessary.
- Do not add copyrighted Lich King images, icons, audio, or branded Blizzard assets.
- Do not make animations mandatory or annoying.
- Keep this MVP easy to remove or iterate on.

Testing:
- Run typecheck/lint/build/test commands available in package.json.
- Manually verify:
  - first visit shows intro
  - refresh after first visit does not show intro
  - skip button works
  - reduced-motion does not animate heavily
  - boss order follows encounter order
  - leaderboards still show correct data
  - mobile layout remains usable

Deliverables:
- Implement the MVP.
- Summarize changed files.
- Explain how to reset the intro for testing (localStorage key).
- Call out any assumptions about boss order data.
- If any part cannot be implemented safely, leave a clear TODO with reasoning rather than guessing.

## Assistant

Implemented and pushed to `origin/main`.

What changed:
- Added CSS-only `FrozenLogbookIntro` first-visit overlay.
- Added reusable reveal/order helper in `lib/ui-animation.ts`.
- Wired subtle reveal animations into raids, sessions, leaderboards, player cards, player profile rows, and meter rows.
- Session encounter display now uses `startedAt` order when available; leaderboard boss boards remain ICC progression because they are aggregate boss views with no single session timestamp.
- Updated required vault handoff docs.

Reset intro for testing:
```js
localStorage.removeItem("pizzaLogsFrozenIntroSeen")
```

Validation:
- Focused tests passed: `ui-animation`, `frozen-intro-source`, `boss-order`, `player-profile`.
- `tsc --noEmit`, full ESLint, `git diff --check`, and `next build` passed.
- Local Chrome checks passed for first visit, skip, refresh suppression, auto-complete, reduced motion, and mobile layout.
- Pushed `main`; Railway deployed the new bundle. Production Chrome smoke check passed for intro skip/localStorage and mobile `/players`.

Latest `main`: `419e690`
Animation code commit: `8a6de54`

::git-create-branch{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs" branch="codex/pizza-logs-animation-mvp"}
::git-stage{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-commit{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-push{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs" branch="main"}

## User

I saw the animation for a split second and never again and it was when i selected guild page. not even sure what other animations you implemented

## Assistant

Fixed and pushed to `origin/main` for Railway.

Root cause: the intro was intentionally one-time via `localStorage`, but there was no replay path. More importantly, Tailwind was purging the shared `reveal-item` / `boss-reveal-item` animation classes in production because they were generated from `lib/ui-animation.ts`, outside Tailwindâ€™s scanned paths.

What you can test now:
- Replay intro anytime with `?intro=1`, e.g. `https://pizza-logs-production.up.railway.app/?intro=1`
- Full reset: `localStorage.removeItem("pizzaLogsFrozenIntroSeen")`
- Reveal animations are on Guild roster rows, raid/session boss rows, raid roster/player rows, leaderboards, player cards/profile sections, and meter rows.

Changed:
- Added Tailwind safelist for reveal classes.
- Added regression coverage for the safelist.
- Updated vault handoff, Now, and Known Issues docs.

Verified:
- Targeted animation tests passed.
- TypeScript passed.
- ESLint passed.
- `next build` passed.
- Parser suite passed: `123 passed`.
- Production CSS now serves `.reveal-item`, `.boss-reveal-item`, both reveal keyframes, and the reveal timing after Railway picked up `main`.

::git-stage{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-commit{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-push{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs" branch="main"}

## User

what is the frozne intro because ive never seen it before on live

## Assistant

The â€œFrozen Logbookâ€ intro is a short full-screen startup overlay:

- dark frost/ICC-style background
- subtle snow/frost CSS particles
- `Pizza Logs` title reveal
- tagline: `Raid data, forged from combat logs.`
- visible `Skip` button
- auto-dismisses in about 2.3 seconds
- stores `pizzaLogsFrozenIntroSeen` in `localStorage`

It is mounted globally, so seeing it when you clicked Guild actually makes sense: it appears on the first route the browser loads after the feature is live, not only on the homepage.

Why you probably didnâ€™t see it properly: your browser likely got the first-visit flag set during that split-second flash. Also, before the follow-up fix, some animation CSS was being purged in production, so the rest of the animation pass was basically too subtle or missing.

I verified live currently has the replay code and tagline in the deployed JS. Try this directly:

[Replay Frozen Intro](https://pizza-logs-production.up.railway.app/?intro=1)

Or reset it in browser console:

```js
localStorage.removeItem("pizzaLogsFrozenIntroSeen")
location.reload()
```

If your OS/browser has reduced motion enabled, the intro intentionally becomes much shorter and less animated.

## User

yeah i see by clicking that link but thats the only way i see it

## Assistant

That is expected with the current rule: it only shows once per browser, then `localStorage` suppresses it forever.

Your browser already has this set:

```js
pizzaLogsFrozenIntroSeen = "1"
```

So normal live visits will not show it again. The replay link works because I added `?intro=1` as an override after your feedback.

To test it like a brand-new user, use either:

```js
localStorage.removeItem("pizzaLogsFrozenIntroSeen")
location.reload()
```

or open the site in an incognito/private window.

The original requirement was â€œfirst visit per browser,â€ so I did not make it show every visit. But based on your reaction, the better UX may be to add a small, non-annoying replay control somewhere admin-facing or footer-level, or make it show once per deploy/version instead of once forever.

## User

lets make it slightly longer and use it for every page change always (not just once)

## Assistant

Implemented and pushed to `origin/main`.

The Frozen Logbook intro now:
- shows on initial load and every client-side page change
- lasts `3000ms` instead of `2300ms`
- still has `Skip`
- no longer uses `localStorage`, so `pizzaLogsFrozenIntroSeen` will not suppress it anymore
- keeps reduced-motion users on the short/simple version

Validation:
- `tests/frozen-intro-source.test.ts` passed after failing on the old behavior
- `tests/ui-animation.test.ts` passed
- TypeScript, ESLint, `next build`, `git diff --check` passed
- Parser suite passed: `123 passed`
- Local built-app browser check returned `initialIntro: true` and `routeChangeIntro: true`
- Production bundle now has the route-change intro markers and no old `pizzaLogsFrozenIntroSeen` gate

Commits pushed:
- `a499de0 fix: replay frozen intro on route changes`
- `3156eb8 docs: record route intro deployment`

::git-stage{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-commit{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-push{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs" branch="main"}
