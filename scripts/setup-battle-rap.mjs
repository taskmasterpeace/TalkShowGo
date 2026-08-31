/**
 * Battle Rap Niche Setup & Full Pipeline
 *
 * This script:
 * 1. Creates "Battle Rap" topic in the database
 * 2. Adds 12 Twitter sources (battle rap accounts)
 * 3. Adds 8 YouTube channels (major battle rap channels)
 * 4. Fetches recent videos from each channel
 * 5. Shows results at each step
 *
 * DECISIONS MADE:
 * - Twitter: Mix of leagues (URL, KOTD, RBE), media (JayBlac, 15MOFE), and personalities
 * - YouTube: Major leagues + reaction/media channels
 * - Focus: Recent content, battles, reactions, news
 */

import { Innertube } from 'youtubei.js'
import { createClient } from '@supabase/supabase-js'

// Database connection (matches .env)
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:8000'
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const supabase = createClient(supabaseUrl, supabaseKey)

// ===== MY DECISIONS =====

// Twitter accounts to monitor (12 total - exceeds 10 minimum)
const TWITTER_SOURCES = [
  { handle: 'urlosmg', name: 'Ultimate Rap League', notes: 'Biggest battle rap league - official account' },
  { handle: 'KingOfTheDot', name: 'King of the Dot', notes: 'Major Canadian league - KOTD' },
  { handle: 'RBE_Legion', name: 'Rare Breed Entertainment', notes: 'RBE - growing league' },
  { handle: 'jayblac1615', name: 'Jay Blac', notes: 'Battle rap media personality, interviews' },
  { handle: '15MOFE', name: '15 Minutes of Fame', notes: 'Battle rap media/reactions' },
  { handle: 'WatchLOUD', name: 'Watch LOUD', notes: 'Battle rap media coverage' },
  { handle: 'ChampagneDuane', name: 'Champagne Duane', notes: 'Battle rap personality/host' },
  { handle: 'Angryfan007', name: 'Angry Fan', notes: 'Battle rap commentator/reactor' },
  { handle: 'AyeVerb', name: 'Aye Verb', notes: 'Legendary battler, runs own league' },
  { handle: 'HipHopIsReal', name: 'Hip Hop Is Real', notes: 'HHIR - battle rap media' },
  { handle: 'BeasleyBattles', name: 'Beasley', notes: 'Battle rap commentator' },
  { handle: 'thereloaded', name: 'Reloaded', notes: 'Battle rap media/interviews' },
]

// YouTube channels to monitor (8 total - exceeds 3 minimum)
const YOUTUBE_CHANNELS = [
  { handle: 'urltv', name: 'Ultimate Rap League', notes: 'Biggest battle rap channel - URLTV' },
  { handle: 'KingOfTheDot', name: 'King of the Dot', notes: 'KOTD official channel' },
  { handle: 'RBEofficial', name: 'RBE', notes: 'Rare Breed Entertainment' },
  { handle: 'Champion', name: 'Champion', notes: 'Smack/URL secondary channel' },
  { handle: 'NoStudioN', name: 'No Studio\'N', notes: 'Battle rap reactions/breakdowns' },
  { handle: '15MinutesofFame', name: '15 Minutes of Fame', notes: 'Battle rap media/reactions' },
  { handle: 'JayBlacIsBored', name: 'Jay Blac Is Bored', notes: 'Battle rap commentary' },
  { handle: 'algorithminstituteofbattlerap', name: 'Algorithm Institute', notes: 'YOUR channel - documentary style' },
]

// Keywords for battle rap
const KEYWORDS = [
  'battle rap', 'URL', 'KOTD', 'RBE', 'Smack', 'battle',
  'bars', 'bodybag', 'classic', 'Caffeine', 'grudge match'
]

// ===== FUNCTIONS =====

let youtube = null

async function initYouTube() {
  if (!youtube) {
    console.log('   Initializing YouTube client...')
    youtube = await Innertube.create({
      lang: 'en',
      location: 'US',
      retrieve_player: false,
    })
  }
  return youtube
}

