/**
 * Test Perplexity entity enrichment
 */
import { enrichEntity } from './src/lib/entity-enrichment.ts'

async function main() {
  console.log('Testing Perplexity entity enrichment...')

  const result = await enrichEntity({
    entity_id: '787902db-27ff-42ef-aae7-5ad5a188ef86', // Lu Castro
    use_perplexity: true,
    niche_keywords: ['battle rap'],
    force: true
  })

  console.log('Result:', JSON.stringify(result, null, 2))
}

main().catch(console.error)
