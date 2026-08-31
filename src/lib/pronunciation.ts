/**
 * Pronunciation Dictionary System
 *
 * Manages niche-specific pronunciations for TTS.
 * For example: "DAYLYT" -> "Day-lit", "QOTR" -> "Q-O-T-R"
 *
 * Works with TTS models that don't support phoneme tags
 * by replacing words with phonetic spellings before TTS.
 */

import { supabase } from './db'

// ============================================
// TYPES
// ============================================

export interface PronunciationEntry {
  id?: string
  word: string
  phoneme: string  // How to pronounce it
  ipa?: string     // IPA notation (optional)
  notes?: string
}

export interface PronunciationDictionary {
  topic_id: string
  entries: PronunciationEntry[]
  loaded_at: string
}

// Cache for pronunciation dictionaries
const dictionaryCache = new Map<string, PronunciationDictionary>()
const CACHE_TTL_MS = 5 * 60 * 1000  // 5 minutes

// ============================================
// DICTIONARY MANAGEMENT
// ============================================

/**
 * Get pronunciation dictionary for a topic
 * Cached for performance
 */
export async function getPronunciationDictionary(
  topicId: string
): Promise<PronunciationEntry[]> {
  // Check cache
  const cached = dictionaryCache.get(topicId)
  if (cached && Date.now() - new Date(cached.loaded_at).getTime() < CACHE_TTL_MS) {
    return cached.entries
  }

  // Load from database
  const { data, error } = await supabase
    .from('pronunciation_dictionary')
    .select('id, word, phoneme, ipa, notes')
    .eq('topic_id', topicId)
    .order('word')

  if (error) {
    console.error('[Pronunciation] Failed to load dictionary:', error)
    return []
  }

  const entries: PronunciationEntry[] = data || []

  // Cache it
  dictionaryCache.set(topicId, {
    topic_id: topicId,
    entries,
    loaded_at: new Date().toISOString()
  })

  return entries
}

/**
 * Add or update a pronunciation entry
 */
export async function setPronunciation(
  topicId: string,
  word: string,
  phoneme: string,
  options?: {
    ipa?: string
    notes?: string
    created_by?: string
  }
): Promise<void> {
  const { error } = await supabase
    .from('pronunciation_dictionary')
    .upsert({
      topic_id: topicId,
      word: word.toUpperCase(),  // Normalize to uppercase for matching
      phoneme,
      ipa: options?.ipa,
      notes: options?.notes,
      created_by: options?.created_by || 'manual',
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'topic_id,word'
    })

  if (error) {
    throw new Error(`Failed to set pronunciation: ${error.message}`)
  }

  // Invalidate cache
  dictionaryCache.delete(topicId)
}

/**
 * Delete a pronunciation entry
 */
export async function deletePronunciation(
  topicId: string,
  word: string
): Promise<void> {
  const { error } = await supabase
    .from('pronunciation_dictionary')
    .delete()
    .eq('topic_id', topicId)
    .eq('word', word.toUpperCase())

  if (error) {
    throw new Error(`Failed to delete pronunciation: ${error.message}`)
  }

  // Invalidate cache
  dictionaryCache.delete(topicId)
}

/**
 * Bulk import pronunciations
 */
export async function importPronunciations(
  topicId: string,
  entries: Array<{ word: string; phoneme: string; ipa?: string; notes?: string }>
): Promise<{ imported: number; errors: string[] }> {
  const errors: string[] = []
  let imported = 0

  for (const entry of entries) {
    try {
      await setPronunciation(topicId, entry.word, entry.phoneme, {
        ipa: entry.ipa,
        notes: entry.notes,
        created_by: 'import'
      })
      imported++
    } catch (error) {
      errors.push(`${entry.word}: ${error}`)
    }
  }

  return { imported, errors }
}

// ============================================
// TEXT PROCESSING
// ============================================

/**
 * Apply pronunciation replacements to text
 *
 * This is used before sending text to TTS when the TTS model
 * doesn't support phoneme/SSML tags.
 *
 * The dictionary is applied in order of word length (longest first)
 * to handle overlapping matches correctly.
 */
export function applyPronunciations(
  text: string,
  dictionary: PronunciationEntry[]
): string {
  if (!dictionary || dictionary.length === 0) {
    return text
  }

  // Sort by word length (longest first) to handle overlapping matches
  const sortedEntries = [...dictionary].sort(
    (a, b) => b.word.length - a.word.length
  )

  let result = text

  for (const entry of sortedEntries) {
    // Create case-insensitive regex with word boundaries
    // Handle special characters in the word
    const escapedWord = entry.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi')

    result = result.replace(regex, entry.phoneme)
  }

  return result
}

/**
 * Preview pronunciation replacements
 * Returns the text with replacements highlighted
 */
