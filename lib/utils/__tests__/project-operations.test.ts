import { describe, it, expect } from '@jest/globals';
import {
  createRestoredProject,
  calculateStorageSize,
  generateBatchSummary,
  calculateResourcesFreed,
  processOperationError,
} from '../project-operations';
import { ArchivedProject } from '../../data/mock-projects';

describe('Project Operations Utils', () => {
  describe('createRestoredProject', () => {
    it('should create restored project with active status', () => {
      const archivedProject: ArchivedProject = {
        id: '1',
        name: 'Test Project',
        description: 'Test Description',
        ownerId: 'user1',
        ownerName: 'User One',
        archivedAt: '2024-01-01T00:00:00Z',
        archivedBy: 'user1',
        archivedByName: 'User One',
        deletionDate: '2024-02-01T00:00:00Z',
        collaborators: 3,
        files: 10,
        canRestore: true,
        canDelete: true,
        tags: ['test'],
      };

      const restored = createRestoredProject(archivedProject);

      expect(restored.status).toBe('active');
      expect(restored.updatedAt).toBeDefined();
      expect(restored.id).toBe('1');
      expect(restored.name).toBe('Test Project');

      // Check that archive-specific fields are removed
      expect((restored as Record<string, unknown>).archivedAt).toBeUndefined();
      expect((restored as Record<string, unknown>).archivedBy).toBeUndefined();
      expect((restored as Record<string, unknown>).archivedByName).toBeUndefined();
      expect((restored as Record<string, unknown>).deletionDate).toBeUndefined();
      expect((restored as Record<string, unknown>).canRestore).toBeUndefined();
      expect((restored as Record<string, unknown>).canDelete).toBeUndefined();
    });
  });

  describe('calculateStorageSize', () => {
    it('should calculate MB for small sizes', () => {
      expect(calculateStorageSize(10)).toBe('25.0 MB');
      expect(calculateStorageSize(100)).toBe('250.0 MB');
    });

    it('should calculate GB for large sizes', () => {
      expect(calculateStorageSize(500)).toBe('1.2 GB');
      expect(calculateStorageSize(1000)).toBe('2.4 GB');
    });

    it('should use custom average size', () => {
      expect(calculateStorageSize(10, 5)).toBe('50.0 MB');
      expect(calculateStorageSize(500, 5)).toBe('2.4 GB');
    });

    it('should handle zero files', () => {
      expect(calculateStorageSize(0)).toBe('0.0 MB');
    });
  });

  describe('generateBatchSummary', () => {
    it('should generate correct summary', () => {
      const results = {
        successful: [{}, {}, {}],
        failed: [{}],
        skipped: [{}, {}],
      };

      const summary = generateBatchSummary(results, 10);

      expect(summary.totalRequested).toBe(10);
      expect(summary.totalSuccessful).toBe(3);
      expect(summary.totalFailed).toBe(1);
      expect(summary.totalSkipped).toBe(2);
    });

    it('should handle empty results', () => {
      const results = {
        successful: [],
        failed: [],
        skipped: [],
      };

      const summary = generateBatchSummary(results, 5);

      expect(summary.totalRequested).toBe(5);
      expect(summary.totalSuccessful).toBe(0);
      expect(summary.totalFailed).toBe(0);
      expect(summary.totalSkipped).toBe(0);
    });
  });

  describe('calculateResourcesFreed', () => {
    it('should calculate total resources freed', () => {
      const deletions = [
        { filesDeleted: 10 },
        { filesDeleted: 20 },
        { filesDeleted: 30 },
      ];

      const resources = calculateResourcesFreed(deletions);

      expect(resources.totalFilesDeleted).toBe(60);
      expect(resources.estimatedSizeFreed).toBe('150.0 MB');
    });

    it('should handle GB sizes', () => {
      const deletions = [
        { filesDeleted: 500 },
        { filesDeleted: 500 },
      ];

      const resources = calculateResourcesFreed(deletions);

      expect(resources.totalFilesDeleted).toBe(1000);
      expect(resources.estimatedSizeFreed).toBe('2.4 GB');
    });

    it('should handle empty deletions', () => {
      const resources = calculateResourcesFreed([]);

      expect(resources.totalFilesDeleted).toBe(0);
      expect(resources.estimatedSizeFreed).toBe('0.0 MB');
    });
  });

  describe('processOperationError', () => {
    it('should format error with project name', () => {
      const error = new Error('Test error');
      const result = processOperationError(error, 'proj1', 'Project One', 'deletion');

      expect(result.id).toBe('proj1');
      expect(result.name).toBe('Project One');
      expect(result.reason).toBe('Internal error during deletion');
    });

    it('should format error without project name', () => {
      const error = new Error('Test error');
      const result = processOperationError(error, 'proj1', undefined, 'restoration');

      expect(result.id).toBe('proj1');
      expect(result.name).toBeUndefined();
      expect(result.reason).toBe('Internal error during restoration');
    });

    it('should use default operation name', () => {
      const error = new Error('Test error');
      const result = processOperationError(error, 'proj1');

      expect(result.reason).toBe('Internal error during process');
    });
  });
});