'use client'
// THE MASTER SWITCHER — one place, top of every page, to move between shows. Each show wears its own logo;
// the bar scrolls so it holds ANY number of shows (not a fixed row that runs out). Picking here swaps the
// whole app to that show (its sources, YouTube, people, research) via the shared reactive selection.
import { useEffect, useState } from 'react'
import { useCmdState, useBeat } from './lib'

const slugify = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function ShowSwitcher() {
  const { state } = useCmdState()
  const { beat, beats, pick } = useBeat(state)
  const [picks, setPicks] = useState<Record<string, number>>({})
  useEffect(() => {
    fetch('/api/command/logo').then(r => r.json()).then(j => { const m: Record<string, number> = {}; for (const s of (j.roster || [])) if (s.locked) m[s.slug] = s.locked; setPicks(m) }).catch(() => {})
  }, [])
  // templates are scaffolding, not shows - keep them out of the switcher
  const shows = beats.filter((b: any) => !b.template && !/template/i.test(String(b.file || b.id || '')))
  if (!shows.length) return null
  // prefer the transparent cutout, fall back to the plain logo, then a monogram (not every logo has an _alpha)
  const logoUrl = (b: any) => { const slug = slugify(b.show?.name || b.name || b.id); const v = picks[slug]; return v ? { alpha: `/api/command/audio/logos/${slug}_${v}_alpha.png`, plain: `/api/command/audio/logos/${slug}_${v}.png` } : null }

  return (
    <div style={S.bar}>
      <span style={S.rail}>SHOWS</span>
      <div style={S.scroll}>
        {shows.map(b => {
          const active = beat?.file === b.file
          const name = String(b.show?.name || b.name || b.id)
          const logo = logoUrl(b)
          return (
            <button key={b.file} onClick={() => pick(b.file)} title={name} style={{ ...S.tab, ...(active ? S.tabOn : {}) }}>
              <span style={{ ...S.badge, ...(active ? S.badgeOn : {}) }}>
                {logo
                  ? <img src={logo.alpha} alt="" style={S.logo} data-fb={logo.plain} onError={e => { const t = e.target as HTMLImageElement; const fb = t.getAttribute('data-fb'); if (fb && !t.src.endsWith(fb)) { t.removeAttribute('data-fb'); t.src = fb } else { t.style.display = 'none'; const m = t.nextElementSibling as HTMLElement; if (m) m.style.display = 'flex' } }} />
                  : null}
                <span style={{ ...S.mono, display: logo ? 'none' : 'flex' }}>{name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '??'}</span>
              </span>
              <span style={{ ...S.name, ...(active ? S.nameOn : {}) }}>{name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  bar: { display: 'flex', alignItems: 'stretch', gap: '.5rem', borderBottom: '1px solid var(--cmd-line)', background: 'var(--cmd-bg2, #14110d)', padding: '.5rem .75rem', position: 'sticky', top: 0, zIndex: 20 },
  rail: { alignSelf: 'center', fontFamily: 'var(--font-cmd-mono), monospace', fontSize: '.62rem', letterSpacing: '.25em', color: 'var(--cmd-dim, #8a7f6f)', padding: '0 .5rem 0 0', borderRight: '1px solid var(--cmd-line)' },
  scroll: { display: 'flex', gap: '.4rem', overflowX: 'auto', flex: 1, scrollbarWidth: 'thin' },
  tab: { display: 'flex', alignItems: 'center', gap: '.5rem', flex: '0 0 auto', padding: '.35rem .7rem .35rem .4rem', background: 'transparent', border: '1px solid transparent', borderRadius: '.5rem', cursor: 'pointer', color: 'var(--cmd-dim, #9a8f7f)', maxWidth: '15rem' },
  tabOn: { background: 'color-mix(in oklch, var(--cmd-red) 14%, transparent)', border: '1px solid var(--cmd-red)' },
  badge: { width: '2rem', height: '2rem', flex: '0 0 auto', borderRadius: '.4rem', background: '#0d0b08', border: '1px solid var(--cmd-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  badgeOn: { borderColor: 'var(--cmd-red)' },
  logo: { width: '100%', height: '100%', objectFit: 'contain' },
  mono: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-cmd-display), sans-serif', fontWeight: 900, fontSize: '.8rem', color: 'var(--cmd-amber, #d9a441)' },
  name: { fontFamily: 'var(--font-cmd-display), sans-serif', fontWeight: 700, fontSize: '.82rem', letterSpacing: '.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  nameOn: { color: 'var(--cmd-ink, #f3ece0)' },
}
