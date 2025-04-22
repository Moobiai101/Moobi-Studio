'use client';

import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import { cn } from '@/lib/utils';
import { User, Settings, LogOut, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';

// This component wraps the main layout structure and manages sidebar state
export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const supabase = createClient();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
    };
    getSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => {
      subscription?.unsubscribe();
    };
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Optionally redirect after logout
    // router.push('/'); 
  };

  return (
    // Main container div
    <div className="min-h-screen flex flex-col bg-[url('/grid-pattern.svg')] bg-fixed">
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      {/* Main content area */}
      <main 
        className={cn(
          "relative flex-1 p-6 transition-[margin-left] duration-300 ease-in-out", 
          sidebarCollapsed ? "ml-16" : "ml-64" 
        )}
      >
        {/* Container for the User Dropdown/Login Button (Previously Header Content) */}
        <div className="absolute top-4 right-6 z-10">
          {loading ? (
            <div className="h-9 w-9 rounded-full bg-muted animate-pulse"></div>
          ) : session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-9 w-9 bg-secondary text-secondary-foreground hover:bg-secondary/80"
                >
                  <User className="h-5 w-5" />
                  <span className="sr-only">User Settings</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{session.user?.email || 'My Account'}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="outline">
              <Link href="/auth" className="gap-2">
                <LogIn className="h-4 w-4"/>
                 Login
              </Link>
            </Button>
          )}
        </div>

        {/* Page content */}
        {children}
      </main>
    </div>
  );
} 