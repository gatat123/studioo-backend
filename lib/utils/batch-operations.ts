import { NextResponse } from 'next/server';
import { mockProjectStore } from '@/lib/data/mock-projects';
import {
  isValidProjectId,
  validateDeletion,
  validateRestoration,
  checkProjectPermissions,
} from './project-validation';
import {
  createRestoredProject,
  calculateStorageSize,
  processOperationError,
} from './project-operations';

export interface BatchResult {
  id: string;
  name?: string;
  reason?: string;
  filesDeleted?: number;
  sizeFreed?: string;
}

export interface BatchResults {
  successful: BatchResult[];
  failed: BatchResult[];
  skipped: BatchResult[];
}

/**
 * Process batch deletion of archived projects
 * @param projectIds - Array of project IDs to delete
 * @param force - Whether to force deletion
 * @param currentUserId - Current user ID (optional, for permission checks)
 * @param isAdmin - Whether the current user is admin
 * @returns BatchResults object
 */
export async function processBatchDelete(
  projectIds: string[],
  force: boolean = false,
  currentUserId?: string,
  isAdmin: boolean = false
): Promise<BatchResults> {
  const results: BatchResults = {
    successful: [],
    failed: [],
    skipped: [],
  };

  for (const projectId of projectIds) {
    // Validate project ID format
    if (!isValidProjectId(projectId)) {
      results.failed.push({
        id: String(projectId) || 'invalid',
        reason: 'Invalid project ID format',
      });
      continue;
    }

    // Find the archived project
    const archivedProject = mockProjectStore.findArchivedProject(projectId);

    if (!archivedProject) {
      results.failed.push({
        id: projectId,
        reason: 'Archived project not found',
      });
      continue;
    }

    // Check permissions if currentUserId is provided
    if (currentUserId) {
      const permissionCheck = checkProjectPermissions(
        archivedProject.ownerId,
        currentUserId,
        isAdmin
      );

      if (!permissionCheck.hasPermission) {
        results.failed.push({
          id: projectId,
          name: archivedProject.name,
          reason: permissionCheck.reason || 'Insufficient permissions',
        });
        continue;
      }
    }

    // Validate deletion
    const deletionCheck = validateDeletion(
      archivedProject.canDelete,
      force,
      archivedProject.deletionDate
    );

    if (!deletionCheck.canProceed) {
      results.skipped.push({
        id: projectId,
        name: archivedProject.name,
        reason: deletionCheck.reason!,
      });
      continue;
    }

    try {
      // Calculate storage freed
      const sizeFreed = calculateStorageSize(archivedProject.files);

      // Remove from archived projects
      if (mockProjectStore.removeArchivedProject(projectId)) {
        results.successful.push({
          id: projectId,
          name: archivedProject.name,
          filesDeleted: archivedProject.files,
          sizeFreed,
        });
      } else {
        throw new Error('Failed to remove project from store');
      }

      // TODO: In production, perform actual deletion operations
      // await deleteProjectFiles(projectId);
      // await deleteProjectFromDatabase(projectId);

    } catch (error) {
      results.failed.push(
        processOperationError(error, projectId, archivedProject.name, 'deletion')
      );
    }
  }

  return results;
}

/**
 * Process batch restoration of archived projects
 * @param projectIds - Array of project IDs to restore
 * @param currentUserId - Current user ID (optional, for permission checks)
 * @param isAdmin - Whether the current user is admin
 * @returns BatchResults object
 */
export async function processBatchRestore(
  projectIds: string[],
  currentUserId?: string,
  isAdmin: boolean = false
): Promise<BatchResults> {
  const results: BatchResults = {
    successful: [],
    failed: [],
    skipped: [],
  };

  for (const projectId of projectIds) {
    // Validate project ID format
    if (!isValidProjectId(projectId)) {
      results.failed.push({
        id: String(projectId) || 'invalid',
        reason: 'Invalid project ID format',
      });
      continue;
    }

    // Find the archived project
    const archivedProject = mockProjectStore.findArchivedProject(projectId);

    if (!archivedProject) {
      results.failed.push({
        id: projectId,
        reason: 'Archived project not found',
      });
      continue;
    }

    // Check permissions if currentUserId is provided
    if (currentUserId) {
      const permissionCheck = checkProjectPermissions(
        archivedProject.ownerId,
        currentUserId,
        isAdmin
      );

      if (!permissionCheck.hasPermission) {
        results.failed.push({
          id: projectId,
          name: archivedProject.name,
          reason: permissionCheck.reason || 'Insufficient permissions',
        });
        continue;
      }
    }

    // Validate restoration
    const restorationCheck = validateRestoration(archivedProject.canRestore);

    if (!restorationCheck.canProceed) {
      results.skipped.push({
        id: projectId,
        name: archivedProject.name,
        reason: restorationCheck.reason!,
      });
      continue;
    }

    try {
      // Create restored project
      const restoredProject = createRestoredProject(archivedProject);

      // Move to active projects and remove from archived
      mockProjectStore.addActiveProject(restoredProject);
      mockProjectStore.removeArchivedProject(projectId);

      results.successful.push({
        id: projectId,
        name: archivedProject.name,
      });

      // TODO: In production, update database
      // await restoreProjectInDatabase(projectId);

    } catch (error) {
      results.failed.push(
        processOperationError(error, projectId, archivedProject.name, 'restoration')
      );
    }
  }

  return results;
}

/**
 * Generate batch operation response
 * @param results - BatchResults object
 * @param operation - Operation type (delete/restore)
 * @param totalRequested - Total number of requested operations
 * @param additionalData - Additional data to include in response
 * @returns NextResponse with formatted results
 */
export function generateBatchResponse(
  results: BatchResults,
  operation: 'delete' | 'restore',
  totalRequested: number,
  additionalData?: Record<string, unknown>
): NextResponse {
  const totalSuccessful = results.successful.length;
  const operationVerb = operation === 'delete' ? 'deleted' : 'restored';
  const operationNoun = operation === 'delete' ? 'deletion' : 'restoration';

  const response: Record<string, unknown> = {
    success: totalSuccessful > 0,
    message: `Batch ${operationNoun} completed: ${totalSuccessful}/${totalRequested} projects ${operationVerb} successfully`,
    summary: {
      totalRequested,
      totalSuccessful,
      totalFailed: results.failed.length,
      totalSkipped: results.skipped.length,
    },
    results,
    timestamp: new Date().toISOString(),
  };

  // Add warning for deletions
  if (operation === 'delete' && totalSuccessful > 0) {
    response.warning = 'Deleted projects cannot be recovered';
  }

  // Merge additional data
  if (additionalData) {
    Object.assign(response, additionalData);
  }

  return NextResponse.json(response);
}