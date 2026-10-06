/**
 * Algorithm Institute Show - CORRECT WORKFLOW
 * 1. Get Twitter data to see what's being talked about
 * 2. Search YouTube for those topics
 * 3. Get transcripts
 * 4. Generate story in Algorithm Institute style
 */

import pg from 'pg'
import { Innertube } from 'youtubei.js'
import fetch from 'node-fetch'

const { Client } = pg

// Connect to database
const db = new Client({
  host: '127.0.0.1',
  port: 5432,
  database: 'talkshowgo',
  user: 'postgres',
  password: 'postgres'
})

await db.connect()

console.log('=== ALGORITHM INSTITUTE: Last 48 Hours ===\n')

// Step 1: Get recent tweets to find what's being talked about
console.log('[STEP 1] Checking Twitter for trending topics...\n')

const tweetsResult = await db.query(
  `SELECT author_handle, text, tweet_created_at, metrics_likes, metrics_retweets
   FROM tweets_raw
   WHERE topic_id = '864dbcf4-e1f7-4b1a-86ed-c18007439ad5'
   AND tweet_created_at > NOW() - INTERVAL '10 days'
   ORDER BY tweet_created_at DESC
   LIMIT 50`
)

console.log(`Found ${tweetsResult.rows.length} recent tweets`)

if (tweetsResult.rows.length === 0) {
  console.log('\n⚠️  No recent tweets in database. Need to run Twitter fetch job.')
  console.log('Run: POST /api/jobs/relay_fetch/trigger with topic_id')
  process.exit(0)
}

// Extract topics being discussed
const topics = new Map()
const mentions = new Map()

tweetsResult.rows.forEach(tweet => {
  const text = tweet.text.toLowerCase()

  // Count mentions of battlers/entities
  const words = text.split(/\s+/)
  words.forEach(word => {
    if (word.startsWith('@')) {
      const handle = word.slice(1)
      mentions.set(handle, (mentions.get(handle) || 0) + 1)
    }
  })

  // Look for common battle rap keywords
  const keywords = ['battle', 'vs', 'versus', 'choke', 'url', 'kotd', 'rbe', 'clash', 'caffeine']
  keywords.forEach(keyword => {
    if (text.includes(keyword)) {
      topics.set(keyword, (topics.get(keyword) || 0) + 1)
    }
  })
})

console.log('\nTop mentioned handles:')
Array.from(mentions.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([handle, count]) => {
    console.log(`  @${handle}: ${count} mentions`)
  })

console.log('\nTop keywords:')
Array.from(topics.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([keyword, count]) => {
    console.log(`  ${keyword}: ${count} mentions`)
  })

// Step 2: Search YouTube for the hot topics
console.log('\n[STEP 2] Searching YouTube for trending topics...\n')

const youtube = await Innertube.create()
const searchQueries = []

// Build search queries from top mentions
const topMentions = Array.from(mentions.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .map(([handle]) => handle)

// Search for top mentioned people
for (const handle of topMentions) {
  searchQueries.push(`${handle} battle rap`)
}

// Also search for general battle rap news
searchQueries.push('battle rap news')
searchQueries.push('battle rap drama')

const allVideos = []

for (const query of searchQueries) {
  try {
    console.log(`Searching: "${query}"`)
    const results = await youtube.search(query, {
      type: 'video'
    })

    const videos = results.videos.slice(0, 3)
    videos.forEach(video => {
      allVideos.push({
        id: video.id,
        title: video.title.text,
        channel: video.author.name,
        published: video.published.text,
        views: video.view_count?.text || 'N/A'
      })
      console.log(`  ✓ ${video.title.text} (${video.author.name})`)
    })
  } catch (error) {
    console.error(`  ✗ Error searching "${query}":`, error.message)
  }
}

console.log(`\nTotal videos found: ${allVideos.length}`)

// Step 3: Show what we found
console.log('\n[STEP 3] Summary of Content\n')

console.log('TWITTER ACTIVITY:')
tweetsResult.rows.slice(0, 10).forEach(tweet => {
  console.log(`  @${tweet.author_handle}: ${tweet.text.substring(0, 100)}...`)
})

console.log('\nYOUTUBE VIDEOS:')
allVideos.slice(0, 15).forEach((video, i) => {
  console.log(`  ${i + 1}. [${video.channel}] ${video.title}`)
})

// Save report
const report = {
  generated_at: new Date().toISOString(),
  time_range: 'Last 48 hours',
  twitter_data: {
    tweets_analyzed: tweetsResult.rows.length,
    top_mentions: Array.from(mentions.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10),
    top_keywords: Array.from(topics.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10),
    sample_tweets: tweetsResult.rows.slice(0, 20).map(t => ({
      author: t.author_handle,
      text: t.text,
      created_at: t.tweet_created_at,
      likes: t.metrics_likes,
      retweets: t.metrics_retweets
    }))
  },
  youtube_data: {
    videos_found: allVideos.length,
    search_queries: searchQueries,
    videos: allVideos
  }
}

await import('fs/promises').then(fs =>
  fs.writeFile('algorithm-content-report.json', JSON.stringify(report, null, 2))
)

console.log('\n✓ Full report saved to: algorithm-content-report.json')

await db.end()
