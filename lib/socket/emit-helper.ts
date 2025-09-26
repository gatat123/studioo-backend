/**
 * Socket.io event emission helper
 * Handles emitting events in both development and production environments
 */

import { getSocketInstance } from './server';
import { getGlobalSocketInstance } from './global-socket';

interface EmitOptions {
  room: string;
  event: string;
  data: any;
}

/**
 * Emit a Socket.io event to a room
 * Tries direct emission first, falls back to HTTP if needed
 */
export async function emitSocketEvent({ room, event, data }: EmitOptions): Promise<boolean> {
  try {
    // Try direct emission first - check both local and global instances
    const io = getSocketInstance() || getGlobalSocketInstance();

    if (io) {
      io.to(room).emit(event, data);

      const rooms = io.sockets.adapter.rooms;
      const roomClients = rooms.get(room);
      const clientCount = roomClients ? roomClients.size : 0;

      console.log(`[Socket Helper] Direct emit: ${event} to room ${room} (${clientCount} clients)`);
      return true;
    }

    // In production, Socket.io should be available in the same process
    // Log error and return false instead of trying HTTP fallback
    if (process.env.NODE_ENV === 'production') {
      console.error(`[Socket Helper] Socket.io instance not available in production for: ${event}`);
      console.error('[Socket Helper] This should not happen - check server initialization');
      return false;
    }

    // Only use HTTP fallback in development mode
    console.log(`[Socket Helper] Using HTTP fallback for: ${event} (dev mode)`);

    const baseUrl = 'http://127.0.0.1:3001';
    const response = await fetch(`${baseUrl}/api/socket/emit`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': process.env.INTERNAL_API_KEY || 'internal-socket-emit'
      },
      body: JSON.stringify({ room, event, data })
    });

    if (!response.ok) {
      throw new Error(`Socket emit failed with status ${response.status}`);
    }

    const result = await response.json();
    console.log(`[Socket Helper] HTTP emit result:`, result);
    return true;

  } catch (error) {
    console.error(`[Socket Helper] Failed to emit ${event}:`, error);
    return false;
  }
}

/**
 * Helper function for work-task events
 */
export function emitWorkTaskEvent(workTaskId: string, event: string, data: any) {
  return emitSocketEvent({
    room: `work-task:${workTaskId}`,
    event,
    data: {
      ...data,
      timestamp: new Date()
    }
  });
}

/**
 * Specific event emitters for subtasks
 */
export const subtaskEvents = {
  created: (workTaskId: string, subtask: any) =>
    emitWorkTaskEvent(workTaskId, 'subtask:created', { subtask, workTaskId }),

  updated: (workTaskId: string, subtask: any) =>
    emitWorkTaskEvent(workTaskId, 'subtask:updated', { subtask, workTaskId }),

  statusChanged: (workTaskId: string, subtask: any, previousStatus: string, newStatus: string) =>
    emitWorkTaskEvent(workTaskId, 'subtask:status-changed', {
      subtask,
      previousStatus,
      newStatus,
      workTaskId
    }),

  deleted: (workTaskId: string, subtaskId: string) =>
    emitWorkTaskEvent(workTaskId, 'subtask:deleted', { subtaskId, workTaskId }),

  orderUpdated: (workTaskId: string, subtaskId: string, newStatus: string, newPosition: number) =>
    emitWorkTaskEvent(workTaskId, 'subtaskOrderUpdated', {
      subtaskId,
      newStatus,
      newPosition,
      workTaskId
    })
};

/**
 * Specific event emitters for subtask comments
 */
export const subtaskCommentEvents = {
  created: (workTaskId: string, subtaskId: string, comment: any) =>
    emitWorkTaskEvent(workTaskId, 'subtask:comment-created', { subtaskId, comment, workTaskId }),

  updated: (workTaskId: string, subtaskId: string, comment: any) =>
    emitWorkTaskEvent(workTaskId, 'subtask:comment-updated', { subtaskId, comment, workTaskId }),

  deleted: (workTaskId: string, subtaskId: string, commentId: string) =>
    emitWorkTaskEvent(workTaskId, 'subtask:comment-deleted', { subtaskId, commentId, workTaskId })
};