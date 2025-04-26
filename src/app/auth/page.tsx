'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Define custom theme colors based on Moobi Studio palette
const customTheme = {
  default: {
    colors: {
      brand: 'hsl(var(--primary))', // Use the primary CSS variable from shadcn/tailwind
      brandAccent: 'hsl(var(--primary) / 0.8)', // Slightly transparent primary for accent
      brandButtonText: 'hsl(var(--primary-foreground))', // Use the foreground CSS variable
      defaultButtonBackground: 'hsl(var(--muted))', // Use muted for secondary buttons
      defaultButtonBackgroundHover: 'hsl(var(--muted) / 0.8)',
      defaultButtonBorder: 'hsl(var(--muted-foreground))',
      defaultButtonText: 'hsl(var(--muted-foreground))',
      dividerBackground: 'hsl(var(--border))',
      inputBackground: 'hsl(var(--input))',
      inputBorder: 'hsl(var(--input))',
      inputBorderHover: 'hsl(var(--ring))',
      inputBorderFocus: 'hsl(var(--ring))',
      inputText: 'hsl(var(--foreground))',
      inputLabelText: 'hsl(var(--muted-foreground))',
      inputPlaceholder: 'hsl(var(--muted-foreground) / 0.7)',
      messageText: 'hsl(var(--foreground))',
      messageTextDanger: 'hsl(var(--destructive))',
      anchorTextColor: 'hsl(var(--primary))',
      anchorTextHoverColor: 'hsl(var(--primary) / 0.8)',
    },
    space: {
      spaceSmall: '4px',
      spaceMedium: '8px',
      spaceLarge: '16px',
      labelBottomMargin: '8px',
      anchorBottomMargin: '4px',
      emailInputSpacing: '4px',
      socialAuthSpacing: '8px',
      buttonPadding: '10px 15px',
      inputPadding: '10px 12px',
    },
    fontSizes: {
      baseBodySize: '14px',
      baseInputSize: '14px',
      baseLabelSize: '14px',
      baseButtonSize: '14px',
    },
    fonts: {
      bodyFontFamily: 'var(--font-manrope)', // Match layout font
      buttonFontFamily: 'var(--font-manrope)',
      inputFontFamily: 'var(--font-manrope)',
      labelFontFamily: 'var(--font-manrope)',
    },
    // Match shadcn/ui border radius
    radii: {
      borderRadiusButton: 'var(--radius)',
      buttonBorderRadius: 'var(--radius)',
      inputBorderRadius: 'var(--radius)',
    },
  },
};

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
            appearance={{
              theme: ThemeSupa,
              variables: customTheme,
            }}
            theme="dark"
            providers={['google']}
            redirectTo="/"
            showLinks={true}
            onlyThirdPartyProviders={false}
          />
        </CardContent>
      </Card>
    </div>
  )
} 