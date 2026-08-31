import { Big_Shoulders_Display, JetBrains_Mono } from 'next/font/google'
import './command.css'
import { CommandNav } from './nav'

const display = Big_Shoulders_Display({ weight: ['700', '900'], subsets: ['latin'], variable: '--font-cmd-display', display: 'swap' })
const mono = JetBrains_Mono({ weight: ['400', '500', '700'], subsets: ['latin'], variable: '--font-cmd-mono', display: 'swap' })

export const metadata = { title: 'TSG COMMAND' }

export default function CommandLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`tsg-command ${display.variable} ${mono.variable}`}>
      <div className="flex min-h-screen">
        <aside className="w-52 shrink-0 border-r" style={{ borderColor: 'var(--cmd-line)' }}>
          <div className="p-4 border-b" style={{ borderColor: 'var(--cmd-line)' }}>
            <div className="cmd-display text-xl leading-none" style={{ letterSpacing: '0.08em' }}>TSG</div>
            <div className="cmd-display text-xl leading-none" style={{ color: 'var(--cmd-red)', letterSpacing: '0.08em' }}>COMMAND</div>
            <div className="cmd-kbd mt-2">SHOW-MAKER CONTROL</div>
          </div>
          <CommandNav />
          <div className="p-4 mt-auto">
            <div className="onair"><i />MANUAL</div>
          </div>
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  )
}
