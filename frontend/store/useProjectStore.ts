import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { projectsAPI } from '@/lib/api/projects';
import type { 
  Project, 
  ProjectParticipant, 
  Scene, 
  Image as SceneImage, 
  Comment 
} from '@/types';

// Project store state
interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  currentScene: Scene | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setProjects: (projects: Project[]) => void;
  getProject: (projectId: string) => Project | undefined;
  addProject: (project: Project) => void;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  deleteProject: (projectId: string) => void;
  setCurrentProject: (project: Project | null) => void;
  setCurrentScene: (scene: Scene | null) => void;
  
  // Scene actions
  addScene: (projectId: string, scene: Scene) => void;
  updateScene: (projectId: string, sceneId: string, updates: Partial<Scene>) => void;
  deleteScene: (projectId: string, sceneId: string) => void;
  
  // Image actions
  addImage: (projectId: string, sceneId: string, image: SceneImage) => void;
  
  // Comment actions  
  addComment: (projectId: string, sceneId: string, comment: Comment) => void;
  
  // Async actions (connected to API)
  fetchProjects: () => Promise<void>;
  fetchProject: (projectId: string) => Promise<void>;
  createProject: (projectData: { name: string; description?: string; deadline?: string; tag?: 'illustration' | 'storyboard' }) => Promise<void>;
  joinProject: (inviteCode: string) => Promise<void>;
  
  // Settings actions
  generateInviteCode: (projectId: string) => Promise<string | null>;
  updateProjectParticipant: (projectId: string, participantId: string, updates: Partial<ProjectParticipant>) => void;
  removeProjectParticipant: (projectId: string, participantId: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProject: null,
      currentScene: null,
      isLoading: false,
      error: null,

      // Get project by ID
      getProject: (projectId) => {
        const state = get();
        return state.projects.find(project => project.id === projectId);
      },

      setProjects: (projects) => {
        set({ projects });
      },

      // Add new project
      addProject: (project) => {
        set((state) => ({
          projects: [...state.projects, project],
        }));
      },

      // Update project
      updateProject: (projectId, updates) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, ...updates } : p
          ),
          currentProject:
            state.currentProject?.id === projectId
              ? { ...state.currentProject, ...updates }
              : state.currentProject,
        }));
      },

      // Delete project
      deleteProject: (projectId) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== projectId),
          currentProject:
            state.currentProject?.id === projectId ? null : state.currentProject,
        }));
      },

      // Set current project
      setCurrentProject: (project) => {
        set({ currentProject: project, currentScene: null });
      },

      // Set current scene
      setCurrentScene: (scene) => {
        set({ currentScene: scene });
      },

      // Add scene to project
      addScene: (projectId, scene) => {
        set((state) => {
          const updatedProjects = state.projects.map((p) => {
            if (p.id === projectId) {
              return {
                ...p,
                scenes: [...(p.scenes || []), scene],
              };
            }
            return p;
          });

          return {
            projects: updatedProjects,
            currentProject:
              state.currentProject?.id === projectId
                ? updatedProjects.find((p) => p.id === projectId) || null
                : state.currentProject,
          };
        });
      },

      // Update scene
      updateScene: (projectId, sceneId, updates) => {
        set((state) => {
          const updatedProjects = state.projects.map((p) => {
            if (p.id === projectId) {
              return {
                ...p,
                scenes: p.scenes?.map((s) =>
                  s.id === sceneId ? { ...s, ...updates } : s
                ),
              };
            }
            return p;
          });

          return {
            projects: updatedProjects,
            currentProject:
              state.currentProject?.id === projectId
                ? updatedProjects.find((p) => p.id === projectId) || null
                : state.currentProject,
            currentScene:
              state.currentScene?.id === sceneId
                ? { ...state.currentScene, ...updates }
                : state.currentScene,
          };
        });
      },

      // Delete scene
      deleteScene: (projectId, sceneId) => {
        set((state) => {
          const updatedProjects = state.projects.map((p) => {
            if (p.id === projectId) {
              return {
                ...p,
                scenes: p.scenes?.filter((s) => s.id !== sceneId),
              };
            }
            return p;
          });

          return {
            projects: updatedProjects,
            currentProject:
              state.currentProject?.id === projectId
                ? updatedProjects.find((p) => p.id === projectId) || null
                : state.currentProject,
            currentScene:
              state.currentScene?.id === sceneId ? null : state.currentScene,
          };
        });
      },

      // Add image to scene
      addImage: (projectId, sceneId, image) => {
        set((state) => {
          const updatedProjects = state.projects.map((p) => {
            if (p.id === projectId) {
              return {
                ...p,
                scenes: p.scenes?.map((s) => {
                  if (s.id === sceneId) {
                    return {
                      ...s,
                      images: [...(s.images || []), image],
                    };
                  }
                  return s;
                }),
              };
            }
            return p;
          });

          return {
            projects: updatedProjects,
            currentProject:
              state.currentProject?.id === projectId
                ? updatedProjects.find((p) => p.id === projectId) || null
                : state.currentProject,
          };
        });
      },

      // Add comment to scene
      addComment: (projectId, sceneId, comment) => {
        set((state) => {
          const updatedProjects = state.projects.map((p) => {
            if (p.id === projectId) {
              return {
                ...p,
                scenes: p.scenes?.map((s) => {
                  if (s.id === sceneId) {
                    return {
                      ...s,
                      comments: [...(s.comments || []), comment],
                    };
                  }
                  return s;
                }),
              };
            }
            return p;
          });

          return {
            projects: updatedProjects,
            currentProject:
              state.currentProject?.id === projectId
                ? updatedProjects.find((p) => p.id === projectId) || null
                : state.currentProject,
          };
        });
      },

      // Fetch all projects from API
      fetchProjects: async () => {
        set({ isLoading: true, error: null });
        
        try {
          const projects = await projectsAPI.getProjects();
          
          // Projects from API already have proper date formats
          const formattedProjects = projects.map(p => ({
            ...p,
            deadline: p.deadline ? p.deadline : null,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          }));
          
          set({ projects: formattedProjects, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch projects',
            isLoading: false,
            projects: [], // Clear projects on error
          });
        }
      },

      // Fetch single project from API
      fetchProject: async (projectId) => {
        set({ isLoading: true, error: null });
        
        try {
          const project = await projectsAPI.getProject(projectId);
          
          // Project from API already has proper date formats
          const formattedProject = {
            ...project,
            deadline: project.deadline ? project.deadline : null,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
          };
          
          set({ currentProject: formattedProject, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch project',
            isLoading: false,
            currentProject: null,
          });
        }
      },

      // Create new project via API
      createProject: async (projectData) => {
        set({ isLoading: true, error: null });
        
        try {
          const newProject = await projectsAPI.createProject(projectData);
          
          // Project from API already has proper date formats
          const formattedProject = {
            ...newProject,
            deadline: newProject.deadline ? newProject.deadline : null,
            createdAt: newProject.createdAt,
            updatedAt: newProject.updatedAt,
          };
          
          get().addProject(formattedProject);
          set({ isLoading: false, currentProject: formattedProject });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create project',
            isLoading: false,
          });
          throw error;
        }
      },

      // Join project with invite code via API
      joinProject: async (inviteCode) => {
        set({ isLoading: true, error: null });
        
        try {
          const project = await projectsAPI.joinProject(inviteCode);
          
          // Project from API already has proper date formats
          const formattedProject = {
            ...project,
            deadline: project.deadline ? project.deadline : null,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
          };
          
          get().addProject(formattedProject);
          set({ isLoading: false, currentProject: formattedProject });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to join project',
            isLoading: false,
          });
          throw error;
        }
      },

      // Generate invite code for project via API
      generateInviteCode: async (projectId) => {
        try {
          const { inviteCode } = await projectsAPI.generateInviteCode(projectId);
          get().updateProject(projectId, { inviteCode });
          return inviteCode;
        } catch (error) {
          console.error('Failed to generate invite code:', error);
          return null;
        }
      },

      // Update project participant role
      updateProjectParticipant: (projectId, participantId, updates) => {
        set((state) => {
          const updatedProjects = state.projects.map((p) => {
            if (p.id === projectId) {
              return {
                ...p,
                participants: p.participants?.map((participant) =>
                  participant.id === participantId
                    ? { ...participant, ...updates }
                    : participant
                ),
              };
            }
            return p;
          });

          return {
            projects: updatedProjects,
            currentProject:
              state.currentProject?.id === projectId
                ? updatedProjects.find((p) => p.id === projectId) || null
                : state.currentProject,
          };
        });
      },

      // Remove project participant
      removeProjectParticipant: (projectId, participantId) => {
        set((state) => {
          const updatedProjects = state.projects.map((p) => {
            if (p.id === projectId) {
              return {
                ...p,
                participants: p.participants?.filter(
                  (participant) => participant.id !== participantId
                ),
              };
            }
            return p;
          });

          return {
            projects: updatedProjects,
            currentProject:
              state.currentProject?.id === projectId
                ? updatedProjects.find((p) => p.id === projectId) || null
                : state.currentProject,
          };
        });
      },
    }),
    {
      name: 'project-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Don't persist loading states or errors
        projects: state.projects,
        currentProject: state.currentProject,
        currentScene: state.currentScene,
      }),
    }
  )
);