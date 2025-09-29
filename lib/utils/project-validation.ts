import { NextResponse } from 'next/server';

export interface ValidationResult {
  isValid: boolean;
  error?: NextResponse;
}

/**
 * Validates project IDs array for batch operations
 * @param projectIds - Array of project IDs to validate
 * @param maxCount - Maximum number of projects allowed (default: 50)
 * @returns ValidationResult with isValid flag and optional error response
 */
export function validateProjectIds(
  projectIds: unknown,
  maxCount: number = 50
): ValidationResult {
  // Check if projectIds exists and is an array
  if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
    return {
      isValid: false,
      error: NextResponse.json(
        { error: 'Project IDs array is required' },
        { status: 400 }
      )
    };
  }

  // Check maximum limit
  if (projectIds.length > maxCount) {
    return {
      isValid: false,
      error: NextResponse.json(
        { error: `Maximum ${maxCount} projects can be processed at once` },
        { status: 400 }
      )
    };
  }

  return { isValid: true };
}

/**
 * Validates a single project ID
 * @param projectId - Project ID to validate
 * @returns boolean indicating if the ID is valid
 */
export function isValidProjectId(projectId: unknown): projectId is string {
  return typeof projectId === 'string' && projectId.length > 0;
}

/**
 * Validates if a project can be deleted
 * @param canDelete - Whether the project can be deleted
 * @param force - Whether to force deletion
 * @param deletionDate - Scheduled deletion date
 * @returns Object with canProceed flag and optional reason
 */
export function validateDeletion(
  canDelete: boolean,
  force: boolean,
  deletionDate: string
): { canProceed: boolean; reason?: string } {
  // Check if project can be deleted
  if (!canDelete && !force) {
    return {
      canProceed: false,
      reason: 'Project cannot be deleted (protected or has dependencies). Use force=true to override.'
    };
  }

  // Check if deletion date has passed for non-force deletions
  if (!force && new Date(deletionDate) > new Date()) {
    return {
      canProceed: false,
      reason: `Project is not yet scheduled for deletion (scheduled: ${deletionDate})`
    };
  }

  return { canProceed: true };
}

/**
 * Validates if a project can be restored
 * @param canRestore - Whether the project can be restored
 * @returns Object with canProceed flag and optional reason
 */
export function validateRestoration(canRestore: boolean): {
  canProceed: boolean;
  reason?: string;
} {
  if (!canRestore) {
    return {
      canProceed: false,
      reason: 'Project cannot be restored (permanently archived or corrupted)'
    };
  }

  return { canProceed: true };
}

/**
 * Check user permissions for project operations
 * @param projectOwnerId - Owner ID of the project
 * @param currentUserId - Current user ID
 * @param isAdmin - Whether the current user is an admin
 * @returns Object with hasPermission flag and optional reason
 */
export function checkProjectPermissions(
  projectOwnerId: string,
  currentUserId: string,
  isAdmin: boolean = false
): { hasPermission: boolean; reason?: string } {
  if (projectOwnerId !== currentUserId && !isAdmin) {
    return {
      hasPermission: false,
      reason: 'Insufficient permissions'
    };
  }

  return { hasPermission: true };
}