/**
 * Research Battle Rap Trap's YouTube channel
 * Find which channels they mention, collaborate with, and reference
 */

import { FreeYouTubeClient } from './src/lib/youtube-api.ts'

const CHANNEL_PATTERNS = [
  // URL patterns
  /youtube\.com\/@([a-zA-Z0-9_-]+)/g,
  /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/g,
  /youtube\.com\/c\/([a-zA-Z0-9_-]+)/g,
  // @mentions in text
  /@([a-zA-Z0-9_-]+)/g
]

const KNOWN_BATTLE_RAP_CHANNELS = [
  'URLTV',
  'KingOfTheDot',
  'JayBlac',
  'Algorithm Institute',
  'HHIR',
  '15MOFE',
  'RareBreedEnt',
  'ChrisUnbias',
  'AngryFan',
  'VadaFly',
  'No Studio',
  'Geechi Gotti',
  'Tay Roc',
  'Loaded Lux',
  'URL',
  'KOTD',
  'RBE'
]

async function extractChannelMentions(text) {
  const mentions = new Set()

  for (const pattern of CHANNEL_PATTERNS) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      if (match[1]) {
        mentions.add(match[1])
      }
    }
  }

  return Array.from(mentions)
}

function findChannelReferences(text) {
  const references = []
  const lowerText = text.toLowerCase()

  for (const channel of KNOWN_BATTLE_RAP_CHANNELS) {
    if (lowerText.includes(channel.toLowerCase())) {
      references.push(channel)
    }
  }

  return references
}

async function main() {
  console.log('🔍 Researching Battle Rap Trap\'s YouTube Channel...\n')

  const client = new FreeYouTubeClient()

  // Step 1: Find Battle Rap Trap channel
  console.log('📡 Step 1: Finding Battle Rap Trap channel...')
  const channel = await client.getChannel('BattleRapTrap')

  if (!channel) {
    // Try search
    console.log('⚠️  Channel not found by handle, trying search...')
    const searchResults = await client.search('Battle Rap Trap channel', 5)

    if (searchResults.length > 0) {
      console.log('\n🔎 Search Results:')
      searchResults.forEach((video, idx) => {
        console.log(`${idx + 1}. ${video.channelTitle} (${video.channelId})`)
        console.log(`   Video: ${video.title}`)
      })

      console.log('\n❌ Please manually identify the correct channel ID from above.')
      return
    } else {
      console.log('❌ No results found. Channel may not exist or name is different.')
      return
    }
  }

  console.log(`✅ Found: ${channel.title}`)
  console.log(`   ID: ${channel.id}`)
  console.log(`   Subscribers: ${channel.subscriberCount.toLocaleString()}`)
  console.log(`   Videos: ${channel.videoCount.toLocaleString()}`)
  console.log(`   Description: ${channel.description.substring(0, 200)}...\n`)

  // Step 2: Get recent videos (last 3 months = ~50 videos)
  console.log('📹 Step 2: Fetching recent videos (last 3 months)...')
  const videos = await client.getChannelVideos(channel.id, 50)
  console.log(`✅ Found ${videos.length} recent videos\n`)

  // Step 3: Analyze videos for channel mentions
  console.log('🔬 Step 3: Analyzing video descriptions and titles...\n')

  const channelMentions = new Map()
  const channelReferences = new Map()
  const collaborations = []

  for (const video of videos) {
    const fullText = `${video.title} ${video.description}`

    // Extract @mentions and URLs
    const mentions = await extractChannelMentions(fullText)
    for (const mention of mentions) {
      channelMentions.set(mention, (channelMentions.get(mention) || 0) + 1)
    }

    // Find known channel references
    const refs = findChannelReferences(fullText)
    for (const ref of refs) {
      channelReferences.set(ref, (channelReferences.get(ref) || 0) + 1)
    }

    // Check for collaboration indicators
    if (video.title.toLowerCase().includes('feat') ||
        video.title.toLowerCase().includes('ft.') ||
        video.description.toLowerCase().includes('collaboration') ||
        video.description.toLowerCase().includes('collab')) {
      collaborations.push({
        title: video.title,
        description: video.description.substring(0, 200),
        publishedAt: video.publishedAt
      })
    }
  }

  // Step 4: Output Results
  console.log('=' .repeat(80))
  console.log('📊 RESEARCH RESULTS')
  console.log('=' .repeat(80))

  console.log('\n🔗 CHANNEL MENTIONS (URLs & @handles):')
  if (channelMentions.size === 0) {
    console.log('   None found in video descriptions')
  } else {
    const sortedMentions = Array.from(channelMentions.entries())
      .sort((a, b) => b[1] - a[1])
    sortedMentions.forEach(([mention, count]) => {
      console.log(`   ${count}x - @${mention}`)
    })
  }

  console.log('\n📢 CHANNEL REFERENCES (Names mentioned):')
  if (channelReferences.size === 0) {
    console.log('   None found')
  } else {
    const sortedRefs = Array.from(channelReferences.entries())
      .sort((a, b) => b[1] - a[1])
    sortedRefs.forEach(([ref, count]) => {
      console.log(`   ${count}x - ${ref}`)
    })
  }

  console.log('\n🤝 POTENTIAL COLLABORATIONS:')
  if (collaborations.length === 0) {
    console.log('   None found')
  } else {
    collaborations.forEach((collab, idx) => {
      console.log(`\n   ${idx + 1}. ${collab.title}`)
      console.log(`      Published: ${collab.publishedAt}`)
      console.log(`      Desc: ${collab.description}...`)
    })
  }

  // Step 5: Try to resolve channel IDs
  console.log('\n🔍 RESOLVING CHANNEL IDs...')
  const resolvedChannels = []

  for (const [handle] of channelMentions) {
    try {
      const resolvedChannel = await client.getChannel(handle)
      if (resolvedChannel) {
        resolvedChannels.push({
          handle,
          id: resolvedChannel.id,
          title: resolvedChannel.title,
          subscribers: resolvedChannel.subscriberCount
        })
        console.log(`   ✅ @${handle} → ${resolvedChannel.title} (${resolvedChannel.id})`)
      } else {
        console.log(`   ❌ @${handle} → Could not resolve`)
      }
    } catch (error) {
      console.log(`   ❌ @${handle} → Error: ${error.message}`)
    }
  }

  // Step 6: Summary
  console.log('\n' + '=' .repeat(80))
  console.log('📋 SUMMARY')
  console.log('=' .repeat(80))
  console.log(`Channel: ${channel.title}`)
  console.log(`Channel ID: ${channel.id}`)
  console.log(`Total Videos Analyzed: ${videos.length}`)
  console.log(`Unique Channel Mentions: ${channelMentions.size}`)
  console.log(`Known Battle Rap Channels Referenced: ${channelReferences.size}`)
  console.log(`Potential Collaborations: ${collaborations.length}`)
  console.log(`Successfully Resolved: ${resolvedChannels.length}`)

  console.log('\n✅ RECOMMENDED CHANNELS TO ADD AS SOURCES:')
  resolvedChannels
    .sort((a, b) => b.subscribers - a.subscribers)
    .forEach((ch, idx) => {
      console.log(`${idx + 1}. ${ch.title}`)
      console.log(`   Handle: @${ch.handle}`)
      console.log(`   ID: ${ch.id}`)
      console.log(`   Subscribers: ${ch.subscribers.toLocaleString()}`)
    })

  console.log('\n🎯 Done!')
}

main().catch(console.error)
