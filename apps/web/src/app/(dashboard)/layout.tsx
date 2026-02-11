'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Database, MessageSquare, Home, Sparkles, ChevronLeft, ChevronRight, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const SIDEBAR_STORAGE_KEY = 'analytique-sidebar-collapsed';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) {
      setIsCollapsed(stored === 'true');
    }
    setMounted(true);
  }, []);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(newState));
  };

  const navItems = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/chat', icon: MessageSquare, label: 'Chat' },
    { href: '/schema', icon: Database, label: 'Schema' },
    { href: '/settings', icon: Shield, label: 'Security' },
  ];

  // Don't render different sizes until mounted to avoid hydration mismatch
  const sidebarWidth = !mounted ? 'w-16' : isCollapsed ? 'w-16' : 'w-52';

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen bg-background overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            'relative h-full border-r bg-card/50 backdrop-blur-sm flex flex-col py-4 transition-all duration-300 ease-in-out flex-shrink-0',
            sidebarWidth
          )}
        >
          {/* Logo */}
          <div className="flex items-center justify-center px-3 mb-4">
            <div className="p-2 rounded-lg bg-gradient-brand">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            {!isCollapsed && mounted && (
              <span className="ml-3 font-bold text-lg whitespace-nowrap overflow-hidden">
                Analytique
              </span>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 flex flex-col gap-1 px-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;

              const button = (
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full h-10 transition-all duration-200 rounded-lg',
                    isCollapsed ? 'justify-center px-0' : 'justify-start px-3 gap-3',
                    isActive && 'bg-accent text-accent-foreground shadow-sm'
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && mounted && (
                    <span className="whitespace-nowrap overflow-hidden">
                      {item.label}
                    </span>
                  )}
                </Button>
              );

              if (isCollapsed && mounted) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link href={item.href}>{button}</Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <Link key={item.href} href={item.href}>
                  {button}
                </Link>
              );
            })}
          </nav>

          {/* Bottom Section */}
          <div className={cn(
            'px-2 flex flex-col gap-2',
            isCollapsed ? 'items-center' : 'items-start'
          )}>
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Collapse Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-9 w-9 transition-all duration-200 rounded-lg hover:bg-accent"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}
