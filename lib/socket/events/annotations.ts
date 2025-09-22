import { Server as SocketIOServer } from "socket.io";
import { AuthenticatedSocket } from "../auth";
import { NotificationService } from "@/lib/services/notification";
import { CollaborationService } from "@/lib/services/collaboration";
import RoomManager from "../rooms";
import PresenceManager from "../presence";
import { prisma } from "@/lib/prisma";

export interface AnnotationEventData {
  annotationId: string;
  imageId: string;
  type: "point" | "rectangle" | "circle" | "arrow" | "text" | "freehand";
  position: { x: number; y: number };
  dimensions?: {
    width?: number;
    height?: number;
    radius?: number;
  };
  style?: {
    color?: string;
    strokeWidth?: number;
    opacity?: number;
    fill?: boolean;
  };
  content?: string;
  metadata?: Record<string, any>;
}

export interface AnnotationUpdateEventData {
  annotationId: string;
  imageId: string;
  changes: {
    position?: { x: number; y: number };
    dimensions?: any;
    style?: any;
    content?: string;
    isResolved?: boolean;
  };
}

export interface DrawingEventData {
  imageId: string;
  sessionId: string;
  drawingData: {
    type: "start" | "move" | "end" | "cancel";
    points?: Array<{ x: number; y: number; pressure?: number }>;
    style?: {
      color: string;
      strokeWidth: number;
      opacity: number;
    };
  };
  isComplete: boolean;
}

export interface AnnotationSelectionEventData {
  imageId: string;
  annotationIds: string[];
  action: "select" | "deselect" | "multi_select";
}

export class AnnotationEventHandler {
  private io: SocketIOServer;
  private roomManager: RoomManager;
  private presenceManager: PresenceManager;
  private drawingSessions: Map<string, Map<string, any>> = new Map(); // imageId -> sessionId -> drawingData

  constructor(io: SocketIOServer, roomManager: RoomManager, presenceManager: PresenceManager) {
    this.io = io;
    this.roomManager = roomManager;
    this.presenceManager = presenceManager;
  }

  /**
   * 주석 이벤트 핸들러 등록
   */
  registerEventHandlers(socket: AuthenticatedSocket): void {
    // 주석 생성 이벤트
    socket.on("annotation:create", (data: AnnotationEventData) => {
      this.handleAnnotationCreate(socket, data);
    });

    // 주석 업데이트 이벤트
    socket.on("annotation:update", (data: AnnotationUpdateEventData) => {
      this.handleAnnotationUpdate(socket, data);
    });

    // 주석 삭제 이벤트
    socket.on("annotation:delete", (data: { annotationId: string; imageId: string }) => {
      this.handleAnnotationDelete(socket, data);
    });

    // 주석 해결/재열기 이벤트
    socket.on("annotation:resolve", (data: { annotationId: string; imageId: string; isResolved: boolean }) => {
      this.handleAnnotationResolve(socket, data);
    });

    // 실시간 드로잉 이벤트
    socket.on("drawing:data", (data: DrawingEventData) => {
      this.handleDrawingData(socket, data);
    });

    // 드로잉 세션 종료
    socket.on("drawing:end_session", (data: { imageId: string; sessionId: string; saveAsAnnotation: boolean }) => {
      this.handleDrawingEndSession(socket, data);
    });

    // 주석 선택 이벤트
    socket.on("annotation:select", (data: AnnotationSelectionEventData) => {
      this.handleAnnotationSelection(socket, data);
    });

    // 주석 하이라이트 이벤트
    socket.on("annotation:highlight", (data: { annotationId: string; imageId: string; isHighlighted: boolean }) => {
      this.handleAnnotationHighlight(socket, data);
    });

    // 주석 잠금 이벤트 (편집 중 다른 사용자의 수정 방지)
    socket.on("annotation:lock", (data: { annotationId: string; imageId: string; action: "lock" | "unlock" }) => {
      this.handleAnnotationLock(socket, data);
    });

    // 주석 그룹화 이벤트
    socket.on("annotation:group", (data: { annotationIds: string[]; imageId: string; action: "group" | "ungroup" }) => {
      this.handleAnnotationGroup(socket, data);
    });

    // 주석 가시성 토글
    socket.on("annotation:visibility", (data: { annotationId: string; imageId: string; isVisible: boolean }) => {
      this.handleAnnotationVisibility(socket, data);
    });
  }