async function createTopic() {
  console.log('\n' + '='.repeat(60))
  console.log('STEP 1: Creating Battle Rap Topic')
  console.log('='.repeat(60))

  // Check if topic already exists
  const { data: existing } = await supabase
    .from('topics')
    .select('*')
    .eq('name', 'Battle Rap')
    .single()

  if (existing) {
    console.log('   Topic already exists!')
    console.log(`   ID: ${existing.id}`)
    console.log(`   Name: ${existing.name}`)
    return existing
  }

  // Create new topic
  const { data: topic, error } = await supabase
    .from('topics')
    .insert({
      name: 'Battle Rap',
      description: 'The world of competitive rap battles - URL, KOTD, RBE, and more. Documentary-style coverage of battles, battlers, and culture.',
      status: 'active',
    })
    .select()
    .single()

  if (error) {
    console.error('   Error creating topic:', error.message)
    throw error
  }

  // Create credibility profile
  await supabase.from('credibility_profiles').insert({
    topic_id: topic.id,
  })

  console.log('   Topic created successfully!')
  console.log(`   ID: ${topic.id}`)
  console.log(`   Name: ${topic.name}`)

  return topic
}

async function addTwitterSources(topicId) {
  console.log('\n' + '='.repeat(60))
  console.log('STEP 2: Adding Twitter Sources')
  console.log('='.repeat(60))
  console.log(`   Adding ${TWITTER_SOURCES.length} accounts (minimum was 10)`)
  console.log('')

  const added = []
  const skipped = []

  for (const source of TWITTER_SOURCES) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('source_accounts')
      .select('id')
      .eq('topic_id', topicId)
      .eq('handle', source.handle)
      .single()

    if (existing) {
      skipped.push(source.handle)
      continue
    }

    const { data, error } = await supabase
      .from('source_accounts')
      .insert({
        topic_id: topicId,
        platform: 'twitter',
        handle: source.handle,
        display_name: source.name,
        notes: source.notes,
        status: 'seed',
        credibility_score: 0.8, // Start with high credibility for known accounts
      })
      .select()
      .single()

    if (error) {
      console.log(`   ❌ Failed: @${source.handle} - ${error.message}`)
    } else {
      added.push(source.handle)
    }
  }

  console.log('   TWITTER SOURCES ADDED:')
  console.log('   ' + '-'.repeat(50))
  for (const source of TWITTER_SOURCES) {
    const status = added.includes(source.handle) ? '✅ NEW' : '⏭️  EXISTS'
    console.log(`   ${status} @${source.handle.padEnd(20)} - ${source.name}`)
  }
  console.log('')
  console.log(`   Added: ${added.length} | Already existed: ${skipped.length}`)

  return { added, skipped }
}

