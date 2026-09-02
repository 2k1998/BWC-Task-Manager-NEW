'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const pathname = window.location.pathname;
    // Static hosts serve index.html for `/chat` (no trailing slash). Reload
    // onto `/chat/` so the exported `chat/index.html` is used instead.
    if (pathname !== '/') {
      if (!pathname.endsWith('/')) {
        window.location.replace(`${pathname}/${window.location.search}${window.location.hash}`);
      }
      return;
    }
    if (isAuthenticated()) {
      router.replace('/dashboard/');
    } else {
      router.replace('/login/');
    }
  }, [router]);

  return null;
}
