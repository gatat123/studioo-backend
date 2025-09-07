import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { authAPI } from '@/lib/api/auth';
import Cookies from 'js-cookie';
import type { User } from '@/types';

// Auth store state interface
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: { username: string; email: string; password: string; nickname: string }) => Promise<void>;
  logout: () => void;
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
              profileImageUrl: response.user.profileImageUrl || undefined,
              createdAt: response.user.createdAt || new Date().toISOString(),
              updatedAt: response.user.updatedAt || new Date().toISOString(),
              isActive: response.user.isActive !== undefined ? response.user.isActive : true
            };
            
            // Set cookie for middleware authentication
            const token = response.accessToken || response.token;
            if (token) {
              Cookies.set('token', token, { expires: 7 });
            }
            
            set({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          }
        } catch (error: any) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error?.message || '로그인에 실패했습니다.',
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
              profileImageUrl: response.user.profileImageUrl || undefined,
              createdAt: response.user.createdAt || new Date().toISOString(),
              updatedAt: response.user.updatedAt || new Date().toISOString(),
              isActive: response.user.isActive !== undefined ? response.user.isActive : true
            };
            
            // Set cookie for middleware authentication
            const token = response.accessToken || response.token;
            if (token) {
              Cookies.set('token', token, { expires: 7 });
            }
            
            set({
              user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          }
        } catch (error: any) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: error?.message || '회원가입에 실패했습니다.',
          });
          throw error;
        }
      },

      // Logout function
      logout: async () => {
        try {
          await authAPI.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          // Clear state and cookies
          set({
            user: null,
            isAuthenticated: false,
            error: null,
          });
          
          // Remove authentication cookie
          Cookies.remove('token');
          
          // Clear other stores if needed
          if (typeof window !== 'undefined') {
            // Clear any other persisted data
            localStorage.removeItem('project-storage');
            localStorage.removeItem('ui-storage');
            localStorage.removeItem('auth-storage');
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('user');
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
        set({ isLoading: true });
        
        try {
          const token = Cookies.get('token') || localStorage.getItem('token');
          
          if (!token) {
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
            return;
          }
          
          const sessionUser = await authAPI.getSession();
          
          if (sessionUser) {
            const user: User = {
              ...sessionUser,
              profileImageUrl: sessionUser.profileImageUrl || undefined,
              createdAt: sessionUser.createdAt || new Date().toISOString(),
              updatedAt: sessionUser.updatedAt || new Date().toISOString(),
              isActive: sessionUser.isActive !== undefined ? sessionUser.isActive : true
            };
            
            set({
              user,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } catch (error) {
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