async function addYouTubeChannels(topicId) {
  console.log('\n' + '='.repeat(60))
  console.log('STEP 3: Adding YouTube Channels')
  console.log('='.repeat(60))
  console.log(`   Adding ${YOUTUBE_CHANNELS.length} channels (minimum was 3)`)
  console.log('')

  await initYouTube()

  const results = []

  for (const channel of YOUTUBE_CHANNELS) {
    console.log(`   Looking up: ${channel.handle}...`)

    try {
      // Get channel info from YouTube
      const yt = await youtube.getChannel(channel.handle)

      const channelId = yt.metadata?.external_id || `manual_${channel.handle}`
      const title = yt.metadata?.title || channel.name
      const description = yt.metadata?.description?.substring(0, 500) || ''
      const subscribers = yt.metadata?.subscriber_count || 'Unknown'

      // Check if already exists
      const { data: existing } = await supabase
        .from('youtube_channels')
        .select('id')
        .eq('topic_id', topicId)
        .eq('channel_id', channelId)
        .single()

      if (existing) {
        results.push({ ...channel, status: 'exists', subscribers })
        continue
      }

      // Add to database
      const { data, error } = await supabase
        .from('youtube_channels')
        .insert({
          topic_id: topicId,
          channel_id: channelId,
          channel_name: title,
          handle: channel.handle,
          description: description,
          notes: channel.notes,
          status: 'trusted',
          credibility_score: 0.85,
        })
        .select()
        .single()

      if (error) {
        results.push({ ...channel, status: 'error', error: error.message })
      } else {
        results.push({ ...channel, status: 'added', subscribers, channelId })
      }
    } catch (err) {
      // Manual add if YouTube lookup fails
      const { data, error } = await supabase
        .from('youtube_channels')
        .insert({
          topic_id: topicId,
          channel_id: `manual_${channel.handle}_${Date.now()}`,
          channel_name: channel.name,
          handle: channel.handle,
          notes: channel.notes,
          status: 'trusted',
          credibility_score: 0.8,
        })
        .select()
        .single()

      results.push({ ...channel, status: error ? 'error' : 'added_manual' })
    }
  }

  console.log('')
  console.log('   YOUTUBE CHANNELS:')
  console.log('   ' + '-'.repeat(60))
  for (const r of results) {
    const icon = r.status === 'added' ? '✅' : r.status === 'exists' ? '⏭️ ' : r.status === 'added_manual' ? '📝' : '❌'
    const subs = r.subscribers ? ` (${r.subscribers} subs)` : ''
    console.log(`   ${icon} ${r.name.padEnd(25)}${subs}`)
  }

  return results
}

async function fetchYouTubeVideos(topicId) {
  console.log('\n' + '='.repeat(60))
  console.log('STEP 4: Fetching Recent YouTube Videos')
  console.log('='.repeat(60))

  await initYouTube()

  // Get our channels
  const { data: channels } = await supabase
    .from('youtube_channels')
    .select('*')
    .eq('topic_id', topicId)

  if (!channels || channels.length === 0) {
    console.log('   No channels found!')
    return []
  }

  console.log(`   Fetching from ${channels.length} channels...`)
  console.log('')

  const allVideos = []

  for (const channel of channels) {
    console.log(`   📺 ${channel.channel_name}:`)

    try {
      const handle = channel.handle || channel.channel_name.toLowerCase().replace(/\s+/g, '')
      const yt = await youtube.getChannel(handle)

      if (!yt) {
        console.log('      ⚠️  Channel not found on YouTube')
        continue
      }

      const videosTab = await yt.getVideos()
      const videos = (videosTab.videos || []).slice(0, 5) // Get 5 most recent

      for (const video of videos) {
        const videoData = {
          channel_id: channel.id,
          video_id: video.id,
          title: video.title?.text || '',
          description: video.description_snippet?.text || '',
          published_at: video.published?.text || '',
          thumbnail_url: video.thumbnails?.[0]?.url || '',
          view_count: parseViewCount(video.view_count?.text),
          duration: video.duration?.text || '',
        }

        // Check if already exists
        const { data: existing } = await supabase
          .from('youtube_videos')
          .select('id')
          .eq('video_id', video.id)
          .single()

        if (!existing) {
          await supabase
            .from('youtube_videos')
            .insert({
              topic_id: topicId,
              channel_id: channel.id,
              video_id: video.id,
              title: videoData.title,
              description: videoData.description,
              view_count: videoData.view_count,
              thumbnail_url: videoData.thumbnail_url,
            })

          console.log(`      ✅ "${videoData.title.substring(0, 50)}..."`)
          console.log(`         ${videoData.view_count?.toLocaleString() || '?'} views | ${videoData.published_at}`)
        } else {
          console.log(`      ⏭️  "${videoData.title.substring(0, 50)}..." (exists)`)
        }

        allVideos.push(videoData)
      }
    } catch (err) {
      console.log(`      ❌ Error: ${err.message}`)
    }
    console.log('')
  }

  console.log(`   Total videos fetched: ${allVideos.length}`)
  return allVideos
}

