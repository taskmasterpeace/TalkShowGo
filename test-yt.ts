
import { fetchChannelRSS } from './src/lib/sources/youtube-adapter'
import { createTimeRange, isWithinTimeRange } from './src/lib/time-range'

async function test() {
  console.log('Testing YouTube RSS Adapter...')
  
  // URLTV channel
  const videos = await fetchChannelRSS('UCdXzXtwGpGfpkQLejc4GMiQ')
  console.log('Fetched', videos.length, 'videos from URLTV')
  
  if (videos.length > 0) {
    const v = videos[0]
    console.log('Most recent:', v.title.substring(0, 50) + '...')
    console.log('Published:', v.published_at.toISOString())
    console.log('Has ISO timestamp:', v.published_at.toISOString().includes('T'))
    
    // Test filtering
    const range = createTimeRange(48)
    const inRange = isWithinTimeRange(v.published_at, range)
    console.log('Within 48h range:', inRange)
  }
}

test().catch(e => console.error('Error:', e.message))

