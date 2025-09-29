import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  processBatchDelete,
  processBatchRestore,
  generateBatchResponse,
  BatchResults,
} from '../batch-operations';
import { mockProjectStore } from '../../data/mock-projects';

// Mock the mockProjectStore methods
jest.mock('../../data/mock-projects', () => ({
  mockProjectStore: {
    findArchivedProject: jest.fn(),
    removeArchivedProject: jest.fn(),
    addActiveProject: jest.fn(),
    getArchivedProjects: jest.fn(),
    getActiveProjects: jest.fn(),
    getArchivedProjectIndex: jest.fn(),
  },
}));

describe('Batch Operations Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processBatchDelete', () => {
    it('should successfully delete valid projects', async () => {
      const mockProject = {
        id: '1',
        name: 'Test Project',
        ownerId: 'user1',
        canDelete: true,
        deletionDate: new Date(Date.now() - 86400000).toISOString(), // Past date
        files: 10,
      };

      (mockProjectStore.findArchivedProject as jest.Mock).mockReturnValue(mockProject);
      (mockProjectStore.removeArchivedProject as jest.Mock).mockReturnValue(true);

      const results = await processBatchDelete(['1'], false);

      expect(results.successful).toHaveLength(1);
      expect(results.successful[0].id).toBe('1');
      expect(results.successful[0].name).toBe('Test Project');
      expect(results.successful[0].filesDeleted).toBe(10);
      expect(results.failed).toHaveLength(0);
      expect(results.skipped).toHaveLength(0);
    });

    it('should skip projects that cannot be deleted without force', async () => {
      const mockProject = {
        id: '1',
        name: 'Protected Project',
        ownerId: 'user1',
        canDelete: false,
        deletionDate: new Date(Date.now() - 86400000).toISOString(),
        files: 10,
      };

      (mockProjectStore.findArchivedProject as jest.Mock).mockReturnValue(mockProject);

      const results = await processBatchDelete(['1'], false);

      expect(results.successful).toHaveLength(0);
      expect(results.failed).toHaveLength(0);
      expect(results.skipped).toHaveLength(1);
      expect(results.skipped[0].reason).toContain('protected or has dependencies');
    });

    it('should force delete protected projects when force is true', async () => {
      const mockProject = {
        id: '1',
        name: 'Protected Project',
        ownerId: 'user1',
        canDelete: false,
        deletionDate: new Date(Date.now() + 86400000).toISOString(), // Future date
        files: 10,
      };

      (mockProjectStore.findArchivedProject as jest.Mock).mockReturnValue(mockProject);
      (mockProjectStore.removeArchivedProject as jest.Mock).mockReturnValue(true);

      const results = await processBatchDelete(['1'], true);

      expect(results.successful).toHaveLength(1);
      expect(results.failed).toHaveLength(0);
      expect(results.skipped).toHaveLength(0);
    });

    it('should handle invalid project IDs', async () => {
      const results = await processBatchDelete([null as unknown as string, '', '2'], false);

      expect(results.failed).toHaveLength(2); // null and empty string
      expect(results.failed[0].reason).toBe('Invalid project ID format');
    });

    it('should handle non-existent projects', async () => {
      (mockProjectStore.findArchivedProject as jest.Mock).mockReturnValue(undefined);

      const results = await processBatchDelete(['999'], false);

      expect(results.failed).toHaveLength(1);
      expect(results.failed[0].reason).toBe('Archived project not found');
    });
  });

  describe('processBatchRestore', () => {
    it('should successfully restore valid projects', async () => {
      const mockProject = {
        id: '1',
        name: 'Test Project',
        ownerId: 'user1',
        canRestore: true,
        archivedAt: '2024-01-01T00:00:00Z',
        archivedBy: 'user1',
        files: 10,
      };

      (mockProjectStore.findArchivedProject as jest.Mock).mockReturnValue(mockProject);
      (mockProjectStore.removeArchivedProject as jest.Mock).mockReturnValue(true);
      (mockProjectStore.addActiveProject as jest.Mock).mockImplementation(() => {});

      const results = await processBatchRestore(['1']);

      expect(results.successful).toHaveLength(1);
      expect(results.successful[0].id).toBe('1');
      expect(results.successful[0].name).toBe('Test Project');
      expect(results.failed).toHaveLength(0);
      expect(results.skipped).toHaveLength(0);

      // Verify addActiveProject was called
      expect(mockProjectStore.addActiveProject).toHaveBeenCalled();
    });

    it('should skip projects that cannot be restored', async () => {
      const mockProject = {
        id: '1',
        name: 'Corrupted Project',
        ownerId: 'user1',
        canRestore: false,
        files: 10,
      };

      (mockProjectStore.findArchivedProject as jest.Mock).mockReturnValue(mockProject);

      const results = await processBatchRestore(['1']);

      expect(results.successful).toHaveLength(0);
      expect(results.failed).toHaveLength(0);
      expect(results.skipped).toHaveLength(1);
      expect(results.skipped[0].reason).toContain('cannot be restored');
    });

    it('should check permissions when currentUserId is provided', async () => {
      const mockProject = {
        id: '1',
        name: 'Other User Project',
        ownerId: 'user2',
        canRestore: true,
        files: 10,
      };

      (mockProjectStore.findArchivedProject as jest.Mock).mockReturnValue(mockProject);

      const results = await processBatchRestore(['1'], 'user1', false);

      expect(results.successful).toHaveLength(0);
      expect(results.failed).toHaveLength(1);
      expect(results.failed[0].reason).toContain('Insufficient permissions');
    });

    it('should allow admin to restore any project', async () => {
      const mockProject = {
        id: '1',
        name: 'Other User Project',
        ownerId: 'user2',
        canRestore: true,
        files: 10,
      };

      (mockProjectStore.findArchivedProject as jest.Mock).mockReturnValue(mockProject);
      (mockProjectStore.removeArchivedProject as jest.Mock).mockReturnValue(true);
      (mockProjectStore.addActiveProject as jest.Mock).mockImplementation(() => {});

      const results = await processBatchRestore(['1'], 'user1', true);

      expect(results.successful).toHaveLength(1);
      expect(results.failed).toHaveLength(0);
    });
  });

  describe('generateBatchResponse', () => {
    it('should generate delete response with warning', async () => {
      const results: BatchResults = {
        successful: [{ id: '1', name: 'Project 1' }],
        failed: [],
        skipped: [],
      };

      const response = generateBatchResponse(results, 'delete', 1);
      const body = await response.text();
      const jsonResponse = JSON.parse(body);

      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.message).toContain('deleted successfully');
      expect(jsonResponse.warning).toBe('Deleted projects cannot be recovered');
    });

    it('should generate restore response without warning', async () => {
      const results: BatchResults = {
        successful: [{ id: '1', name: 'Project 1' }],
        failed: [],
        skipped: [],
      };

      const response = generateBatchResponse(results, 'restore', 1);
      const body = await response.text();
      const jsonResponse = JSON.parse(body);

      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.message).toContain('restored successfully');
      expect(jsonResponse.warning).toBeUndefined();
    });

    it('should include additional data when provided', async () => {
      const results: BatchResults = {
        successful: [],
        failed: [],
        skipped: [],
      };

      const additionalData = {
        customField: 'customValue',
        anotherField: 123,
      };

      const response = generateBatchResponse(results, 'delete', 0, additionalData);
      const body = await response.text();
      const jsonResponse = JSON.parse(body);

      expect(jsonResponse.customField).toBe('customValue');
      expect(jsonResponse.anotherField).toBe(123);
    });

    it('should handle failed operations correctly', async () => {
      const results: BatchResults = {
        successful: [],
        failed: [{ id: '1', reason: 'Error' }],
        skipped: [{ id: '2', reason: 'Skipped' }],
      };

      const response = generateBatchResponse(results, 'restore', 2);
      const body = await response.text();
      const jsonResponse = JSON.parse(body);

      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.summary.totalSuccessful).toBe(0);
      expect(jsonResponse.summary.totalFailed).toBe(1);
      expect(jsonResponse.summary.totalSkipped).toBe(1);
    });
  });
});