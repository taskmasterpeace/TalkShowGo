import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { ReviewNominationRequest } from '@/lib/types'

// POST /api/nominations/[id]/review - Approve/Reject nomination
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: ReviewNominationRequest = await request.json()

    // Get nomination
    const { data: nomination, error: fetchError } = await supabase
      .from('nominations')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError) throw fetchError
    if (!nomination) {
      return NextResponse.json(
        { error: 'Nomination not found' },
        { status: 404 }
      )
    }

    // Update nomination status
    const { error: updateError } = await supabase
      .from('nominations')
      .update({
        status: body.action === 'approve' ? 'approved' : body.action === 'reject' ? 'rejected' : 'deferred',
        rejection_reason: body.rejection_reason,
        reviewed_by: 'user',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    if (updateError) throw updateError

    // If approved, create source account
    if (body.action === 'approve') {
      const { error: sourceError } = await supabase
        .from('source_accounts')
        .insert({
          topic_id: nomination.topic_id,
          platform: nomination.platform,
          handle: nomination.identifier,
          status: 'verified',
          credibility_score: nomination.preliminary_score,
        })

      if (sourceError) throw sourceError
    }

    // Log the action
    await supabase.from('audit_log').insert({
      actor: 'user',
      action: `${body.action}_nomination`,
      target_type: 'nomination',
      target_id: params.id,
      details: { rejection_reason: body.rejection_reason },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reviewing nomination:', error)
    return NextResponse.json(
      { error: 'Failed to review nomination' },
      { status: 500 }
    )
  }
}
