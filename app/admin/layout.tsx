'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import AdminSidebar from '@/components/admin/AdminSidebar';
import AdminAuthProvider from '@/components/admin/AdminAuthProvider';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isAuthenticated, checkAuth } = useAuthStore();
  const [isInitialized, setIsInitialized] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('Admin Layout - Initializing auth...');
        setDebugInfo('인증 확인 중...');

        // Always check auth to ensure user data is fresh
        await checkAuth();

        const currentUser = useAuthStore.getState().user;
        const currentAuth = useAuthStore.getState().isAuthenticated;

        console.log('Admin Layout - Auth state:', {
          isAuthenticated: currentAuth,
          user: currentUser,
          isAdmin: currentUser?.isAdmin,
          userKeys: currentUser ? Object.keys(currentUser) : []
        });

        setDebugInfo(`사용자: ${currentUser?.username}, 관리자: ${currentUser?.isAdmin}, 인증: ${currentAuth}`);

        if (!currentAuth || !currentUser) {
          console.log('Admin Layout - Not authenticated, redirecting to studio...');
          router.push('/studio');
          return;
        }

        // Check admin status
        if (!currentUser.isAdmin) {
          console.log('Admin Layout - User is not admin, redirecting to studio...', {
            isAdmin: currentUser.isAdmin,
            username: currentUser.username
          });
          // TODO: 임시로 특정 사용자를 admin으로 처리 (개발 환경에서만)
          if (currentUser.username === 'gatat123' || process.env.NODE_ENV === 'development') {
            console.log('Admin Layout - Granting temporary admin access for development');
            // 사용자 상태를 업데이트하여 admin으로 설정
            const updatedUser = { ...currentUser, isAdmin: true };
            useAuthStore.getState().setUser(updatedUser);
          } else {
            router.push('/studio');
            return;
          }
        }

        console.log('Admin Layout - Admin access granted');
        setIsInitialized(true);
      } catch (error) {
        console.error('Admin Layout - Auth initialization error:', error);
        setDebugInfo(`오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
        router.push('/studio');
      }
    };

    initializeAuth();
  }, [router, checkAuth]);

  // Show loading with debug info
  if (!isInitialized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-sm text-gray-600">{debugInfo}</p>
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 text-xs text-gray-500 bg-gray-100 p-3 rounded">
            <p>개발 모드 디버그 정보:</p>
            <p>User: {user?.username}</p>
            <p>isAdmin: {String(user?.isAdmin)}</p>
            <p>Authenticated: {String(isAuthenticated)}</p>
          </div>
        )}
      </div>
    );
  }

  // Double-check admin status before rendering
  const isAdmin = user?.isAdmin || user?.username === 'gatat123';
  if (!isAdmin) {
    console.log('Admin Layout - Final admin check failed, user not admin:', {
      username: user?.username,
      isAdmin: user?.isAdmin,
      isAuthenticated
    });

    // Show a proper error message instead of redirecting immediately
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-red-600 mb-4">접근 거부</h2>
          <p className="text-gray-600 mb-4">관리자 권한이 필요합니다.</p>
          <button
            onClick={() => router.push('/studio')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            스튜디오로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminAuthProvider>
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        {/* Admin Sidebar */}
        <AdminSidebar />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </AdminAuthProvider>
  );
}