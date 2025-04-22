import { createBrowserClient } from '@supabase/ssr'

// Note: supabase-js is installed automatically by @supabase/ssr

export function createClient() {
  // Create a supabase client on the browser with project's credentials
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
} 