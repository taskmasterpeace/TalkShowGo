import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:8000'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Service-level client with elevated permissions (for server-side operations)
const serviceKey = process.env.SUPABASE_SERVICE_KEY || supabaseKey
export const supabaseService = createClient(supabaseUrl, serviceKey)

// Direct postgres connection for server-side operations
export const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/talkshowgo'
