'use client'

import { TopicProvider } from '@/context/topic-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TopicProvider>
      {children}
    </TopicProvider>
  )
}
