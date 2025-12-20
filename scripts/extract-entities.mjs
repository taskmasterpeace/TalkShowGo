/**
 * Entity Extraction from Battle Rap Videos
 *
 * Extracts battlers, leagues, and events from video titles
 * Inserts into entities table via database
 */

import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'talkshowgo',
  user: 'postgres',
  password: 'postgres',
})

const TOPIC_ID = '864dbcf4-e1f7-4b1a-86ed-c18007439ad5'

// Known leagues
const LEAGUES = [
  { name: 'Ultimate Rap League', aliases: ['URL', 'URLTV', 'SMACK'] },
  { name: 'King of the Dot', aliases: ['KOTD'] },
  { name: 'Rare Breed Entertainment', aliases: ['RBE'] },
  { name: 'The Battle League', aliases: ['TBL'] },
  { name: 'Caffeine', aliases: ['Caffeine TV'] },
]

// Known events
const EVENTS = [
  { name: 'NOME', type: 'event' },
  { name: 'Summer Madness', type: 'event' },
  { name: 'Born Legacy', type: 'event' },
  { name: 'TRAFFIC', type: 'event' },
]

async function main() {
  console.log('')
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║  ENTITY EXTRACTION FROM BATTLE RAP VIDEOS                 ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')
  console.log('')

  // Get all videos
  const { rows: videos } = await pool.query(`
    SELECT id, title, view_count
    FROM youtube_videos
    WHERE topic_id = $1
  `, [TOPIC_ID])

  console.log(`Processing ${videos.length} videos...\n`)

  const battlers = new Map() // name -> { count, totalViews }
  const leagues = new Map()
  const events = new Map()

  // Extract battlers from "X vs Y" patterns
  for (const video of videos) {
    const title = video.title.toUpperCase()
    const views = video.view_count || 0

    // Extract battlers from "X VS Y" pattern
    const vsMatch = title.match(/^([A-Z0-9\s\-'\.]+?)\s+(?:VS\.?|VERSUS)\s+([A-Z0-9\s\-'\.]+?)(?:\s*[-|]|$)/i)
    if (vsMatch) {
      const battler1 = cleanBattlerName(vsMatch[1])
      const battler2 = cleanBattlerName(vsMatch[2])

      if (battler1 && battler1.length > 2) {
        if (!battlers.has(battler1)) {
          battlers.set(battler1, { count: 0, totalViews: 0 })
        }
        battlers.get(battler1).count++
        battlers.get(battler1).totalViews += views
      }

      if (battler2 && battler2.length > 2) {
        if (!battlers.has(battler2)) {
          battlers.set(battler2, { count: 0, totalViews: 0 })
        }
        battlers.get(battler2).count++
        battlers.get(battler2).totalViews += views
      }
    }

    // Detect leagues
    for (const league of LEAGUES) {
      for (const alias of [league.name.toUpperCase(), ...league.aliases.map(a => a.toUpperCase())]) {
        if (title.includes(alias)) {
          if (!leagues.has(league.name)) {
            leagues.set(league.name, { count: 0, totalViews: 0, aliases: league.aliases })
          }
          leagues.get(league.name).count++
          leagues.get(league.name).totalViews += views
          break
        }
      }
    }
  }

  // Insert battlers
  console.log('BATTLERS EXTRACTED:')
  console.log('─'.repeat(60))

  const sortedBattlers = [...battlers.entries()]
    .sort((a, b) => b[1].totalViews - a[1].totalViews)

  let insertedBattlers = 0
  for (const [name, stats] of sortedBattlers) {
    // Check if exists
    const { rows: existing } = await pool.query(
      'SELECT id FROM entities WHERE topic_id = $1 AND canonical_name ILIKE $2',
      [TOPIC_ID, name]
    )

    if (existing.length === 0) {
      await pool.query(`
        INSERT INTO entities (topic_id, canonical_name, entity_type, mention_count, metadata)
        VALUES ($1, $2, 'person', $3, $4)
      `, [TOPIC_ID, name, stats.count, JSON.stringify({ totalViews: stats.totalViews, source: 'youtube_extraction' })])
      insertedBattlers++
    }

    const viewsStr = stats.totalViews > 1000000 ? `${(stats.totalViews/1000000).toFixed(1)}M` :
                     stats.totalViews > 1000 ? `${(stats.totalViews/1000).toFixed(0)}K` : stats.totalViews.toString()
    console.log(`   ${stats.count.toString().padStart(2)} battles | ${viewsStr.padStart(6)} views | ${name}`)
  }

  // Insert leagues
  console.log('\nLEAGUES DETECTED:')
  console.log('─'.repeat(60))

  let insertedLeagues = 0
  for (const [name, stats] of [...leagues.entries()].sort((a, b) => b[1].totalViews - a[1].totalViews)) {
    const { rows: existing } = await pool.query(
      'SELECT id FROM entities WHERE topic_id = $1 AND canonical_name = $2',
      [TOPIC_ID, name]
    )

    if (existing.length === 0) {
      const { rows: [entity] } = await pool.query(`
        INSERT INTO entities (topic_id, canonical_name, entity_type, mention_count, metadata)
        VALUES ($1, $2, 'organization', $3, $4)
        RETURNING id
      `, [TOPIC_ID, name, stats.count, JSON.stringify({ totalViews: stats.totalViews })])

      // Add aliases
      for (const alias of stats.aliases) {
        await pool.query(
          'INSERT INTO entity_aliases (entity_id, alias, source) VALUES ($1, $2, $3)',
          [entity.id, alias, 'extracted']
        )
      }
      insertedLeagues++
    }

    const viewsStr = stats.totalViews > 1000000 ? `${(stats.totalViews/1000000).toFixed(1)}M` :
                     stats.totalViews > 1000 ? `${(stats.totalViews/1000).toFixed(0)}K` : stats.totalViews.toString()
    console.log(`   ${stats.count.toString().padStart(2)} videos  | ${viewsStr.padStart(6)} views | ${name}`)
  }

  // Summary
  console.log('\n' + '═'.repeat(60))
  console.log('EXTRACTION COMPLETE')
  console.log('═'.repeat(60))

  const { rows: stats } = await pool.query(`
    SELECT entity_type, count(*) as count
    FROM entities
    WHERE topic_id = $1
    GROUP BY entity_type
  `, [TOPIC_ID])

  console.log(`
   Entities by Type:
   ─────────────────
${stats.map(s => `   ${s.entity_type.padEnd(15)} ${s.count}`).join('\n')}

   New Battlers:    ${insertedBattlers}
   New Leagues:     ${insertedLeagues}
  `)

  // Top battlers by views
  const { rows: topBattlers } = await pool.query(`
    SELECT canonical_name, mention_count, metadata->>'totalViews' as total_views
    FROM entities
    WHERE topic_id = $1 AND entity_type = 'person'
    ORDER BY (metadata->>'totalViews')::int DESC NULLS LAST
    LIMIT 20
  `, [TOPIC_ID])

  console.log('   TOP 20 BATTLERS BY TOTAL VIEWS:')
  console.log('   ' + '─'.repeat(50))
  for (const b of topBattlers) {
    const views = parseInt(b.total_views) || 0
    const viewsStr = views > 1000000 ? `${(views/1000000).toFixed(1)}M` :
                     views > 1000 ? `${(views/1000).toFixed(0)}K` : views.toString()
    console.log(`   ${viewsStr.padStart(6)} | ${b.canonical_name}`)
  }

  await pool.end()
}

function cleanBattlerName(name) {
  // Remove common suffixes and clean up
  return name
    .trim()
    .replace(/\s*[-|:].*/g, '') // Remove anything after - | :
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim()
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
