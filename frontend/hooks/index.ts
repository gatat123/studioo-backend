// Export all custom hooks
export {
  useAuth,
  useCurrentProject,
  useProjects,
  useUIPreferences,
  useSidebar,
  useModal,
  useGlobalLoading,
} from './useStores';

// Re-export notification hook from store
export { useNotification } from '@/store/useUIStore';
