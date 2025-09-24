/**
 * Work Task Socket Event Handlers
 * This module adds work-task specific socket event handlers to the main socket server
 */

import { AuthenticatedSocket } from './server';
import { prisma } from '@/lib/prisma';

/**
 * Setup work-task related event handlers
 */
export function setupWorkTaskHandlers(socket: AuthenticatedSocket, io: any) {
  // Join work-task room
  socket.on('join:work-task', async (workTaskId: string) => {
    try {
      console.log(`[Socket] User ${socket.user.username} joining work-task room: ${workTaskId}`);

      // Verify user has access to the work task
      const workTask = await prisma.workTask.findFirst({
        where: {
          id: workTaskId,
          OR: [
            { createdById: socket.userId },
            {
              participants: {
                some: { userId: socket.userId }
              }
            }
          ]
        }
      });

      if (!workTask) {
        socket.emit('error', {
          type: 'access_denied',
          message: 'Work task access denied'
        });
        return;
      }

      // Join the work-task specific room
      const roomId = `work-task:${workTaskId}`;
      await socket.join(roomId);

      console.log(`[Socket] User ${socket.user.username} joined work-task room: ${roomId}`);

      // Notify the client that they've successfully joined
      socket.emit('joined:work-task', {
        workTaskId,
        roomId,
        timestamp: new Date()
      });

      // Optionally notify others in the room
      socket.to(roomId).emit('user:joined:work-task', {
        userId: socket.userId,
        user: {
          id: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
          profileImageUrl: socket.user.profileImageUrl
        },
        workTaskId,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[Socket] Error joining work-task room:', error);
      socket.emit('error', {
        type: 'join_work_task_failed',
        message: 'Failed to join work task room'
      });
    }
  });

  // Leave work-task room
  socket.on('leave:work-task', (workTaskId: string) => {
    const roomId = `work-task:${workTaskId}`;
    socket.leave(roomId);

    console.log(`[Socket] User ${socket.user.username} left work-task room: ${roomId}`);

    // Notify others in the room
    socket.to(roomId).emit('user:left:work-task', {
      userId: socket.userId,
      workTaskId,
      timestamp: new Date()
    });
  });

  // Handle subtask events (these would typically be emitted from API routes)
  socket.on('subtask:create', async (data: {
    workTaskId: string;
    subtask: any;
  }) => {
    const roomId = `work-task:${data.workTaskId}`;

    // Broadcast to all clients in the room except the sender
    socket.to(roomId).emit('subtask:created', {
      subtask: data.subtask,
      workTaskId: data.workTaskId,
      createdBy: {
        id: socket.userId,
        username: socket.user.username,
        nickname: socket.user.nickname
      },
      timestamp: new Date()
    });
  });

  socket.on('subtask:update', async (data: {
    workTaskId: string;
    subtaskId: string;
    updates: any;
    previousStatus?: string;
  }) => {
    const roomId = `work-task:${data.workTaskId}`;

    // Broadcast general update
    socket.to(roomId).emit('subtask:updated', {
      subtaskId: data.subtaskId,
      updates: data.updates,
      workTaskId: data.workTaskId,
      updatedBy: {
        id: socket.userId,
        username: socket.user.username,
        nickname: socket.user.nickname
      },
      timestamp: new Date()
    });

    // If status changed, emit specific status change event
    if (data.updates.status && data.previousStatus && data.updates.status !== data.previousStatus) {
      socket.to(roomId).emit('subtask:status-changed', {
        subtaskId: data.subtaskId,
        previousStatus: data.previousStatus,
        newStatus: data.updates.status,
        workTaskId: data.workTaskId,
        updatedBy: {
          id: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname
        },
        timestamp: new Date()
      });
    }
  });

  socket.on('subtask:delete', async (data: {
    workTaskId: string;
    subtaskId: string;
  }) => {
    const roomId = `work-task:${data.workTaskId}`;

    socket.to(roomId).emit('subtask:deleted', {
      subtaskId: data.subtaskId,
      workTaskId: data.workTaskId,
      deletedBy: {
        id: socket.userId,
        username: socket.user.username,
        nickname: socket.user.nickname
      },
      timestamp: new Date()
    });
  });

  // Typing indicators for subtask comments
  socket.on('typing:start:subtask', (data: {
    workTaskId: string;
    subtaskId?: string;
  }) => {
    const roomId = `work-task:${data.workTaskId}`;

    socket.to(roomId).emit('user:typing:subtask', {
      userId: socket.userId,
      user: {
        username: socket.user.username,
        nickname: socket.user.nickname,
        profileImageUrl: socket.user.profileImageUrl
      },
      subtaskId: data.subtaskId,
      timestamp: new Date()
    });
  });

  socket.on('typing:stop:subtask', (data: {
    workTaskId: string;
    subtaskId?: string;
  }) => {
    const roomId = `work-task:${data.workTaskId}`;

    socket.to(roomId).emit('user:stopped:typing:subtask', {
      userId: socket.userId,
      subtaskId: data.subtaskId,
      timestamp: new Date()
    });
  });
}

/**
 * Check if user has access to work task
 */
export async function checkWorkTaskAccess(userId: string, workTaskId: string): Promise<boolean> {
  try {
    const workTask = await prisma.workTask.findFirst({
      where: {
        id: workTaskId,
        OR: [
          { createdById: userId },
          {
            participants: {
              some: { userId }
            }
          }
        ]
      }
    });

    return !!workTask;
  } catch (error) {
    console.error('[Socket] Work task access check error:', error);
    return false;
  }
}