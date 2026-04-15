'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/notifications/NotificationBell';
import PresenceSidebar from '@/components/presence/PresenceSidebar';
// We might want to move the user profile component here or reuse parts of sidebar.
// For now, I will reimplement a simple user profile display for the header.

import { Badge } from '@/components/ui'; // Assuming Badge exists
import CommandPalette from '@/components/CommandPalette';
import { useCommandSearch } from '@/hooks/useCommandSearch';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const cmdSearch = useCommandSearch();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = originalOverflow;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileMenuOpen]);

  if (isLoading) {
    return (
        <div className="h-screen w-full flex items-center justify-center bg-brand-silver/20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-gold border-t-transparent"></div>
        </div>
    );
  }

  if (!user) {
    return null;
  }

  const isAdmin = user?.user_type === 'Admin';

  return (
        <div className="flex h-dvh min-h-screen max-w-full bg-brand-silver/15 overflow-x-hidden">
          <Sidebar />
          <div className="flex-1 min-w-0 overflow-hidden flex flex-col transition-all duration-300">
            
            {/* Desktop Header */}
            <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 sm:px-8 shadow-sm z-20">
                 {/* Left side (Breadcrumbs or Page Title - placeholder for now, maybe mobile toggle) */}
                 <div className="flex items-center gap-4 flex-1">
                     <button
                        type="button"
                        onClick={() => setMobileMenuOpen(true)}
                        className="lg:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                        aria-label="Open navigation menu"
                     >
                        <Menu className="w-5 h-5" />
                     </button>
                     <span className="lg:hidden font-bold text-lg bg-clip-text text-transparent bg-brand-bar mr-2">BWC</span>
                     
                     {/* Command Palette Trigger */}
                     <button 
                        onClick={cmdSearch.toggle}
                        className="hidden sm:flex items-center w-full max-w-sm px-3 py-1.5 text-sm text-gray-600 bg-white border border-brand-silver/80 rounded-lg hover:bg-brand-silver/25 hover:text-black transition-colors focus:outline-none focus:ring-2 focus:ring-primary-gold"
                     >
                        <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <span className="flex-1 text-left">Search...</span>
                        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-medium text-gray-400 border border-gray-200 rounded">⌘K</kbd>
                     </button>
                 </div>

                 {/* Right side: Notifications + Profile */}
                 <div className="flex items-center gap-4 sm:gap-6">
                     <NotificationBell />
                     
                     <div className="h-8 w-px bg-gray-200 hidden sm:block"></div>

                     {/* Profile Dropdown / Display */}
                     <Link href="/profile" className="flex items-center gap-3 pl-2">
                        <div className="text-right hidden sm:block hover:opacity-90 transition-opacity">
                             <p className="text-sm font-medium text-gray-900 leading-none">{user.first_name} {user.last_name}</p>
                             <div className="mt-1 flex justify-end"> 
                                <Badge variant="status" color={isAdmin ? 'red' : 'gray'} className="px-1.5 py-0 text-[10px] uppercase inline-block">
                                    {user.user_type}
                                </Badge>
                             </div>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-primary-gold/20 flex items-center justify-center text-sm font-bold text-brand-brown ring-2 ring-white shadow-sm cursor-pointer hover:bg-primary-gold/35 transition-colors">
                             {user.first_name?.[0]}{user.last_name?.[0]}
                        </div>
                     </Link>
                 </div>
            </header>

            <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden px-4 py-3 sm:p-6 lg:p-8 scroll-smooth">
              <div className="w-full min-w-0 max-w-full">
                {children}
              </div>
            </main>
          </div>
          <PresenceSidebar />

          {mobileMenuOpen && (
            <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
              <button
                type="button"
                className="fixed inset-0 bg-black/40 z-40"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
              />
              <Sidebar
                mobile
                isOpen={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
                onNavigate={() => setMobileMenuOpen(false)}
              />
            </div>
          )}
          
          {/* Global Command Palette Overlay */}
          <CommandPalette 
             isOpen={cmdSearch.isOpen} 
             onClose={cmdSearch.close} 
             query={cmdSearch.query} 
             setQuery={cmdSearch.setQuery} 
             results={cmdSearch.results} 
          />
        </div>
  );
}
