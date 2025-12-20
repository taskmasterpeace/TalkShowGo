/**
 * Migration Script
 *
 * Runs the SQL migrations against the database
 * Run: node scripts/migrate.js
 */

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/talkshowgo'

async function migrate() {
  const client = new Client({ connectionString: DATABASE_URL })

  try {
    await client.connect()
    console.log('Connected to database')

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_initial_schema.sql')
    const migration = fs.readFileSync(migrationPath, 'utf8')

    console.log('Running migration...')
    await client.query(migration)

    console.log('✓ Migration completed successfully!')

  } catch (error) {
    // Check if it's just "already exists" errors
    if (error.message.includes('already exists')) {
      console.log('Tables already exist, skipping...')
    } else {
      console.error('Migration error:', error.message)
      process.exit(1)
    }
  } finally {
    await client.end()
  }
}

migrate()