function parseViewCount(text) {
  if (!text) return 0
  const cleaned = text.toString().toLowerCase().replace(/,/g, '').replace(' views', '')
  if (cleaned.includes('k')) return Math.round(parseFloat(cleaned) * 1000)
  if (cleaned.includes('m')) return Math.round(parseFloat(cleaned) * 1000000)
  return parseInt(cleaned) || 0
}

async function showSummary(topicId, videos) {
  console.log('\n' + '='.repeat(60))
  console.log('STEP 5: FINAL SUMMARY')
  console.log('='.repeat(60))

  // Get counts
  const { count: twitterCount } = await supabase
    .from('source_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('topic_id', topicId)
    .eq('platform', 'twitter')

  const { count: ytChannelCount } = await supabase
    .from('youtube_channels')
    .select('*', { count: 'exact', head: true })
    .eq('topic_id', topicId)

  const { count: ytVideoCount } = await supabase
    .from('youtube_videos')
    .select('*', { count: 'exact', head: true })
    .eq('topic_id', topicId)

  console.log('')
  console.log('   BATTLE RAP NICHE - SETUP COMPLETE')
  console.log('   ' + '-'.repeat(40))
  console.log(`   📊 Twitter Sources:    ${twitterCount}`)
  console.log(`   📺 YouTube Channels:   ${ytChannelCount}`)
  console.log(`   🎬 YouTube Videos:     ${ytVideoCount}`)
  console.log('')
  console.log('   DECISIONS I MADE:')
  console.log('   ' + '-'.repeat(40))
  console.log('   Twitter: Mix of leagues (URL, KOTD, RBE),')
  console.log('            media (JayBlac, 15MOFE, HHIR),')
  console.log('            and personalities (Aye Verb, Champagne Duane)')
  console.log('')
  console.log('   YouTube: Major league channels + reaction/media')
  console.log('            Including YOUR channel (Algorithm Institute)')
  console.log('')
  console.log('   TTS:     Dia TTS (local, multi-voice, free)')
  console.log('            No API key needed - runs locally via Docker')
  console.log('')
  console.log('   Host:    Algorithm Institute (documentary narrator style)')
  console.log('            Catchphrase: "In the world of battle rap..."')
  console.log('')

  // Show some recent videos
  if (videos && videos.length > 0) {
    console.log('   TOP VIDEOS BY VIEWS:')
    console.log('   ' + '-'.repeat(40))
    const sorted = [...videos].sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    for (const v of sorted.slice(0, 10)) {
      const views = v.view_count ? `${(v.view_count / 1000).toFixed(0)}K` : '?'
      console.log(`   ${views.padStart(6)} | ${v.title.substring(0, 50)}`)
    }
  }

  console.log('')
  console.log('   NEXT STEPS:')
  console.log('   1. Go to /perimeter to see the signals')
  console.log('   2. Go to /extraction to see entity extraction')
  console.log('   3. Go to /nexus to see story clustering')
  console.log('   4. Go to /studio/preview to hear YOUR voice!')
  console.log('')
}

// ===== MAIN =====

async function main() {
  console.log('')
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║     BATTLE RAP NICHE - FULL SETUP & INGESTION              ║')
  console.log('╠════════════════════════════════════════════════════════════╣')
  console.log('║  This will set up everything for the battle rap niche:     ║')
  console.log('║  • Create topic in database                                ║')
  console.log('║  • Add 12 Twitter sources                                  ║')
  console.log('║  • Add 8 YouTube channels                                  ║')
  console.log('║  • Fetch recent videos                                     ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log('')

  try {
    // Step 1: Create topic
    const topic = await createTopic()

    // Step 2: Add Twitter sources
    await addTwitterSources(topic.id)

    // Step 3: Add YouTube channels
    await addYouTubeChannels(topic.id)

    // Step 4: Fetch YouTube videos
    const videos = await fetchYouTubeVideos(topic.id)

    // Step 5: Show summary
    await showSummary(topic.id, videos)

    console.log('✅ SETUP COMPLETE!')
    console.log('')

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()
