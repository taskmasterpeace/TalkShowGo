/**
 * RSS Feeds Configuration
 *
 * Default RSS feeds for news aggregation.
 * These are free, reliable feeds from major news sources.
 */

export interface RSSFeedConfig {
  name: string
  url: string
  category: string
  priority: number  // Higher = more important
}

/**
 * Global News Feeds (High-Signal)
 */
export const GLOBAL_NEWS_FEEDS: RSSFeedConfig[] = [
  {
    name: 'BBC World News',
    url: 'http://feeds.bbci.co.uk/news/world/rss.xml',
    category: 'global',
    priority: 10,
  },
  {
    name: 'Reuters World',
    url: 'https://www.reutersagency.com/feed/?best-topics=world',
    category: 'global',
    priority: 10,
  },
  {
    name: 'CNN Top Stories',
    url: 'http://rss.cnn.com/rss/edition.rss',
    category: 'global',
    priority: 9,
  },
  {
    name: 'NPR News',
    url: 'https://feeds.npr.org/1001/rss.xml',
    category: 'global',
    priority: 9,
  },
  {
    name: 'AP News',
    url: 'https://feedx.net/rss/ap.xml',
    category: 'global',
    priority: 10,
  },
]

/**
 * Technology Feeds
 */
export const TECH_FEEDS: RSSFeedConfig[] = [
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    category: 'tech',
    priority: 9,
  },
  {
    name: 'Ars Technica',
    url: 'https://feeds.arstechnica.com/arstechnica/index',
    category: 'tech',
    priority: 9,
  },
  {
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
    category: 'tech',
    priority: 8,
  },
  {
    name: 'Wired',
    url: 'https://www.wired.com/feed/rss',
    category: 'tech',
    priority: 8,
  },
  {
    name: 'Hacker News',
    url: 'https://hnrss.org/frontpage',
    category: 'tech',
    priority: 7,
  },
]

/**
 * Entertainment Feeds
 */
export const ENTERTAINMENT_FEEDS: RSSFeedConfig[] = [
  {
    name: 'Variety',
    url: 'https://variety.com/feed/',
    category: 'entertainment',
    priority: 9,
  },
  {
    name: 'The Hollywood Reporter',
    url: 'https://www.hollywoodreporter.com/feed/',
    category: 'entertainment',
    priority: 9,
  },
  {
    name: 'Entertainment Weekly',
    url: 'https://ew.com/feed/',
    category: 'entertainment',
    priority: 8,
  },
  {
    name: 'Billboard',
    url: 'https://www.billboard.com/feed/',
    category: 'entertainment',
    priority: 8,
  },
]

/**
 * Sports Feeds
 */
export const SPORTS_FEEDS: RSSFeedConfig[] = [
  {
    name: 'ESPN',
    url: 'https://www.espn.com/espn/rss/news',
    category: 'sports',
    priority: 10,
  },
  {
    name: 'BBC Sport',
    url: 'http://feeds.bbci.co.uk/sport/rss.xml',
    category: 'sports',
    priority: 9,
  },
  {
    name: 'Sports Illustrated',
    url: 'https://www.si.com/rss/si_topstories.rss',
    category: 'sports',
    priority: 8,
  },
]

/**
 * Business Feeds
 */
export const BUSINESS_FEEDS: RSSFeedConfig[] = [
  {
    name: 'Bloomberg',
    url: 'https://feeds.bloomberg.com/markets/news.rss',
    category: 'business',
    priority: 10,
  },
  {
    name: 'CNBC',
    url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    category: 'business',
    priority: 9,
  },
  {
    name: 'Financial Times',
    url: 'https://www.ft.com/rss/home',
    category: 'business',
    priority: 9,
  },
]

/**
 * Science Feeds
 */
export const SCIENCE_FEEDS: RSSFeedConfig[] = [
  {
    name: 'Scientific American',
    url: 'http://rss.sciam.com/ScientificAmerican-Global',
    category: 'science',
    priority: 9,
  },
  {
    name: 'Nature',
    url: 'https://www.nature.com/nature.rss',
    category: 'science',
    priority: 10,
  },
  {
    name: 'Science Daily',
    url: 'https://www.sciencedaily.com/rss/all.xml',
    category: 'science',
    priority: 8,
  },
]

/**
 * Hip-Hop / Urban Culture Feeds
 * (Relevant for battle rap niche)
 */
export const HIPHOP_FEEDS: RSSFeedConfig[] = [
  {
    name: 'Complex Hip-Hop',
    url: 'https://www.complex.com/music/rss',
    category: 'hiphop',
    priority: 9,
  },
  {
    name: 'HipHopDX',
    url: 'https://hiphopdx.com/feed',
    category: 'hiphop',
    priority: 9,
  },
  {
    name: 'XXL Magazine',
    url: 'https://www.xxlmag.com/feed/',
    category: 'hiphop',
    priority: 8,
  },
  {
    name: 'Pitchfork Hip-Hop',
    url: 'https://pitchfork.com/rss/reviews/albums/',
    category: 'hiphop',
    priority: 7,
  },
]

/**
 * All feeds by category
 */
export const RSS_FEEDS_BY_CATEGORY = {
  global: GLOBAL_NEWS_FEEDS,
  tech: TECH_FEEDS,
  entertainment: ENTERTAINMENT_FEEDS,
  sports: SPORTS_FEEDS,
  business: BUSINESS_FEEDS,
  science: SCIENCE_FEEDS,
  hiphop: HIPHOP_FEEDS,
}

/**
 * Default feeds to use when no category is specified
 * Includes top feeds from each major category
 */
export const DEFAULT_RSS_FEEDS: RSSFeedConfig[] = [
  // Top global news
  ...GLOBAL_NEWS_FEEDS.filter(f => f.priority >= 9),
  // Top tech
  ...TECH_FEEDS.filter(f => f.priority >= 9).slice(0, 2),
  // Top entertainment
  ...ENTERTAINMENT_FEEDS.filter(f => f.priority >= 9).slice(0, 2),
]

/**
 * Get all configured feeds
 */
export function getAllFeeds(): RSSFeedConfig[] {
  return Object.values(RSS_FEEDS_BY_CATEGORY).flat()
}

/**
 * Get feeds for a specific category
 */
export function getFeedsForCategory(category: string): RSSFeedConfig[] {
  return RSS_FEEDS_BY_CATEGORY[category as keyof typeof RSS_FEEDS_BY_CATEGORY] || []
}

/**
 * Get feed count summary
 */
export function getFeedSummary(): {
  total: number
  byCategory: Record<string, number>
} {
  const byCategory: Record<string, number> = {}

  for (const [category, feeds] of Object.entries(RSS_FEEDS_BY_CATEGORY)) {
    byCategory[category] = feeds.length
  }

  return {
    total: getAllFeeds().length,
    byCategory,
  }
}
