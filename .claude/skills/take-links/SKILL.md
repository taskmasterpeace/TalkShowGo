---
name: take-links
description: Use when putting a real person (Dad, a fan, Robert) on a show via their private take link — links/QR, REMOTE access (tunnel laws, the Studio Door), voice-print capture, and recovering a stranded take. Triggers on "take link", "QR code", "remote access", "put me/dad on the show", "the send failed".
---

# Take links — real people on the floor

A person on `beat.people[]` has a private token; `/take/<token>` is their whole handshake (no login). Flow: inform-first brief → ask (live web answers) → fan-depth chips (behavioral wording, NEVER "are you a superfan"; remembered on the person — returning fans skip the quiz) → record/type → follow-ups → save. **Saves are idempotent via client_key — a retried send can't duplicate.** The longest recorded clip across ALL their takes auto-becomes their Breeze voice ref (a 2s "yep" never replaces last week's clean 19s ref); refs auto-cut to the 10-20s spec.

## Links + QR
```
npm run show:takes -- --person=robert [--beat=<id>] [--public]   # wifi + tailnet links + QR
node lab/engine/take_link.mjs --off                              # CLOSE everything when takes are in
```
`--public` opens an on-demand tunnel and **verifies against /logo.svg before handing out** (never the take API — its GET logs "<person> opened their link"; synthetic traffic once wrote 144 phantom visits).

## TUNNEL LAWS (all measured, all paid for)
- **Free localhost.run tunnels are CULLED AT ~31 MINUTES, period.** ssh keepalives don't help; HTTP pings don't help; it's a hard clock. Plan respawn+repoint, not prevention.
- While ANY tunnel is up, the WHOLE dev app is internet-reachable — `src/middleware.ts` hides `/command` + `/api/command/*` + `/api/showtime` from tunnel-origin hosts (bare 404). The take flow stays public by design.
- **The Studio Door** = Robert's permanent QR: private artifact `https://claude.ai/code/artifact/7179546c-20c4-46b6-9c81-b83e69064253` that forwards to whatever tunnel is live (repoint by writing artifact-db doc `state/current` {url, person, updated_at}; url:"" = honest OFF-AIR state). Robert's phone must be signed into claude.ai; it's private so dad/son can't use it.
- **The real permanent fix**: Robert's one-time Tailscale Funnel enable → https://login.tailscale.com/f/funnel?node=naN2A1kXw411CNTRL (then `tailscale funnel --bg 3000` = stable URL, works for everyone). Unclicked as of 2026-09.
- Phone mic needs HTTPS (tunnels/funnel yes, LAN http no).

## When a send "failed"
Check `npm run show:activity -- --person=<slug>` — the clip usually landed (stage clip) before the save died (a dead tunnel returns HTML → Safari's "string did not match the expected pattern"). Recover server-side: replay the on-disk wav through localhost (depth → audio with take:N → answers save). The page now retries + speaks human, but the activity log is the truth.

## Reading the activity log
Metronomic ~46s-spaced "open" events = machine traffic, not humans (the phantom-visits lesson). Real flows show open → depth → clip → take progressions.
