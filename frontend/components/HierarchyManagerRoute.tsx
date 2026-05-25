import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { canManageUsers } from '@/lib/userHierarchy';

export default function HierarchyManagerRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const allowed = canManageUsers(user?.user_type);

  useEffect(() => {
    if (!isLoading && !allowed) {
      router.push('/dashboard');
    }
  }, [allowed, isLoading, router]);

  if (isLoading || !user || !allowed) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-gold" />
      </div>
    );
  }

  return <>{children}</>;
}
