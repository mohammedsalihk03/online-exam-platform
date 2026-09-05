import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

if (process.env.NODE_ENV === 'production' && (!supabaseUrl || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
  throw new Error('Production requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; memory storage is not durable')
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseServiceKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: { persistSession: false },
    })
  : null
