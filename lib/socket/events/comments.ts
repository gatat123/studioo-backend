import { Server as SocketIOServer } from "socket.io";
import { AuthenticatedSocket } from "../auth";
import { NotificationService } from "@/lib/services/notification";
import { CollaborationService } from "@/lib/services/collaboration";
import RoomManager from "../rooms";
import PresenceManager from "../presence";

export interface CommentEventData {
  commentId: string;
  projectId: string;
  sceneId?: string;
  imageId?: string;
  content: string;
  parentCommentId?: string;
  mentions?: string[]; // 언급된 사용자 ID들
}

export interface CommentUpdateEventData {
  commentId: string;
  content: string;
  projectId: string;
  sceneId?: string;
  imageId?: string;
}

export interface CommentDeleteEventData {
  commentId: string;
  projectId: string;
  sceneId?: string;
  imageId?: string;
  isHardDelete: boolean;
}

export interface CommentReactionEventData {
  commentId: string;
  reaction: "like" | "dislike" | "heart" | "laugh" | "angry";
  action: "add" | "remove";
  projectId: string;
}

export class CommentEventHandler {
  private io: SocketIOServer;
  private roomManager: RoomManager;
  private presenceManager: PresenceManager;

  constructor(io: SocketIOServer, roomManager: RoomManager, presenceManager: PresenceManager) {
    this.io = io;
    this.roomManager = roomManager;
    this.presenceManager = presenceManager;
  }

  /**
   * 댓글 이벤트 핸들러 등록
   */
  registerEventHandlers(socket: AuthenticatedSocket): void {
    // 새 댓글 생성 이벤트
    socket.on("comment:create", (data: CommentEventData) => {
      this.handleCommentCreate(socket, data);
    });

    // 댓글 수정 이벤트
    socket.on("comment:update", (data: CommentUpdateEventData) => {
      this.handleCommentUpdate(socket, data);
    });

    // 댓글 삭제 이벤트
    socket.on("comment:delete", (data: CommentDeleteEventData) => {
      this.handleCommentDelete(socket, data);
    });

    // 댓글 반응 이벤트
    socket.on("comment:reaction", (data: CommentReactionEventData) => {
      this.handleCommentReaction(socket, data);
    });

    // 댓글 조회 이벤트
    socket.on("comment:view", (data: { commentId: string; projectId: string }) => {
      this.handleCommentView(socket, data);
    });

    // 댓글 타이핑 시작
    socket.on("comment:typing_start", (data: { 
      projectId: string; 
      sceneId?: string; 
      imageId?: string;
      parentCommentId?: string;
    }) => {
      this.handleCommentTypingStart(socket, data);
    });

    // 댓글 타이핑 중단
    socket.on("comment:typing_stop", (data: { 
      projectId: string; 
      sceneId?: string; 
      imageId?: string;
      parentCommentId?: string;
    }) => {
      this.handleCommentTypingStop(socket, data);
    });

    // 댓글 멘션 이벤트
    socket.on("comment:mention", (data: {
      commentId: string;
      mentionedUserIds: string[];
      projectId: string;
    }) => {
      this.handleCommentMention(socket, data);
    });
  }

