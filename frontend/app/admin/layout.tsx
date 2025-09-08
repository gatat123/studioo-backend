'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Check if user is authenticated and is an admin
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    // Check if user has admin privileges
    // In real app, this would check the actual user role from the auth store
    // For now, we'll check if username is 'admin' for demo purposes
    if (user?.username !== 'admin') {
      // Redirect non-admin users to studio
      router.push('/studio');
      return;
    }
  }, [isAuthenticated, user, router]);

  // Show loading state while checking auth
  if (!isAuthenticated || user?.username !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Checking permissions...</div>
      </div>
    );
  }

  return <>{children}</>;
}
