/**
 * Look up YouTube channel IDs by handle - Direct API calls
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load .env.local
config({ path: resolve(process.cwd(), '.env.local') })

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

if (!YOUTUBE_API_KEY) {
  console.error('❌ YOUTUBE_API_KEY not found in .env.local')
  process.exit(1)
}

const handles = [
  'HeySandyyy',
  'm3s3tv',
  '1GOATSTATUS'
]

async function getChannelByHandle(handle: string) {
  const cleanHandle = handle.replace('@', '')

  try {
    // Try forHandle first
    const url = `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&forHandle=${cleanHandle}&key=${YOUTUBE_API_KEY}`
    const response = await fetch(url)
    const data = await response.json()

    if (data.items && data.items.length > 0) {
      const item = data.items[0]
      return {
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        customUrl: item.snippet.customUrl,
        subscriberCount: parseInt(item.statistics?.subscriberCount || '0'),
        videoCount: parseInt(item.statistics?.videoCount || '0'),
        viewCount: parseInt(item.statistics?.viewCount || '0'),
        thumbnailUrl: item.snippet.thumbnails?.high?.url,
      }
    }

    // Fallback: Try forUsername
    const fallbackUrl = `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&forUsername=${cleanHandle}&key=${YOUTUBE_API_KEY}`
    const fallbackResponse = await fetch(fallbackUrl)
    const fallbackData = await fallbackResponse.json()

    if (fallbackData.items && fallbackData.items.length > 0) {
      const item = fallbackData.items[0]
      return {
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        customUrl: item.snippet.customUrl,
        subscriberCount: parseInt(item.statistics?.subscriberCount || '0'),
        videoCount: parseInt(item.statistics?.videoCount || '0'),
        viewCount: parseInt(item.statistics?.viewCount || '0'),
        thumbnailUrl: item.snippet.thumbnails?.high?.url,
      }
    }

    return null
  } catch (error: any) {
    throw new Error(`API error: ${error.message}`)
  }
}

async function main() {
  console.log('🔍 Looking up YouTube channel IDs...\n')

  for (const handle of handles) {
    try {
      console.log(`Searching for: @${handle}`)
      const channel = await getChannelByHandle(handle)

      if (channel) {
        console.log(`✓ Found: ${channel.title}`)
        console.log(`  Channel ID: ${channel.id}`)
        console.log(`  Subscribers: ${channel.subscriberCount.toLocaleString()}`)
        console.log(`  Custom URL: ${channel.customUrl || 'N/A'}`)
        console.log()
      } else {
        console.log(`✗ Not found: @${handle}`)
        console.log()
      }
    } catch (error: any) {
      console.error(`❌ Error looking up @${handle}:`, error.message)
      console.log()
    }
  }

  console.log('\n✅ Done! Copy the Channel IDs from above to use in database inserts.')
}

main().catch(console.error)
