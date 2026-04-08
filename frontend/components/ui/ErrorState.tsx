'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  message,
  onRetry,
}: ErrorStateProps) {
  const t = useTranslations('Common');
  const resolvedMessage = message ?? t('error');
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <svg
          className="w-7 h-7 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>
      <p className="text-gray-700 font-medium mb-1">{t('error')}</p>
      <p className="text-sm text-gray-500 max-w-sm mb-6">{resolvedMessage}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          aria-label={t('tryAgain')}
        >
          {t('tryAgain')}
        </button>
      )}
    </div>
  );
}
