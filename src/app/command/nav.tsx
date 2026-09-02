'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, Radio, Users, Clapperboard, PlayCircle, Shapes, Search, Radar, ScrollText } from 'lucide-react'

const ITEMS = [
  { href: '/command', label: 'DESK', icon: LayoutGrid },
  { href: '/command/discovery', label: 'DISCOVERY', icon: Radar },
  { href: '/command/stringer', label: 'STRINGER', icon: Search },
  { href: '/command/formats', label: 'FORMATS', icon: Shapes },
  { href: '/command/sources', label: 'SOURCES', icon: Radio },
  { href: '/command/cast', label: 'CAST', icon: Users },
  { href: '/command/producer', label: 'PRODUCER', icon: Clapperboard },
  { href: '/command/tape', label: 'TAPE', icon: PlayCircle },
  { href: '/command/log', label: 'LOG', icon: ScrollText },
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
