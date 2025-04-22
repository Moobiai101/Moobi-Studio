'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// This component listens for auth changes and refreshes the page
// to ensure server components update accordingly.
// It doesn't render anything itself.
export default function SupabaseListener() {
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Optional: Add logic here based on event (SIGNED_IN, SIGNED_OUT, etc.)
      console.log('Supabase auth event:', event);
      // Refresh the page to ensure server components update
      router.refresh();
    });

    // Cleanup subscription on component unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router])

  return null // This component does not render anything
} 