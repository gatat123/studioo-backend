import { getAuthHeaders } from '@/lib/api/helpers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface BackupInfo {
  id: string;
  projectId: string;
  projectName: string;
  createdAt: string;
  createdBy: string;
  size: number;
  version: string;
  includesFiles: boolean;
  includesComments: boolean;
  includesMembers: boolean;
  downloadUrl?: string;
}

export interface ExportOptions {
  format: 'json' | 'zip';
  includeFiles: boolean;
  includeComments: boolean;
  includeMembers: boolean;
  includeVersionHistory: boolean;
  includeActivityLog: boolean;
}

// Create project backup
export async function createBackup(
  projectId: string,
  options?: Partial<ExportOptions>
): Promise<BackupInfo> {
  const response = await fetch(`${API_URL}/projects/${projectId}/backup`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options || {}),
  });

  if (!response.ok) {
    throw new Error('Failed to create backup');
  }

  return response.json();
}

// Get backup history
export async function getBackupHistory(projectId: string): Promise<BackupInfo[]> {
  const response = await fetch(`${API_URL}/projects/${projectId}/backups`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch backup history');
  }

  return response.json();
}

// Download backup
export async function downloadBackup(backupId: string): Promise<Blob> {
  const response = await fetch(`${API_URL}/backups/${backupId}/download`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to download backup');
  }

  return response.blob();
}

// Export project
export async function exportProject(
  projectId: string,
  options: ExportOptions
): Promise<Blob> {
  const response = await fetch(`${API_URL}/projects/${projectId}/export`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    throw new Error('Failed to export project');
  }

  return response.blob();
}

// Import project
export async function importProject(file: File): Promise<{ projectId: string; name: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/projects/import`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to import project');
  }

  return response.json();
}

// Restore from backup
export async function restoreBackup(
  projectId: string,
  backupId: string
): Promise<void> {
  const response = await fetch(`${API_URL}/projects/${projectId}/restore`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ backupId }),
  });

  if (!response.ok) {
    throw new Error('Failed to restore backup');
  }
}

// Delete backup
export async function deleteBackup(backupId: string): Promise<void> {
  const response = await fetch(`${API_URL}/backups/${backupId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error('Failed to delete backup');
  }
}

// Transfer project ownership
export async function transferOwnership(
  projectId: string,
  newOwnerId: string
): Promise<void> {
  const response = await fetch(`${API_URL}/projects/${projectId}/transfer`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ newOwnerId }),
  });

  if (!response.ok) {
    throw new Error('Failed to transfer ownership');
  }
}

// Delete project permanently
export async function deleteProjectPermanently(
  projectId: string,
  confirmationText: string
): Promise<void> {
  const response = await fetch(`${API_URL}/projects/${projectId}/permanent-delete`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ confirmationText }),
  });

  if (!response.ok) {
    throw new Error('Failed to delete project');
  }
}