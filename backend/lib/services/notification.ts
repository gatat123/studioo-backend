import { prisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";

export interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  projectId?: string;
  sceneId?: string;
  commentId?: string;
  imageId?: string;
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
          content: data.content,
          projectId: data.projectId,
          sceneId: data.sceneId,
          commentId: data.commentId,
          imageId: data.imageId,
          metadata: data.metadata,
          isRead: false,
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          scene: {
            select: {
              id: true,
              sceneNumber: true,
              description: true,
            },
          },
          comment: {
            select: {
              id: true,
              content: true,
            },
          },
          image: {
            select: {
              id: true,
              filename: true,
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
  static async getNotifications(userId: string, filters: NotificationFilters = {}) {
    try {
      const {
        isRead,
        type,
        projectId,
        limit = 20,
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
            scene: {
              select: {
                id: true,
                sceneNumber: true,
                description: true,
              },
            },
            comment: {
              select: {
                id: true,
                content: true,
                user: {
                  select: {
                    id: true,
                    username: true,
                    nickname: true,
                  },
                },
              },
            },
            image: {
              select: {
                id: true,
                filename: true,
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
      console.error("Failed to get notifications:", error);
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
          userId, // 권한 확인
        },
        data: {
          isRead: true,
          readAt: new Date(),
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
  static async markMultipleAsRead(notificationIds: string[], userId: string) {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId, // 권한 확인
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
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
  static async markAllAsRead(userId: string, projectId?: string) {
    try {
      const where: any = {
        userId,
        isRead: false,
      };

      if (projectId) {
        where.projectId = projectId;
      }

      const result = await prisma.notification.updateMany({
        where,
        data: {
          isRead: true,
          readAt: new Date(),
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
          userId, // 권한 확인
        },
      });

      return notification;
    } catch (error) {
      console.error("Failed to delete notification:", error);
      throw error;
    }
  }

  /**
   * 읽지 않은 알림 개수 조회
   */
  static async getUnreadCount(userId: string, projectId?: string) {
    try {
      const where: any = {
        userId,
        isRead: false,
      };

      if (projectId) {
        where.projectId = projectId;
      }

      const count = await prisma.notification.count({ where });
      return count;
    } catch (error) {
      console.error("Failed to get unread count:", error);
      throw error;
    }
  }

  /**
   * 프로젝트 관련 알림 생성 헬퍼들
   */
  
  // 프로젝트 참여자에게 알림 전송
  static async notifyProjectParticipants(
    projectId: string,
    type: NotificationType,
    title: string,
    content: string,
    excludeUserId?: string,
    metadata?: Record<string, any>
  ) {
    try {
      const participants = await prisma.projectParticipant.findMany({
        where: {
          projectId,
          userId: excludeUserId ? { not: excludeUserId } : undefined,
        },
        select: {
          userId: true,
        },
      });

      const notifications = await Promise.all(
        participants.map((participant) =>
          this.createNotification({
            userId: participant.userId,
            type,
            title,
            content,
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

  // 새 댓글 알림
  static async notifyNewComment(
    commentId: string,
    authorId: string,
    projectId: string,
    sceneId?: string,
    imageId?: string
  ) {
    try {
      const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        include: {
          user: {
            select: {
              nickname: true,
              username: true,
            },
          },
          project: {
            select: {
              name: true,
            },
          },
          scene: {
            select: {
              sceneNumber: true,
              description: true,
            },
          },
          image: {
            select: {
              filename: true,
            },
          },
        },
      });

      if (!comment) return;

      const authorName = comment.user.nickname || comment.user.username;
      const projectName = comment.project.name;
      let location = projectName;

      if (comment.scene) {
        location += ` - 씬 ${comment.scene.sceneNumber}`;
      }
      if (comment.image) {
        location += ` - ${comment.image.filename}`;
      }

      await this.notifyProjectParticipants(
        projectId,
        "comment_created",
        "새 댓글",
        `${authorName}님이 ${location}에 댓글을 작성했습니다.`,
        authorId,
        {
          commentId,
          commentContent: comment.content.substring(0, 100),
          authorName,
          location,
        }
      );
    } catch (error) {
      console.error("Failed to notify new comment:", error);
    }
  }

  // 이미지 업로드 알림
  static async notifyImageUpload(
    imageId: string,
    uploaderId: string,
    projectId: string,
    sceneId: string
  ) {
    try {
      const image = await prisma.image.findUnique({
        where: { id: imageId },
        include: {
          uploader: {
            select: {
              nickname: true,
              username: true,
            },
          },
          scene: {
            select: {
              sceneNumber: true,
              description: true,
            },
          },
          project: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!image) return;

      const uploaderName = image.uploader.nickname || image.uploader.username;
      const location = `${image.project.name} - 씬 ${image.scene.sceneNumber}`;

      await this.notifyProjectParticipants(
        projectId,
        "image_uploaded",
        "새 이미지 업로드",
        `${uploaderName}님이 ${location}에 이미지를 업로드했습니다.`,
        uploaderId,
        {
          imageId,
          filename: image.filename,
          uploaderName,
          location,
        }
      );
    } catch (error) {
      console.error("Failed to notify image upload:", error);
    }
  }

  // 프로젝트 초대 알림
  static async notifyProjectInvite(
    userId: string,
    projectId: string,
    inviterUserId: string,
    inviteCode: string
  ) {
    try {
      const [project, inviter] = await Promise.all([
        prisma.project.findUnique({
          where: { id: projectId },
          select: { name: true },
        }),
        prisma.user.findUnique({
          where: { id: inviterUserId },
          select: { nickname: true, username: true },
        }),
      ]);

      if (!project || !inviter) return;

      const inviterName = inviter.nickname || inviter.username;

      await this.createNotification({
        userId,
        type: "project_invite",
        title: "프로젝트 초대",
        content: `${inviterName}님이 "${project.name}" 프로젝트에 초대했습니다.`,
        projectId,
        metadata: {
          inviteCode,
          inviterName,
          projectName: project.name,
        },
      });
    } catch (error) {
      console.error("Failed to notify project invite:", error);
    }
  }

  // 씬 업데이트 알림
  static async notifySceneUpdate(
    sceneId: string,
    editorId: string,
    projectId: string,
    changeType: "created" | "updated" | "deleted"
  ) {
    try {
      const scene = await prisma.scene.findUnique({
        where: { id: sceneId },
        include: {
          project: {
            select: {
              name: true,
            },
          },
        },
      });

      const editor = await prisma.user.findUnique({
        where: { id: editorId },
        select: {
          nickname: true,
          username: true,
        },
      });

      if (!scene || !editor) return;

      const editorName = editor.nickname || editor.username;
      const projectName = scene.project.name;
      
      let actionText = "";
      switch (changeType) {
        case "created":
          actionText = "생성했습니다";
          break;
        case "updated":
          actionText = "수정했습니다";
          break;
        case "deleted":
          actionText = "삭제했습니다";
          break;
      }

      await this.notifyProjectParticipants(
        projectId,
        "scene_updated",
        "씬 업데이트",
        `${editorName}님이 ${projectName}의 씬 ${scene.sceneNumber}을 ${actionText}.`,
        editorId,
        {
          sceneId,
          sceneNumber: scene.sceneNumber,
          changeType,
          editorName,
          projectName,
        }
      );
    } catch (error) {
      console.error("Failed to notify scene update:", error);
    }
  }
}

export default NotificationService;