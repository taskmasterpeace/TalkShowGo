/**
 * Battle Rap Niche - Complete Summary
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

async function main() {
  console.log('')
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗')
  console.log('║                    BATTLE RAP NICHE - COMPLETE SUMMARY                    ║')
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝')

  // Get topic info
  const { rows: [topic] } = await pool.query(`
    SELECT * FROM topics WHERE id = $1
  `, [TOPIC_ID])

  console.log(`
╭───────────────────────────────────────────────────────────────────────────╮
│ TOPIC: ${topic.name.padEnd(67)}│
│ Status: ${topic.status.padEnd(66)}│
│ Created: ${topic.created_at.toISOString().substring(0,10).padEnd(65)}│
╰───────────────────────────────────────────────────────────────────────────╯
`)

  // ===== TWITTER SOURCES =====
  const { rows: twitterSources } = await pool.query(`
    SELECT handle, display_name, status, credibility_score
    FROM source_accounts
    WHERE topic_id = $1 AND platform = 'twitter'
    ORDER BY credibility_score DESC
  `, [TOPIC_ID])

  console.log(`
┌─────────────────────────────────────────────────────────────────────────────┐
│ TWITTER SOURCES (${twitterSources.length})                                                        │
├─────────────────────────────────────────────────────────────────────────────┤`)

  for (const src of twitterSources) {
    const score = (src.credibility_score * 100).toFixed(0) + '%'
    console.log(`│ @${src.handle.padEnd(20)} ${src.display_name.substring(0,25).padEnd(25)} ${score.padStart(5)} ${src.status.padEnd(10)}│`)
  }
  console.log(`└─────────────────────────────────────────────────────────────────────────────┘`)

  // ===== YOUTUBE CHANNELS =====
  const { rows: ytChannels } = await pool.query(`
    SELECT yc.channel_name, yc.status, yc.credibility_score, count(yv.id) as video_count
    FROM youtube_channels yc
    LEFT JOIN youtube_videos yv ON yv.channel_id = yc.id
    WHERE yc.topic_id = $1
    GROUP BY yc.id
    ORDER BY video_count DESC
  `, [TOPIC_ID])

  console.log(`
┌─────────────────────────────────────────────────────────────────────────────┐
│ YOUTUBE CHANNELS (${ytChannels.length})                                                       │
├─────────────────────────────────────────────────────────────────────────────┤`)

  for (const ch of ytChannels) {
    const score = (ch.credibility_score * 100).toFixed(0) + '%'
    console.log(`│ ${ch.channel_name.substring(0,35).padEnd(35)} ${ch.video_count.toString().padStart(3)} videos  ${score.padStart(5)} ${ch.status.padEnd(8)}│`)
  }
  console.log(`└─────────────────────────────────────────────────────────────────────────────┘`)

  // ===== TOP VIDEOS =====
  const { rows: topVideos } = await pool.query(`
    SELECT yv.title, yv.view_count, yc.channel_name
    FROM youtube_videos yv
    JOIN youtube_channels yc ON yc.id = yv.channel_id
    WHERE yv.topic_id = $1
    ORDER BY yv.view_count DESC NULLS LAST
    LIMIT 15
  `, [TOPIC_ID])

  console.log(`
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOP 15 VIDEOS BY VIEWS                                                      │
├─────────────────────────────────────────────────────────────────────────────┤`)

  for (const v of topVideos) {
    const views = v.view_count > 1000000 ? `${(v.view_count/1000000).toFixed(1)}M` :
                  v.view_count > 1000 ? `${(v.view_count/1000).toFixed(0)}K` : (v.view_count || 0).toString()
    console.log(`│ ${views.padStart(6)} │ ${v.title.substring(0,60).padEnd(60)} │`)
  }
  console.log(`└─────────────────────────────────────────────────────────────────────────────┘`)

  // ===== ENTITIES =====
  const { rows: entityStats } = await pool.query(`
    SELECT entity_type, count(*) as count
    FROM entities
    WHERE topic_id = $1
    GROUP BY entity_type
  `, [TOPIC_ID])

  const { rows: topBattlers } = await pool.query(`
    SELECT canonical_name, mention_count, metadata->>'totalViews' as total_views
    FROM entities
    WHERE topic_id = $1 AND entity_type = 'person'
    ORDER BY (metadata->>'totalViews')::int DESC NULLS LAST
    LIMIT 20
  `, [TOPIC_ID])

  const { rows: leagues } = await pool.query(`
    SELECT canonical_name, mention_count
    FROM entities
    WHERE topic_id = $1 AND entity_type = 'organization'
    ORDER BY mention_count DESC
  `, [TOPIC_ID])

  console.log(`
┌─────────────────────────────────────────────────────────────────────────────┐
│ ENTITIES EXTRACTED                                                          │
├─────────────────────────────────────────────────────────────────────────────┤`)

  for (const stat of entityStats) {
    console.log(`│ ${stat.entity_type.padEnd(15)} ${stat.count.toString().padStart(5)} entities                                          │`)
  }

  console.log(`├─────────────────────────────────────────────────────────────────────────────┤
│ TOP BATTLERS BY VIEWS:                                                      │`)

  for (const b of topBattlers.slice(0, 10)) {
    const views = parseInt(b.total_views) || 0
    const viewsStr = views > 1000000 ? `${(views/1000000).toFixed(1)}M` :
                     views > 1000 ? `${(views/1000).toFixed(0)}K` : views.toString()
    console.log(`│ ${viewsStr.padStart(6)} │ ${b.canonical_name.padEnd(66)}│`)
  }

  console.log(`├─────────────────────────────────────────────────────────────────────────────┤
│ LEAGUES:                                                                    │`)

  for (const l of leagues) {
    console.log(`│ ${l.mention_count.toString().padStart(3)} videos │ ${l.canonical_name.padEnd(62)}│`)
  }
  console.log(`└─────────────────────────────────────────────────────────────────────────────┘`)

  // ===== TOTAL STATS =====
  const { rows: [counts] } = await pool.query(`
    SELECT
      (SELECT count(*) FROM source_accounts WHERE topic_id = $1) as twitter_sources,
      (SELECT count(*) FROM youtube_channels WHERE topic_id = $1) as youtube_channels,
      (SELECT count(*) FROM youtube_videos WHERE topic_id = $1) as youtube_videos,
      (SELECT count(*) FROM entities WHERE topic_id = $1) as entities,
      (SELECT sum(view_count) FROM youtube_videos WHERE topic_id = $1) as total_views
  `, [TOPIC_ID])

  const totalViews = parseInt(counts.total_views) || 0
  const viewsStr = totalViews > 1000000 ? `${(totalViews/1000000).toFixed(1)}M` :
                   totalViews > 1000 ? `${(totalViews/1000).toFixed(0)}K` : totalViews.toString()

  console.log(`
╔═══════════════════════════════════════════════════════════════════════════╗
║                              TOTAL STATS                                  ║
╠═══════════════════════════════════════════════════════════════════════════╣
║   Twitter Sources:     ${counts.twitter_sources.toString().padEnd(50)}║
║   YouTube Channels:    ${counts.youtube_channels.toString().padEnd(50)}║
║   YouTube Videos:      ${counts.youtube_videos.toString().padEnd(50)}║
║   Entities Extracted:  ${counts.entities.toString().padEnd(50)}║
║   Total Video Views:   ${viewsStr.padEnd(50)}║
╚═══════════════════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════════════════════╗
║                          MY DECISIONS SUMMARY                             ║
╠═══════════════════════════════════════════════════════════════════════════╣
║   Twitter:    Major leagues (URL, KOTD, RBE) + media (JayBlac, 15MOFE,   ║
║               HHIR, Rap Grid) + personalities (Aye Verb, Champagne Duane)║
║                                                                           ║
║   YouTube:    6 major channels including YOUR channel (Algorithm Inst.)  ║
║               - URLTV (Ultimate Rap League)                               ║
║               - King Of The Dot (KOTD)                                    ║
║               - Rare Breed Ent (RBE)                                      ║
║               - No Studio'N Network                                       ║
║               - Jayblac1615                                               ║
║               - Algorithm Institute of Battle Rap (YOUR CHANNEL)          ║
║                                                                           ║
║   TTS:        ElevenLabs with YOUR cloned voice "Battlerap Algorithm"    ║
║               Voice ID: ZJ7BlVZrxZKBDMTIK5c9                              ║
║                                                                           ║
║   Host:       Algorithm Institute (documentary narrator style)            ║
║               Catchphrase: "In the world of battle rap..."                ║
║                                                                           ║
║   Output:     All formats - Short-form, YouTube Videos, Podcast          ║
╚═══════════════════════════════════════════════════════════════════════════╝

🎤 YOUR VOICE PREVIEW:  http://localhost:3000/studio/preview
📊 VIEW PERIMETER:      http://localhost:3000/perimeter
🗺️  VIEW EXTRACTION:    http://localhost:3000/extraction
📰 VIEW NEXUS:          http://localhost:3000/nexus
`)

  await pool.end()
}

main().catch(console.error)
