/**
 * Synthetic Data Seed Script - Battle Rap
 *
 * Generates realistic test data for the entire pipeline without calling real APIs.
 * Includes "needles in haystacks" - specific test scenarios to verify the system works.
 *
 * Run: node scripts/seed-synthetic.js
 */

const { Client } = require('pg')

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/talkshowgo'

// ============================================
// SYNTHETIC DATA GENERATORS
// ============================================

// Generate a fake tweet ID
function fakeTweetId() {
  return '17' + Math.floor(Math.random() * 90000000000000 + 10000000000000).toString()
}

// Generate a fake YouTube video ID
function fakeVideoId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let result = ''
  for (let i = 0; i < 11; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Random date in the last N days
function randomRecentDate(daysBack = 7) {
  const now = Date.now()
  const past = now - (Math.random() * daysBack * 24 * 60 * 60 * 1000)
  return new Date(past).toISOString()
}

// Random number in range
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// Pick random from array
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ============================================
// BATTLE RAP CONTENT DATA
// ============================================

const BATTLERS = [
  { name: 'Loaded Lux', handle: 'LoadedLux', tier: 'legend' },
  { name: 'Geechi Gotti', handle: 'GeechiGotti', tier: 'champion' },
  { name: 'Tay Roc', handle: 'TayRoc', tier: 'champion' },
  { name: 'Rum Nitty', handle: 'RumNitty', tier: 'elite' },
  { name: 'Chess', handle: 'Chess_', tier: 'rising' },
  { name: 'Ave', handle: 'TheRealAve', tier: 'elite' },
  { name: 'Eazy The Block Captain', handle: 'EazyTBC', tier: 'rising' },
  { name: 'Nu Jersey Twork', handle: 'NuJerseyTwork', tier: 'elite' },
  { name: 'JC', handle: 'ItsJC', tier: 'elite' },
  { name: 'Hitman Holla', handle: 'HitmanHolla', tier: 'champion' },
  { name: 'K-Shine', handle: 'KShine', tier: 'elite' },
  { name: 'DNA', handle: 'DNA_GTFOH', tier: 'vet' },
  { name: 'Charlie Clips', handle: 'CharlieClips', tier: 'legend' },
  { name: 'Surf', handle: 'Lovelytsunamii', tier: 'champion' },
  { name: 'Hollow Da Don', handle: 'HollowDaDon', tier: 'legend' },
]

const EVENTS = [
  { name: 'Summer Madness 2025', short: 'SM2025', org: 'URL' },
  { name: 'NOME 14', short: 'NOME14', org: 'URL' },
  { name: 'Volume 12', short: 'Vol12', org: 'URL' },
  { name: 'Born Legacy 4', short: 'BL4', org: 'URL' },
  { name: 'Traffic 5', short: 'Traffic5', org: 'URL' },
]

const MEDIA_ACCOUNTS = [
  { handle: 'BattleRapTrap', name: 'Battle Rap Trap', credibility: 0.75 },
  { handle: 'ChrisUnbias', name: 'Chris Unbias', credibility: 0.7 },
  { handle: '15MOFERadio', name: '15 Minutes of Fame', credibility: 0.8 },
  { handle: 'hiphopisrealtv', name: 'Hip Hop Is Real TV', credibility: 0.65 },
  { handle: 'KingDnaTooth', name: 'DNA Tooth', credibility: 0.55 },
  { handle: 'Vada_Fly', name: 'Vada Fly', credibility: 0.6 },
  { handle: 'rapgrid', name: 'Rap Grid', credibility: 0.85 },
  { handle: 'AngryFan007', name: 'Angry Fan', credibility: 0.5 },
]

// ============================================
// TWEET TEMPLATES
// ============================================

const TWEET_TEMPLATES = {
  announcement: [
    'BREAKING: {battler1} vs {battler2} announced for {event}! This is gonna be CRAZY! #BattleRap #URL',
    'Just confirmed: {battler1} will be facing {battler2} at {event}. Who y\'all got?',
    '{event} lineup looking STACKED. {battler1} vs {battler2} headline. We eating good.',
    'IT\'S OFFICIAL: {battler1} vs {battler2} at {event}. The culture needed this one.',
  ],
  reaction: [
    '{battler1} on that {battler2} announcement: "I been waiting for this one. It\'s personal."',
    'Just talked to {battler1}. He said {battler2} better come correct at {event}.',
    '{battler1} responds to {battler2}: "You ain\'t ready for what I got planned."',
    'Sources saying {battler1} been in the lab preparing for {battler2}. This battle is important to him.',
  ],
  prediction: [
    'My prediction for {battler1} vs {battler2}: {battler1} 2-1. That pen game different.',
    '{battler1} vs {battler2} at {event}? I got {battler2} winning. Been watching his recent performances.',
    'Hot take: {battler1} about to BODY {battler2} at {event}. Save this tweet.',
    'Can\'t call {battler1} vs {battler2}. Both been on point lately. Might be battle of the year.',
  ],
  rumor: [
    'Hearing whispers that {battler1} might be battling {battler2} soon. Nothing confirmed yet.',
    'Word on the street is {battler1} turned down the {battler2} battle. Don\'t know if it\'s true.',
    'Somebody told me {battler1} and {battler2} got into it backstage at {event}. Crazy if true.',
    'Rumors circulating that {event} might be postponed. URL hasn\'t confirmed anything.',
  ],
  opinion: [
    '{battler1} is the best battler in the game right now. No debate.',
    'People sleep on {battler1}. His last 3 battles been FIRE.',
    '{battler1} overrated. I said what I said. {battler2} got him in that battle.',
    'The {battler1} vs {battler2} battle was a classic. Both came with their A game.',
  ],
  news: [
    '{event} ticket sales breaking records. This card is insane.',
    'URL just dropped the full {event} card. Who y\'all most excited for?',
    '{battler1} announces he\'s taking a break from battle rap after {event}.',
    'Contract dispute between {battler1} and URL reportedly resolved. Expect an announcement soon.',
  ],
}

// ============================================
// NEEDLE IN HAYSTACK TEST CASES
// ============================================

const NEEDLE_TWEETS = [
  // NEEDLE 1: Breaking news that develops over time - Tay Roc injury
  {
    text: 'Hearing that Tay Roc might have gotten injured during practice. Nothing confirmed but prayers up if true. #BattleRap',
    author: 'KingDnaTooth',
    type: 'rumor',
    needle_id: 'tay_roc_injury_rumor',
    sequence: 1,
  },
  {
    text: 'Multiple sources now confirming Tay Roc is dealing with a leg injury. NOME 14 appearance in question.',
    author: 'rapgrid',
    type: 'news',
    needle_id: 'tay_roc_injury_rumor',
    sequence: 2,
  },
  {
    text: 'Tay Roc just posted on his IG story. He\'s in a walking boot. This doesn\'t look good for NOME.',
    author: 'BattleRapTrap',
    type: 'news',
    needle_id: 'tay_roc_injury_rumor',
    sequence: 3,
  },
  {
    text: 'UPDATE: Tay Roc confirms he WILL battle at NOME 14 despite injury. "I\'m not missing this for nothing." WARRIOR.',
    author: '15MOFERadio',
    type: 'news',
    needle_id: 'tay_roc_injury_rumor',
    sequence: 4,
  },

  // NEEDLE 2: Conflicting claims about battle outcome
  {
    text: 'Geechi Gotti CLEARLY won that battle 3-0. Anyone saying otherwise is biased.',
    author: 'ChrisUnbias',
    type: 'opinion',
    needle_id: 'geechi_surf_debate',
    sequence: 1,
  },
  {
    text: 'Surf won that battle 2-1 minimum. Y\'all let the crowd reaction fool you. Watch it back.',
    author: 'AngryFan007',
    type: 'opinion',
    needle_id: 'geechi_surf_debate',
    sequence: 2,
  },
  {
    text: 'Poll results: Geechi vs Surf - 52% Geechi, 45% Surf, 3% Debatable. CLOSE battle.',
    author: 'rapgrid',
    type: 'factual',
    needle_id: 'geechi_surf_debate',
    sequence: 3,
  },

  // NEEDLE 3: Hidden gem from low-credibility source that turns out true
  {
    text: 'Y\'all not gonna believe this but I heard Loaded Lux and Hollow Da Don rematch in the works for Summer Madness.',
    author: 'Vada_Fly',
    type: 'rumor',
    needle_id: 'lux_hollow_rematch',
    sequence: 1,
  },
  {
    text: 'That Lux vs Hollow rematch rumor from last week? Starting to hear similar things from my sources.',
    author: '15MOFERadio',
    type: 'rumor',
    needle_id: 'lux_hollow_rematch',
    sequence: 2,
  },
  {
    text: 'CONFIRMED: Loaded Lux vs Hollow Da Don 2 is OFFICIAL for Summer Madness 2025. THE REMATCH.',
    author: 'rapgrid',
    type: 'news',
    needle_id: 'lux_hollow_rematch',
    sequence: 3,
  },

  // NEEDLE 4: Fake news that gets debunked
  {
    text: 'JUST IN: URL cancelled Summer Madness 2025 due to venue issues. DEVASTATING news.',
    author: 'AngryFan007',
    type: 'rumor',
    needle_id: 'sm_cancelled_fake',
    sequence: 1,
  },
  {
    text: 'Seeing reports about SM2025 being cancelled. Reaching out to URL for confirmation.',
    author: 'BattleRapTrap',
    type: 'news',
    needle_id: 'sm_cancelled_fake',
    sequence: 2,
  },
  {
    text: 'URL officially denies Summer Madness cancellation rumors. "Event is still on. Don\'t believe the hype."',
    author: 'rapgrid',
    type: 'news',
    needle_id: 'sm_cancelled_fake',
    sequence: 3,
  },
  {
    text: 'My bad y\'all, the SM2025 cancellation info was wrong. Got bad intel. Event still happening.',
    author: 'AngryFan007',
    type: 'opinion',
    needle_id: 'sm_cancelled_fake',
    sequence: 4,
  },
]

// ============================================
// YOUTUBE VIDEO TEMPLATES
// ============================================

const VIDEO_TEMPLATES = [
  { title: '{battler1} vs {battler2} FULL BATTLE | {event}', type: 'battle' },
  { title: '{battler1} vs {battler2} REACTION & BREAKDOWN', type: 'reaction' },
  { title: '{event} PREDICTIONS | Who\'s Winning Each Battle?', type: 'prediction' },
  { title: '{battler1} INTERVIEW: Talks {battler2} Battle, Career & More', type: 'interview' },
  { title: 'Is {battler1} The BEST Battler Right Now? | Analysis', type: 'analysis' },
  { title: '{event} RECAP | All Winners & Losers', type: 'recap' },
  { title: 'BREAKING NEWS: {battler1} Announces Next Opponent!', type: 'news' },
  { title: '{battler1} Best Moments & Bars Compilation', type: 'compilation' },
]

// ============================================
// CLAIMS TO TEST (with stance distribution for Producer analysis)
// ============================================

const TEST_CLAIMS = [
  // BREAKING NEWS - High velocity, needs reactions
  {
    text: 'Loaded Lux vs Hollow Da Don rematch is happening at Summer Madness 2025',
    type: 'factual',
    related_needle: 'lux_hollow_rematch',
    stances: { supports: 8, denies: 0, neutral: 2, questions: 1 },
    is_breaking: true,
  },
  // DEVELOPING STORY - Multiple updates over time
  {
    text: 'Tay Roc suffered an injury before NOME 14',
    type: 'factual',
    related_needle: 'tay_roc_injury_rumor',
    stances: { supports: 5, denies: 1, neutral: 3, questions: 2 },
    is_developing: true,
  },
  // HIGH CONFLICT - Community divided (for Talk Show format)
  {
    text: 'Geechi Gotti won his battle against Surf',
    type: 'opinion',
    related_needle: 'geechi_surf_debate',
    stances: { supports: 12, denies: 10, neutral: 3, questions: 2 },
    high_contention: true,
  },
  // DEBUNKED RUMOR - Was spreading but proven false
  {
    text: 'Summer Madness 2025 was cancelled',
    type: 'rumor',
    related_needle: 'sm_cancelled_fake',
    is_false: true,
    stances: { supports: 2, denies: 8, neutral: 1, questions: 3 },
  },
  // SINGLE PERSPECTIVE - Needs contrast search (Producer should flag)
  {
    text: 'Rum Nitty has the best pen game in battle rap',
    type: 'opinion',
    stances: { supports: 15, denies: 0, neutral: 2, questions: 0 },
    needs_contrast: true,
  },
  // CONSENSUS - Everyone agrees
  {
    text: 'URL is the biggest battle rap league in the world',
    type: 'factual',
    stances: { supports: 20, denies: 0, neutral: 5, questions: 0 },
    high_consensus: true,
  },
  // PREDICTION - Future speculation
  {
    text: 'Eazy The Block Captain is the next superstar in battle rap',
    type: 'prediction',
    stances: { supports: 8, denies: 3, neutral: 4, questions: 2 },
  },
  // HOT CONTROVERSY - Very heated debate
  {
    text: 'Tay Roc vs Surf 2 should have been 3-0 Surf',
    type: 'opinion',
    stances: { supports: 6, denies: 14, neutral: 1, questions: 0 },
    high_contention: true,
  },
  // RUMOR SPREADING - Unverified but gaining traction
  {
    text: 'DNA and K-Shine are getting their own show on URL app',
    type: 'rumor',
    stances: { supports: 4, denies: 0, neutral: 3, questions: 5 },
    rumor_spreading: true,
  },
  // ANOTHER CONFLICT - For talk show potential
  {
    text: 'Loaded Lux is washed and should retire',
    type: 'opinion',
    stances: { supports: 5, denies: 18, neutral: 2, questions: 1 },
    high_contention: true,
  },
]

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function seedSyntheticData() {
  const client = new Client({ connectionString: DATABASE_URL })

  try {
    await client.connect()
    console.log('Connected to database')
    console.log('==========================================')
    console.log('SEEDING SYNTHETIC BATTLE RAP DATA')
    console.log('==========================================\n')

    // Get Battle Rap topic ID
    const topicResult = await client.query(`SELECT id FROM topics WHERE name = 'Battle Rap'`)
    if (topicResult.rows.length === 0) {
      console.log('Battle Rap topic not found. Run seed.js first!')
      process.exit(1)
    }
    const topicId = topicResult.rows[0].id
    console.log(`Found topic: Battle Rap (${topicId})\n`)

    // ============================================
    // 1. SEED ENTITIES (Battlers, Events, Orgs)
    // ============================================
    console.log('1. SEEDING ENTITIES...')

    // Add battlers as entities
    for (const battler of BATTLERS) {
      await client.query(`
        INSERT INTO entities (topic_id, canonical_name, entity_type, description, metadata)
        VALUES ($1, $2, 'person', $3, $4)
        ON CONFLICT DO NOTHING
      `, [
        topicId,
        battler.name,
        `Battle rapper - ${battler.tier} tier`,
        JSON.stringify({ handle: battler.handle, tier: battler.tier })
      ])

      // Add handle as alias
      await client.query(`
        INSERT INTO entity_aliases (entity_id, alias, source)
        SELECT id, $2, 'manual'
        FROM entities WHERE canonical_name = $1 AND topic_id = $3
        ON CONFLICT DO NOTHING
      `, [battler.name, `@${battler.handle}`, topicId])
    }
    console.log(`  Added ${BATTLERS.length} battlers`)

    // Add events as entities
    for (const event of EVENTS) {
      await client.query(`
        INSERT INTO entities (topic_id, canonical_name, entity_type, description, metadata)
        VALUES ($1, $2, 'event', $3, $4)
        ON CONFLICT DO NOTHING
      `, [
        topicId,
        event.name,
        `${event.org} battle rap event`,
        JSON.stringify({ short_name: event.short, organization: event.org })
      ])

      // Add short name as alias
      await client.query(`
        INSERT INTO entity_aliases (entity_id, alias, source)
        SELECT id, $2, 'manual'
        FROM entities WHERE canonical_name = $1 AND topic_id = $3
        ON CONFLICT DO NOTHING
      `, [event.name, event.short, topicId])
    }
    console.log(`  Added ${EVENTS.length} events`)

    // ============================================
    // 2. GET SOURCE ACCOUNT IDS
    // ============================================
    console.log('\n2. GETTING SOURCE ACCOUNTS...')

    const sourceMap = {}
    for (const account of MEDIA_ACCOUNTS) {
      const result = await client.query(`
        SELECT id FROM source_accounts
        WHERE handle = $1 AND topic_id = $2
      `, [`@${account.handle}`, topicId])

      if (result.rows.length > 0) {
        sourceMap[account.handle] = result.rows[0].id
      }
    }
    console.log(`  Found ${Object.keys(sourceMap).length} source accounts`)

    // ============================================
    // 3. SEED TWEETS (Regular + Needle tweets)
    // ============================================
    console.log('\n3. SEEDING TWEETS...')

    let tweetCount = 0
    const tweetIds = {} // Map needle_id -> tweet UUIDs for linking

    // Generate regular tweets
    for (let i = 0; i < 100; i++) {
      const templateType = pick(Object.keys(TWEET_TEMPLATES))
      const template = pick(TWEET_TEMPLATES[templateType])
      const battler1 = pick(BATTLERS)
      let battler2 = pick(BATTLERS)
      while (battler2.name === battler1.name) battler2 = pick(BATTLERS)
      const event = pick(EVENTS)
      const author = pick(MEDIA_ACCOUNTS)

      const text = template
        .replace('{battler1}', battler1.name)
        .replace('{battler2}', battler2.name)
        .replace('{event}', event.name)

      const tweetId = fakeTweetId()
      const sourceId = sourceMap[author.handle] || null

      await client.query(`
        INSERT INTO tweets_raw (
          tweet_id, topic_id, source_account_id, text,
          author_handle, author_name, tweet_type,
          metrics_likes, metrics_retweets, metrics_replies, metrics_views,
          tweet_created_at, processed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false)
        ON CONFLICT (tweet_id) DO NOTHING
      `, [
        tweetId, topicId, sourceId, text,
        author.handle, author.name, 'original',
        rand(100, 5000), rand(50, 1500), rand(20, 500), rand(5000, 100000),
        randomRecentDate(14)
      ])
      tweetCount++
    }
    console.log(`  Added ${tweetCount} regular tweets`)

    // Insert needle tweets (in sequence order for realistic timeline)
    console.log('\n  INSERTING NEEDLE TWEETS (test scenarios)...')
    for (const needle of NEEDLE_TWEETS) {
      const author = MEDIA_ACCOUNTS.find(a => a.handle === needle.author)
      const sourceId = sourceMap[needle.author] || null
      const tweetId = fakeTweetId()

      // Stagger the dates based on sequence
      const daysAgo = 7 - needle.sequence
      const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)

      const result = await client.query(`
        INSERT INTO tweets_raw (
          tweet_id, topic_id, source_account_id, text,
          author_handle, author_name, tweet_type,
          metrics_likes, metrics_retweets, metrics_replies, metrics_views,
          tweet_created_at, processed,
          raw_payload
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, false, $13)
        RETURNING id
      `, [
        tweetId, topicId, sourceId, needle.text,
        needle.author, author?.name || needle.author, 'original',
        rand(500, 8000), rand(200, 2000), rand(100, 800), rand(20000, 150000),
        date.toISOString(),
        JSON.stringify({ needle_id: needle.needle_id, sequence: needle.sequence })
      ])

      // Track tweet IDs for this needle
      if (!tweetIds[needle.needle_id]) tweetIds[needle.needle_id] = []
      tweetIds[needle.needle_id].push(result.rows[0].id)

      console.log(`    [${needle.needle_id}] Tweet ${needle.sequence}: "${needle.text.slice(0, 50)}..."`)
    }
    console.log(`  Added ${NEEDLE_TWEETS.length} needle tweets`)

    // ============================================
    // 4. SEED CLAIMS (with stance distributions)
    // ============================================
    console.log('\n4. SEEDING CLAIMS WITH STANCES...')

    const claimIds = {}
    let totalClaimMentions = 0

    for (const claim of TEST_CLAIMS) {
      // Calculate total mentions from stances
      const totalMentions = claim.stances
        ? Object.values(claim.stances).reduce((a, b) => a + b, 0)
        : rand(3, 15)

      // Determine first_seen based on claim type
      let firstSeen = new Date()
      if (claim.is_breaking) {
        firstSeen = new Date(Date.now() - rand(1, 5) * 60 * 60 * 1000) // 1-5 hours ago
      } else if (claim.is_developing) {
        firstSeen = new Date(Date.now() - rand(24, 72) * 60 * 60 * 1000) // 1-3 days ago
      } else {
        firstSeen = new Date(Date.now() - rand(72, 168) * 60 * 60 * 1000) // 3-7 days ago
      }

      const result = await client.query(`
        INSERT INTO claims (topic_id, claim_text, claim_type, status, mention_count, first_seen)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        topicId,
        claim.text,
        claim.type,
        claim.is_false ? 'stale' : 'emerging',
        totalMentions,
        firstSeen.toISOString()
      ])

      const claimId = result.rows[0].id
      claimIds[claim.text] = claimId

      // Create claim mentions with proper stance distribution
      if (claim.stances) {
        // Get some tweets to link to (we'll create synthetic links)
        const { rows: sampleTweets } = await client.query(`
          SELECT id FROM tweets_raw WHERE topic_id = $1 ORDER BY RANDOM() LIMIT $2
        `, [topicId, totalMentions])

        let tweetIndex = 0
        for (const [stance, count] of Object.entries(claim.stances)) {
          for (let i = 0; i < count && tweetIndex < sampleTweets.length; i++) {
            await client.query(`
              INSERT INTO claim_mentions (claim_id, tweet_id, stance)
              VALUES ($1, $2, $3)
              ON CONFLICT DO NOTHING
            `, [claimId, sampleTweets[tweetIndex].id, stance])
            tweetIndex++
            totalClaimMentions++
          }
        }
      }

      // Link to needle tweets if applicable
      if (claim.related_needle && tweetIds[claim.related_needle]) {
        for (const tweetUuid of tweetIds[claim.related_needle]) {
          await client.query(`
            INSERT INTO claim_mentions (claim_id, tweet_id, stance)
            VALUES ($1, $2, $3)
            ON CONFLICT DO NOTHING
          `, [
            claimId,
            tweetUuid,
            claim.is_false ? 'denies' : 'supports'
          ])
        }
      }

      // Log claim type for visibility
      const claimFlag = claim.high_contention ? '[CONFLICT]'
        : claim.needs_contrast ? '[SINGLE POV]'
        : claim.is_breaking ? '[BREAKING]'
        : claim.rumor_spreading ? '[RUMOR]'
        : claim.high_consensus ? '[CONSENSUS]'
        : ''
      console.log(`  ${claimFlag} ${claim.text.slice(0, 50)}...`)
    }
    console.log(`  Added ${TEST_CLAIMS.length} claims with ${totalClaimMentions} stance mentions`)

    // ============================================
    // 5. SEED YOUTUBE VIDEOS
    // ============================================
    console.log('\n5. SEEDING YOUTUBE VIDEOS...')

    // Get YouTube channel IDs
    const channelResult = await client.query(`
      SELECT id, channel_name FROM youtube_channels WHERE topic_id = $1
    `, [topicId])

    const channels = channelResult.rows
    let videoCount = 0

    for (const channel of channels) {
      // Generate 5-10 videos per channel
      const numVideos = rand(5, 10)
      for (let i = 0; i < numVideos; i++) {
        const template = pick(VIDEO_TEMPLATES)
        const battler1 = pick(BATTLERS)
        let battler2 = pick(BATTLERS)
        while (battler2.name === battler1.name) battler2 = pick(BATTLERS)
        const event = pick(EVENTS)

        const title = template.title
          .replace('{battler1}', battler1.name)
          .replace('{battler2}', battler2.name)
          .replace('{event}', event.name)

        const videoId = fakeVideoId()

        await client.query(`
          INSERT INTO youtube_videos (
            channel_id, topic_id, video_id, title, description,
            published_at, duration_seconds,
            view_count, like_count, comment_count,
            processed
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)
          ON CONFLICT (video_id) DO NOTHING
        `, [
          channel.id, topicId, videoId, title,
          `${template.type} video about battle rap`,
          randomRecentDate(30),
          rand(300, 3600),
          rand(5000, 500000),
          rand(100, 20000),
          rand(50, 2000)
        ])
        videoCount++
      }
    }
    console.log(`  Added ${videoCount} YouTube videos`)

    // ============================================
    // 6. SEED ENTITY MENTIONS
    // ============================================
    console.log('\n6. LINKING ENTITIES TO TWEETS...')

    // Get all tweets
    const tweetsResult = await client.query(`
      SELECT id, text FROM tweets_raw WHERE topic_id = $1
    `, [topicId])

    // Get all entities with aliases
    const entitiesResult = await client.query(`
      SELECT e.id, e.canonical_name, ARRAY_AGG(ea.alias) as aliases
      FROM entities e
      LEFT JOIN entity_aliases ea ON ea.entity_id = e.id
      WHERE e.topic_id = $1
      GROUP BY e.id, e.canonical_name
    `, [topicId])

    let mentionCount = 0
    for (const tweet of tweetsResult.rows) {
      for (const entity of entitiesResult.rows) {
        // Check if entity name or any alias appears in tweet
        const names = [entity.canonical_name, ...(entity.aliases || []).filter(Boolean)]
        for (const name of names) {
          if (tweet.text.toLowerCase().includes(name.toLowerCase())) {
            await client.query(`
              INSERT INTO entity_mentions (entity_id, tweet_id, mention_type, sentiment, context_snippet)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT DO NOTHING
            `, [
              entity.id,
              tweet.id,
              pick(['subject', 'object', 'reference']),
              pick(['positive', 'negative', 'neutral', 'mixed']),
              tweet.text.slice(0, 200)
            ])
            mentionCount++

            // Update mention count on entity
            await client.query(`
              UPDATE entities SET mention_count = mention_count + 1 WHERE id = $1
            `, [entity.id])
            break // Only count once per entity per tweet
          }
        }
      }
    }
    console.log(`  Created ${mentionCount} entity mentions`)

    // ============================================
    // 7. SEED CONSENSUS SCORES FOR CLAIMS
    // ============================================
    console.log('\n7. GENERATING CONSENSUS SCORES (based on stance distributions)...')

    for (const claim of TEST_CLAIMS) {
      const claimId = claimIds[claim.text]

      // Calculate consensus and contention from stances
      let consensus = 0
      let contention = 0
      let sourceCount = 0

      if (claim.stances) {
        const { supports, denies, neutral, questions } = claim.stances
        sourceCount = supports + denies + neutral + questions

        // Consensus: +1 if all support, -1 if all deny, 0 if split
        // Formula: (supports - denies) / total
        const opinionated = supports + denies
        if (opinionated > 0) {
          consensus = (supports - denies) / opinionated
        }

        // Contention: How divided is the community?
        // High contention = close split between supports and denies
        if (opinionated > 0) {
          const minority = Math.min(supports, denies)
          const majority = Math.max(supports, denies)
          contention = opinionated > 0 ? (minority / majority) : 0
        }

        // Boost contention for claims we flagged as high_contention
        if (claim.high_contention) {
          contention = Math.max(contention, 0.6)
        }
      } else {
        // Default values for claims without explicit stances
        consensus = claim.is_false ? -0.7 : (Math.random() * 0.6 + 0.2)
        contention = Math.random() * 0.5
        sourceCount = rand(3, 12)
      }

      // Special cases
      if (claim.is_false) {
        consensus = -0.7  // Mostly debunked
        contention = 0.3  // Some still believe it
      }
      if (claim.high_consensus) {
        consensus = 0.9
        contention = 0.1
      }
      if (claim.needs_contrast) {
        consensus = 0.95  // One-sided
        contention = 0.05  // No debate yet
      }

      const confidence = sourceCount > 10 ? 0.8 : sourceCount > 5 ? 0.6 : 0.4

      await client.query(`
        INSERT INTO consensus_scores (claim_id, consensus, contention, confidence, source_count, engagement_total)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (claim_id) DO UPDATE SET
          consensus = $2, contention = $3, confidence = $4, source_count = $5
      `, [
        claimId,
        consensus,
        contention,
        confidence,
        sourceCount,
        rand(10000, 100000)
      ])

      console.log(`  [consensus=${consensus.toFixed(2)}, contention=${contention.toFixed(2)}] ${claim.text.slice(0, 40)}...`)
    }
    console.log(`  Added consensus scores for ${TEST_CLAIMS.length} claims`)

    // ============================================
    // 8. SEED NOMINATIONS (Pending review)
    // ============================================
    console.log('\n8. SEEDING NOMINATIONS...')

    const nominationSources = [
      { platform: 'twitter', identifier: '@NewBattleRapChannel', context: 'Discovered via retweet from @BattleRapTrap' },
      { platform: 'youtube', identifier: 'UC_newchannel123', context: 'Found in search results for "battle rap reactions"' },
      { platform: 'twitter', identifier: '@UpcomingBattler', context: 'Multiple mentions in entity tweets' },
      { platform: 'website', identifier: 'battlerapworld.com', context: 'Linked in several tweet threads' },
    ]

    for (const nom of nominationSources) {
      await client.query(`
        INSERT INTO nominations (topic_id, platform, identifier, discovery_context, preliminary_score, status)
        VALUES ($1, $2, $3, $4, $5, 'pending')
        ON CONFLICT DO NOTHING
      `, [topicId, nom.platform, nom.identifier, nom.context, Math.random() * 0.4 + 0.4])
    }
    console.log(`  Added ${nominationSources.length} nominations`)

    // ============================================
    // 9. SEED STORY CANDIDATES
    // ============================================
    console.log('\n9. SEEDING STORY CANDIDATES...')

    const stories = [
      {
        bucket: 'breaking',
        headline: 'Loaded Lux vs Hollow Da Don 2 Confirmed for Summer Madness 2025',
        summary: 'The highly anticipated rematch is officially happening. URL confirms the legendary battle will headline Summer Madness.',
      },
      {
        bucket: 'developing',
        headline: 'Tay Roc Battles Through Injury at NOME 14',
        summary: 'Despite suffering a leg injury during practice, Tay Roc confirmed he will compete at NOME 14. Warrior mentality.',
      },
      {
        bucket: 'recurring',
        headline: 'Geechi Gotti vs Surf Debate Continues',
        summary: 'The battle rap community remains divided on the winner of this classic battle. Polls show a near 50-50 split.',
      },
      {
        bucket: 'background',
        headline: 'URL Summer Madness 2025 Card Takes Shape',
        summary: 'Full card announced including multiple championship-level matchups. Ticket sales reportedly breaking records.',
      },
    ]

    for (const story of stories) {
      await client.query(`
        INSERT INTO story_candidates (
          topic_id, bucket, headline, summary, confidence_score, status
        ) VALUES ($1, $2, $3, $4, $5, 'candidate')
      `, [topicId, story.bucket, story.headline, story.summary, Math.random() * 0.3 + 0.6])
    }
    console.log(`  Added ${stories.length} story candidates`)

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n==========================================')
    console.log('SYNTHETIC DATA SEED COMPLETE!')
    console.log('==========================================')
    console.log('\nData Summary:')
    console.log(`  - Entities: ${BATTLERS.length} battlers + ${EVENTS.length} events`)
    console.log(`  - Tweets: ${tweetCount + NEEDLE_TWEETS.length} total`)
    console.log(`  - Claims: ${TEST_CLAIMS.length}`)
    console.log(`  - YouTube Videos: ${videoCount}`)
    console.log(`  - Entity Mentions: ${mentionCount}`)
    console.log(`  - Nominations: ${nominationSources.length}`)
    console.log(`  - Story Candidates: ${stories.length}`)

    console.log('\nNeedle Test Cases:')
    console.log('  1. tay_roc_injury_rumor - Breaking news developing over time')
    console.log('  2. geechi_surf_debate - Conflicting opinions from sources')
    console.log('  3. lux_hollow_rematch - Hidden gem from low-cred source confirmed')
    console.log('  4. sm_cancelled_fake - Fake news gets debunked')

    console.log('\nNext Steps:')
    console.log('  1. Run: npm run dev')
    console.log('  2. Visit PERIMETER page to see tweets')
    console.log('  3. Visit EXTRACTION page to see entities/claims')
    console.log('  4. Visit NEXUS page to see story candidates')

  } catch (error) {
    console.error('Seed error:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

seedSyntheticData()
