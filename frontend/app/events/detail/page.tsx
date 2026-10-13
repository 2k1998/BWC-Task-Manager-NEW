import { Suspense } from 'react';
import ProtectedLayout from '@/components/ProtectedLayout';
import { LoadingSkeleton } from '@/components/ui';
import PageClient from './page-client';

export default function Page() {
  return (
    <Suspense
      fallback={
        <ProtectedLayout>
          <LoadingSkeleton variant="list" count={1} />
        </ProtectedLayout>
      }
    >
      <PageClient />
    </Suspense>
  );
}
