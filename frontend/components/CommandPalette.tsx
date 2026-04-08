'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CommandResult } from '@/hooks/useCommandSearch';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  setQuery: (q: string) => void;
  results: CommandResult[];
}

export default function CommandPalette({ isOpen, onClose, query, setQuery, results }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 10);
      setSelectedIndex(0); // Reset selection
    }
  }, [isOpen]);

  // Handle Keyboard Navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results.length > 0 && results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  // Keep selected item in view (simple scroll handling)
  useEffect(() => {
    if (isOpen) {
      const selectedEl = document.getElementById(`cmd-item-${selectedIndex}`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, isOpen]);


  const handleSelect = (result: CommandResult) => {
    router.push(result.link);
    onClose();
  };

  const getIcon = (iconType?: string) => {
    // Return simple, non-noisy SVG icons based on type
    switch (iconType) {
      case 'collection': return <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
      case 'template': return <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>;
      case 'calendar': return <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
      case 'document': return <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
      case 'bell': return <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
      case 'users': return <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
      case 'clock': return <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
      case 'check-circle': return <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
      case 'plus': return <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>;
      default: return <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] sm:pt-[20vh] px-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-gray-500/20 transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Dialog */}
      <div 
        className="relative w-full max-w-xl bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center px-4 py-3 border-b border-gray-100">
          <svg className="w-5 h-5 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-400 sm:text-sm"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="hidden sm:inline-flex items-center justify-center px-2 py-1 text-[10px] font-medium text-gray-500 bg-gray-100 rounded border border-gray-200">
            ESC
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto overscroll-contain py-2">
          {results.length > 0 ? (
            <ul className="text-sm text-gray-700">
              {results.map((result, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <li
                    key={result.id}
                    id={`cmd-item-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    className={`flex items-center px-4 py-2 cursor-pointer transition-colors ${
                      isSelected ? 'bg-gray-100 text-gray-900' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className="flex-shrink-0 mr-3">
                      {getIcon(result.iconType)}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center justify-between">
                      <div className="flex flex-col truncate">
                        <span className="font-medium truncate">{result.title}</span>
                        {result.subtitle && (
                          <span className="text-xs text-gray-500 truncate">{result.subtitle}</span>
                        )}
                      </div>
                      {result.badge && (
                        <span className="ml-3 flex-shrink-0 px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200 rounded">
                          {result.badge}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
             <div className="py-14 px-6 text-center sm:px-14">
                <svg className="mx-auto h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="mt-4 text-sm text-gray-900 font-medium">No results found</p>
                <p className="mt-1 text-sm text-gray-500">We couldn't find anything matching "{query}".</p>
              </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="hidden sm:flex border-t border-gray-100 px-4 py-2 bg-gray-50 text-[10px] text-gray-500 items-center gap-4">
            <div className="flex items-center gap-1">
                <kbd className="bg-white border border-gray-200 rounded px-1 min-w-[16px] text-center">↑</kbd>
                <kbd className="bg-white border border-gray-200 rounded px-1 min-w-[16px] text-center">↓</kbd>
                <span>to navigate</span>
            </div>
            <div className="flex items-center gap-1">
                <kbd className="bg-white border border-gray-200 rounded px-1 min-w-[20px] text-center">↵</kbd>
                <span>to select</span>
            </div>
        </div>
      </div>
    </div>
  );
}
