# Plan roster sync API

> Imported from local Codex session logs on 2026-05-05. This is a readable chat digest, not the raw JSONL transcript.

## Metadata

- Session date: 2026-05-01
- Thread id: `019de5e3-7358-7012-8cfa-c10042782566`
- Original cwd: `C:\Users\neil_\OneDrive\Desktop\PizzaLogs`
- Source log: `C:\Users\neil_\.codex\sessions\2026\05\01\rollout-2026-05-01T20-33-01-019de5e3-7358-7012-8cfa-c10042782566.jsonl`
- Imported user turns: 8
- Imported assistant final replies: 7
- Tool/command events omitted: 38

## Discussion Digest

## User

So im thinking about updating the API we use to pull the guild roster and the gear sync for each player. Are there better APIs I can use for this task? specifically for wotlk 3.3.5a? or could I do a residential proxy on my railway deployment to bypass the cloudflare security? lets talk about it and plan it out

## User

So im thinking about updating the API we use to pull the guild roster and the gear sync for each player. Are there better APIs I can use for this task? specifically for wotlk 3.3.5a? or could I do a residential proxy on my railway deployment to bypass the cloudflare? lets talk about it and plan it out

## Assistant

Short version: I would **not** build this around a Railway residential proxy to bypass Cloudflare. It will be brittle, likely violates upstream intent/ToS, and I canâ€™t help design an evasion path around Cloudflare. The better direction is: keep Warmane browser-side/import based, make it more reliable, and reduce live scraping with local/static item metadata.

**Whatâ€™s available**
Warmaneâ€™s undocumented API is still the only useful public-ish source for Warmane-specific roster/gear:

- Character gear: `https://armory.warmane.com/api/character/<name>/<realm>/summary`
- Guild summary: `https://armory.warmane.com/api/guild/<guild>/<realm>/summary`
- Guild members: `https://armory.warmane.com/api/guild/<guild>/<realm>/members`
- Guild HTML page still matters because it can expose things the JSON API may not, like rank/profession context.

