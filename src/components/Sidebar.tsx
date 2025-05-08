"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Camera, 
  Video, 
  ImagePlus, 
  Headphones, 
  Home as HomeIcon,
  Sparkles,
  Settings,
  ChevronsLeft,
  ChevronsRight,
  ImageIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigationItems = [
  { name: 'Home', href: '/', icon: HomeIcon },
  { name: 'Video Studio', href: '/studios/video-studio', icon: Video },
  { name: 'Image Studio', href: '/studios/image-studio', icon: Camera },
  { name: 'Image Editing', href: '/studios/image-editing', icon: ImagePlus },
  { name: 'My Assets', href: '/studios/my-assets', icon: ImageIcon },
  { name: 'Dubbing Studio', href: '/studios/dubbing-studio', icon: Headphones },
];

// Define props interface
interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

// Accept props
export default function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className={cn(
      "h-full flex flex-col bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 border-r border-sidebar-border backdrop-blur-sm bg-opacity-80 transition-width duration-300",
      collapsed ? 'w-16' : 'w-64'
    )}>
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-sidebar-primary" />
          {!collapsed && <h1 className="text-xl font-bold">Studio</h1>}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 text-sidebar-foreground hover:text-sidebar-primary focus:outline-none"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center px-3 py-2 rounded-md transition-colors",
                collapsed ? 'justify-center' : 'gap-3',
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5",
                  isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60"
                )}
              />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="mt-4 text-xs text-sidebar-foreground/50 text-center">
          © 2025 MOOBILABS.{!collapsed && <><br />ALL RIGHTS RESERVED</>}
        </div>
      </div>
    </div>
  );
} 