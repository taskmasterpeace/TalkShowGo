'use client'

import { Bell, Search } from 'lucide-react'
import { Button, Input, Badge, Avatar, AvatarFallback } from '@/components/ui'
import { TopicSelector } from '@/components/topic-selector'

interface TopbarProps {
  topicName?: string // Deprecated - now uses context
}

export function Topbar({ topicName }: TopbarProps) {
  return (
    <header className="flex items-center justify-between h-14 px-4 border-b-2 border-foreground bg-background">
      {/* Left side - Topic selector */}
      <div className="flex items-center gap-4">
        <TopicSelector />
        <Badge variant="success" size="sm">
          Active
        </Badge>
      </div>

      {/* Center - Search */}
      <div className="flex-1 max-w-md mx-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search entities, claims, stories..."
            className="pl-10 h-9"
          />
        </div>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" className="relative gap-2 px-4 h-10">
          <Bell className="h-5 w-5" />
          <span className="font-semibold">Notifications</span>
          <span className="ml-1 h-6 w-6 bg-destructive text-destructive-foreground text-sm font-bold flex items-center justify-center border-2 border-foreground">
            3
          </span>
        </Button>
        <Avatar className="h-10 w-10 border-2 border-foreground">
          <AvatarFallback className="font-bold">CK</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
