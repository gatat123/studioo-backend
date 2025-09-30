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
    }),

  participantAdded: (workTaskId: string, subtaskId: string, participant: any) =>
    emitWorkTaskEvent(workTaskId, 'subtask:participant-added', {
      subtaskId,
      participant,
      workTaskId
    }),

  participantRemoved: (workTaskId: string, subtaskId: string, userId: string) =>
    emitWorkTaskEvent(workTaskId, 'subtask:participant-removed', {
      subtaskId,
      userId,
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

/**
 * Helper function for project/scene comments
 */
export function emitCommentEvent(roomId: string, event: string, data: any) {
  return emitSocketEvent({
    room: roomId,
    event,
    data: {
      ...data,
      timestamp: new Date()
    }
  });
}

/**
 * Specific event emitters for project/scene comments
 */
export const commentEvents = {
  created: (targetType: 'project' | 'scene', targetId: string, comment: any) => {
    const room = `${targetType}:${targetId}`;
    return emitCommentEvent(room, 'comment:created', { comment, targetType, targetId });
  },

  updated: (targetType: 'project' | 'scene', targetId: string, comment: any) => {
    const room = `${targetType}:${targetId}`;
    return emitCommentEvent(room, 'comment:updated', { comment, targetType, targetId });
  },

  deleted: (targetType: 'project' | 'scene', targetId: string, commentId: string) => {
    const room = `${targetType}:${targetId}`;
    return emitCommentEvent(room, 'comment:deleted', { commentId, targetType, targetId });
  }
};

/**
 * Helper function for scene events (storyboard/illustration)
 */
export function emitSceneEvent(sceneId: string, event: string, data: any) {
  return emitSocketEvent({
    room: `scene:${sceneId}`,
    event,
    data: {
      ...data,
      timestamp: new Date()
    }
  });
}

/**
 * Specific event emitters for scenes (storyboard/illustration)
 */
export const sceneEvents = {
  created: (projectId: string, scene: any) =>
    emitSocketEvent({
      room: `project:${projectId}`,
      event: 'scene:created',
      data: { scene, projectId, timestamp: new Date() }
    }),

  updated: (sceneId: string, scene: any) =>
    emitSceneEvent(sceneId, 'scene:updated', { scene, sceneId }),

  deleted: (projectId: string, sceneId: string) =>
    emitSocketEvent({
      room: `project:${projectId}`,
      event: 'scene:deleted',
      data: { sceneId, projectId, timestamp: new Date() }
    }),

  imageUploaded: (sceneId: string, image: any) =>
    emitSceneEvent(sceneId, 'scene:image-uploaded', { image, sceneId }),

  imageUpdated: (sceneId: string, image: any) =>
    emitSceneEvent(sceneId, 'scene:image-updated', { image, sceneId }),

  imageDeleted: (sceneId: string, imageId: string) =>
    emitSceneEvent(sceneId, 'scene:image-deleted', { imageId, sceneId }),

  scriptUpdated: (sceneId: string, script: string) =>
    emitSceneEvent(sceneId, 'scene:script-updated', { script, sceneId })
};

/**
 * Helper function for project events
 */
export function emitProjectEvent(projectId: string, event: string, data: any) {
  return emitSocketEvent({
    room: `project:${projectId}`,
    event,
    data: {
      ...data,
      timestamp: new Date()
    }
  });
}

/**
 * Specific event emitters for projects
 */
export const projectEvents = {
  created: (project: any) =>
    emitProjectEvent(project.id, 'project:created', { project }),

  updated: (projectId: string, project: any) =>
    emitProjectEvent(projectId, 'project:updated', { project, projectId }),

  deleted: (projectId: string) =>
    emitProjectEvent(projectId, 'project:deleted', { projectId }),

  participantAdded: (projectId: string, participant: any) =>
    emitProjectEvent(projectId, 'project:participant-added', { participant, projectId }),

  participantRemoved: (projectId: string, userId: string) =>
    emitProjectEvent(projectId, 'project:participant-removed', { userId, projectId }),

  participantUpdated: (projectId: string, participant: any) =>
    emitProjectEvent(projectId, 'project:participant-updated', { participant, projectId })
};

/**
 * Helper function for channel events
 */
export function emitChannelEvent(channelId: string, event: string, data: any) {
  return emitSocketEvent({
    room: `channel:${channelId}`,
    event,
    data: {
      ...data,
      timestamp: new Date()
    }
  });
}

/**
 * Specific event emitters for channels
 */
export const channelEvents = {
  created: (channel: any) =>
    emitChannelEvent(channel.id, 'channel:created', { channel }),

  updated: (channelId: string, channel: any) =>
    emitChannelEvent(channelId, 'channel:updated', { channel, channelId }),

  deleted: (channelId: string) =>
    emitChannelEvent(channelId, 'channel:deleted', { channelId }),

  memberAdded: (channelId: string, member: any) =>
    emitChannelEvent(channelId, 'channel:member-added', { member, channelId }),

  memberRemoved: (channelId: string, userId: string) =>
    emitChannelEvent(channelId, 'channel:member-removed', { userId, channelId }),

  memberUpdated: (channelId: string, member: any) =>
    emitChannelEvent(channelId, 'channel:member-updated', { member, channelId }),

  messageCreated: (channelId: string, message: any) =>
    emitChannelEvent(channelId, 'channel:message-created', { message, channelId }),

  // 채널 초대 이벤트 추가
  inviteSent: (channelId: string, inviteeId: string, invite: any) =>
    emitSocketEvent({
      room: `user:${inviteeId}`, // 초대받는 사용자의 개인 룸으로 전송
      event: 'channel_invite_received',
      data: {
        invite,
        channelId,
        timestamp: new Date()
      }
    }),

  inviteAccepted: (channelId: string, invite: any) =>
    emitChannelEvent(channelId, 'channel:invite-accepted', { invite, channelId }),

  inviteRejected: (channelId: string, invite: any) =>
    emitChannelEvent(channelId, 'channel:invite-rejected', { invite, channelId }),

  // 사용자가 채널에 성공적으로 참여했을 때 이벤트
  userJoined: (userId: string, channelData: any) =>
    emitSocketEvent({
      room: `user:${userId}`,
      event: 'channel_joined',
      data: {
        channelId: channelData.id,
        channel: channelData,
        message: '채널에 성공적으로 참여했습니다.',
        timestamp: new Date()
      }
    }),

  // 채널 목록 업데이트가 필요할 때 (초대 수락 후 등)
  channelListUpdated: (userId: string) =>
    emitSocketEvent({
      room: `user:${userId}`,
      event: 'channel_list_updated',
      data: {
        message: '채널 목록을 다시 불러오세요.',
        timestamp: new Date()
      }
    }),

  // 초대 수락 알림 (초대한 사람에게)
  inviteAcceptedNotification: (inviterId: string, acceptedBy: any, channel: any) =>
    emitSocketEvent({
      room: `user:${inviterId}`,
      event: 'channel_invite_accepted_notification',
      data: {
        acceptedBy,
        channel,
        timestamp: new Date()
      }
    }),

  // Work 연결/해제 이벤트
  workLinked: (channelId: string, workTaskId: string, workTask: any) =>
    emitChannelEvent(channelId, 'channel:work-linked', { channelId, workTaskId, workTask }),

  workUnlinked: (channelId: string) =>
    emitChannelEvent(channelId, 'channel:work-unlinked', { channelId })
};

/**
 * Helper function for work events
 */
export function emitWorkEvent(workId: string, event: string, data: any) {
  return emitSocketEvent({
    room: `work:${workId}`,
    event,
    data: {
      ...data,
      timestamp: new Date()
    }
  });
}

/**
 * Specific event emitters for work
 */
export const workEvents = {
  created: (work: any) =>
    emitWorkEvent(work.id, 'work:created', { work }),

  updated: (workId: string, work: any) =>
    emitWorkEvent(workId, 'work:updated', { work, workId }),

  deleted: (workId: string) =>
    emitWorkEvent(workId, 'work:deleted', { workId })
};

/**
 * Specific event emitters for work tasks
 */
export const workTaskEvents = {
  created: (workId: string, workTask: any) =>
    emitWorkEvent(workId, 'work-task:created', { workTask, workId }),

  updated: (workTaskId: string, workTask: any) =>
    emitWorkTaskEvent(workTaskId, 'work-task:updated', { workTask, workTaskId }),

  deleted: (workId: string, workTaskId: string) =>
    emitWorkEvent(workId, 'work-task:deleted', { workTaskId, workId }),

  statusChanged: (workTaskId: string, workTask: any, previousStatus: string, newStatus: string) =>
    emitWorkTaskEvent(workTaskId, 'work-task:status-changed', {
      workTask,
      previousStatus,
      newStatus,
      workTaskId
    })
};

/**
 * Helper function for global announcement events
 */
export function emitAnnouncementEvent(event: string, data: any) {
  return emitSocketEvent({
    room: 'global',
    event,
    data: {
      ...data,
      timestamp: new Date()
    }
  });
}

/**
 * Specific event emitters for announcements
 */
export const announcementEvents = {
  created: (announcement: any) =>
    emitAnnouncementEvent('announcement:created', { announcement }),

  updated: (announcement: any) =>
    emitAnnouncementEvent('announcement:updated', { announcement }),

  deleted: (announcementId: string) =>
    emitAnnouncementEvent('announcement:deleted', { announcementId }),

  // 전체 시스템 공지사항 업데이트 알림
  listUpdated: () =>
    emitAnnouncementEvent('announcement:list-updated', {
      message: '공지사항이 업데이트되었습니다. 목록을 다시 불러오세요.'
    })
};