Warmane forum users confirm these endpoints exist, but also note the exact problems weâ€™re seeing: no official docs/rate limits, odd JSON shape, errors returned as HTTP 200, missing item slot/ilvl/rank details, etc. Source: [Warmane API feedback](https://forum.warmane.com/showthread.php?t=463405), [How to use Warmane API](https://forum.warmane.com/showthread.php?t=383159).

Blizzardâ€™s official APIs are not a solution for Warmane 3.3.5a. They cover Blizzard realms/data, not private-server characters. Classic API support has historically been limited and separate from retail, and it does not give you Warmane guild/gear state. Sources: [Blizzard Classic API discussion](https://us.forums.blizzard.com/en/blizzard/t/profile-api-for-wow-classic/3522), [Classic Game Data API listing](https://apis.apis.io/apis/battle-net/world-of-warcraft-classic/).

**Best path Iâ€™d plan**
My recommendation is a 3-source pipeline:

1. **Warmane browser-side userscript remains the live source**
   Use the adminâ€™s real browser session on Warmane pages to fetch roster and character summaries, then POST normalized payloads into Pizza Logs. This avoids Railway IP blocks without trying to defeat Cloudflare.

2. **Local/static WotLK item metadata**
   Stop depending on live Wowhead for every item if possible. Build or import a 3.3.5a item metadata table: `itemId`, `name`, `itemLevel`, `inventoryType/equipLoc`, `quality`, `icon`. Sources could be Wowhead tooltip JSON for enrichment, Cavern of Time as fallback, or a TrinityCore/AzerothCore `item_template` export. This makes GearScore deterministic and much faster.

3. **Optional in-game addon/export later**
   For true WotLK 3.3.5a accuracy, an addon can export guild/raid-visible data to SavedVariables, then Pizza Logs imports that file. Thatâ€™s more work, but it is the cleanest long-term escape hatch from Armory/Cloudflare weirdness.

**The proxy question**
A residential proxy on Railway would probably â€œwork until it doesnâ€™t,â€ but itâ€™s the wrong foundation. It adds cost, secret handling, ban/challenge risk, and a cat-and-mouse dependency. Iâ€™d only consider a proxy-like route if Warmane explicitly provides/approves an API access method or allowlists an integration.

One key question before we design this: do you want the next iteration optimized for **minimum manual effort** for you as admin, or for **maximum reliability/accuracy** even if it means installing a small addon or doing occasional exports?

## User

i want everything to be automated. i dont want to be fetching gear and guild roster updates manually just for the backend code to fail like its doing now leaving my web app with broke soruces

## Assistant

Yep. Then the target design should be: **Pizza Logs never depends on live Warmane/Wowhead requests during page render**, and sync failures must never destroy or hide the last good data.

Iâ€™d split this into two problems:

**1. Automated Data Collection**
Best practical option: a **Pizza Logs Sync Agent** that runs outside Railway on a normal residential/home machine or small always-on box. It would run on a schedule, fetch Warmane roster/gear, enrich items, then POST clean snapshots to your Railway app.

I would not use Railway itself for Warmane/Wowhead polling because that is exactly the failing path: datacenter IPs get challenged/blocked. I also canâ€™t help build a residential proxy path to bypass Cloudflare, but a local sync agent using your normal network/browser session is a cleaner, non-cat-and-mouse version of the same practical idea.

**2. Backend Must Become Snapshot-First**
Right now, live source failure can leave the app feeling broken. The backend should treat external APIs as unreliable imports, not live dependencies.

Rules Iâ€™d add:

- Keep `lastGoodRosterSnapshot`.
- Keep `lastGoodGearSnapshot` per character.
- Never overwrite good gear/roster data with failed, empty, partial, or Cloudflare HTML responses.
- Track source health: `lastAttemptAt`, `lastSuccessAt`, `lastError`, `source`.
- Show stale data with a small â€œlast syncedâ€ timestamp instead of broken/missing panels.
- For roster, donâ€™t remove missing players immediately. Require N consecutive successful roster syncs where theyâ€™re absent, or mark them inactive after X days.
- For gear, update a character only after a complete valid snapshot. Partial item enrichment should merge with previous metadata, not wipe it.

**Approaches**
My recommendation is **Approach A**.

**A. Local/Residential Sync Agent**
A small Node/TypeScript worker runs via Windows Task Scheduler, Docker, or a cheap always-on mini PC. It does:

- Every 6-12 hours: sync guild roster.
- Every 12-24 hours: sync gear for roster members and known logged players.
- Queue + retry with backoff.
- POST results to `/api/admin/guild-roster/import` and `/api/admin/armory-gear/import`.
- Backend stores only validated snapshots.

This gives you near-full automation without depending on Railwayâ€™s blocked IPs.

**B. In-Game Addon + Companion App**
Most robust long-term, no Warmane Armory needed for some data. Addon captures guild roster and player gear into SavedVariables; companion app uploads it automatically. Downside: full guild gear requires guildies to run it, or an officer to inspect people while online.

**C. Server Cron Only**
Cleanest operationally, but not realistic if Railway IPs are blocked. We can still keep server cron for retrying internal queues, but not as the primary Warmane fetcher.

**What Iâ€™d Build First**
Phase 1: harden the backend so broken sources canâ€™t break pages.

Phase 2: build a local `pizza-logs-sync-agent` that automates current roster/gear import.

Phase 3: add source-health UI on `/admin`: last successful roster sync, gear queue count, failed characters, stale characters, next scheduled run.

Phase 4: optionally replace Wowhead live enrichment with a local WotLK item metadata table so item level/slot/icon data becomes deterministic.

The important shift is: **Railway hosts the app; a sync agent feeds it trusted snapshots.** Railway should not be responsible for fighting Warmane/Wowhead availability.

## User

the data i need is on warmanes armory so lets build to pull from there except in an acurate reliable way. my dekstop and laptop are usually on

## Assistant

Yes. Iâ€™d build this as a **local Warmane sync agent** plus a hardened snapshot backend.

**Recommended Design**
Run a small Pizza Logs sync process on your desktop and optionally laptop. It pulls from Warmane Armory on a schedule, validates the data, enriches item metadata, then posts clean snapshots to the Railway app.

Flow:

```text
Desktop/Laptop Sync Agent
  -> Warmane guild API / guild page
  -> Warmane character API for each roster player
  -> item metadata enrichment
  -> Pizza Logs import APIs
  -> DB stores validated snapshots only
```

Railway becomes the receiver/database/UI, not the thing trying to fetch Warmane live.

**Why This Fits**
Your desktop/laptop are usually on, and they use normal residential connections. That avoids the Railway IP problem without turning the deployed app into a Cloudflare workaround machine.

For reliability, we make the agent conservative:

- Fetch roster every 6-12 hours.
- Fetch gear for stale/missing roster members every 12-24 hours.
- Retry failed characters with backoff.
- Never post empty/invalid data as a â€œsuccess.â€
- Keep a local queue file so it can resume after sleep/reboot.
- Use one active sync source at a time so desktop and laptop donâ€™t fight each other.

**Backend Changes**
The backend should stop behaving like live source failure equals missing data.

Iâ€™d add:

- `lastSuccessAt`, `lastAttemptAt`, `lastError`, `sourceAgent`
- snapshot validation before write
- no overwriting good gear with partial/empty gear
- no immediate roster deletion when a player disappears
- stale-but-valid display states
- admin sync health panel

So even if Warmane is down, Cloudflare challenges, your PC sleeps, or a player API call fails, the public app still shows the last known good roster/gear.

**Accuracy**
For gear, the agent should pull the Warmane character summary as the authority for equipped items. For slot/item level/icon data, we should prefer a local WotLK item metadata table if possible, then fall back to Wowhead/Cavern of Time enrichment. That makes GearScore far more deterministic.

**Implementation Choice**
Iâ€™d build the first version as a repo-local Node/TypeScript CLI:

```bash
npm run sync:warmane
```

Then we add a Windows Task Scheduler setup script so your desktop/laptop can run it automatically.

One important design question before we write the spec: should the sync agent run on **both desktop and laptop with a backend lock**, or do you want **desktop primary, laptop backup only**?

## User

im working on my laptop now. lets do laptop

## Assistant

Perfect. Laptop-primary is the cleanest first version.

**Design**
Weâ€™ll build a repo-local **Warmane Sync Agent** meant to run from your laptop. It will pull Warmane Armory data directly from your laptop network, validate it, and POST snapshots into the live Pizza Logs app.

Initial command:

```bash
npm run sync:warmane
```

Later automation:

```text
Windows Task Scheduler
  -> runs every 6 or 12 hours
  -> starts from PizzaLogs repo
  -> calls the sync command
  -> writes logs locally
```

**Agent Behavior**
The agent should:

- fetch `PizzaWarriors` roster from Warmane guild page/API
- import roster to Pizza Logs
- ask Pizza Logs for missing/stale gear queue
- fetch Warmane character summaries for those players
- enrich gear metadata
- import each valid gear snapshot
- retry failures gently
- resume safely if your laptop sleeps or disconnects

**Backend Safety**
Before relying on automation, Iâ€™d harden the import path so bad source data cannot damage the app:

- reject Cloudflare/HTML/error responses as invalid
- reject empty roster/gear snapshots
- never overwrite good gear with partial gear
- keep last good data visible
- record sync status/errors for admin visibility

**First Milestone**
Iâ€™d make v1 laptop-only, no desktop/laptop coordination yet. Once that works, we can add â€œdesktop as backupâ€ with a backend sync lock.

If this design looks right, Iâ€™ll write the design spec into the repo next, then we can turn it into an implementation plan and build it.

## User

lets do it

## Assistant

Done. I wrote and committed the laptop-primary Warmane sync agent design.

Spec: [2026-05-01-warmane-sync-agent-design.md](<C:/Users/neil_/OneDrive/Desktop/PizzaLogs/docs/superpowers/specs/2026-05-01-warmane-sync-agent-design.md>)
Commit: `613744b docs: design Warmane sync agent`

I also updated the vault handoff, current focus, and known blockers so the next session has the right context. I left the unrelated untracked `tmp-mobile-check/` folder alone.

Please review the spec and tell me if you want any changes before I write the implementation plan.

::git-stage{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-commit{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}

## User

i have about 14% left in my weekly plan. should i take this project on in Claude? this project is over there as well

## Assistant

Honestly: yes, Claude is fine for this project, but Iâ€™d be careful about **where the source of truth lives**.

You have only ~14% left here, so Iâ€™d save this session for high-leverage things: architecture decisions, reviewing Claudeâ€™s patches, debugging a specific failure, or deployment help. The Warmane sync agent build is a real multi-step implementation, so it may chew through that 14% fast.

If you move it to Claude, do this first:

1. Make sure Claude has the latest repo state, including commit `613744b docs: design Warmane sync agent`.
2. Tell Claude to read:
   - `AGENTS.md`
   - `Pizza Logs HQ/00 Inbox/START HERE.md`
   - `Pizza Logs HQ/02 Build Log/Latest Handoff.md`
   - `Pizza Logs HQ/03 Current Focus/Now.md`
   - `docs/superpowers/specs/2026-05-01-warmane-sync-agent-design.md`
3. Ask it to write an implementation plan before coding.

You can paste this to Claude:

```text
We are building the laptop-primary Warmane sync agent for Pizza Logs.

Before coding, read AGENTS.md and the required vault files:
- Pizza Logs HQ/00 Inbox/START HERE.md
- Pizza Logs HQ/02 Build Log/Latest Handoff.md
- Pizza Logs HQ/03 Current Focus/Now.md

Then read:
- docs/superpowers/specs/2026-05-01-warmane-sync-agent-design.md

Write an implementation plan first. The goal is an automated local laptop sync agent that fetches Warmane guild roster and gear data, validates snapshots, posts them to the hosted Pizza Logs app, and hardens the backend so bad/empty source data never overwrites last known good data.
```

My take: let Claude do the bigger implementation if you have more room there. Keep this Codex thread as the â€œcontinuity brainâ€ and review/debug partner.

## User

ok update my claude files with this project. gonna move to my dekstop as well

## Assistant

Updated and committed the Claude handoff.

Changed:
- [CLAUDE.md](C:/Users/neil_/OneDrive/Desktop/PizzaLogs/CLAUDE.md) now tells Claude about the laptop-primary Warmane sync agent, the spec to read, the no Railway proxy boundary, and v1 priorities.
- Updated vault handoff/current focus so the project state matches.

Commit: `4bbef54 docs: update Claude handoff for sync agent`

I did not push to `origin`, so a separate desktop checkout will need this commit via push/pull. The only untracked item left is still `tmp-mobile-check/`, untouched.

::git-stage{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
::git-commit{cwd="C:\Users\neil_\OneDrive\Desktop\PizzaLogs"}
