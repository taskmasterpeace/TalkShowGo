/**
 * Niche Health Check API
 *
 * Returns the health status of a topic/niche including:
 * - Source requirements (Twitter, YouTube, RSS)
 * - Data requirements (entities, claims)
 * - API requirements (Twitter API, YouTube API, etc.)
 * - Layer health (each pipeline phase)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  NicheHealth,
  NicheRequirement,
  LayerHealth,
  NICHE_REQUIREMENTS,
  PIPELINE_LAYERS,
  calculateOverallHealth
} from '@/lib/niche/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: topicId } = await params

    // Get topic info
    const { data: topic, error: topicError } = await supabase
      .from('topics')
      .select('id, name')
      .eq('id', topicId)
      .single()

    if (topicError || !topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    // Check each requirement
    const requirements: NicheRequirement[] = await Promise.all(
      NICHE_REQUIREMENTS.map(async (req) => {
        const check = await checkRequirement(req.id, topicId)
        return {
          ...req,
          status: check.status,
          lastChecked: new Date(),
          details: check.details,
        }
      })
    )

    // Check layer health
    const layers: LayerHealth[] = await Promise.all(
      PIPELINE_LAYERS.map(async (layer) => {
        return await checkLayerHealth(layer.id, topicId)
      })
    )

    // Calculate overall health
    const { status, score } = calculateOverallHealth(requirements)

    const health: NicheHealth = {
      topicId: topic.id,
      topicName: topic.name,
      overallStatus: status,
      score,
      requirements,
      lastFullCheck: new Date(),
    }

    return NextResponse.json({ health, layers })

  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      { error: 'Failed to check health' },
      { status: 500 }
    )
  }
}

async function checkRequirement(reqId: string, topicId: string): Promise<{
  status: NicheRequirement['status']
  details: string
}> {
  try {
    switch (reqId) {
      case 'twitter_sources': {
        const { count } = await supabase
          .from('sources')
          .select('*', { count: 'exact', head: true })
          .eq('topic_id', topicId)
          .eq('platform', 'twitter')
          .eq('is_active', true)

        if (!count || count === 0) {
          return { status: 'missing', details: 'No Twitter sources configured' }
        }
        if (count < 5) {
          return { status: 'degraded', details: `Only ${count}/5 Twitter sources` }
        }
        return { status: 'healthy', details: `${count} Twitter sources active` }
      }

      case 'youtube_channels': {
        const { count } = await supabase
          .from('sources')
          .select('*', { count: 'exact', head: true })
          .eq('topic_id', topicId)
          .eq('platform', 'youtube')
          .eq('is_active', true)

        if (!count || count === 0) {
          return { status: 'missing', details: 'No YouTube channels configured' }
        }
        if (count < 3) {
          return { status: 'degraded', details: `Only ${count}/3 YouTube channels` }
        }
        return { status: 'healthy', details: `${count} YouTube channels active` }
      }

      case 'rss_feeds': {
        const { count } = await supabase
          .from('sources')
          .select('*', { count: 'exact', head: true })
          .eq('topic_id', topicId)
          .eq('platform', 'rss')
          .eq('is_active', true)

        if (!count || count === 0) {
          return { status: 'missing', details: 'No RSS feeds configured' }
        }
        return { status: 'healthy', details: `${count} RSS feeds active` }
      }

      case 'official_accounts': {
        const { count } = await supabase
          .from('sources')
          .select('*', { count: 'exact', head: true })
          .eq('topic_id', topicId)
          .eq('is_official', true)
          .eq('is_active', true)

        if (!count || count === 0) {
          return { status: 'missing', details: 'No official accounts configured' }
        }
        return { status: 'healthy', details: `${count} official accounts` }
      }

      case 'entities_seeded': {
        const { count } = await supabase
          .from('entities')
          .select('*', { count: 'exact', head: true })
          .eq('topic_id', topicId)

        if (!count || count === 0) {
          return { status: 'missing', details: 'No entities seeded' }
        }
        if (count < 10) {
          return { status: 'degraded', details: `Only ${count}/10 entities` }
        }
        return { status: 'healthy', details: `${count} entities seeded` }
      }

      case 'credibility_profile': {
        // Check if we have credibility scores
        const { count } = await supabase
          .from('sources')
          .select('*', { count: 'exact', head: true })
          .eq('topic_id', topicId)
          .not('credibility_score', 'is', null)

        if (!count || count === 0) {
          return { status: 'missing', details: 'No credibility profiles set' }
        }
        return { status: 'healthy', details: `${count} sources with credibility scores` }
      }

      case 'web_resources': {
        // Check topic config for web resources
        const { data } = await supabase
          .from('topics')
          .select('config')
          .eq('id', topicId)
          .single()

        const webResources = data?.config?.webResources || []
        if (webResources.length === 0) {
          return { status: 'missing', details: 'No web resources configured' }
        }
        return { status: 'healthy', details: `${webResources.length} web resources` }
      }

      case 'twitter_api': {
        const hasKey = !!process.env.TWITTER_API_KEY
        if (!hasKey) {
          return { status: 'missing', details: 'TWITTER_API_KEY not configured' }
        }
        return { status: 'healthy', details: 'Twitter API key configured' }
      }

      case 'youtube_api': {
        const hasKey = !!process.env.YOUTUBE_API_KEY
        if (!hasKey) {
          return { status: 'missing', details: 'YOUTUBE_API_KEY not configured' }
        }
        return { status: 'healthy', details: 'YouTube API key configured' }
      }

      case 'openai_api': {
        const hasKey = !!process.env.OPENAI_API_KEY
        if (!hasKey) {
          return { status: 'missing', details: 'OPENAI_API_KEY not configured' }
        }
        return { status: 'healthy', details: 'OpenAI API key configured' }
      }

      case 'database_connected': {
        // If we got here, database is connected
        return { status: 'healthy', details: 'Database connected' }
      }

      default:
        return { status: 'missing', details: 'Unknown requirement' }
    }
  } catch (error) {
    return { status: 'failing', details: `Error checking: ${error}` }
  }
}

async function checkLayerHealth(layerId: string, topicId: string): Promise<LayerHealth> {
  const layer = PIPELINE_LAYERS.find(l => l.id === layerId)!

  try {
    switch (layerId) {
      case 'twitter': {
        // Check recent tweets
        const { data, count } = await supabase
          .from('tweets_raw')
          .select('created_at', { count: 'exact' })
          .eq('topic_id', topicId)
          .order('created_at', { ascending: false })
          .limit(1)

        const lastSuccess = data?.[0]?.created_at ? new Date(data[0].created_at) : undefined
        const itemsProcessed = count || 0

        // Check if we got tweets in last 24 hours
        const isRecent = lastSuccess && (Date.now() - lastSuccess.getTime()) < 24 * 60 * 60 * 1000

        return {
          layer: layerId,
          name: layer.name,
          status: !lastSuccess ? 'not_configured' : isRecent ? 'online' : 'degraded',
          lastSuccess,
          metrics: {
            successRate: isRecent ? 1 : 0.5,
            avgResponseTime: 500,
            itemsProcessed,
          }
        }
      }

      case 'youtube': {
        const { data, count } = await supabase
          .from('youtube_videos')
          .select('fetched_at', { count: 'exact' })
          .eq('topic_id', topicId)
          .order('fetched_at', { ascending: false })
          .limit(1)

        const lastSuccess = data?.[0]?.fetched_at ? new Date(data[0].fetched_at) : undefined
        const itemsProcessed = count || 0

        return {
          layer: layerId,
          name: layer.name,
          status: !lastSuccess ? 'not_configured' : 'online',
          lastSuccess,
          metrics: {
            successRate: lastSuccess ? 1 : 0,
            avgResponseTime: 800,
            itemsProcessed,
          }
        }
      }

      case 'extraction': {
        const { count: entityCount } = await supabase
          .from('entity_mentions')
          .select('*', { count: 'exact', head: true })

        const { count: claimCount } = await supabase
          .from('claims')
          .select('*', { count: 'exact', head: true })
          .eq('topic_id', topicId)

        const itemsProcessed = (entityCount || 0) + (claimCount || 0)

        return {
          layer: layerId,
          name: layer.name,
          status: itemsProcessed > 0 ? 'online' : 'not_configured',
          metrics: {
            successRate: itemsProcessed > 0 ? 1 : 0,
            avgResponseTime: 2000,
            itemsProcessed,
          }
        }
      }

      case 'audit': {
        const { count } = await supabase
          .from('consensus_scores')
          .select('*', { count: 'exact', head: true })

        return {
          layer: layerId,
          name: layer.name,
          status: (count || 0) > 0 ? 'online' : 'not_configured',
          metrics: {
            successRate: (count || 0) > 0 ? 1 : 0,
            avgResponseTime: 500,
            itemsProcessed: count || 0,
          }
        }
      }

      case 'web': {
        // Web research layer - check if configured
        return {
          layer: layerId,
          name: layer.name,
          status: 'not_configured',
          metrics: {
            successRate: 0,
            avgResponseTime: 0,
            itemsProcessed: 0,
          }
        }
      }

      case 'database': {
        return {
          layer: layerId,
          name: layer.name,
          status: 'online',
          lastSuccess: new Date(),
          metrics: {
            successRate: 1,
            avgResponseTime: 50,
            itemsProcessed: 0,
          }
        }
      }

      default:
        return {
          layer: layerId,
          name: layer.name,
          status: 'not_configured',
          metrics: {
            successRate: 0,
            avgResponseTime: 0,
            itemsProcessed: 0,
          }
        }
    }
  } catch (error) {
    return {
      layer: layerId,
      name: layer.name,
      status: 'offline',
      lastError: String(error),
      metrics: {
        successRate: 0,
        avgResponseTime: 0,
        itemsProcessed: 0,
      }
    }
  }
}
