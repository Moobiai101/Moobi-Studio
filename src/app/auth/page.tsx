'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AuthForm() {
  const supabase = createClient()
  const router = useRouter()
  const [sessionExists, setSessionExists] = useState(false)

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setSessionExists(true)
        router.push('/') // Redirect to home if already logged in
      } else {
        setSessionExists(false)
      }
    }
    checkSession()
  }, [supabase, router])

  // Prevent rendering the Auth form until we know if a session exists
  if (sessionExists) {
    return null; // Or a loading indicator
  }

  return (
    <div className="flex justify-center items-center min-h-screen px-4">
      <Card className="w-full max-w-md backdrop-blur-sm bg-card/80">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Sign In / Sign Up</CardTitle>
          <CardDescription>Access your Moobi Labs account</CardDescription>
        </CardHeader>
        <CardContent>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa, variables: { default: { colors: { brand: 'hsl(var(--primary))' } } } }}
            theme="dark"
            providers={['google']} // Add other providers like GitHub if configured
            redirectTo="/" // Redirect to home after successful login/signup
            showLinks={true}
            onlyThirdPartyProviders={false} // Show email/password too
          />
        </CardContent>
      </Card>
    </div>
  )
} 