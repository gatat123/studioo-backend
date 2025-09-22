import { prisma } from "@/lib/prisma";

// NotificationType은 일반 string으로 정의
type NotificationType = string;

export interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  projectId?: string;
  metadata?: Record<string, any>;
}

export interface NotificationFilters {
  isRead?: boolean;
  type?: NotificationType;
  projectId?: string;
  limit?: number;
  offset?: number;
}

export class NotificationService {
  /**
   * 알림 생성
   */
  static async createNotification(data: CreateNotificationData) {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message || '',
          projectId: data.projectId,
          isRead: false,
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
              profileImageUrl: true,
            },
          },
        },
      });

      return notification;
    } catch (error) {
      console.error("Failed to create notification:", error);
      throw error;
    }
  }

  /**
   * 사용자의 알림 목록 조회
   */
  static async getUserNotifications(
    userId: string,
    filters: NotificationFilters = {}
  ) {
    try {
      const {
        isRead,
        type,
        projectId,
        limit = 50,
        offset = 0,
      } = filters;

      const where: any = {
        userId,
      };

      if (isRead !== undefined) {
        where.isRead = isRead;
      }

      if (type) {
        where.type = type;
      }

      if (projectId) {
        where.projectId = projectId;
      }

      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          include: {
            project: {
              select: {
                id: true,
                name: true,
              },
            },
            user: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: limit,
          skip: offset,
        }),
        prisma.notification.count({ where }),
      ]);

      return {
        notifications,
        total,
        hasMore: offset + limit < total,
      };
    } catch (error) {
      console.error("Failed to get user notifications:", error);
      throw error;
    }
  }

  /**
   * 알림 읽음 처리
   */
  static async markAsRead(notificationId: string, userId: string) {
    try {
      const notification = await prisma.notification.update({
        where: {
          id: notificationId,
          userId,
        },
        data: {
          isRead: true,
        },
      });

      return notification;
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      throw error;
    }
  }

  /**
   * 여러 알림 읽음 처리
   */
  static async markManyAsRead(notificationIds: string[], userId: string) {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          id: {
            in: notificationIds,
          },
          userId,
        },
        data: {
          isRead: true,
        },
      });

      return result;
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);
      throw error;
    }
  }

  /**
   * 모든 알림 읽음 처리
   */
  static async markAllAsRead(userId: string) {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });

      return result;
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      throw error;
    }
  }

  /**
   * 알림 삭제
   */
  static async deleteNotification(notificationId: string, userId: string) {
    try {
      const notification = await prisma.notification.delete({
        where: {
          id: notificationId,
          userId,
        },
      });

      return notification;
    } catch (error) {
      console.error("Failed to delete notification:", error);
      throw error;
    }
  }

  /**
   * 오래된 알림 삭제
   */
  static async deleteOldNotifications(days: number = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const result = await prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
          isRead: true,
        },
      });

      return result;
    } catch (error) {
      console.error("Failed to delete old notifications:", error);
      throw error;
    }
  }

  /**
   * 읽지 않은 알림 개수 조회
   */
  static async getUnreadCount(userId: string) {
    try {
      const count = await prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      });

      return count;
    } catch (error) {
      console.error("Failed to get unread notification count:", error);
      throw error;
    }
  }

  /**
   * 프로젝트 관련 알림 조회
   */
  static async getProjectNotifications(projectId: string, limit: number = 50) {
    try {
      const notifications = await prisma.notification.findMany({
        where: {
          projectId,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
              profileImageUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
      });

      return notifications;
    } catch (error) {
      console.error("Failed to get project notifications:", error);
      throw error;
    }
  }

  /**
   * 알림 설정 업데이트
   */
  static async updateNotificationSettings(
    userId: string,
    settings: {
      projectUpdates?: boolean;
      commentMentions?: boolean;
      newMembers?: boolean;
    }
  ) {
    try {
      // 실제 구현은 사용자 설정 테이블이 필요함
      // 현재는 placeholder
      return settings;
    } catch (error) {
      console.error("Failed to update notification settings:", error);
      throw error;
    }
  }

  /**
   * 프로젝트 참여자에게 알림 전송
   */
  static async notifyProjectParticipants(
    projectId: string,
    type: NotificationType,
    title: string,
    message: string,
    excludeUserId?: string,
    metadata?: Record<string, any>
  ) {
    try {
      // 프로젝트 참여자 조회
      const participants = await prisma.projectParticipant.findMany({
        where: {
          projectId,
          userId: excludeUserId ? { not: excludeUserId } : undefined,
        },
        select: {
          userId: true,
        },
      });

      // 각 참여자에게 알림 생성
      const notifications = await Promise.all(
        participants.map((participant) =>
          this.createNotification({
            userId: participant.userId,
            type,
            title,
            message,
            projectId,
            metadata,
          })
        )
      );

      return notifications;
    } catch (error) {
      console.error("Failed to notify project participants:", error);
      throw error;
    }
  }

  /**
   * 댓글 알림 생성 (언급, 답글 등)
   */
  static async createCommentNotification(
    commentId: string,
    type: "comment_mention" | "comment_reply",
    targetUserId: string
  ) {
    try {
      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
          scene: {
            select: {
              id: true,
              projectId: true,
              project: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      if (!comment) {
        throw new Error("Comment not found");
      }

      const title = type === "comment_mention" 
        ? `${comment.user.nickname || comment.user.username}님이 회원님을 언급했습니다`
        : `${comment.user.nickname || comment.user.username}님이 답글을 남겼습니다`;

      const notification = await this.createNotification({
        userId: targetUserId,
        type,
        title,
        message: comment.content.substring(0, 100),
        projectId: comment.scene?.projectId || undefined,
        metadata: {
          commentId,
          commentUserId: comment.userId,
        },
      });

      return notification;
    } catch (error) {
      console.error("Failed to create comment notification:", error);
      throw error;
    }
  }

  /**
   * 이미지 업로드 알림 생성
   */
  static async createImageUploadNotification(
    imageId: string,
    projectId: string,
    uploaderId: string
  ) {
    try {
      const image = await prisma.image.findUnique({
        where: { id: imageId },
        include: {
          uploader: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
          scene: {
            select: {
              id: true,
              sceneNumber: true,
              projectId: true,
            },
          },
        },
      });

      if (!image) {
        throw new Error("Image not found");
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true },
      });

      const title = `${image.uploader.nickname || image.uploader.username}님이 새 이미지를 업로드했습니다`;
      const message = project && image.scene ? `${project.name} - 씬 ${image.scene.sceneNumber}` : undefined;

      await this.notifyProjectParticipants(
        projectId,
        "image_upload",
        title,
        message || "",
        uploaderId,
        {
          imageId,
          sceneId: image.sceneId,
        }
      );
    } catch (error) {
      console.error("Failed to create image upload notification:", error);
      throw error;
    }
  }

  /**
   * 프로젝트 초대 알림 생성
   */
  static async createInviteNotification(
    projectId: string,
    invitedUserId: string,
    inviterUserId: string
  ) {
    try {
      const [project, inviter] = await Promise.all([
        prisma.project.findUnique({
          where: { id: projectId },
          select: { name: true },
        }),
        prisma.user.findUnique({
          where: { id: inviterUserId },
          select: { username: true, nickname: true },
        }),
      ]);

      if (!project || !inviter) {
        throw new Error("Project or inviter not found");
      }

      const title = `${inviter.nickname || inviter.username}님이 프로젝트에 초대했습니다`;
      const message = `${project.name} 프로젝트에 참여하세요`;

      const notification = await this.createNotification({
        userId: invitedUserId,
        type: "project_invite",
        title,
        message,
        projectId,
        metadata: {
          inviterUserId,
        },
      });

      return notification;
    } catch (error) {
      console.error("Failed to create invite notification:", error);
      throw error;
    }
  }

  /**
   * 시스템 알림 생성
   */
  static async createSystemNotification(
    userId: string,
    title: string,
    message: string
  ) {
    try {
      const notification = await this.createNotification({
        userId,
        type: "system",
        title,
        message,
      });

      return notification;
    } catch (error) {
      console.error("Failed to create system notification:", error);
      throw error;
    }
  }

  /**
   * 배치 알림 생성
   */
  static async createBatchNotifications(
    notifications: CreateNotificationData[]
  ) {
    try {
      const createdNotifications = await prisma.notification.createMany({
        data: notifications.map((n) => ({
          ...n,
          message: n.message || '',
          isRead: false,
        })),
      });

      return createdNotifications;
    } catch (error) {
      console.error("Failed to create batch notifications:", error);
      throw error;
    }
  }
}

export default NotificationService;