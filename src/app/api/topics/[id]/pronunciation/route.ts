/**
 * Pronunciation Dictionary API
 *
 * GET /api/topics/[id]/pronunciation
 * POST /api/topics/[id]/pronunciation
 * DELETE /api/topics/[id]/pronunciation?word=...
 *
 * Manage pronunciation dictionary for a topic
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getPronunciationDictionary,
  setPronunciation,
  deletePronunciation,
  importPronunciations,
  applyPronunciations,
  previewPronunciations
} from '@/lib/pronunciation'

/**
 * GET - List all pronunciations for a topic
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: topicId } = await params

    const dictionary = await getPronunciationDictionary(topicId)

    return NextResponse.json({
      success: true,
      topic_id: topicId,
      entries: dictionary,
      count: dictionary.length
    })
  } catch (error) {
    console.error('[API] Pronunciation GET error:', error)
    return NextResponse.json(
      { error: 'Failed to get pronunciation dictionary', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST - Add or update pronunciation entries
 *
 * Body:
 * - word: string (required for single add)
 * - phoneme: string (required for single add)
 * - ipa?: string
 * - notes?: string
 *
 * Or for bulk import:
 * - entries: Array<{ word, phoneme, ipa?, notes? }>
 *
 * Or for preview:
 * - preview_text: string (returns text with replacements applied)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: topicId } = await params
    const body = await request.json()

    // Preview mode
    if (body.preview_text) {
      const dictionary = await getPronunciationDictionary(topicId)
      const result = previewPronunciations(body.preview_text, dictionary)

      return NextResponse.json({
        success: true,
        original: body.preview_text,
        processed: result.processed,
        replacements: result.replacements
      })
    }

    // Bulk import
    if (body.entries && Array.isArray(body.entries)) {
      const result = await importPronunciations(topicId, body.entries)

      return NextResponse.json({
        success: result.errors.length === 0,
        imported: result.imported,
        errors: result.errors
      })
    }

    // Single add/update
    const { word, phoneme, ipa, notes } = body

    if (!word || !phoneme) {
      return NextResponse.json(
        { error: 'word and phoneme are required' },
        { status: 400 }
      )
    }

    await setPronunciation(topicId, word, phoneme, { ipa, notes })

    return NextResponse.json({
      success: true,
      message: `Pronunciation for "${word}" saved`,
      entry: { word: word.toUpperCase(), phoneme, ipa, notes }
    })
  } catch (error) {
    console.error('[API] Pronunciation POST error:', error)
    return NextResponse.json(
      { error: 'Failed to save pronunciation', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Remove a pronunciation entry
 *
 * Query params:
 * - word: string (required)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: topicId } = await params
    const { searchParams } = new URL(request.url)
    const word = searchParams.get('word')

    if (!word) {
      return NextResponse.json(
        { error: 'word query parameter is required' },
        { status: 400 }
      )
    }

    await deletePronunciation(topicId, word)

    return NextResponse.json({
      success: true,
      message: `Pronunciation for "${word}" deleted`
    })
  } catch (error) {
    console.error('[API] Pronunciation DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete pronunciation', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * PATCH - Apply pronunciations to text (utility endpoint)
 *
 * Body:
 * - text: string (required)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: topicId } = await params
    const body = await request.json()

    if (!body.text) {
      return NextResponse.json(
        { error: 'text is required' },
        { status: 400 }
      )
    }

    const dictionary = await getPronunciationDictionary(topicId)
    const processed = applyPronunciations(body.text, dictionary)

    return NextResponse.json({
      success: true,
      original: body.text,
      processed,
      applied_count: dictionary.filter(d =>
        body.text.toUpperCase().includes(d.word.toUpperCase())
      ).length
    })
  } catch (error) {
    console.error('[API] Pronunciation PATCH error:', error)
    return NextResponse.json(
      { error: 'Failed to apply pronunciations', details: String(error) },
      { status: 500 }
    )
  }
}
