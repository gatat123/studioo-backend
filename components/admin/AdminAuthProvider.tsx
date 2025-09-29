'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useRouter } from 'next/navigation';
import { hasAuthToken } from '@/lib/utils/cookies';

interface AdminAuthProviderProps {
  children: React.ReactNode;
}

/**
 * AdminAuthProvider Component
 * Manages authentication state for admin pages
 * Prevents unnecessary auth checks during navigation
 */
export default function AdminAuthProvider({ children }: AdminAuthProviderProps) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Create an interval to check token validity
    // This ensures the user stays logged in as long as the token is valid
    const checkTokenValidity = () => {
      const tokenExists = hasAuthToken();
      const currentUser = useAuthStore.getState().user;
      const currentAuth = useAuthStore.getState().isAuthenticated;

      // If token exists but auth state is lost (can happen on hydration issues)
      if (tokenExists && (!currentAuth || !currentUser)) {
        // Restore auth state from persisted storage or API
        useAuthStore.getState().checkAuth();
      }

      // If no token but still authenticated, clear auth state
      if (!tokenExists && currentAuth) {
        useAuthStore.getState().logout();
      }
    };

    // Check immediately on mount
    checkTokenValidity();

    // Set up periodic check (every 30 seconds)
    const interval = setInterval(checkTokenValidity, 30000);

    return () => clearInterval(interval);
  }, []);

  // Monitor auth state changes
  useEffect(() => {
    // Only redirect if explicitly not authenticated or not an admin
    // But avoid redirecting during initial load or hydration
    if (isAuthenticated === false || (user && !user.is_admin && user.username !== 'gatat123')) {
      console.log('AdminAuthProvider: Redirecting to studio due to auth/admin check failure');
      router.push('/studio');
    }
  }, [isAuthenticated, user, router]);

  return <>{children}</>;
}