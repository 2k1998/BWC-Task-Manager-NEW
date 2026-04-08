'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import BrandingLogo from '@/components/BrandingLogo';

interface SidebarProps {
  mobile?: boolean;
  isOpen?: boolean;
  onNavigate?: () => void;
  onClose?: () => void;
}

export default function Sidebar({ mobile = false, isOpen = false, onNavigate, onClose }: SidebarProps) {
  const pathname = usePathname();
  const tNav = useTranslations('Navigation');
  const tCommon = useTranslations('Common');
  const { user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const isAdmin = user?.user_type === 'Admin';

  const navItems = [
    { name: tNav('dashboard'), href: '/dashboard', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
    )},
    { name: tNav('tasks'), href: '/tasks', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
    )},
    { name: tNav('projects'), href: '/projects', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
    )},
    { name: tNav('events'), href: '/events', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
    )},
    { name: tNav('documents'), href: '/documents', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    )},
    { name: tNav('contacts'), href: '/contacts', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7.5 14.5A3.5 3.5 0 0011 11a3.5 3.5 0 00-3.5-3.5M17.5 14.5A3.5 3.5 0 0014 11a3.5 3.5 0 013.5-3.5M4 20a6 6 0 0110-3.5M20 20a6 6 0 00-10-3.5" /></svg>
    )},
    { name: tNav('companies'), href: '/companies', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008z" /></svg>
    )},
    { name: tNav('payments'), href: '/payments', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1.5v2.25M17.25 3.75l1.125 2.025M6.75 3.75L5.625 5.775M21 9.75v9.75a2 2 0 01-2 2H5a2 2 0 01-2-2V9.75m18 0H3m18 0l-3-4.5H6l-3 4.5m7.5 4.5h1.5a1.5 1.5 0 010 3h-1.5a1.5 1.5 0 010-3z" /></svg>
    )},
    { name: tNav('cars'), href: '/cars', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13.5h18M5.25 13.5l1.5-4.5a2.25 2.25 0 012.134-1.5h6.232a2.25 2.25 0 012.134 1.5l1.5 4.5M6 17.25A1.5 1.5 0 107.5 18.75 1.5 1.5 0 006 17.25zm10.5 0A1.5 1.5 0 1018 18.75a1.5 1.5 0 00-1.5-1.5zM4.5 13.5v3a1.5 1.5 0 001.5 1.5h12a1.5 1.5 0 001.5-1.5v-3" /></svg>
    )},
    { name: tNav('analytics'), href: '/analytics', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18M7.5 15v3m4.5-8v8m4.5-5v5" /></svg>
    )},
    { name: tNav('chat'), href: '/chat', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h7m-7 8-4-4V6a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H7z" /></svg>
    )},
  ];

  if (isAdmin) {
    navItems.push({ name: tNav('users'), href: '/admin/users', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
    )});
  }

  return (
    <aside
      className={`relative w-64 bg-black border-r border-brand-silver/20 flex-col flex-shrink-0 transition-all duration-300 ${
        mobile
          ? `fixed inset-y-0 left-0 z-50 flex h-full transform transition-transform duration-300 lg:hidden ${
              isOpen ? 'translate-x-0' : '-translate-x-full'
            }`
          : 'hidden lg:flex'
      }`}
    >
      <div className="min-h-16 flex flex-col justify-center gap-1 px-3 py-3 border-b border-brand-silver/15">
        {mobile && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-brand-silver hover:bg-white/10 lg:hidden"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        <BrandingLogo height={40} className="max-w-[220px]" alt="BWC Task Manager" />
        <span className="text-[11px] font-medium text-brand-silver/70 tracking-wide">
          {tNav('tasks')}
        </span>
      </div>
      
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {isAdmin && (
           <div className="px-3 py-2 text-xs font-semibold text-brand-silver/60 uppercase tracking-wider">
             {tNav('admin')}
           </div>
        )}
        {navItems.map((item) => {
          // If it's the Users link and user is not admin, skip (double check)
          if (item.href === '/admin/users' && !isAdmin) return null;
          
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => {
                onNavigate?.();
                onClose?.();
              }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? 'bg-brand-brown text-primary-gold shadow-sm ring-1 ring-primary-gold/30'
                  : 'text-sidebar-text hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className={`transition-colors duration-200 ${isActive ? 'text-primary-gold' : 'text-brand-silver/50 group-hover:text-brand-silver'}`}>
                {item.icon}
              </div>
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 pb-4">
        <div className="flex gap-1 justify-center mb-3">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`text-xs px-3 py-1 rounded-full transition ${
              language === 'en'
                ? 'bg-[#D1AE62] text-white'
                : 'bg-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLanguage('el')}
            className={`text-xs px-3 py-1 rounded-full transition ${
              language === 'el'
                ? 'bg-[#D1AE62] text-white'
                : 'bg-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            EL
          </button>
        </div>
        <button
          type="button"
          onClick={logout}
          className="w-full text-sm px-3 py-2 rounded-lg text-sidebar-text hover:bg-white/5 hover:text-white transition-all duration-200"
        >
          {tCommon('logout')}
        </button>
      </div>
    </aside>
  );
}
