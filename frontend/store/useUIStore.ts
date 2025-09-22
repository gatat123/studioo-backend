import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Theme type
type Theme = 'light' | 'dark' | 'system';

// Modal types
type ModalType = 
  | 'createProject'
  | 'joinProject'
  | 'deleteProject'
  | 'uploadImage'
  | 'addComment'
  | 'addAnnotation'
  | 'userProfile'
  | 'projectSettings'
  | null;

// Notification type
interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  createdAt: Date;
}

// UI Store state
interface UIState {
  // Theme
  theme: Theme;
  
  // Sidebar
  isSidebarOpen: boolean;
  isMobileMenuOpen: boolean;
  
  // Modals
  activeModal: ModalType;
  modalData: any;
  
  // Notifications
  notifications: Notification[];
  
  // Loading states
  globalLoading: boolean;
  loadingMessage?: string;
  
  // View preferences
  imageViewMode: 'single' | 'comparison' | 'grid';
  showAnnotations: boolean;
  showComments: boolean;
  
  // Actions
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  toggleMobileMenu: () => void;
  setMobileMenuOpen: (isOpen: boolean) => void;
  
  // Modal actions
  openModal: (modalType: ModalType, data?: any) => void;
  closeModal: () => void;
  
  // Notification actions
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // Loading actions
  setGlobalLoading: (loading: boolean, message?: string) => void;
  
  // View actions
  setImageViewMode: (mode: 'single' | 'comparison' | 'grid') => void;
  toggleAnnotations: () => void;
  toggleComments: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Initial state
      theme: 'system',
      isSidebarOpen: true,
      isMobileMenuOpen: false,
      activeModal: null,
      modalData: null,
      notifications: [],
      globalLoading: false,
      loadingMessage: undefined,
      imageViewMode: 'single',
      showAnnotations: true,
      showComments: true,
      // Theme actions
      setTheme: (theme) => {
        set({ theme });
        
        // Apply theme to document
        if (typeof window !== 'undefined') {
          const root = document.documentElement;
          root.classList.remove('light', 'dark');
          
          if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light';
            root.classList.add(systemTheme);
          } else {
            root.classList.add(theme);
          }
        }
      },

      // Sidebar actions
      toggleSidebar: () => {
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen }));
      },

      setSidebarOpen: (isOpen) => {
        set({ isSidebarOpen: isOpen });
      },

      toggleMobileMenu: () => {
        set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen }));
      },

      setMobileMenuOpen: (isOpen) => {
        set({ isMobileMenuOpen: isOpen });
      },

      // Modal actions
      openModal: (modalType, data = null) => {
        set({ activeModal: modalType, modalData: data });
      },

      closeModal: () => {
        set({ activeModal: null, modalData: null });
      },
      // Notification actions
      addNotification: (notification) => {
        const newNotification: Notification = {
          ...notification,
          id: `notification-${Date.now()}`,
          createdAt: new Date(),
        };

        set((state) => ({
          notifications: [...state.notifications, newNotification],
        }));

        // Auto-remove notification after duration
        if (notification.duration !== 0) {
          setTimeout(() => {
            get().removeNotification(newNotification.id);
          }, notification.duration || 5000);
        }
      },

      removeNotification: (id) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      },

      clearNotifications: () => {
        set({ notifications: [] });
      },

      // Loading actions
      setGlobalLoading: (loading, message) => {
        set({ globalLoading: loading, loadingMessage: message });
      },

      // View actions
      setImageViewMode: (mode) => {
        set({ imageViewMode: mode });
      },

      toggleAnnotations: () => {
        set((state) => ({ showAnnotations: !state.showAnnotations }));
      },

      toggleComments: () => {
        set((state) => ({ showComments: !state.showComments }));
      },
    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        isSidebarOpen: state.isSidebarOpen,
        imageViewMode: state.imageViewMode,
        showAnnotations: state.showAnnotations,
        showComments: state.showComments,
      }),
    }
  )
);

// Helper hook for showing notifications
export const useNotification = () => {
  const addNotification = useUIStore((state) => state.addNotification);

  return {
    success: (title: string, message?: string) =>
      addNotification({ type: 'success', title, message }),
    error: (title: string, message?: string) =>
      addNotification({ type: 'error', title, message }),
    warning: (title: string, message?: string) =>
      addNotification({ type: 'warning', title, message }),
    info: (title: string, message?: string) =>
      addNotification({ type: 'info', title, message }),
  };
};