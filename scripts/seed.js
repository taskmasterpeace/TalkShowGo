/**
 * Seed Script - Battle Rap Topic
 *
 * Run: node scripts/seed.js
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:8000'
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'placeholder'

// For local postgres direct connection
const { Client } = require('pg')

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/talkshowgo'

async function seed() {
  const client = new Client({ connectionString: DATABASE_URL })

  try {
    await client.connect()
    console.log('Connected to database')

    // Create Battle Rap topic
    console.log('\nCreating Battle Rap topic...')
    const topicResult = await client.query(`
      INSERT INTO topics (name, description, status)
      VALUES ('Battle Rap', 'URL, RBE, KOTD battle rap news, culture, and community coverage', 'active')
      ON CONFLICT DO NOTHING
      RETURNING id, name
    `)

    let topicId
    if (topicResult.rows.length > 0) {
      topicId = topicResult.rows[0].id
      console.log(`Created topic: ${topicResult.rows[0].name} (${topicId})`)
    } else {
      // Topic already exists, get its ID
      const existing = await client.query(`SELECT id FROM topics WHERE name = 'Battle Rap'`)
      topicId = existing.rows[0].id
      console.log(`Topic already exists: Battle Rap (${topicId})`)
    }

    // Create credibility profile for the topic
    console.log('\nSetting up credibility profile...')
    await client.query(`
      INSERT INTO credibility_profiles (
        topic_id,
        youtube_min_subscribers,
        youtube_min_views,
        youtube_verified_bonus,
        twitter_min_followers,
        twitter_verified_bonus,
        engagement_weight,
        recency_weight
      ) VALUES ($1, 5000, 500, 0.15, 500, 0.1, 0.6, 0.3)
      ON CONFLICT (topic_id) DO NOTHING
    `, [topicId])
    console.log('Credibility profile configured')

    // Twitter seed accounts
    const twitterAccounts = [
      {
        handle: '@LTBRpodcast',
        displayName: 'LTBR Podcast',
        description: 'Battle rap podcast covering URL, RBE, and more',
        notes: 'Popular battle rap podcast, good for reactions and analysis',
      },
      {
        handle: '@15MOFERadio',
        displayName: '15 Minutes of Fame Radio',
        description: 'Battle rap radio and interviews',
        notes: 'Interview-focused, gets exclusive access to battlers',
      },
      {
        handle: '@hiphopisrealtv',
        displayName: 'Hip Hop Is Real TV',
        description: 'Hip hop and battle rap content',
        notes: 'Broader hip hop coverage but solid battle rap content',
      },
      {
        handle: '@KingDnaTooth',
        displayName: 'DNA Tooth',
        description: 'Battle rap blogger and news reporter',
        notes: 'Reports on salacious stories, people bring him wild exclusives. Not a battler - media personality.',
      },
      {
        handle: '@Vada_Fly',
        displayName: 'Vada Fly',
        description: 'Battle rap media personality',
        notes: 'Good for hot takes and community pulse',
      },
      {
        handle: '@BattleRapTrap',
        displayName: 'Battle Rap Trap',
        description: 'Battle rap news and predictions',
        notes: 'Daily uploads, predictions, reactions - very active',
      },
      {
        handle: '@ChrisUnbias',
        displayName: 'Chris Unbias',
        description: 'Battle rap journalist and content creator',
        notes: 'Analysis and breakdowns, sometimes controversial takes',
      },
      {
        handle: '@rapgrid',
        displayName: 'Rap Grid',
        description: 'Battle rap news aggregator',
        notes: 'Good for event announcements and news',
      },
      {
        handle: '@OTFMZLIVE',
        displayName: 'OTF MZ Live',
        description: 'Battle rap content and coverage',
        notes: 'Event coverage and reactions',
      },
    ]

    console.log('\nAdding Twitter seed accounts...')
    for (const account of twitterAccounts) {
      const result = await client.query(`
        INSERT INTO source_accounts (
          topic_id,
          platform,
          handle,
          display_name,
          description,
          notes,
          credibility_score,
          status
        ) VALUES ($1, 'twitter', $2, $3, $4, $5, 0.7, 'seed')
        ON CONFLICT (topic_id, platform, handle) DO UPDATE
        SET display_name = $3, description = $4, notes = $5
        RETURNING handle
      `, [topicId, account.handle, account.displayName, account.description, account.notes])

      console.log(`  Added: ${account.handle}`)
    }

    // YouTube trusted channels
    const youtubeChannels = [
      {
        channelName: 'Battle Rap Trap',
        handle: '@BattleRapTrap',
        description: 'Battle rap news, predictions, and reactions',
        notes: 'Very active, daily uploads, good for pulse of the community',
      },
      {
        channelName: '15 Minutes of Fame',
        handle: '@15MOFERadio',
        description: 'Battle rap interviews and radio content',
        notes: 'Exclusive interviews with battlers',
      },
      {
        channelName: 'Chris Unbias',
        handle: '@ChrisUnbias',
        description: 'Battle rap analysis and breakdowns',
        notes: 'In-depth analysis, prediction videos',
      },
      {
        channelName: 'Hip Hop Is Real TV',
        handle: '@hiphopisrealtv',
        description: 'Battle rap and hip hop content',
        notes: 'Event coverage and reactions',
      },
      {
        channelName: 'Angry Fan TV',
        handle: '@AngryFan007',
        description: 'Battle rap commentary and hot takes',
        notes: 'Known for passionate reactions and controversial opinions, engaging content',
      },
    ]

    console.log('\nAdding YouTube trusted channels...')
    for (const channel of youtubeChannels) {
      // Generate a placeholder channel ID (would be real YouTube channel ID in production)
      const channelId = `UC_${channel.handle.replace('@', '').toLowerCase()}`

      const result = await client.query(`
        INSERT INTO youtube_channels (
          topic_id,
          channel_id,
          channel_name,
          handle,
          description,
          notes,
          credibility_score,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, 0.75, 'trusted')
        ON CONFLICT (topic_id, channel_id) DO UPDATE
        SET channel_name = $3, description = $5, notes = $6
        RETURNING channel_name
      `, [topicId, channelId, channel.channelName, channel.handle, channel.description, channel.notes])

      console.log(`  Added: ${channel.channelName}`)
    }

    // Add RSS feeds / websites
    console.log('\nAdding RSS feeds and websites...')
    await client.query(`
      INSERT INTO rss_feeds (topic_id, feed_url, name, status)
      VALUES ($1, 'https://www.letstalkbattlerap.com/feed', 'Let''s Talk Battle Rap', 'active')
      ON CONFLICT (topic_id, feed_url) DO NOTHING
    `, [topicId])
    console.log('  Added: Let\'s Talk Battle Rap RSS feed')

    // Add some initial entities we know about
    // NOTE: Removed outdated orgs (Caffeine - dead, KOTD - inactive, RBE - inactive)
    const knownEntities = [
      { name: 'URL TV', type: 'organization', description: 'Ultimate Rap League - Premier battle rap platform, mostly streams on their app now' },
      { name: 'Summer Madness', type: 'event', description: 'URL flagship annual event' },
      { name: 'NOME', type: 'event', description: 'Night of Main Events - URL major event' },
      { name: 'Loaded Lux', type: 'person', description: 'Legendary battle rapper known for complex wordplay' },
      { name: 'Geechi Gotti', type: 'person', description: 'Champion battle rapper from Compton, URL face' },
      { name: 'Tay Roc', type: 'person', description: 'Cave Gang leader, aggressive gun bar specialist' },
      { name: 'DNA', type: 'person', description: 'Battle rapper and culture figure' },
      { name: 'Rum Nitty', type: 'person', description: 'Elite pen game specialist' },
      { name: 'Chess', type: 'person', description: 'Rising battle rapper' },
      { name: 'Ave', type: 'person', description: 'Bar-heavy battle rapper' },
      { name: 'Eazy The Block Captain', type: 'person', description: 'Philadelphia battle rapper, rising star' },
    ]

    console.log('\nAdding known entities...')
    for (const entity of knownEntities) {
      await client.query(`
        INSERT INTO entities (topic_id, canonical_name, entity_type, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
      `, [topicId, entity.name, entity.type, entity.description])
      console.log(`  Added: ${entity.name} (${entity.type})`)
    }

    // Add some entity aliases
    const aliases = [
      { entity: 'URL TV', alias: 'URL' },
      { entity: 'URL TV', alias: 'Ultimate Rap League' },
      { entity: 'URL TV', alias: '@urltv' },
      { entity: 'Loaded Lux', alias: 'Lux' },
      { entity: 'Loaded Lux', alias: '@LoadedLux' },
      { entity: 'Geechi Gotti', alias: 'Geechi' },
      { entity: 'Geechi Gotti', alias: '@GeechiGotti' },
      { entity: 'Summer Madness', alias: 'SM' },
      { entity: 'NOME', alias: 'Night of Main Events' },
      { entity: 'Eazy The Block Captain', alias: 'Eazy' },
      { entity: 'Eazy The Block Captain', alias: '@EazyTBC' },
      { entity: 'Tay Roc', alias: '@TayRoc' },
      { entity: 'Rum Nitty', alias: '@RumNitty' },
    ]

    console.log('\nAdding entity aliases...')
    for (const alias of aliases) {
      const entityResult = await client.query(
        `SELECT id FROM entities WHERE canonical_name = $1 AND topic_id = $2`,
        [alias.entity, topicId]
      )
      if (entityResult.rows.length > 0) {
        await client.query(`
          INSERT INTO entity_aliases (entity_id, alias, source)
          VALUES ($1, $2, 'manual')
          ON CONFLICT DO NOTHING
        `, [entityResult.rows[0].id, alias.alias])
      }
    }
    console.log(`  Added ${aliases.length} aliases`)

    console.log('\n✓ Seed completed successfully!')
    console.log('\nSummary:')
    console.log(`  - Topic: Battle Rap`)
    console.log(`  - Twitter accounts: ${twitterAccounts.length}`)
    console.log(`  - YouTube channels: ${youtubeChannels.length}`)
    console.log(`  - RSS feeds: 1 (Let's Talk Battle Rap)`)
    console.log(`  - Known entities: ${knownEntities.length}`)
    console.log(`  - Entity aliases: ${aliases.length}`)

    console.log('\nNext steps:')
    console.log('  1. Add your API keys to .env')
    console.log('  2. Run: npm run dev')
    console.log('  3. Visit http://localhost:3000')
    console.log('  4. Go to Jobs page and run PERIMETER sweep')

  } catch (error) {
    console.error('Seed error:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

seed()
