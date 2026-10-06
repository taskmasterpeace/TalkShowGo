#!/usr/bin/env node

/**
 * Quick test to verify youtube-caption-extractor works
 */

import { getSubtitles } from 'youtube-caption-extractor'

const videoId = '8GhtB6SIKa4' // Geechi Gotti battle rap interview

console.log(`Testing youtube-caption-extractor with video: ${videoId}`)

try {
  const subtitles = await getSubtitles({
    videoID: videoId,
    lang: 'en'
  })

  if (!subtitles || subtitles.length === 0) {
    console.log('❌ No captions found')
    process.exit(1)
  }

  const fullText = subtitles
    .map(item => item.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  console.log('✅ SUCCESS! Got captions from YouTube')
  console.log(`✅ Caption count: ${subtitles.length} segments`)
  console.log(`✅ Total characters: ${fullText.length}`)
  console.log(`\n📝 First 500 characters:\n${fullText.substring(0, 500)}...`)

  process.exit(0)
} catch (error) {
  console.log('❌ ERROR:', error.message)
  process.exit(1)
}
