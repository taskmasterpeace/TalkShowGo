/**
 * Synthesize Talk Show Test
 *
 * Creates a sample talk show production from our synthetic data
 * demonstrating the Producer → Host → Show pipeline.
 *
 * Run: node scripts/synthesize-talk-show.js
 */

const { Client } = require('pg')

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/talkshowgo'

// ============================================
// HOSTS (imported from our types)
// ============================================

const HOSTS = {
  maya_sterling: {
    name: 'Maya Sterling',
    archetype: 'investigative_anchor',
    tagline: "Let me walk you through this...",
    openingStyle: 'methodical, builds case',
  },
  marcus_blaze: {
    name: 'Marcus Blaze',
    archetype: 'hot_take_king',
    tagline: "I'm just saying what everybody's thinking!",
    openingStyle: 'bold statement, high energy',
  },
  devon_sharp: {
    name: 'Devon Sharp',
    archetype: 'witty_satirist',
    tagline: 'Wait, wait, wait... are we serious right now?',
    openingStyle: 'sets up then subverts with comedy',
  },
  tasha_raw: {
    name: 'Tasha Raw',
    archetype: 'unfiltered_real',
    tagline: "I don't got time for the bullsh*t",
    openingStyle: 'jumps right into the mess',
  },
  james_noble: {
    name: 'James Noble',
    archetype: 'smooth_narrator',
    tagline: 'This is the story of...',
    openingStyle: 'cinematic scene setting',
  },
  king_knowledge: {
    name: 'King Knowledge',
    archetype: 'street_analyst',
    tagline: 'Real recognize real',
    openingStyle: 'establishes credibility, drops knowledge',
  },
}

// ============================================
// SHOW FORMATS
// ============================================

const SHOW_FORMATS = {
  talk_show_debate: {
    name: 'Talk Show Debate',
    structure: ['intro', 'topic_setup', 'side_a_argument', 'side_b_argument', 'rebuttal', 'conclusion'],
    hostCount: 2,
  },
  news_bulletin: {
    name: 'News Bulletin',
    structure: ['headline', 'key_facts', 'sources', 'whats_next'],
    hostCount: 1,
  },
  narrative_story: {
    name: 'Narrative Story',
    structure: ['hook', 'setup', 'rising_action', 'climax', 'resolution'],
    hostCount: 1,
  },
  hot_take: {
    name: 'Hot Take',
    structure: ['bold_statement', 'reasoning', 'evidence', 'mic_drop'],
    hostCount: 1,
  },
}

// ============================================
// SYNTHESIZE FUNCTIONS
// ============================================

