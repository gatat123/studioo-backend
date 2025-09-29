import { ArchivedProject, ActiveProject } from '@/lib/data/mock-projects';

/**
 * Creates a restored project from an archived project
 * Removes archive-specific fields and adds active status
 * @param archivedProject - The archived project to restore
 * @returns The restored active project
 */
export function createRestoredProject(archivedProject: ArchivedProject): ActiveProject {
  // Create a copy with active status
  const restoredProject: Record<string, unknown> = {
    ...archivedProject,
    status: 'active',
    updatedAt: new Date().toISOString(),
  };

  // Remove archive-specific fields
  const fieldsToRemove = [
    'archivedAt',
    'archivedBy',
    'archivedByName',
    'deletionDate',
    'canRestore',
    'canDelete'
  ];

  fieldsToRemove.forEach(field => {
    delete restoredProject[field];
  });

  return restoredProject as ActiveProject;
}

/**
 * Calculates the estimated storage size for a project
 * @param filesCount - Number of files in the project
 * @param averageSizeMB - Average size per file in MB (default: 2.5)
 * @returns Formatted string with size (e.g., "1.5 GB" or "500.0 MB")
 */
export function calculateStorageSize(
  filesCount: number,
  averageSizeMB: number = 2.5
): string {
  const totalSizeMB = filesCount * averageSizeMB;

  if (totalSizeMB > 1024) {
    return `${(totalSizeMB / 1024).toFixed(1)} GB`;
  }

  return `${totalSizeMB.toFixed(1)} MB`;
}

/**
 * Generates a summary for batch operations
 * @param results - Results object containing successful, failed, and skipped arrays
 * @param totalRequested - Total number of requested operations
 * @returns Summary object with counts
 */
export function generateBatchSummary(
  results: {
    successful: Array<unknown>;
    failed: Array<unknown>;
    skipped: Array<unknown>;
  },
  totalRequested: number
) {
  return {
    totalRequested,
    totalSuccessful: results.successful.length,
    totalFailed: results.failed.length,
    totalSkipped: results.skipped.length,
  };
}

/**
 * Calculate total resources freed from deletion
 * @param successfulDeletions - Array of successful deletion results
 * @returns Object with total files deleted and estimated size freed
 */
export function calculateResourcesFreed(
  successfulDeletions: Array<{ filesDeleted: number }>
): {
  totalFilesDeleted: number;
  estimatedSizeFreed: string;
} {
  const totalFilesDeleted = successfulDeletions.reduce(
    (sum, result) => sum + result.filesDeleted,
    0
  );

  const estimatedSizeFreed = calculateStorageSize(totalFilesDeleted);

  return {
    totalFilesDeleted,
    estimatedSizeFreed,
  };
}

/**
 * Process error for batch operations
 * @param error - The error that occurred
 * @param projectId - The project ID being processed
 * @param projectName - Optional project name
 * @param operation - The operation being performed
 * @returns Formatted error object
 */
export function processOperationError(
  error: unknown,
  projectId: string,
  projectName?: string,
  operation: string = 'process'
): { id: string; name?: string; reason: string } {
  console.error(`Failed to ${operation} project ${projectId}:`, error);

  return {
    id: projectId,
    ...(projectName && { name: projectName }),
    reason: `Internal error during ${operation}`
  };
}