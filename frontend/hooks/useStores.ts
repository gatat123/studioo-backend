// Custom hooks for accessing store data

import { useAuthStore } from '@/store/useAuthStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useUIStore, useNotification } from '@/store/useUIStore';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Hook for authentication checks
export const useAuth = () => {
  const { user, isAuthenticated, isLoading, login, logout, checkAuth } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const requireAuth = (redirectTo: string = '/login') => {
    if (!isLoading && !isAuthenticated) {
      router.push(redirectTo);
    }
  };

  const requireAdmin = (redirectTo: string = '/') => {
    if (!isLoading && (!isAuthenticated || !user?.isAdmin)) {
      router.push(redirectTo);
    }
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    requireAuth,
    requireAdmin,
  };
};

// Hook for current project
export const useCurrentProject = () => {
  const { currentProject, currentScene, setCurrentScene } = useProjectStore();
  
  return {
    project: currentProject,
    scene: currentScene,
    setScene: setCurrentScene,
  };
};

// Hook for project operations
export const useProjects = () => {
  const {
    projects,
    isLoading,
    error,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    joinProject,
  } = useProjectStore();

  useEffect(() => {
    if (projects.length === 0) {
      fetchProjects();
    }
  }, [projects.length, fetchProjects]);

  return {
    projects,
    isLoading,
    error,
    createProject,
    updateProject,
    deleteProject,
    joinProject,
    refresh: fetchProjects,
  };
};

// Hook for UI preferences
export const useUIPreferences = () => {
  const {
    theme,
    imageViewMode,
    showAnnotations,
    showComments,
    setTheme,
    setImageViewMode,
    toggleAnnotations,
    toggleComments,
  } = useUIStore();

  return {
    theme,
    imageViewMode,
    showAnnotations,
    showComments,
    setTheme,
    setImageViewMode,
    toggleAnnotations,
    toggleComments,
  };
};

// Hook for sidebar state
export const useSidebar = () => {
  const {
    isSidebarOpen,
    isMobileMenuOpen,
    toggleSidebar,
    setSidebarOpen,
    toggleMobileMenu,
    setMobileMenuOpen,
  } = useUIStore();

  return {
    isOpen: isSidebarOpen,
    isMobileOpen: isMobileMenuOpen,
    toggle: toggleSidebar,
    setOpen: setSidebarOpen,
    toggleMobile: toggleMobileMenu,
    setMobileOpen: setMobileMenuOpen,
  };
};

// Hook for modal management
export const useModal = () => {
  const { activeModal, modalData, openModal, closeModal } = useUIStore();

  return {
    isOpen: activeModal !== null,
    type: activeModal,
    data: modalData,
    open: openModal,
    close: closeModal,
  };
};

// Hook for global loading state
export const useGlobalLoading = () => {
  const { globalLoading, loadingMessage, setGlobalLoading } = useUIStore();

  return {
    isLoading: globalLoading,
    message: loadingMessage,
    setLoading: setGlobalLoading,
  };
};

// Hook for notifications
export { useNotification };
