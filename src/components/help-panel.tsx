'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { X, HelpCircle, ChevronRight, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getHelpForPath, type PageHelp } from '@/lib/help-content'
import { cn } from '@/lib/utils'

interface HelpPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function HelpPanel({ isOpen, onClose }: HelpPanelProps) {
  const pathname = usePathname()
  const [help, setHelp] = useState<PageHelp | null>(null)

  useEffect(() => {
    const pageHelp = getHelpForPath(pathname)
    setHelp(pageHelp)
  }, [pathname])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={cn(
        'fixed right-0 top-0 h-full w-96 bg-background border-l-2 border-foreground z-50',
        'transform transition-transform duration-300 ease-out',
        'overflow-y-auto shadow-lg'
      )}>
        {/* Header */}
        <div className="sticky top-0 bg-background border-b-2 border-foreground p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <h2 className="font-head text-lg">Help</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {help ? (
            <>
              {/* Title & Description */}
              <div>
                <h3 className="font-head text-xl mb-2">{help.title}</h3>
                <p className="text-sm text-muted-foreground">{help.description}</p>
              </div>

              {/* Steps */}
              {help.steps && help.steps.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm uppercase text-muted-foreground mb-3">
                    How to Use
                  </h4>
                  <ol className="space-y-2">
                    {help.steps.map((step, index) => (
                      <li key={index} className="flex gap-3 text-sm">
                        <span className="flex-shrink-0 w-6 h-6 border-2 border-foreground bg-primary/10 flex items-center justify-center font-semibold text-xs">
                          {index + 1}
                        </span>
                        <span className="pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Tips */}
              {help.tips && help.tips.length > 0 && (
                <div className="bg-muted/50 border-2 border-foreground/10 p-4">
                  <h4 className="font-semibold text-sm uppercase text-muted-foreground mb-3">
                    Pro Tips
                  </h4>
                  <ul className="space-y-2">
                    {help.tips.map((tip, index) => (
                      <li key={index} className="flex gap-2 text-sm">
                        <span className="text-primary">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quick Actions */}
              {help.quickActions && help.quickActions.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm uppercase text-muted-foreground mb-3">
                    Quick Actions
                  </h4>
                  <div className="space-y-2">
                    {help.quickActions.map((action, index) => (
                      <a
                        key={index}
                        href={action.href}
                        className="flex items-center justify-between p-3 border-2 border-foreground/20 hover:border-foreground hover:bg-muted/50 transition-colors group"
                      >
                        <div>
                          <p className="font-medium text-sm">{action.label}</p>
                          <p className="text-xs text-muted-foreground">{action.description}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No help available for this page</p>
              <p className="text-sm mt-2">
                Try navigating to a main feature page
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="pt-4 border-t border-foreground/10">
            <p className="text-xs text-muted-foreground text-center">
              Need more help?{' '}
              <a href="https://github.com/anthropics/claude-code/issues" className="text-primary hover:underline">
                Report an issue
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * Help Button - Trigger for opening the help panel
 */
export function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="gap-1"
    >
      <HelpCircle className="h-4 w-4" />
      <span className="sr-only md:not-sr-only">Help</span>
    </Button>
  )
}
