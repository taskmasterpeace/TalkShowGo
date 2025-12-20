import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'

// GET /api/stories/[id] - Get single story candidate with related data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch the story candidate
    const { data: story, error: storyError } = await supabase
      .from('story_candidates')
      .select('*')
      .eq('id', id)
      .single()

    if (storyError) {
      if (storyError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Story not found' }, { status: 404 })
      }
      throw storyError
    }

    // Fetch related claims if there are primary_claims
    let claims: Array<{ id: string; claim_text: string; verdict: string; confidence_score: number }> = []
    if (story.primary_claims && story.primary_claims.length > 0) {
      const { data: claimsData } = await supabase
        .from('claims')
        .select('id, claim_text, verdict, confidence_score')
        .in('id', story.primary_claims)

      claims = claimsData || []
    }

    // Fetch related entities if there are primary_entities
    let entities: Array<{ id: string; name: string; entity_type: string; role: string; mention_count: number }> = []
    if (story.primary_entities && story.primary_entities.length > 0) {
      const { data: entitiesData } = await supabase
        .from('entities')
        .select('id, name, entity_type, role, mention_count')
        .in('id', story.primary_entities)

      entities = entitiesData || []
    }

    // Fetch source tweets that contributed to this story (from evidence package)
    let sources: Array<{ twitter_handle: string; credibility_score: number; count: number }> = []
    if (story.evidence_package?.source_tweets) {
      // Get unique sources from evidence package
      const tweetIds = story.evidence_package.source_tweets
      if (tweetIds.length > 0) {
        const { data: tweetsData } = await supabase
          .from('tweets')
          .select('author_handle, twitter_accounts(credibility_score)')
          .in('id', tweetIds)

        if (tweetsData) {
          // Group by handle and count
          const sourceMap = new Map<string, { credibility: number; count: number }>()
          tweetsData.forEach((t: any) => {
            const existing = sourceMap.get(t.author_handle)
            if (existing) {
              existing.count++
            } else {
              // twitter_accounts may be array or object depending on query
              const cred = Array.isArray(t.twitter_accounts)
                ? t.twitter_accounts[0]?.credibility_score
                : t.twitter_accounts?.credibility_score
              sourceMap.set(t.author_handle, {
                credibility: cred || 0.5,
                count: 1,
              })
            }
          })

          sources = Array.from(sourceMap.entries()).map(([handle, data]) => ({
            twitter_handle: handle,
            credibility_score: data.credibility,
            count: data.count,
          }))
        }
      }
    }

    // Fetch any existing draft
    const { data: draft } = await supabase
      .from('story_drafts')
      .select('*')
      .eq('story_candidate_id', id)
      .order('revision_number', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      ...story,
      claims,
      entities,
      sources,
      draft: draft || null,
    })
  } catch (error) {
    console.error('Error fetching story:', error)
    return NextResponse.json(
      { error: 'Failed to fetch story' },
      { status: 500 }
    )
  }
}

// PATCH /api/stories/[id] - Update story status or content
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, headline, summary } = body

    const updateData: Record<string, string> = {}
    if (status) updateData.status = status
    if (headline) updateData.headline = headline
    if (summary) updateData.summary = summary

    const { data, error } = await supabase
      .from('story_candidates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating story:', error)
    return NextResponse.json(
      { error: 'Failed to update story' },
      { status: 500 }
    )
  }
}
