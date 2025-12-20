'use client'

import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

interface AppShellProps {
  children: React.ReactNode
  topicName?: string
}

export function AppShell({ children, topicName }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar topicName={topicName} />
        <main className="flex-1 overflow-y-auto p-6 bg-muted/30">
          {children}
        </main>
      </div>
    </div>
  )
}
