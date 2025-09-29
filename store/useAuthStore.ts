import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { authAPI } from '@/lib/api/auth';
import { setAuthToken, getAuthToken, removeAuthToken, hasAuthToken } from '@/lib/utils/cookies';
import type { User } from '@/types';

// Auth store state interface
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (credentials: { username: string; password: string }) => Promise<void>;
  register: (data: { username: string; email: string; password: string; nickname: string }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
}

// Create auth store with persistence
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Login function with actual API call
      login: async (credentials) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await authAPI.login(credentials);
          
          if (response.user) {
            const user: User = {
              ...response.user,
              profile_image_url: response.user.profile_image_url || undefined,
              created_at: response.user.created_at || new Date().toISOString(),
              updated_at: response.user.updated_at || new Date().toISOString(),
              is_active: response.user.is_active !== undefined ? response.user.is_active : true,
              // 임시로 특정 사용자를 관리자로 설정 (테스트용)
              is_admin: response.user.username === 'gatat123' ? true : (response.user.isAdmin || response.user.is_admin || false)
            };
            
            // Set authentication token
            const token = response.accessToken || response.token;
            if (token) {
              setAuthToken(token);
            }
            
            set({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '로그인에 실패했습니다.';
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      // Register function with actual API call
      register: async (data) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await authAPI.register(data);
          
          if (response.user) {
            const user: User = {
              ...response.user,
              profile_image_url: response.user.profile_image_url || undefined,
              created_at: response.user.created_at || new Date().toISOString(),
              updated_at: response.user.updated_at || new Date().toISOString(),
              is_active: response.user.is_active !== undefined ? response.user.is_active : true,
              // 임시로 특정 사용자를 관리자로 설정 (테스트용)
              is_admin: response.user.username === 'gatat123' ? true : (response.user.isAdmin || response.user.is_admin || false)
            };
            
            // Set authentication token
            const token = response.accessToken || response.token;
            if (token) {
              setAuthToken(token);
            }
            
            set({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '회원가입에 실패했습니다.';
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          });
          throw error;
        }
      },

      // Logout function
      logout: async () => {
        try {
          await authAPI.logout();
        } catch {
          
        } finally {
          // Clear state first
          set({
            user: null,
            isAuthenticated: false,
            error: null,
          });

          // Remove authentication token
          removeAuthToken();

          // Clear all localStorage items related to auth
          if (typeof window !== 'undefined') {
            // Clear zustand stores
            localStorage.removeItem('auth-storage');
            localStorage.removeItem('project-storage');
            localStorage.removeItem('ui-storage');
            localStorage.removeItem('socket-storage');
            localStorage.removeItem('team-storage');
            localStorage.removeItem('notification-storage');

            // Clear any token/user related items
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('user');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');

            // Clear session storage as well
            sessionStorage.clear();
          }
        }
      },

      // Set user directly
      setUser: (user) => {
        set({
          user,
          isAuthenticated: true,
          error: null,
        });
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Check authentication status
      checkAuth: async () => {
        const currentState = get();

        // If already authenticated with valid user, skip API call
        // This prevents unnecessary API calls during navigation
        if (currentState.isAuthenticated && currentState.user && hasAuthToken()) {
          set({ isLoading: false });
          return;
        }

        // Skip check if already logged out intentionally
        if (currentState.isAuthenticated === false && !hasAuthToken()) {
          set({ isLoading: false });
          return;
        }

        set({ isLoading: true });

        try {
          // Check for authentication token
          const authToken = getAuthToken();

          if (!authToken) {
            // No token means user is not authenticated
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
            // Clear localStorage to ensure clean state
            localStorage.removeItem('auth-storage');
            return;
          }

          // Only make API call if we have token but no user data
          const sessionUser = await authAPI.getSession();

          if (sessionUser) {
            const user: User = {
              ...sessionUser,
              profile_image_url: sessionUser.profile_image_url || undefined,
              created_at: sessionUser.created_at || new Date().toISOString(),
              updated_at: sessionUser.updated_at || new Date().toISOString(),
              is_active: sessionUser.is_active !== undefined ? sessionUser.is_active : true,
              // 임시로 특정 사용자를 관리자로 설정 (테스트용)
              is_admin: sessionUser.username === 'gatat123' ? true : (sessionUser.isAdmin || sessionUser.is_admin || false)
            };

            set({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } else {
            // Session expired or invalid
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
            // Clear token since session is invalid
            removeAuthToken();
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: 'Failed to check authentication',
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
