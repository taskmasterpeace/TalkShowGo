'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import {
  Radar,
  Target,
  Network,
  Shield,
  Newspaper,
  CheckCircle,
  Send,
  Users,
  Settings,
  Crown,
  Activity,
  FileText,
  HeartPulse,
  HelpCircle,
  Film,
  Mic,
  Brain,
  Workflow,
  Volume2,
  Twitter,
  BookOpen,
  Rocket,
  FileStack,
  Radio,
  Key,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  {
    name: 'Command Center',
    href: '/',
    icon: Radio,
    description: 'Dashboard overview',
  },
  {
    name: 'OUTPOST',
    href: '/outpost',
    icon: Target,
    description: 'Topics & Sources',
  },
  {
    name: 'PERIMETER',
    href: '/perimeter',
    icon: Radar,
    description: 'Signal Monitor',
  },
  {
    name: 'EXTRACTION',
    href: '/extraction',
    icon: Network,
    description: 'Entity Map',
  },
  {
    name: 'AUDIT',
    href: '/audit',
    icon: Shield,
    description: 'Credibility Ledger',
  },
  {
    name: 'TRIBUNAL',
    href: '/tribunal',
    icon: Users,
    description: 'Nominations',
  },
  {
    name: 'NEXUS',
    href: '/nexus',
    icon: Newspaper,
    description: 'Story Desk',
  },
  {
    name: 'SANCTION',
    href: '/sanction',
    icon: CheckCircle,
    description: 'Story Workbench',
  },
  {
    name: 'SIGNAL',
    href: '/signal',
    icon: Send,
    description: 'Export Center',
  },
]

const secondaryNavigation = [
  {
    name: 'Studio',
    href: '/studio',
    icon: Film,
    description: 'Hosts & Producers',
  },
  {
    name: 'Hosts',
    href: '/studio/hosts',
    icon: Mic,
    description: 'Meet the voices',
    indent: true,
  },
  {
    name: 'Voices',
    href: '/studio/voices',
    icon: Volume2,
    description: 'Voice Library',
    indent: true,
  },
  {
    name: 'Preview',
    href: '/studio/preview',
    icon: Volume2,
    description: 'Listen to samples',
    indent: true,
  },
  {
    name: 'Source Pool',
    href: '/studio/sources',
    icon: Twitter,
    description: 'Compare sources',
    indent: true,
  },
  {
    name: 'Entities',
    href: '/studio/entities',
    icon: Users,
    description: 'Entity context',
    indent: true,
  },
  {
    name: 'Research',
    href: '/studio/research',
    icon: Brain,
    description: 'Chat with data',
    indent: true,
  },
  {
    name: 'Templates',
    href: '/studio/templates',
    icon: FileStack,
    description: 'Show templates',
    indent: true,
  },
  {
    name: 'Producer',
    href: '/studio/producer',
    icon: Brain,
    description: 'Research & stories',
    indent: true,
  },
  {
    name: 'Daily Show',
    href: '/studio/daily-show',
    icon: Radio,
    description: 'Create shows',
    indent: true,
  },
  {
    name: 'Prompts',
    href: '/studio/prompts',
    icon: FileText,
    description: 'Prompt registry',
    indent: true,
  },
  {
    name: 'Settings',
    href: '/studio/settings',
    icon: Settings,
    description: 'Studio settings',
    indent: true,
  },
  {
    name: 'Workflows',
    href: '/studio/workflows',
    icon: Workflow,
    description: 'Schedule tasks',
    indent: true,
  },
  {
    name: 'Health',
    href: '/health',
    icon: HeartPulse,
    description: 'System Health',
  },
  {
    name: 'Notes',
    href: '/notes',
    icon: FileText,
    description: 'Memory & Notes',
  },
  {
    name: 'Jobs',
    href: '/jobs',
    icon: Activity,
    description: 'Pipeline Status',
  },
  {
    name: 'Config',
    href: '/settings/usage',
    icon: Settings,
    description: 'Usage & Config',
  },
  {
    name: 'API Keys',
    href: '/settings/api-keys',
    icon: Key,
    description: 'Manage API Keys',
    indent: true,
  },
  {
    name: 'Guide',
    href: '/guide',
    icon: BookOpen,
    description: 'User Guide',
  },
  {
    name: 'Manual',
    href: '/guide/manual',
    icon: FileText,
    description: 'Full Documentation',
    indent: true,
  },
  {
    name: 'Onboarding',
    href: '/onboarding',
    icon: Rocket,
    description: 'Setup Wizard',
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full w-64 border-r-2 border-foreground bg-background">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b-2 border-foreground">
        <Image
          src="/logo.svg"
          alt="TalkShowGo"
          width={40}
          height={48}
          className="text-foreground"
        />
        <div>
          <h1 className="font-head text-xl leading-none tracking-tight">TalkShowGo</h1>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        <div className="mb-2 px-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Operations
          </span>
        </div>
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-sm font-medium transition-all border-2',
                isActive
                  ? 'bg-primary text-primary-foreground border-foreground brutal-shadow-sm'
                  : 'border-transparent hover:bg-muted hover:border-foreground'
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate">{item.name}</div>
                <div className="text-xs opacity-70 truncate">{item.description}</div>
              </div>
            </Link>
          )
        })}

        <div className="mt-6 mb-2 px-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            System
          </span>
        </div>
        {secondaryNavigation.map((item) => {
          const isActive = pathname === item.href
          const isIndented = 'indent' in item && item.indent
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-sm font-medium transition-all border-2',
                isIndented && 'ml-4 text-xs',
                isActive
                  ? 'bg-secondary text-secondary-foreground border-foreground brutal-shadow-sm'
                  : 'border-transparent hover:bg-muted hover:border-foreground'
              )}
            >
              <item.icon className={cn('flex-shrink-0', isIndented ? 'h-4 w-4' : 'h-5 w-5')} />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* Status indicator */}
      <div className="px-4 py-3 border-t-2 border-foreground">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 bg-success rounded-full animate-pulse" />
          <span className="text-xs text-muted-foreground">System Online</span>
        </div>
      </div>
    </div>
  )
}
