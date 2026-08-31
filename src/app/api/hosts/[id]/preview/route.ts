/**
 * Host Voice Preview API
 *
 * POST /api/hosts/[id]/preview
 * Generate a ~30 second audio preview in the host's voice
 *
 * Body:
 * - script?: string (optional custom script, default uses archetype-specific sample)
 */

import { NextRequest, NextResponse } from 'next/server'
import { HOSTS, type HostArchetype } from '@/lib/hosts/types'
import { generateDialogue, isDiaAvailable } from '@/lib/dia'
import * as fs from 'fs/promises'
import * as path from 'path'

// Sample scripts by archetype (~75 words each for ~30 second audio)
const TEST_SCRIPTS: Record<HostArchetype, string> = {
  investigative_anchor: `Breaking news from the battle rap world. Let me walk you through what just happened, because this is significant. We've been following this story for weeks, and now we finally have confirmation. Here's the thing - when you connect all the dots, the picture that emerges is fascinating. And this is why it matters to the culture.`,

  hot_take_king: `Y'all not ready for this! I've been saying it for MONTHS and nobody wanted to listen. But NOW? Now everybody sees what I was talking about! Let me be very clear about this - this changes EVERYTHING. And I said what I said! Don't come at me later acting like you knew, because I'm the one who called it first!`,

  witty_satirist: `Wait, wait, wait... are we seriously doing this right now? Let me get this straight. So you're telling me that THIS is the big announcement? I'm not even mad, I'm genuinely impressed at the audacity. Here's the thing though - and this is the beautiful part - nobody saw it coming. And scene.`,

  unfiltered_real: `Alright, let's get into this mess because I don't got time for the nonsense. Y'all hear what happened? The streets is watching and they're NOT happy. I said what I said - this was bound to happen eventually. But hold up, y'all not ready for this part. It gets even crazier. Period.`,

  smooth_narrator: `In the world of battle rap, few moments define an era. This is one of them. The stage was set, the players were in position, and what happened next would change everything. This is the story of how one moment shifted the entire landscape. History would remember this as a turning point.`,

  hype_energy: `LET'S GOOOO! We got breaking news and it's about to get CRAZY! Oh it's about to go DOWN! You already KNOW what time it is! Now THIS is what I'm talking about! Y'all ready for this?! But wait, it gets BETTER! That's CRAZY! We not done yet - stay tuned!`,

  street_analyst: `Now see, what people don't understand about this situation... this goes deeper than y'all think. Let me break this down for you, because if you know, you know. Real recognize real. The game is the game, and right now? The culture don't forget. That's game right there. Respect the game.`,
}

// Dia seed mapping for each archetype to get distinct voice characteristics
const ARCHETYPE_SEEDS: Record<HostArchetype, number> = {
  investigative_anchor: 100,
  hot_take_king: 200,
  witty_satirist: 300,
  unfiltered_real: 400,
  smooth_narrator: 500,
  hype_energy: 600,
  street_analyst: 700,
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Find host
    const host = HOSTS[id]
    if (!host) {
      return NextResponse.json(
        { error: `Host not found: ${id}` },
        { status: 404 }
      )
    }

    // Check Dia availability
    if (!await isDiaAvailable()) {
      return NextResponse.json(
        { error: 'Dia TTS service is not available. Start it with: npm run dia:up' },
        { status: 503 }
      )
    }

    // Get optional custom script
    const body = await request.json().catch(() => ({}))
    const script = body.script || TEST_SCRIPTS[host.archetype]

    console.log(`[HostPreview] Generating preview for ${host.name} (${host.archetype})`)
    console.log(`[HostPreview] Script length: ${script.split(/\s+/).length} words`)

    // Get seed for this archetype
    const seed = ARCHETYPE_SEEDS[host.archetype] || 42

    // Check cache first
    const cacheKey = `${id}_${script.slice(0, 50).replace(/[^a-z0-9]/gi, '_')}`
    const cacheDir = path.join(process.cwd(), 'public', 'audio', 'previews')
    const cacheFile = path.join(cacheDir, `${cacheKey}.mp3`)

    try {
      // Check if cached file exists and is less than 24 hours old
      const stats = await fs.stat(cacheFile)
      const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60)
      if (ageHours < 24) {
        console.log(`[HostPreview] Using cached audio for ${host.name}`)
        return NextResponse.json({
          success: true,
          host_id: id,
          host_name: host.name,
          archetype: host.archetype,
          audio_url: `/audio/previews/${cacheKey}.mp3`,
          duration_seconds: Math.ceil(script.split(/\s+/).length / 2.5),
          cached: true,
        })
      }
    } catch {
      // Cache miss - generate new audio
    }

    // Generate audio with Dia
    const audioBuffer = await generateDialogue({
      segments: [{ speaker: 1, text: script }],
      seed,
    })

    // Save to cache
    await fs.mkdir(cacheDir, { recursive: true })
    await fs.writeFile(cacheFile, audioBuffer)

    const audioUrl = `/audio/previews/${cacheKey}.mp3`
    const durationSeconds = Math.ceil(script.split(/\s+/).length / 2.5) // ~2.5 words per second

    console.log(`[HostPreview] Generated preview: ${audioUrl}`)

    return NextResponse.json({
      success: true,
      host_id: id,
      host_name: host.name,
      archetype: host.archetype,
      audio_url: audioUrl,
      duration_seconds: durationSeconds,
      cached: false,
    })

  } catch (error) {
    console.error('[HostPreview] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: String(error),
        message: 'Failed to generate host preview. Check Dia TTS configuration and logs.',
      },
      { status: 500 }
    )
  }
}

// GET - Return host info and test script
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const host = HOSTS[id]
    if (!host) {
      return NextResponse.json(
        { error: `Host not found: ${id}` },
        { status: 404 }
      )
    }

    const diaAvailable = await isDiaAvailable()

    return NextResponse.json({
      host: {
        id: host.id,
        name: host.name,
        archetype: host.archetype,
        tagline: host.tagline,
        description: host.description,
        voice: host.voice,
        style: host.style,
        catchphrases: host.delivery.catchphrases,
      },
      test_script: TEST_SCRIPTS[host.archetype],
      seed: ARCHETYPE_SEEDS[host.archetype],
      estimated_duration_seconds: Math.ceil(TEST_SCRIPTS[host.archetype].split(/\s+/).length / 2.5),
      dia_available: diaAvailable,
    })

  } catch (error) {
    console.error('[HostPreview] GET Error:', error)
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    )
  }
}
