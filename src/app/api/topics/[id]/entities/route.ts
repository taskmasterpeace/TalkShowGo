import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

// GET /api/topics/[id]/entities - List entities for topic
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: topicId } = await params
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const withContext = searchParams.get('withContext') === 'true'

    let query = supabase
      .from('entities')
      .select(`
        *,
        entity_aliases (
          id,
          alias,
          source
        )
      `)
      .eq('topic_id', topicId)
      .order('mention_count', { ascending: false })

    if (type) {
      query = query.eq('entity_type', type)
    }

    const { data, error } = await query

    if (error) throw error

    // If withContext is requested, fetch recent tweets for each entity
    let entitiesWithContext = data || []

    if (withContext && data && data.length > 0) {
      // Get entity mentions with tweet context for top entities
      const entityIds = data.slice(0, 20).map(e => e.id)

      const { data: mentions } = await supabase
        .from('entity_mentions')
        .select(`
          entity_id,
          sentiment,
          context_snippet,
          tweets_raw (
            id,
            text,
            author_handle,
            tweet_created_at,
            metrics_likes,
            metrics_retweets
          )
        `)
        .in('entity_id', entityIds)
        .order('created_at', { ascending: false })
        .limit(100)

      // Group mentions by entity
      const mentionsByEntity: Record<string, any[]> = {}
      mentions?.forEach(m => {
        if (!mentionsByEntity[m.entity_id]) {
          mentionsByEntity[m.entity_id] = []
        }
        if (mentionsByEntity[m.entity_id].length < 5) { // Max 5 mentions per entity
          mentionsByEntity[m.entity_id].push({
            sentiment: m.sentiment,
            context: m.context_snippet,
            tweet: m.tweets_raw,
          })
        }
      })

      // Compute sentiment breakdown for each entity
      entitiesWithContext = data.map(entity => {
        const entityMentions = mentionsByEntity[entity.id] || []
        const sentimentCounts = {
          positive: 0,
          negative: 0,
          neutral: 0,
          mixed: 0,
        }

        entityMentions.forEach(m => {
          if (m.sentiment && sentimentCounts.hasOwnProperty(m.sentiment)) {
            sentimentCounts[m.sentiment as keyof typeof sentimentCounts]++
          }
        })

        // Determine overall sentiment
        const total = Object.values(sentimentCounts).reduce((a, b) => a + b, 0)
        let overallSentiment = 'neutral'
        if (total > 0) {
          if (sentimentCounts.positive > sentimentCounts.negative * 2) {
            overallSentiment = 'positive'
          } else if (sentimentCounts.negative > sentimentCounts.positive * 2) {
            overallSentiment = 'negative'
          } else if (sentimentCounts.positive > 0 && sentimentCounts.negative > 0) {
            overallSentiment = 'mixed'
          }
        }

        return {
          ...entity,
          aliases: entity.entity_aliases?.map((a: { alias: string }) => a.alias) || [],
          sentimentBreakdown: sentimentCounts,
          overallSentiment,
          recentMentions: entityMentions.map(m => ({
            sentiment: m.sentiment,
            context: m.context,
            tweet: m.tweet ? {
              text: m.tweet.text,
              author: m.tweet.author_handle,
              date: m.tweet.tweet_created_at,
              likes: m.tweet.metrics_likes,
            } : null,
          })),
        }
      })
    } else {
      // Transform to include aliases as array
      entitiesWithContext = data?.map(entity => ({
        ...entity,
        aliases: entity.entity_aliases?.map((a: { alias: string }) => a.alias) || [],
      })) || []
    }

    return NextResponse.json(entitiesWithContext)
  } catch (error) {
    console.error('Error fetching entities:', error)
    return NextResponse.json(
      { error: 'Failed to fetch entities' },
      { status: 500 }
    )
  }
}

// POST /api/topics/[id]/entities - Add entity
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: topicId } = await params
    const body = await request.json()

    if (!body.name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      )
    }

    // Insert entity
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .insert({
        topic_id: topicId,
        canonical_name: body.name,
        entity_type: body.type || 'other',
        description: body.description || null,
        notes: body.notes || null,
      })
      .select()
      .single()

    if (entityError) throw entityError

    // Insert aliases if provided
    if (body.aliases && body.aliases.length > 0) {
      const aliasRecords = body.aliases.map((alias: string) => ({
        entity_id: entity.id,
        alias: alias.trim(),
        source: 'manual',
      }))

      await supabase.from('entity_aliases').insert(aliasRecords)
    }

    return NextResponse.json(entity, { status: 201 })
  } catch (error) {
    console.error('Error adding entity:', error)
    return NextResponse.json(
      { error: 'Failed to add entity' },
      { status: 500 }
    )
  }
}

// DELETE /api/topics/[id]/entities?entityId=xxx
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: topicId } = await params
    const { searchParams } = new URL(request.url)
    const entityId = searchParams.get('entityId')

    if (!entityId) {
      return NextResponse.json(
        { error: 'entityId parameter is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('entities')
      .delete()
      .eq('id', entityId)
      .eq('topic_id', topicId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting entity:', error)
    return NextResponse.json(
      { error: 'Failed to delete entity' },
      { status: 500 }
    )
  }
}

// PATCH /api/topics/[id]/entities - Update entity (add alias)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: topicId } = await params
    const body = await request.json()

    if (!body.entityId) {
      return NextResponse.json(
        { error: 'entityId is required' },
        { status: 400 }
      )
    }

    // Add alias if provided
    if (body.addAlias) {
      const { error } = await supabase
        .from('entity_aliases')
        .insert({
          entity_id: body.entityId,
          alias: body.addAlias.trim(),
          source: 'manual',
        })

      if (error) throw error
    }

    // Update entity fields if provided
    if (body.description || body.notes || body.type) {
      const updates: Record<string, string> = {}
      if (body.description) updates.description = body.description
      if (body.notes) updates.notes = body.notes
      if (body.type) updates.entity_type = body.type

      const { error } = await supabase
        .from('entities')
        .update(updates)
        .eq('id', body.entityId)
        .eq('topic_id', topicId)

      if (error) throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating entity:', error)
    return NextResponse.json(
      { error: 'Failed to update entity' },
      { status: 500 }
    )
  }
}
