'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Radio, Users, Clapperboard, PlayCircle, Shapes, Search, Radar, ScrollText, GitBranch, MonitorPlay, UserRound, Wrench, Settings, Palette } from 'lucide-react'

// round 3 (2026-09-02): YOUTUBE (rung health, transcripts, clips), PEOPLE (delegates on a beat + their take links),
// JANITOR (the ecosystem's decisions), SETTINGS (in-app keys + the model lineup)
// label + a plain-English tip (hover) so the app explains itself instead of needing a tour (Robert 2026-09-03).
const ITEMS = [
  { href: '/command', label: 'DESK', icon: LayoutGrid, tip: 'Home base: pick a show, pull its sources, mine today’s story, and build it.' },
  { href: '/command/discovery', label: 'DISCOVERY', icon: Radar, tip: 'Dig into a topic: turn raw leads into evidence and see who’s covering it.' },
  { href: '/command/dataflow', label: 'DATAFLOW', icon: GitBranch, tip: 'The pipeline for a show, step by step: pull → cluster → leads → ranked stories.' },
  { href: '/command/youtube', label: 'YOUTUBE', icon: MonitorPlay, tip: 'YouTube sources: channel health, recent videos, transcripts and clips.' },
  { href: '/command/stringer', label: 'RESEARCH DESK', icon: Search, tip: 'Research a topic or a person deeply and pull the receipts (was “Stringer”).' },
  { href: '/command/formats', label: 'FORMATS', icon: Shapes, tip: 'Show formats (panel, debate, news desk, kids news) and how many seats each needs.' },
  { href: '/command/sources', label: 'SOURCES', icon: Radio, tip: 'The Twitter + YouTube accounts each show watches. Verify and prioritize them.' },
  { href: '/command/people', label: 'PEOPLE', icon: UserRound, tip: 'Real people tied to a show (delegates) and their private drop-in links.' },
  { href: '/command/cast', label: 'CAST', icon: Users, tip: 'Your hosts + the voice/face library: rotate, hear, copy, and generate faces.' },
  { href: '/command/branding', label: 'BRANDING', icon: Palette, tip: 'A logo for every show: it reads the show and draws 3 options, pick one or upload your own.' },
  { href: '/command/producer', label: 'PRODUCER', icon: Clapperboard, tip: 'Assemble and run a full show from the day’s story.' },
  { href: '/command/tape', label: 'TAPE', icon: PlayCircle, tip: 'Rendered shows and takes — listen back (and delete, soon).' },
  { href: '/command/janitor', label: 'JANITOR', icon: Wrench, tip: 'The maintenance crew: audits your sources (dead/squatter/silent) and proposes fixes to approve.' },
  { href: '/command/log', label: 'LOG', icon: ScrollText, tip: 'The activity log — every action the system took, with timing.' },
  { href: '/command/settings', label: 'SETTINGS', icon: Settings, tip: 'API keys and the model lineup.' },
]

export function CommandNav() {
  const path = usePathname()
  return (
    <nav className="cmd-rail py-2">
      {ITEMS.map(it => {
        const active = it.href === '/command' ? path === '/command' : path.startsWith(it.href)
        const Icon = it.icon
        return (
          <Link key={it.href} href={it.href} className={active ? 'active' : ''} title={it.tip}>
            <Icon size={14} strokeWidth={2} />
            {it.label}
          </Link>
        )
      })}
    </nav>
  )
}
