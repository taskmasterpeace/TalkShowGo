'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Radio, Users, Clapperboard, PlayCircle, Shapes, Search, Radar, ScrollText, GitBranch, MonitorPlay, UserRound, Wrench, Settings } from 'lucide-react'

// round 3 (2026-09-02): YOUTUBE (rung health, transcripts, clips), PEOPLE (delegates on a beat + their take links),
// JANITOR (the ecosystem's decisions), SETTINGS (in-app keys + the model lineup)
const ITEMS = [
  { href: '/command', label: 'DESK', icon: LayoutGrid },
  { href: '/command/discovery', label: 'DISCOVERY', icon: Radar },
  { href: '/command/dataflow', label: 'DATAFLOW', icon: GitBranch },
  { href: '/command/youtube', label: 'YOUTUBE', icon: MonitorPlay },
  { href: '/command/stringer', label: 'STRINGER', icon: Search },
  { href: '/command/formats', label: 'FORMATS', icon: Shapes },
  { href: '/command/sources', label: 'SOURCES', icon: Radio },
  { href: '/command/people', label: 'PEOPLE', icon: UserRound },
  { href: '/command/cast', label: 'CAST', icon: Users },
  { href: '/command/producer', label: 'PRODUCER', icon: Clapperboard },
  { href: '/command/tape', label: 'TAPE', icon: PlayCircle },
  { href: '/command/janitor', label: 'JANITOR', icon: Wrench },
  { href: '/command/log', label: 'LOG', icon: ScrollText },
  { href: '/command/settings', label: 'SETTINGS', icon: Settings },
]

export function CommandNav() {
  const path = usePathname()
  return (
    <nav className="cmd-rail py-2">
      {ITEMS.map(it => {
        const active = it.href === '/command' ? path === '/command' : path.startsWith(it.href)
        const Icon = it.icon
        return (
          <Link key={it.href} href={it.href} className={active ? 'active' : ''}>
            <Icon size={14} strokeWidth={2} />
            {it.label}
          </Link>
        )
      })}
    </nav>
  )
}
