'use client'

import * as React from 'react'
import { HelpCircle } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip'
import { cn } from '@/lib/utils'

interface HelpTooltipProps {
  title: string
  content: string
  learnMoreUrl?: string
  className?: string
  iconClassName?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}

/**
 * HelpTooltip - Contextual help component for explaining UI elements
 *
 * Usage:
 * <HelpTooltip
 *   title="What is this?"
 *   content="This feature helps you..."
 *   learnMoreUrl="/docs/feature"
 * />
 */
export function HelpTooltip({
  title,
  content,
  learnMoreUrl,
  className,
  iconClassName,
  side = 'top'
}: HelpTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center justify-center rounded-full hover:bg-muted p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary',
              className
            )}
          >
            <HelpCircle className={cn('h-4 w-4 text-muted-foreground', iconClassName)} />
            <span className="sr-only">Help</span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-xs bg-background text-foreground border-2 border-foreground p-3"
        >
          <div className="space-y-1">
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{content}</p>
            {learnMoreUrl && (
              <a
                href={learnMoreUrl}
                className="text-primary text-xs hover:underline inline-block mt-1"
              >
                Learn more →
              </a>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * InfoBanner - Larger help section for page-level explanations
 */
interface InfoBannerProps {
  title: string
  description: string
  steps?: string[]
  tips?: string[]
  className?: string
  dismissible?: boolean
  onDismiss?: () => void
}

export function InfoBanner({
  title,
  description,
  steps,
  tips,
  className,
  dismissible = false,
  onDismiss,
}: InfoBannerProps) {
  const [dismissed, setDismissed] = React.useState(false)

  if (dismissed) return null

  return (
    <div className={cn(
      'border-2 border-foreground bg-muted/50 p-4 brutal-shadow',
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <HelpCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>

            {steps && steps.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-2">How to use:</p>
                <ol className="text-sm space-y-1 list-decimal list-inside">
                  {steps.map((step, i) => (
                    <li key={i} className="text-muted-foreground">{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {tips && tips.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Tips:</p>
                <ul className="text-sm space-y-1 list-disc list-inside">
                  {tips.map((tip, i) => (
                    <li key={i} className="text-muted-foreground">{tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {dismissible && (
          <button
            onClick={() => {
              setDismissed(true)
              onDismiss?.()
            }}
            className="text-muted-foreground hover:text-foreground p-1"
          >
            <span className="sr-only">Dismiss</span>
            ×
          </button>
        )}
      </div>
    </div>
  )
}
