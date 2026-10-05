---
name: make-a-show
description: Use when building any TalkShowGo episode (prep show, daily, topic show) — the one-command build, the QA-before-voice checklist that catches contamination/era/invented-name bugs, voicing, and delivery. Triggers on "make a show", "build an episode", "make a <team/topic> show".
---

# Make a show (the proven loop)

Boot: `npm run dev` (research brain on :3000). Gateway for voice: cupcake `:8700` — see `tsg-ops` skill for health laws.

## 1. Beat exists? If not, bootstrap (it validates itself)
```
npm run show:bootstrap -- --name="South Carolina State" --niche="HBCU football"
```
Writes `lab/beats/<slug>.json` + `<slug>.VALIDATION.md` with a PASS/MARGINAL/FAIL contract. Read the report; prune auto-trusted channels.

## 2. Build (one command, two+ segments)
```
npm run show:build -- --beat=sc-state --slug=myshow --questions="Q1|Q2" [--desk=a,b,c] [--resume]
```
**Question law (paid for by the phantom-48-3 build): ANCHOR the entities and the time.** Name BOTH teams + "this week" in the question text — anchored questions took evidence 17→41 and killed adjacent-team contamination. Heed the builder's `⚠ THIN RESEARCH` warning (<8 evidence = one off-story web hit can own the floor).

## 3. QA BEFORE VOICING (non-negotiable — every defect below shipped once)
Read `lab/shows/<slug>-s1/episode.md` and scan for:
- **Phantom results / wrong era**: a score or result that hasn't happened; "the 2023 season" (it's not); stats from years ago asserted as current. `grep -nE "202[0-9]" episode.md` should return nothing.
- **Wrong team/person leakage**: adjacent teams from HBCU-wide channels (Jackson State leaked into a FAMU show once); grep for teams not in the question.
- **Invented people**: a coach or player the evidence never named ("Coach Davis" happened). Predictions may not name people/teams/years the show didn't establish (now a prompt law, still verify).
- **Real-person facts**: pronouns/roles of real people (a floor line once called Coach Berry "she").
- **Team-identity confusion**: a host calling their own team like it's the opponent.
- Fix small defects by editing the floor `segment_final.md` / episode.md directly; fix CLASSES at the prompt level in `make_episode.mjs`/`run_floor.mjs` and note it in `lab/engine/SELF_IMPROVE_LOG.md`.

## 4. Voice + deliver
```
npm run show:voice -- lab/shows/<slug>-s1/episode.md lab/shows/<slug>-s1/SHOW-ep.mp3
```
Renderer refuses if >10% of spoken lines would be silently skipped (trust it). Output: -16 LUFS mastered + `*.timeline.json` (who speaks when — feeds video). Copy episode.md to a `-script.txt`, send BOTH files to Robert (audio-first law: they listen, they don't read).

## Current known weaknesses (check SELF_IMPROVE_LOG roadmap before "fixing" fresh)
Repetition/rhythm war: "Ayo" opener tic, vocative spam, fixed 0.3s gaps, 27-word metronome turns, formulaic cold opens. The architectural successor is THE RUNDOWN (issue #25) — don't bolt fixes where the rundown engine will land.