async function synthesizeTalkShow(client, topicId, claim) {
  console.log('\n' + '='.repeat(60))
  console.log('SYNTHESIZING TALK SHOW DEBATE')
  console.log('='.repeat(60))

  const topic = claim.claim_text
  console.log(`\nTOPIC: "${topic}"`)

  // Get hosts for debate (contrasting styles)
  const hostA = HOSTS.marcus_blaze  // Hot take king - will argue one side
  const hostB = HOSTS.devon_sharp   // Witty satirist - will argue other side

  console.log(`\nHOSTS:`)
  console.log(`  Side A: ${hostA.name} (${hostA.archetype})`)
  console.log(`  Side B: ${hostB.name} (${hostB.archetype})`)

  // Get tweets supporting each side
  const { rows: supportingTweets } = await client.query(`
    SELECT tr.text, tr.author_handle, cm.stance
    FROM claim_mentions cm
    JOIN tweets_raw tr ON tr.id = cm.tweet_id
    WHERE cm.claim_id = $1 AND cm.stance = 'supports'
    LIMIT 3
  `, [claim.id])

  const { rows: denyingTweets } = await client.query(`
    SELECT tr.text, tr.author_handle, cm.stance
    FROM claim_mentions cm
    JOIN tweets_raw tr ON tr.id = cm.tweet_id
    WHERE cm.claim_id = $1 AND cm.stance = 'denies'
    LIMIT 3
  `, [claim.id])

  console.log(`\nEVIDENCE GATHERED:`)
  console.log(`  Supporting: ${supportingTweets.length} tweets`)
  console.log(`  Denying: ${denyingTweets.length} tweets`)

  // Generate the show script
  console.log('\n' + '-'.repeat(60))
  console.log('GENERATED SHOW SCRIPT')
  console.log('-'.repeat(60))

  // INTRO
  console.log('\n[INTRO - 30 seconds]')
  console.log(`\n${hostA.name}: "Y'all not ready for this conversation! We're talking about ${topic}. HOWEVER, I got a LOT to say about this!"`)
  console.log(`\n${hostB.name}: "Wait, wait, wait... we're really doing this? *shuffles papers* Alright, let's get into it."`)

  // TOPIC SETUP
  console.log('\n[TOPIC SETUP - 1 minute]')
  console.log(`\n${hostA.name}: "Let me be very clear about this - the facts are the facts. We got people out here saying ${topic}. And I'm here to tell you why that's TRUE."`)

  // SIDE A ARGUMENT
  console.log('\n[SIDE A ARGUMENT - 2 minutes]')
  console.log(`\n${hostA.name}: "${hostA.tagline}"`)
  if (supportingTweets.length > 0) {
    console.log(`\n${hostA.name}: "Look at what @${supportingTweets[0]?.author_handle || 'sources'} said: '${(supportingTweets[0]?.text || 'Multiple sources confirm this').slice(0, 100)}...'`)
    console.log(`\n${hostA.name}: "That's not just one person - that's the CULTURE speaking!"`)
  }

  // SIDE B ARGUMENT
  console.log('\n[SIDE B ARGUMENT - 2 minutes]')
  console.log(`\n${hostB.name}: "${hostB.tagline}"`)
  if (denyingTweets.length > 0) {
    console.log(`\n${hostB.name}: "I mean, here's the thing though... @${denyingTweets[0]?.author_handle || 'others'} said: '${(denyingTweets[0]?.text || 'Some disagree with this take').slice(0, 100)}...'`)
    console.log(`\n${hostB.name}: "So maybe, MAYBE, it's not as cut and dry as my friend here thinks."`)
  } else {
    console.log(`\n${hostB.name}: "Look, I hear you, but let me play devil's advocate here..."`)
  }

  // REBUTTAL
  console.log('\n[REBUTTAL - 1 minute]')
  console.log(`\n${hostA.name}: "See, this is what I'm talking about! You're making my point FOR me!"`)
  console.log(`\n${hostB.name}: "*laughs* I'm not making your point, I'm EXPOSING your point. There's a difference."`)

  // CONCLUSION
  console.log('\n[CONCLUSION - 30 seconds]')
  console.log(`\n${hostA.name}: "At the end of the day, ${topic}. And I said what I said!"`)
  console.log(`\n${hostB.name}: "I guess we'll have to agree to disagree. But I'm not wrong. *looks at camera*"`)

  console.log('\n' + '-'.repeat(60))
  console.log('END OF SCRIPT')
  console.log('-'.repeat(60))

  return {
    format: 'talk_show_debate',
    hosts: [hostA, hostB],
    topic,
    durationEstimate: '6-8 minutes',
    segmentCount: 6,
  }
}

