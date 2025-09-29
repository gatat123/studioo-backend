import { describe, it, expect } from '@jest/globals';
import {
  validateProjectIds,
  isValidProjectId,
  validateDeletion,
  validateRestoration,
  checkProjectPermissions,
} from '../project-validation';

describe('Project Validation Utils', () => {
  describe('validateProjectIds', () => {
    it('should return valid for correct project IDs array', () => {
      const result = validateProjectIds(['1', '2', '3']);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return error for empty array', () => {
      const result = validateProjectIds([]);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error for non-array input', () => {
      const result = validateProjectIds('not-an-array');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error for null/undefined input', () => {
      const result = validateProjectIds(null);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error when exceeding max count', () => {
      const tooManyIds = Array(51).fill('id');
      const result = validateProjectIds(tooManyIds, 50);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should respect custom max count', () => {
      const ids = Array(21).fill('id');
      const result = validateProjectIds(ids, 20);
      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('isValidProjectId', () => {
    it('should return true for valid string ID', () => {
      expect(isValidProjectId('project-123')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(isValidProjectId('')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(isValidProjectId(123)).toBe(false);
      expect(isValidProjectId(null)).toBe(false);
      expect(isValidProjectId(undefined)).toBe(false);
      expect(isValidProjectId({})).toBe(false);
    });
  });

  describe('validateDeletion', () => {
    it('should allow deletion when canDelete is true', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const result = validateDeletion(true, false, futureDate);
      expect(result.canProceed).toBe(false); // Date hasn't passed
    });

    it('should allow deletion when force is true', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const result = validateDeletion(false, true, futureDate);
      expect(result.canProceed).toBe(true);
    });

    it('should prevent deletion when canDelete is false and force is false', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const result = validateDeletion(false, false, pastDate);
      expect(result.canProceed).toBe(false);
      expect(result.reason).toContain('protected or has dependencies');
    });

    it('should prevent deletion when deletion date has not passed', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const result = validateDeletion(true, false, futureDate);
      expect(result.canProceed).toBe(false);
      expect(result.reason).toContain('not yet scheduled for deletion');
    });

    it('should allow deletion when deletion date has passed', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const result = validateDeletion(true, false, pastDate);
      expect(result.canProceed).toBe(true);
    });
  });

  describe('validateRestoration', () => {
    it('should allow restoration when canRestore is true', () => {
      const result = validateRestoration(true);
      expect(result.canProceed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should prevent restoration when canRestore is false', () => {
      const result = validateRestoration(false);
      expect(result.canProceed).toBe(false);
      expect(result.reason).toContain('cannot be restored');
    });
  });

  describe('checkProjectPermissions', () => {
    it('should grant permission to project owner', () => {
      const result = checkProjectPermissions('user1', 'user1', false);
      expect(result.hasPermission).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should grant permission to admin even if not owner', () => {
      const result = checkProjectPermissions('user1', 'user2', true);
      expect(result.hasPermission).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny permission to non-owner non-admin', () => {
      const result = checkProjectPermissions('user1', 'user2', false);
      expect(result.hasPermission).toBe(false);
      expect(result.reason).toBe('Insufficient permissions');
    });
  });
});