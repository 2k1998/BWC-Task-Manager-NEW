'use client';

import { useState } from 'react';

/** Public URL paths tried in order (`public/` root → `public/branding/`). */
const LOGO_CANDIDATES = [
  '/logo.png',
  '/logo.svg',
  '/logo.webp',
  '/branding/logo.svg',
  '/branding/logo.png',
  '/branding/company-logo.png',
  '/branding/logo.webp',
];

type BrandingLogoProps = {
  className?: string;
  /** Total height in px (width follows aspect ratio). */
  height?: number;
  /** Screen-reader label */
  alt?: string;
};

/**
 * Renders the company logo from `public/logo.*` or `public/branding/` (first loadable URL wins).
 * Falls back to “BWC” text if every candidate fails (wrong path, 404, or missing file).
 */
export default function BrandingLogo({
  className = '',
  height = 40,
  alt = 'BWC Task Manager',
}: BrandingLogoProps) {
  const [candidateIndex, setCandidateIndex] = useState(0);

  if (candidateIndex >= LOGO_CANDIDATES.length) {
    return (
      <span
        className={`font-bold tracking-tight text-brand-gold ${className}`}
        style={{ fontSize: Math.max(18, height * 0.65) }}
      >
        BWC
      </span>
    );
  }

  const src = LOGO_CANDIDATES[candidateIndex];

  return (
    <img
      src={src}
      alt={alt}
      height={height}
      loading="eager"
      decoding="async"
      className={`h-auto w-auto max-w-full object-contain object-left ${className}`}
      style={{ maxHeight: height }}
      onError={() => setCandidateIndex((i) => i + 1)}
    />
  );
}