async function synthesizeNewsBulletin(client, topicId, claim) {
  console.log('\n' + '='.repeat(60))
  console.log('SYNTHESIZING NEWS BULLETIN')
  console.log('='.repeat(60))

  const host = HOSTS.maya_sterling
  console.log(`\nHOST: ${host.name} (${host.archetype})`)
  console.log(`TOPIC: "${claim.claim_text}"`)

  // Get the evidence
  const { rows: sources } = await client.query(`
    SELECT tr.text, tr.author_handle, tr.metrics_likes, tr.tweet_created_at
    FROM claim_mentions cm
    JOIN tweets_raw tr ON tr.id = cm.tweet_id
    WHERE cm.claim_id = $1
    ORDER BY tr.tweet_created_at DESC
    LIMIT 3
  `, [claim.id])

  console.log('\n' + '-'.repeat(60))
  console.log('GENERATED NEWS SCRIPT')
  console.log('-'.repeat(60))

  // HEADLINE
  console.log('\n[HEADLINE]')
  console.log(`\n${host.name}: "${host.tagline} ${claim.claim_text}."`)

  // KEY FACTS
  console.log('\n[KEY FACTS]')
  console.log(`\n${host.name}: "Here's what we know so far. This claim has been mentioned ${claim.mention_count} times across our monitored sources."`)

  if (sources.length > 0) {
    console.log(`\n${host.name}: "According to @${sources[0].author_handle}, and I quote: '${sources[0].text.slice(0, 150)}...'"`)
  }

  // SOURCES
  console.log('\n[SOURCES]')
  console.log(`\n${host.name}: "We've verified this with ${sources.length} independent sources."`)

  // WHAT'S NEXT
  console.log('\n[WHAT'S NEXT]')
  console.log(`\n${host.name}: "Watch this space - there's more to come on this story."`)

  console.log('\n' + '-'.repeat(60))

  return {
    format: 'news_bulletin',
    host,
    topic: claim.claim_text,
    durationEstimate: '2-3 minutes',
  }
}

async function synthesizeNarrativeStory(client, topicId, claim) {
  console.log('\n' + '='.repeat(60))
  console.log('SYNTHESIZING NARRATIVE STORY')
  console.log('='.repeat(60))

  const host = HOSTS.james_noble
  console.log(`\nNARRATOR: ${host.name} (${host.archetype})`)
  console.log(`STORY: "${claim.claim_text}"`)

  // Get entities involved
  const { rows: entities } = await client.query(`
    SELECT DISTINCT e.canonical_name, e.entity_type
    FROM entities e
    JOIN entity_mentions em ON em.entity_id = e.id
    JOIN tweets_raw tr ON tr.id = em.tweet_id
    WHERE tr.topic_id = $1
    AND e.entity_type = 'person'
    LIMIT 4
  `, [topicId])

  const characters = entities.map(e => e.canonical_name)

  console.log('\n' + '-'.repeat(60))
  console.log('GENERATED NARRATIVE SCRIPT')
  console.log('-'.repeat(60))

  // HOOK
  console.log('\n[HOOK]')
  console.log(`\n${host.name}: "${host.tagline} a moment that would change everything."`)

  // SETUP
  console.log('\n[SETUP]')
  console.log(`\n${host.name}: "In the world of battle rap, legends are made in three-minute rounds. But this story... this story is different."`)

  if (characters.length > 0) {
    console.log(`\n${host.name}: "Our story centers on ${characters.slice(0, 2).join(' and ')}. Two names that would soon become synonymous with ${claim.claim_text.split(' ').slice(0, 5).join(' ')}..."`)
  }

  // RISING ACTION
  console.log('\n[RISING ACTION]')
  console.log(`\n${host.name}: "But this was only the beginning. What happened next would shake the community to its core."`)

  // CLIMAX
  console.log('\n[CLIMAX]')
  console.log(`\n${host.name}: "${claim.claim_text}. The announcement sent shockwaves through social media."`)

  // RESOLUTION
  console.log('\n[RESOLUTION]')
  console.log(`\n${host.name}: "And so, the stage was set. History would remember this moment. The question is... will you?"`)

  console.log('\n' + '-'.repeat(60))

  return {
    format: 'narrative_story',
    host,
    topic: claim.claim_text,
    characters,
    durationEstimate: '5-7 minutes',
  }
}

