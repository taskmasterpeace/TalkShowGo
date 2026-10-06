/**
 * Unified TimeRange System
 *
 * Single source of truth for time filtering across all data sources.
 * Set hours_back once in topic settings, applies to YouTube, Twitter, RSS, etc.
 */

export interface TimeRange {
  hours_back: number
  start_date: Date
  end_date: Date
}

export interface TimeRangeConfig {
  default_hours_back: number
  max_hours_back: number
  freshness_priority: 'strict' | 'relaxed'
}

// Default configuration
export const DEFAULT_TIME_CONFIG: TimeRangeConfig = {
  default_hours_back: 48,
  max_hours_back: 168, // 7 days
  freshness_priority: 'strict',
}

/**
 * Create a TimeRange from hours_back value
 */
export function createTimeRange(hoursBack: number, config?: Partial<TimeRangeConfig>): TimeRange {
  const mergedConfig = { ...DEFAULT_TIME_CONFIG, ...config }

  // Clamp to max
  const effectiveHours = Math.min(hoursBack, mergedConfig.max_hours_back)

  const now = new Date()
  const startDate = new Date(now.getTime() - effectiveHours * 60 * 60 * 1000)

  return {
    hours_back: effectiveHours,
    start_date: startDate,
    end_date: now,
  }
}

/**
 * Check if a date is within the time range
 */
export function isWithinTimeRange(date: Date | string | null | undefined, range: TimeRange): boolean {
  if (!date) return false

  const dateObj = typeof date === 'string' ? new Date(date) : date

  if (isNaN(dateObj.getTime())) return false

  return dateObj >= range.start_date && dateObj <= range.end_date
}

/**
 * Filter items by time range
 * Generic function that works with any item type
 */
export function applyTimeFilter<T>(
  items: T[],
  getDate: (item: T) => Date | string | null | undefined,
  range: TimeRange
): T[] {
  return items.filter((item) => isWithinTimeRange(getDate(item), range))
}

/**
 * Sort items by date (newest first)
 */
export function sortByDate<T>(
  items: T[],
  getDate: (item: T) => Date | string | null | undefined,
  order: 'asc' | 'desc' = 'desc'
): T[] {
  return [...items].sort((a, b) => {
    const dateA = getDate(a)
    const dateB = getDate(b)

    const timeA = dateA ? new Date(dateA).getTime() : 0
    const timeB = dateB ? new Date(dateB).getTime() : 0

    return order === 'desc' ? timeB - timeA : timeA - timeB
  })
}

/**
 * Get a human-readable description of the time range
 */
export function describeTimeRange(range: TimeRange): string {
  if (range.hours_back <= 24) {
    return `last ${range.hours_back} hours`
  } else if (range.hours_back <= 168) {
    const days = Math.round(range.hours_back / 24)
    return `last ${days} day${days === 1 ? '' : 's'}`
  } else {
    const weeks = Math.round(range.hours_back / 168)
    return `last ${weeks} week${weeks === 1 ? '' : 's'}`
  }
}

/**
 * Parse relative time strings like "1 hour ago", "3 days ago"
 * Returns null if parsing fails
 */
export function parseRelativeTime(relativeStr: string): Date | null {
  const now = new Date()
  const lower = relativeStr.toLowerCase().trim()

  // Try to match patterns
  const patterns = [
    { regex: /(\d+)\s*second/i, multiplier: 1000 },
    { regex: /(\d+)\s*minute/i, multiplier: 60 * 1000 },
    { regex: /(\d+)\s*hour/i, multiplier: 60 * 60 * 1000 },
    { regex: /(\d+)\s*day/i, multiplier: 24 * 60 * 60 * 1000 },
    { regex: /(\d+)\s*week/i, multiplier: 7 * 24 * 60 * 60 * 1000 },
    { regex: /(\d+)\s*month/i, multiplier: 30 * 24 * 60 * 60 * 1000 },
    { regex: /(\d+)\s*year/i, multiplier: 365 * 24 * 60 * 60 * 1000 },
  ]

  for (const { regex, multiplier } of patterns) {
    const match = lower.match(regex)
    if (match) {
      const value = parseInt(match[1], 10)
      return new Date(now.getTime() - value * multiplier)
    }
  }

  // Handle "Streamed X ago" format
  if (lower.includes('stream')) {
    const cleaned = lower.replace(/streamed?\s+/i, '')
    return parseRelativeTime(cleaned)
  }

  return null
}

/**
 * Convert ISO date string to Date, with fallback to relative time parsing
 */
export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null

  // Try ISO format first
  const isoDate = new Date(dateStr)
  if (!isNaN(isoDate.getTime())) {
    return isoDate
  }

  // Fall back to relative time parsing
  return parseRelativeTime(dateStr)
}

/**
 * Get time range for YouTube Data API (publishedAfter parameter)
 * Returns RFC 3339 format required by YouTube API
 */
export function toYouTubeApiFormat(range: TimeRange): { publishedAfter: string; publishedBefore?: string } {
  return {
    publishedAfter: range.start_date.toISOString(),
  }
}

/**
 * Get time range for Twitter API (since parameter)
 * Returns ISO format for Twitter API
 */
export function toTwitterApiFormat(range: TimeRange): { since: string } {
  return {
    since: range.start_date.toISOString(),
  }
}