export function previewPronunciations(
  text: string,
  dictionary: PronunciationEntry[]
): { processed: string; replacements: Array<{ original: string; phoneme: string; count: number }> } {
  if (!dictionary || dictionary.length === 0) {
    return { processed: text, replacements: [] }
  }

  const replacements: Array<{ original: string; phoneme: string; count: number }> = []
  const sortedEntries = [...dictionary].sort(
    (a, b) => b.word.length - a.word.length
  )

  let result = text

  for (const entry of sortedEntries) {
    const escapedWord = entry.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi')

    const matches = text.match(regex)
    if (matches && matches.length > 0) {
      replacements.push({
        original: entry.word,
        phoneme: entry.phoneme,
        count: matches.length
      })
      result = result.replace(regex, entry.phoneme)
    }
  }

  return { processed: result, replacements }
}

// ============================================
// COMMON BATTLE RAP PRONUNCIATIONS
// ============================================

/**
 * Default battle rap pronunciations
 * These are seeded by the migration, but can be referenced here
 */
export const DEFAULT_BATTLE_RAP_PRONUNCIATIONS: PronunciationEntry[] = [
  { word: 'DAYLYT', phoneme: 'Day-lit', ipa: 'deɪ.lɪt', notes: 'Battle rapper from Watts, CA' },
  { word: 'QOTR', phoneme: 'Q-O-T-R', ipa: 'kjuː.oʊ.tiː.ɑːr', notes: 'Queen of the Ring - spell out' },
  { word: 'URL', phoneme: 'U-R-L', ipa: 'juː.ɑːr.ɛl', notes: 'Ultimate Rap League - spell out' },
  { word: 'RBE', phoneme: 'R-B-E', ipa: 'ɑːr.biː.iː', notes: 'Rare Breed Entertainment - spell out' },
  { word: 'KOTD', phoneme: 'K-O-T-D', ipa: 'keɪ.oʊ.tiː.diː', notes: 'King of the Dot - spell out' },
  { word: 'UM3', phoneme: 'U-M-3', ipa: 'juː.ɛm.θriː', notes: 'Ultimate Madness 3 - spell out' },
  { word: 'HHIR', phoneme: 'H-H-I-R', ipa: 'eɪtʃ.eɪtʃ.aɪ.ɑːr', notes: 'Hip Hop Is Real - spell out' },
  { word: '15MOFE', phoneme: 'Fifteen Mofay', ipa: 'fɪfˈtiːn moʊˈfeɪ', notes: '15 Minutes of Fame Entertainment' },
  { word: 'K-SHINE', phoneme: 'Kay-Shine', ipa: 'keɪ.ʃaɪn', notes: 'Battle rapper' },
  { word: 'T-TOP', phoneme: 'Tee-Top', ipa: 'tiː.tɒp', notes: 'Battle rapper' },
  { word: 'NJT', phoneme: 'N-J-T', ipa: 'ɛn.dʒeɪ.tiː', notes: 'New Jersey Twork - spell out' },
  { word: 'JC', phoneme: 'Jay-See', ipa: 'dʒeɪ.siː', notes: 'Battle rapper' },
  { word: 'JJDD', phoneme: 'J-J-D-D', ipa: 'dʒeɪ.dʒeɪ.diː.diː', notes: 'John John Da Don - spell out' },
  { word: 'DNA', phoneme: 'D-N-A', ipa: 'diː.ɛn.eɪ', notes: 'Battle rapper - spell out' },
]

/**
 * Check if a word might need pronunciation guidance
 * Heuristics for suggesting words to add to dictionary
 */
export function mightNeedPronunciation(word: string): boolean {
  // All caps words (likely acronyms or stage names)
  if (word === word.toUpperCase() && word.length >= 2) {
    return true
  }

  // Contains numbers
  if (/\d/.test(word)) {
    return true
  }

  // Contains hyphens (stage names like K-SHINE)
  if (word.includes('-')) {
    return true
  }

  // Unusual capitalization patterns
  if (/[A-Z].*[A-Z]/.test(word) && word !== word.toUpperCase()) {
    return true
  }

  return false
}

/**
 * Extract potential pronunciation candidates from text
 */
export function extractPronunciationCandidates(
  text: string,
  existingDictionary: PronunciationEntry[]
): string[] {
  const existingWords = new Set(existingDictionary.map(e => e.word.toUpperCase()))
  const candidates = new Set<string>()

  // Split on whitespace and punctuation
  const words = text.split(/[\s,.!?;:'"()[\]{}]+/)

  for (const word of words) {
    if (word.length < 2) continue
    if (existingWords.has(word.toUpperCase())) continue
    if (mightNeedPronunciation(word)) {
      candidates.add(word)
    }
  }

  return Array.from(candidates)
}

// ============================================
// CACHE MANAGEMENT
// ============================================

/**
 * Clear the pronunciation cache
 */
export function clearPronunciationCache(topicId?: string): void {
  if (topicId) {
    dictionaryCache.delete(topicId)
  } else {
    dictionaryCache.clear()
  }
}

/**
 * Pre-warm the cache for a topic
 */
export async function warmPronunciationCache(topicId: string): Promise<void> {
  await getPronunciationDictionary(topicId)
}
