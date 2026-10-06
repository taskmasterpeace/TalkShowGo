/**
 * Convert Orangeburg script to VibeVoice format
 *
 * Input: orangeburg-3host-script-dia.txt (with emotional markers)
 * Output: orangeburg-vibevoice.txt (Speaker 1/2/3 format)
 */

import * as fs from 'fs/promises'
import * as path from 'path'

async function main() {
  console.log('=== Converting to VibeVoice Format ===\n')

  // Read the Dia script (which has emotional markers)
  const scriptPath = path.join(process.cwd(), 'orangeburg-3host-script-dia.txt')
  const script = await fs.readFile(scriptPath, 'utf-8')

  // Parse script by speaker
  const lines = script.split('\n')
  let output = ''

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Replace speaker tags with VibeVoice format
    if (trimmed.startsWith('[MAYA')) {
      output += 'Speaker 1:'
    } else if (trimmed.startsWith('[MARCUS')) {
      output += 'Speaker 2:'
    } else if (trimmed.startsWith('[DR. CHEN') || trimmed.startsWith('[DR. SARAH')) {
      output += 'Speaker 3:'
    } else if (!trimmed.startsWith('[')) {
      // Content line - clean emotional markers and add content
      let cleanedText = trimmed
        .replace(/\(sighs\)/gi, '')
        .replace(/\(chuckle\)/gi, '')
        .replace(/\(whispers\)/gi, '')
        .replace(/\(inhales\)/gi, '')
        .replace(/\(exhales\)/gi, '')
        .replace(/\(gasps\)/gi, '')
        .replace(/\s+/g, ' ')  // Clean up extra spaces
        .trim()

      output += ' ' + cleanedText + '\n'
    }
  }

  // Write VibeVoice format
  const outputPath = path.join(process.cwd(), 'orangeburg-vibevoice.txt')
  await fs.writeFile(outputPath, output)

  console.log(`✓ Converted script saved: ${outputPath}`)
  console.log(`  Original: ${script.length} chars`)
  console.log(`  Converted: ${output.length} chars`)

  // Count lines
  const speakerLines = output.split('\n').filter(l => l.startsWith('Speaker ')).length
  console.log(`  Speaker lines: ${speakerLines}`)
}

main().catch(console.error)