  /**
   * 새 댓글 생성 처리
   */
  private async handleCommentCreate(socket: AuthenticatedSocket, data: CommentEventData): Promise<void> {
    try {
      // 관련된 룸들 결정
      const roomIds = this.getRelevantRoomIds(data);

      // 댓글 생성 이벤트를 관련 룸들에 브로드캐스트
      const commentData = {
        commentId: data.commentId,
        content: data.content,
        parentCommentId: data.parentCommentId,
        author: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
          profileImageUrl: socket.user.profileImageUrl,
        },
        projectId: data.projectId,
        
        imageId: data.imageId,
        timestamp: new Date(),
        isReply: !!data.parentCommentId,
      };

      // 각 룸에 브로드캐스트 (작성자 제외)
      roomIds.forEach(roomId => {
        socket.to(roomId).emit("comment:created", commentData);
      });

      // 협업 로그 기록
      await CollaborationService.logActivity({
        projectId: data.projectId,
        userId: socket.userId,
        action: "create_comment",
        details: data.parentCommentId ? "답글을 작성했습니다." : "댓글을 작성했습니다.",
      });

      // 프로젝트 참여자들에게 알림
      if (!data.parentCommentId) { // 최상위 댓글만 알림
        await this.notifyProjectParticipants(data, socket.userId, "새 댓글");
      }

      // 멘션된 사용자들에게 알림
      if (data.mentions && data.mentions.length > 0) {
        await this.notifyMentionedUsers(data, socket.userId);
      }

      // 작성자에게 성공 응답
      socket.emit("comment:create_success", {
        commentId: data.commentId,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Comment create event error:", error);
      socket.emit("comment:create_error", {
        error: "댓글 생성 중 오류가 발생했습니다.",
        timestamp: new Date(),
      });
    }
  }

  /**
   * 댓글 수정 처리
   */
  private async handleCommentUpdate(socket: AuthenticatedSocket, data: CommentUpdateEventData): Promise<void> {
    try {
      const roomIds = this.getRelevantRoomIds(data);

      const updateData = {
        commentId: data.commentId,
        content: data.content,
        updatedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      // 룸들에 업데이트 브로드캐스트
      roomIds.forEach(roomId => {
        socket.to(roomId).emit("comment:updated", updateData);
      });

      // 협업 로그 기록
      await CollaborationService.logActivity({
        projectId: data.projectId,
        userId: socket.userId,
        action: "update_comment",
        
        
        
        details: "댓글을 수정했습니다.",
      });

      socket.emit("comment:update_success", {
        commentId: data.commentId,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Comment update event error:", error);
      socket.emit("comment:update_error", {
        error: "댓글 수정 중 오류가 발생했습니다.",
        timestamp: new Date(),
      });
    }
  }

  /**
   * 댓글 삭제 처리
   */
  private async handleCommentDelete(socket: AuthenticatedSocket, data: CommentDeleteEventData): Promise<void> {
    try {
      const roomIds = this.getRelevantRoomIds(data);

      const deleteData = {
        commentId: data.commentId,
        isHardDelete: data.isHardDelete,
        deletedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      // 룸들에 삭제 브로드캐스트
      roomIds.forEach(roomId => {
        socket.to(roomId).emit("comment:deleted", deleteData);
      });

      // 협업 로그 기록
      await CollaborationService.logActivity({
        projectId: data.projectId,
        userId: socket.userId,
        action: "delete_comment",
        
        
        
        details: data.isHardDelete ? "댓글을 완전히 삭제했습니다." : "댓글을 삭제했습니다.",
      });

      socket.emit("comment:delete_success", {
        commentId: data.commentId,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Comment delete event error:", error);
      socket.emit("comment:delete_error", {
        error: "댓글 삭제 중 오류가 발생했습니다.",
        timestamp: new Date(),
      });
    }
  }

  /**
   * 댓글 반응 처리
   */
  private async handleCommentReaction(socket: AuthenticatedSocket, data: CommentReactionEventData): Promise<void> {
    try {
      const projectRoomId = `project:${data.projectId}`;

      const reactionData = {
        commentId: data.commentId,
        reaction: data.reaction,
        action: data.action,
        user: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      // 프로젝트 룸에 반응 브로드캐스트
      socket.to(projectRoomId).emit("comment:reaction_changed", reactionData);

      // 협업 로그 기록
      await CollaborationService.logActivity({
        projectId: data.projectId,
        userId: socket.userId,
        action: data.action === "add" ? "add_reaction" : "remove_reaction",
        details: `댓글에 ${data.reaction} 반응을 ${data.action === "add" ? "추가" : "제거"}했습니다.`,
      });

      socket.emit("comment:reaction_success", {
        commentId: data.commentId,
        reaction: data.reaction,
        action: data.action,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Comment reaction event error:", error);
      socket.emit("comment:reaction_error", {
        error: "반응 처리 중 오류가 발생했습니다.",
        timestamp: new Date(),
      });
    }
  }

  /**
   * 댓글 조회 처리
   */
  private async handleCommentView(socket: AuthenticatedSocket, data: { commentId: string; projectId: string }): Promise<void> {
    try {
      // 읽음 상태 업데이트를 위한 이벤트
      // 실제 읽음 처리는 API에서 하고, 여기서는 실시간 알림만
      const projectRoomId = `project:${data.projectId}`;

      socket.to(projectRoomId).emit("comment:viewed", {
        commentId: data.commentId,
        viewedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Comment view event error:", error);
    }
  }

  /**
   * 댓글 타이핑 시작 처리
   */
  private handleCommentTypingStart(socket: AuthenticatedSocket, data: {
    projectId: string;
    sceneId?: string;
    imageId?: string;
    parentCommentId?: string;
  }): void {
    try {
      const roomIds = this.getRelevantRoomIds(data);
      const context = this.getTypingContext(data);

      // 프레젠스 매니저에 타이핑 시작 알림
      roomIds.forEach(roomId => {
        this.presenceManager.startTyping(socket, roomId, context);
      });

    } catch (error) {
      console.error("Comment typing start error:", error);
    }
  }

  /**
   * 댓글 타이핑 중단 처리
   */
  private handleCommentTypingStop(socket: AuthenticatedSocket, data: {
    projectId: string;
    sceneId?: string;
    imageId?: string;
    parentCommentId?: string;
  }): void {
    try {
      const roomIds = this.getRelevantRoomIds(data);
      const context = this.getTypingContext(data);

      // 프레젠스 매니저에 타이핑 중단 알림
      roomIds.forEach(roomId => {
        this.presenceManager.stopTyping(socket, roomId, context);
      });

    } catch (error) {
      console.error("Comment typing stop error:", error);
    }
  }

  /**
   * 댓글 멘션 처리
   */
  private async handleCommentMention(socket: AuthenticatedSocket, data: {
    commentId: string;
    mentionedUserIds: string[];
    projectId: string;
  }): Promise<void> {
    try {
      // 멘션된 사용자들에게 실시간 알림
      for (const mentionedUserId of data.mentionedUserIds) {
        // 해당 사용자가 온라인인지 확인하고 알림 전송
        const userPresence = this.presenceManager.getUserPresence(mentionedUserId);
        if (userPresence && userPresence.status !== "offline") {
          this.io.to(userPresence.connectionId).emit("comment:mentioned", {
            commentId: data.commentId,
            mentionedBy: {
              userId: socket.userId,
              username: socket.user.username,
              nickname: socket.user.nickname,
            },
            projectId: data.projectId,
            timestamp: new Date(),
          });
        }

        // 데이터베이스에 알림 생성
        await NotificationService.createNotification({
          userId: mentionedUserId,
          type: "comment_mention",
          title: "댓글에서 언급",
          message: `${socket.user.nickname || socket.user.username}님이 댓글에서 회원님을 언급했습니다.`,
          projectId: data.projectId,
        });
      }

    } catch (error) {
      console.error("Comment mention event error:", error);
    }
  }

  /**
   * 관련 룸 ID들 조회
   */
  private getRelevantRoomIds(data: { projectId: string; sceneId?: string; imageId?: string }): string[] {
    const roomIds = [`project:${data.projectId}`];
    
    if (data.sceneId) {
      roomIds.push(`scene:${data.sceneId}`);
    }
    
    if (data.imageId) {
      roomIds.push(`image:${data.imageId}`);
    }

    return roomIds;
  }

  /**
   * 타겟 타입 결정
   */
  private getTargetType(data: { imageId?: string; sceneId?: string }): "project" | "scene" | "image" {
    if (data.imageId) return "image";
    if (data.sceneId) return "scene";
    return "project";
  }

  /**
   * 타겟 ID 결정
   */
  private getTargetId(data: { projectId: string; sceneId?: string; imageId?: string }): string {
    return data.imageId || data.sceneId || data.projectId;
  }

  /**
   * 타이핑 컨텍스트 생성
   */
  private getTypingContext(data: {
    sceneId?: string;
    imageId?: string;
    parentCommentId?: string;
  }): string {
    if (data.parentCommentId) {
      return `reply:${data.parentCommentId}`;
    }
    if (data.imageId) {
      return `image:${data.imageId}`;
    }
    if (data.sceneId) {
      return `scene:${data.sceneId}`;
    }
    return "project";
  }

  /**
   * 프로젝트 참여자들에게 알림
   */
  private async notifyProjectParticipants(
    data: CommentEventData,
    authorId: string,
    title: string
  ): Promise<void> {
    try {
      let location = "";
      if (data.imageId) location = "이미지에서";
      else if (data.sceneId) location = "씬에서";
      else location = "프로젝트에서";

      await NotificationService.notifyProjectParticipants(
        data.projectId,
        "comment_created",
        title,
        `${location} 새 댓글이 작성되었습니다.`,
        authorId,
        {
          commentId: data.commentId,
          content: data.content.substring(0, 100),
          location,
        }
      );
    } catch (error) {
      console.error("Failed to notify project participants:", error);
    }
  }

  /**
   * 멘션된 사용자들에게 알림
   */
  private async notifyMentionedUsers(
    data: CommentEventData,
    authorId: string
  ): Promise<void> {
    try {
      if (!data.mentions) return;

      for (const mentionedUserId of data.mentions) {
        await NotificationService.createNotification({
          userId: mentionedUserId,
          type: "comment_mention",
          title: "댓글에서 언급",
          message: `댓글에서 회원님이 언급되었습니다.`,
          projectId: data.projectId,
        });
      }
    } catch (error) {
      console.error("Failed to notify mentioned users:", error);
    }
  }
}

export default CommentEventHandler;