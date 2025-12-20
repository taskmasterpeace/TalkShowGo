import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

export function formatDate(date: Date | string): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatRelativeTime(date: Date | string): string {
  const d = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(date)
}

export function getCredibilityTier(score: number): {
  label: string
  color: string
} {
  if (score >= 0.8) return { label: 'High', color: 'success' }
  if (score >= 0.6) return { label: 'Medium', color: 'warning' }
  if (score >= 0.4) return { label: 'Low', color: 'muted' }
  return { label: 'Unknown', color: 'destructive' }
}

export function getVerdictColor(verdict: string): string {
  switch (verdict) {
    case 'confirmed':
      return 'success'
    case 'likely':
      return 'primary'
    case 'uncertain':
      return 'warning'
    case 'disputed':
      return 'destructive'
    case 'debunked':
      return 'destructive'
    default:
      return 'muted'
  }
}

export function getBucketColor(bucket: string): string {
  switch (bucket) {
    case 'breaking':
      return 'destructive'
    case 'developing':
      return 'warning'
    case 'recurring':
      return 'primary'
    case 'feature':
      return 'success'
    case 'background':
      return 'muted'
    default:
      return 'secondary'
  }
}