async function synthesizeHotTake(client, topicId, claim) {
  console.log('\n' + '='.repeat(60))
  console.log('SYNTHESIZING HOT TAKE')
  console.log('='.repeat(60))

  const host = HOSTS.tasha_raw
  console.log(`\nHOST: ${host.name} (${host.archetype})`)
  console.log(`TOPIC: "${claim.claim_text}"`)

  console.log('\n' + '-'.repeat(60))
  console.log('GENERATED HOT TAKE SCRIPT')
  console.log('-'.repeat(60))

  // BOLD STATEMENT
  console.log('\n[BOLD STATEMENT]')
  console.log(`\n${host.name}: "Y'all, ${host.tagline}! Let's talk about ${claim.claim_text}."`)

  // REASONING
  console.log('\n[REASONING]')
  console.log(`\n${host.name}: "Now look, the streets is talking, and I'm about to tell y'all what NOBODY else will say..."`)

  // EVIDENCE
  console.log('\n[EVIDENCE]')
  console.log(`\n${host.name}: "This ain't just my opinion - ${claim.mention_count} sources are saying the same thing! If you know, you know."`)

  // MIC DROP
  console.log('\n[MIC DROP]')
  console.log(`\n${host.name}: "I said what I said. Periodt. If you disagree, @ me. I don't got time for the bullsh*t!"`)

  console.log('\n' + '-'.repeat(60))

  return {
    format: 'hot_take',
    host,
    topic: claim.claim_text,
    durationEstimate: '1-2 minutes',
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  const client = new Client({ connectionString: DATABASE_URL })

  try {
    await client.connect()
    console.log('Connected to database')

    // Get topic
    const { rows: topics } = await client.query(`SELECT id FROM topics WHERE name = 'Battle Rap'`)
    if (topics.length === 0) {
      console.log('No Battle Rap topic found. Run seed.js first!')
      return
    }
    const topicId = topics[0].id

    // Get claims with high contention (good for debates)
    const { rows: debateClaims } = await client.query(`
      SELECT c.*, cs.contention, cs.consensus
      FROM claims c
      LEFT JOIN consensus_scores cs ON cs.claim_id = c.id
      WHERE c.topic_id = $1
      AND cs.contention > 0.4
      ORDER BY cs.contention DESC
      LIMIT 1
    `, [topicId])

    // Get breaking news claims
    const { rows: breakingClaims } = await client.query(`
      SELECT c.*
      FROM claims c
      WHERE c.topic_id = $1
      AND c.claim_type = 'factual'
      AND c.status = 'emerging'
      ORDER BY c.first_seen DESC
      LIMIT 1
    `, [topicId])

    // Get narrative claims
    const { rows: narrativeClaims } = await client.query(`
      SELECT c.*
      FROM claims c
      WHERE c.topic_id = $1
      ORDER BY c.mention_count DESC
      LIMIT 1
    `, [topicId])

    // Get hot take claims (opinions)
    const { rows: hotTakeClaims } = await client.query(`
      SELECT c.*
      FROM claims c
      WHERE c.topic_id = $1
      AND c.claim_type = 'opinion'
      LIMIT 1
    `, [topicId])

    console.log('\n' + '█'.repeat(60))
    console.log('TALKSHOWGO - SHOW SYNTHESIS TEST')
    console.log('█'.repeat(60))

    // Synthesize different show types
    const results = []

    if (debateClaims.length > 0) {
      results.push(await synthesizeTalkShow(client, topicId, debateClaims[0]))
    }

    if (breakingClaims.length > 0) {
      results.push(await synthesizeNewsBulletin(client, topicId, breakingClaims[0]))
    }

    if (narrativeClaims.length > 0) {
      results.push(await synthesizeNarrativeStory(client, topicId, narrativeClaims[0]))
    }

    if (hotTakeClaims.length > 0) {
      results.push(await synthesizeHotTake(client, topicId, hotTakeClaims[0]))
    }

    // Summary
    console.log('\n' + '█'.repeat(60))
    console.log('SYNTHESIS SUMMARY')
    console.log('█'.repeat(60))

    console.log(`\nGenerated ${results.length} show scripts:`)
    for (const result of results) {
      console.log(`\n  ${result.format.toUpperCase()}`)
      console.log(`    Host(s): ${Array.isArray(result.hosts) ? result.hosts.map(h => h.name).join(', ') : result.host.name}`)
      console.log(`    Duration: ${result.durationEstimate}`)
      console.log(`    Topic: ${result.topic.slice(0, 50)}...`)
    }

    console.log('\n✓ Synthesis complete!')
    console.log('\nThese scripts demonstrate the Producer → Host → Show pipeline.')
    console.log('In production, these would be sent to TTS (11Labs) for audio generation.')

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await client.end()
  }
}

main()
