import api from './client';

// Admin User Management
export const adminAPI = {
  // Get all users
  getUsers: async () => {
    return api.get('/api/admin/users');
  },

  // Delete user
  deleteUser: async (userId: string) => {
    return api.delete(`/api/admin/users/${userId}`);
  },

  // Get all projects
  getProjects: async () => {
    return api.get('/api/admin/projects');
  },

  // View project as admin (invisible)
  viewProject: async (projectId: string) => {
    return api.post(`/api/admin/projects/${projectId}/view`);
  },

  // Delete project
  deleteProject: async (projectId: string) => {
    return api.delete(`/api/admin/projects/${projectId}`);
  },

  // Get all channels
  getChannels: async () => {
    return api.get('/api/admin/channels');
  },

  // View channel as admin (invisible)
  viewChannel: async (channelId: string) => {
    return api.post(`/api/admin/channels/${channelId}/view`);
  },

  // Delete channel
  deleteChannel: async (channelId: string) => {
    return api.delete(`/api/admin/channels/${channelId}`);
  },

  // Get admin statistics
  getStatistics: async () => {
    return api.get('/api/admin/stats');
  },

  // Get system status
  getSystemStatus: async () => {
    return api.get('/api/admin/system/status');
  },

  // Get projects stats
  getProjectsStats: async () => {
    return api.get('/api/admin/projects/stats');
  },

  // Get system logs
  getSystemLogs: async () => {
    return api.get('/api/admin/system/logs');
  },
};