  /**
   * 새 주석 생성 처리
   */
  private async handleAnnotationCreate(socket: AuthenticatedSocket, data: AnnotationEventData): Promise<void> {
    try {
      const imageRoomId = `image:${data.imageId}`;

      // 새 주석 데이터 구성
      const annotationData = {
        annotationId: data.annotationId,
        type: data.type,
        position: data.position,
        dimensions: data.dimensions,
        style: data.style,
        content: data.content,
        metadata: data.metadata,
        creator: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
          profileImageUrl: socket.user.profileImageUrl,
        },
        timestamp: new Date(),
      };

      // 같은 이미지를 보고 있는 다른 사용자들에게 브로드캐스트
      socket.to(imageRoomId).emit("annotation:created", annotationData);

      // 관련 씬과 프로젝트 룸에도 알림
      const sceneRoomId = await this.getSceneRoomId(data.imageId);
      const projectRoomId = await this.getProjectRoomId(data.imageId);

      if (sceneRoomId) {
        socket.to(sceneRoomId).emit("annotation:activity", {
          type: "created",
          annotationId: data.annotationId,
          imageId: data.imageId,
          creator: annotationData.creator,
          timestamp: new Date(),
        });
      }

      if (projectRoomId) {
        socket.to(projectRoomId).emit("annotation:activity", {
          type: "created",
          annotationId: data.annotationId,
          imageId: data.imageId,
          creator: annotationData.creator,
          timestamp: new Date(),
        });
      }

      // 협업 로그 기록
      const sceneId = await this.getSceneId(data.imageId);
      await CollaborationService.logActivity({
        projectId: await this.getProjectId(data.imageId),
        userId: socket.userId,
        action: "create_annotation",
        details: `${data.type} 주석을 생성했습니다.`,
      });

      // 성공 응답
      socket.emit("annotation:create_success", {
        annotationId: data.annotationId,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Annotation create event error:", error);
      socket.emit("annotation:create_error", {
        error: "주석 생성 중 오류가 발생했습니다.",
        timestamp: new Date(),
      });
    }
  }

  /**
   * 주석 업데이트 처리
   */
  private async handleAnnotationUpdate(socket: AuthenticatedSocket, data: AnnotationUpdateEventData): Promise<void> {
    try {
      const imageRoomId = `image:${data.imageId}`;

      const updateData = {
        annotationId: data.annotationId,
        changes: data.changes,
        updatedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      // 같은 이미지를 보고 있는 다른 사용자들에게 브로드캐스트
      socket.to(imageRoomId).emit("annotation:updated", updateData);

      // 협업 로그 기록
      const sceneId2 = await this.getSceneId(data.imageId);
      await CollaborationService.logActivity({
        projectId: await this.getProjectId(data.imageId),
        userId: socket.userId,
        action: "update_annotation",
        details: "주석을 수정했습니다.",
      });

      socket.emit("annotation:update_success", {
        annotationId: data.annotationId,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Annotation update event error:", error);
      socket.emit("annotation:update_error", {
        error: "주석 수정 중 오류가 발생했습니다.",
        timestamp: new Date(),
      });
    }
  }

  /**
   * 주석 삭제 처리
   */
  private async handleAnnotationDelete(socket: AuthenticatedSocket, data: { annotationId: string; imageId: string }): Promise<void> {
    try {
      const imageRoomId = `image:${data.imageId}`;

      const deleteData = {
        annotationId: data.annotationId,
        deletedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      // 같은 이미지를 보고 있는 다른 사용자들에게 브로드캐스트
      socket.to(imageRoomId).emit("annotation:deleted", deleteData);

      // 협업 로그 기록
      const sceneId3 = await this.getSceneId(data.imageId);
      await CollaborationService.logActivity({
        projectId: await this.getProjectId(data.imageId),
        userId: socket.userId,
        action: "delete_annotation",
        details: "주석을 삭제했습니다.",
      });

      socket.emit("annotation:delete_success", {
        annotationId: data.annotationId,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Annotation delete event error:", error);
      socket.emit("annotation:delete_error", {
        error: "주석 삭제 중 오류가 발생했습니다.",
        timestamp: new Date(),
      });
    }
  }

  /**
   * 주석 해결/재열기 처리
   */
  private async handleAnnotationResolve(socket: AuthenticatedSocket, data: { annotationId: string; imageId: string; isResolved: boolean }): Promise<void> {
    try {
      const imageRoomId = `image:${data.imageId}`;

      const resolveData = {
        annotationId: data.annotationId,
        isResolved: data.isResolved,
        resolvedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      // 같은 이미지를 보고 있는 다른 사용자들에게 브로드캐스트
      socket.to(imageRoomId).emit("annotation:resolved", resolveData);

      // 협업 로그 기록
      const actionType = data.isResolved ? "resolve_annotation" : "reopen_annotation";
      const description = data.isResolved ? "주석을 해결로 표시했습니다." : "주석을 다시 열었습니다.";

      const sceneId4 = await this.getSceneId(data.imageId);
      await CollaborationService.logActivity({
        projectId: await this.getProjectId(data.imageId),
        userId: socket.userId,
        action: actionType as any,
        details: description,
      });

      socket.emit("annotation:resolve_success", {
        annotationId: data.annotationId,
        isResolved: data.isResolved,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Annotation resolve event error:", error);
      socket.emit("annotation:resolve_error", {
        error: "주석 해결 상태 변경 중 오류가 발생했습니다.",
        timestamp: new Date(),
      });
    }
  }

  /**
   * 실시간 드로잉 데이터 처리
   */
  private handleDrawingData(socket: AuthenticatedSocket, data: DrawingEventData): void {
    try {
      const imageRoomId = `image:${data.imageId}`;

      // 드로잉 세션 관리
      if (!this.drawingSessions.has(data.imageId)) {
        this.drawingSessions.set(data.imageId, new Map());
      }

      const imageSessions = this.drawingSessions.get(data.imageId)!;

      // 드로잉 데이터 업데이트
      if (data.drawingData.type === "start") {
        imageSessions.set(data.sessionId, {
          userId: socket.userId,
          startTime: new Date(),
          points: data.drawingData.points || [],
          style: data.drawingData.style,
        });
      } else if (data.drawingData.type === "move" && imageSessions.has(data.sessionId)) {
        const session = imageSessions.get(data.sessionId);
        if (session.userId === socket.userId) {
          session.points.push(...(data.drawingData.points || []));
        }
      } else if (data.drawingData.type === "end" || data.drawingData.type === "cancel") {
        imageSessions.delete(data.sessionId);
      }

      // 실시간 드로잉 데이터를 다른 사용자들에게 브로드캐스트
      const drawingUpdate = {
        sessionId: data.sessionId,
        userId: socket.userId,
        username: socket.user.username,
        nickname: socket.user.nickname,
        drawingData: data.drawingData,
        isComplete: data.isComplete,
        timestamp: new Date(),
      };

      socket.to(imageRoomId).emit("drawing:update", drawingUpdate);

    } catch (error) {
      console.error("Drawing data event error:", error);
    }
  }

  /**
   * 드로잉 세션 종료 처리
   */
  private async handleDrawingEndSession(socket: AuthenticatedSocket, data: { imageId: string; sessionId: string; saveAsAnnotation: boolean }): Promise<void> {
    try {
      const imageRoomId = `image:${data.imageId}`;

      // 드로잉 세션 정리
      if (this.drawingSessions.has(data.imageId)) {
        this.drawingSessions.get(data.imageId)!.delete(data.sessionId);
      }

      // 드로잉 종료 알림
      socket.to(imageRoomId).emit("drawing:session_ended", {
        sessionId: data.sessionId,
        userId: socket.userId,
        saveAsAnnotation: data.saveAsAnnotation,
        timestamp: new Date(),
      });

      if (data.saveAsAnnotation) {
        // 협업 로그 기록
        const sceneId5 = await this.getSceneId(data.imageId);
        await CollaborationService.logActivity({
          projectId: await this.getProjectId(data.imageId),
          userId: socket.userId,
          action: "create_annotation",
          details: "자유 그리기 주석을 생성했습니다.",
        });
      }

    } catch (error) {
      console.error("Drawing end session event error:", error);
    }
  }

  /**
   * 주석 선택 처리
   */
  private handleAnnotationSelection(socket: AuthenticatedSocket, data: AnnotationSelectionEventData): void {
    try {
      const imageRoomId = `image:${data.imageId}`;

      const selectionData = {
        userId: socket.userId,
        username: socket.user.username,
        nickname: socket.user.nickname,
        annotationIds: data.annotationIds,
        action: data.action,
        timestamp: new Date(),
      };

      // 같은 이미지를 보고 있는 다른 사용자들에게 선택 상태 브로드캐스트
      socket.to(imageRoomId).emit("annotation:selection_changed", selectionData);

    } catch (error) {
      console.error("Annotation selection event error:", error);
    }
  }

  /**
   * 주석 하이라이트 처리
   */
  private handleAnnotationHighlight(socket: AuthenticatedSocket, data: { annotationId: string; imageId: string; isHighlighted: boolean }): void {
    try {
      const imageRoomId = `image:${data.imageId}`;

      const highlightData = {
        annotationId: data.annotationId,
        isHighlighted: data.isHighlighted,
        highlightedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      socket.to(imageRoomId).emit("annotation:highlighted", highlightData);

    } catch (error) {
      console.error("Annotation highlight event error:", error);
    }
  }

  /**
   * 주석 잠금 처리
   */
  private handleAnnotationLock(socket: AuthenticatedSocket, data: { annotationId: string; imageId: string; action: "lock" | "unlock" }): void {
    try {
      const imageRoomId = `image:${data.imageId}`;

      const lockData = {
        annotationId: data.annotationId,
        action: data.action,
        lockedBy: data.action === "lock" ? {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        } : null,
        timestamp: new Date(),
      };

      socket.to(imageRoomId).emit("annotation:lock_changed", lockData);

    } catch (error) {
      console.error("Annotation lock event error:", error);
    }
  }

  /**
   * 주석 그룹화 처리
   */
  private async handleAnnotationGroup(socket: AuthenticatedSocket, data: { annotationIds: string[]; imageId: string; action: "group" | "ungroup" }): Promise<void> {
    try {
      const imageRoomId = `image:${data.imageId}`;

      const groupData = {
        annotationIds: data.annotationIds,
        action: data.action,
        groupedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      socket.to(imageRoomId).emit("annotation:group_changed", groupData);

      // 협업 로그 기록
      const sceneId6 = await this.getSceneId(data.imageId);
      await CollaborationService.logActivity({
        projectId: await this.getProjectId(data.imageId),
        userId: socket.userId,
        action: data.action === "group" ? "group_annotations" : "ungroup_annotations",
        details: `주석을 ${data.action === "group" ? "그룹화" : "그룹 해제"}했습니다.`,
      });

    } catch (error) {
      console.error("Annotation group event error:", error);
    }
  }

  /**
   * 주석 가시성 토글 처리
   */
  private handleAnnotationVisibility(socket: AuthenticatedSocket, data: { annotationId: string; imageId: string; isVisible: boolean }): void {
    try {
      const imageRoomId = `image:${data.imageId}`;

      const visibilityData = {
        annotationId: data.annotationId,
        isVisible: data.isVisible,
        changedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      socket.to(imageRoomId).emit("annotation:visibility_changed", visibilityData);

    } catch (error) {
      console.error("Annotation visibility event error:", error);
    }
  }

  /**
   * 이미지로부터 씬 룸 ID 조회
   */
  private async getSceneRoomId(imageId: string): Promise<string | null> {
    try {
      const sceneId = await this.getSceneId(imageId);
      return sceneId ? `scene:${sceneId}` : null;
    } catch (error) {
      console.error("Error getting scene room ID:", error);
      return null;
    }
  }

  /**
   * 이미지로부터 프로젝트 룸 ID 조회
   */
  private async getProjectRoomId(imageId: string): Promise<string | null> {
    try {
      const projectId = await this.getProjectId(imageId);
      return projectId ? `project:${projectId}` : null;
    } catch (error) {
      console.error("Error getting project room ID:", error);
      return null;
    }
  }

  /**
   * 이미지로부터 씬 ID 조회
   */
  private async getSceneId(imageId: string): Promise<string | null> {
    try {
      const image = await prisma.image.findUnique({
        where: { id: imageId },
        select: { sceneId: true },
      });
      return image?.sceneId || null;
    } catch (error) {
      console.error("Error getting scene ID:", error);
      return null;
    }
  }

  /**
   * 이미지로부터 프로젝트 ID 조회
   */
  private async getProjectId(imageId: string): Promise<string> {
    try {
      const image = await prisma.image.findUnique({
        where: { id: imageId },
        select: { 
          scene: {
            select: { projectId: true },
          },
        },
      });
      return image?.scene?.projectId || "";
    } catch (error) {
      console.error("Error getting project ID:", error);
      return "";
    }
  }

  /**
   * 활성 드로잉 세션 정리
   */
  cleanupDrawingSessions(): void {
    const now = new Date();
    const maxSessionTime = 30 * 60 * 1000; // 30분

    this.drawingSessions.forEach((sessions, imageId) => {
      const sessionsToDelete: string[] = [];

      sessions.forEach((session, sessionId) => {
        if (now.getTime() - session.startTime.getTime() > maxSessionTime) {
          sessionsToDelete.push(sessionId);
        }
      });

      sessionsToDelete.forEach(sessionId => {
        sessions.delete(sessionId);
        
        // 세션 타임아웃 알림
        this.io.to(`image:${imageId}`).emit("drawing:session_timeout", {
          sessionId,
          timestamp: new Date(),
        });
      });

      if (sessions.size === 0) {
        this.drawingSessions.delete(imageId);
      }
    });
  }
}

export default AnnotationEventHandler;