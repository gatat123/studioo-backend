import { apiClient } from './client';

export interface ArchivedProject {
  id: string;
  name: string;
  description?: string;
  thumbnail?: string;
  ownerId: string;
  ownerName: string;
  ownerAvatar?: string;
  archivedAt: string;
  archivedBy: string;
  archivedByName: string;
  deletionDate?: string;
  collaborators: number;
  files: number;
  lastActivity: string;
  canRestore: boolean;
  canDelete: boolean;
  tags?: string[];
}

// Get archived projects
export async function getArchivedProjects(
  page: number = 1,
  limit: number = 12,
  sortBy: string = 'archivedAt',
  sortOrder: 'asc' | 'desc' = 'desc'
): Promise<{ projects: ArchivedProject[]; total: number }> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sortBy,
    sortOrder,
  });

  try {
    const response = await apiClient.get(`/projects/archived?${params}`);
    return response as { projects: ArchivedProject[]; total: number };
  } catch (error) {
    console.error('Failed to fetch archived projects:', error);
    throw new Error('Failed to fetch archived projects');
  }
}

// Archive a project
export async function archiveProject(projectId: string): Promise<void> {
  try {
    await apiClient.post(`/projects/${projectId}/archive`);
  } catch (error) {
    console.error('Failed to archive project:', error);
    throw new Error('Failed to archive project');
  }
}

// Restore archived project
export async function restoreProject(projectId: string): Promise<void> {
  try {
    await apiClient.post(`/projects/${projectId}/restore`);
  } catch (error) {
    console.error('Failed to restore project:', error);
    throw new Error('Failed to restore project');
  }
}

// Delete archived project permanently
export async function deleteArchivedProject(projectId: string): Promise<void> {
  try {
    await apiClient.delete(`/projects/${projectId}/archived`);
  } catch (error) {
    console.error('Failed to delete archived project:', error);
    throw new Error('Failed to delete archived project');
  }
}

// Search archived projects
export async function searchArchivedProjects(
  query: string,
  filters?: {
    ownerId?: string;
    dateFrom?: string;
    dateTo?: string;
    tags?: string[];
  }
): Promise<ArchivedProject[]> {
  const params = new URLSearchParams({ q: query });

  if (filters?.ownerId) params.append('ownerId', filters.ownerId);
  if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters?.dateTo) params.append('dateTo', filters.dateTo);
  if (filters?.tags) filters.tags.forEach(tag => params.append('tags', tag));

  try {
    const response = await apiClient.get(`/projects/archived/search?${params}`);
    return response as ArchivedProject[];
  } catch (error) {
    console.error('Failed to search archived projects:', error);
    throw new Error('Failed to search archived projects');
  }
}

// Batch restore projects
export async function batchRestoreProjects(projectIds: string[]): Promise<void> {
  try {
    await apiClient.post('/projects/archived/batch-restore', { projectIds });
  } catch (error) {
    console.error('Failed to batch restore projects:', error);
    throw new Error('Failed to batch restore projects');
  }
}

// Batch delete archived projects
export async function batchDeleteArchivedProjects(projectIds: string[]): Promise<void> {
  try {
    await apiClient.post('/projects/archived/batch-delete', { projectIds });
  } catch (error) {
    console.error('Failed to batch delete projects:', error);
    throw new Error('Failed to batch delete projects');
  }
}

// Get archive statistics
export async function getArchiveStats(): Promise<{
  totalArchived: number;
  pendingDeletion: number;
  archivedThisMonth: number;
  totalSize: number;
}> {
  try {
    const response = await apiClient.get('/projects/archived/stats');
    return response as {
      totalArchived: number;
      pendingDeletion: number;
      archivedThisMonth: number;
      totalSize: number;
    };
  } catch (error) {
    console.error('Failed to fetch archive statistics:', error);
    throw new Error('Failed to fetch archive statistics');
  }
}