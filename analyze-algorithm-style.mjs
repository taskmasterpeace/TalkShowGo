/**
 * Analyze actual Algorithm Institute of Battle Rap videos
 * to understand their REAL tone and style (not the noir we generated)
 */

import pkg from './src/lib/youtube-api.ts'
const { getFreeYouTubeClient } = pkg

const ALGORITHM_CHANNEL_ID = 'UCsbjTS5ELYvqXQ_SF2WCbqg'

async function main() {
  console.log('Searching for Algorithm Institute of Battle Rap videos...\n')

  const youtube = getFreeYouTubeClient()

  // Get recent videos from the channel
  const videos = await youtube.getChannelVideos(ALGORITHM_CHANNEL_ID, 10)

  console.log(`Found ${videos.length} videos:\n`)

  for (const video of videos.slice(0, 5)) {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`TITLE: ${video.title}`)
    console.log(`VIDEO ID: ${video.id}`)
    console.log(`VIEWS: ${video.viewCount?.toLocaleString() || 'N/A'}`)
    console.log(`PUBLISHED: ${video.publishedAt}`)
    console.log(`DURATION: ${video.duration}`)
    console.log(`${'='.repeat(80)}`)

    // Get transcript
    console.log('\nFetching transcript...')
    const transcript = await youtube.getTranscript(video.id)

    if (transcript) {
      const fullText = transcript.fullText
      const firstParagraph = fullText.substring(0, 500)
      const lastParagraph = fullText.substring(Math.max(0, fullText.length - 500))

      console.log('\n--- OPENING (first 500 chars) ---')
      console.log(firstParagraph)
      console.log('\n--- CLOSING (last 500 chars) ---')
      console.log(lastParagraph)

      // Analyze tone
      console.log('\n--- STYLE ANALYSIS ---')

      // Check for noir/cinematic language
      const noirWords = ['fluorescent', 'pallor', 'sickly', 'shadows', 'dawn', 'windowless', 'grim', 'atmospheric']
      const hasNoir = noirWords.some(word => fullText.toLowerCase().includes(word))
      console.log(`Noir language detected: ${hasNoir}`)

      // Check for common phrases
      const commonPhrases = [
        'in the world of battle rap',
        'what happened was',
        'but what',
        'algorithm institute',
        'speaking facts',
        'go like and subscribe'
      ]

      for (const phrase of commonPhrases) {
        const count = (fullText.toLowerCase().match(new RegExp(phrase, 'g')) || []).length
        if (count > 0) {
          console.log(`"${phrase}": appears ${count} times`)
        }
      }

      // Word count
      const wordCount = fullText.split(/\s+/).length
      console.log(`Total words: ${wordCount}`)

      // Average sentence length
      const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 0)
      const avgSentenceLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length
      console.log(`Average sentence length: ${Math.round(avgSentenceLength)} words`)

    } else {
      console.log('No transcript available for this video')
    }

    console.log('\n')
  }

  console.log('\n\nAnalysis complete!')
}

main().catch(console.error)
