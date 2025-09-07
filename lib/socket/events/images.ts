import { Server as SocketIOServer } from "socket.io";
import { AuthenticatedSocket } from "../auth";
import { NotificationService } from "@/lib/services/notification";
import { CollaborationService } from "@/lib/services/collaboration";
import { ImageHistoryService } from "@/lib/services/imageHistory";
import RoomManager from "../rooms";
import { prisma } from "@/lib/prisma";
import PresenceManager from "../presence";

export interface ImageUploadEventData {
  imageId: string;
  sceneId: string;
  filename: string;
  type: "reference" | "concept" | "final";
  uploadProgress?: number;
  fileSize?: number;
  dimensions?: { width: number; height: number };
  metadata?: Record<string, any>;
}

export interface ImageUploadProgressEventData {
  uploadId: string;
  sceneId: string;
  filename: string;
  progress: number;
  bytesUploaded: number;
  totalBytes: number;
}

export interface ImageUpdateEventData {
  imageId: string;
  sceneId: string;
  changes: {
    description?: string;
    type?: "reference" | "concept" | "final";
    isCurrent?: boolean;
    status?: "active" | "archived" | "deleted";
  };
}

export interface ImageVersionEventData {
  imageId: string;
  newVersionId: string;
  sceneId: string;
  filename: string;
  version: number;
  description?: string;
}

export interface ImageComparisonEventData {
  imageIds: string[];
  sceneId: string;
  comparisonType: "side_by_side" | "overlay" | "diff";
  settings?: Record<string, any>;
}

export class ImageEventHandler {
  private io: SocketIOServer;
  private roomManager: RoomManager;
  private presenceManager: PresenceManager;
  private uploadSessions: Map<string, any> = new Map(); // uploadId -> session data

  constructor(io: SocketIOServer, roomManager: RoomManager, presenceManager: PresenceManager) {
    this.io = io;
    this.roomManager = roomManager;
    this.presenceManager = presenceManager;
  }

  /**
   * 이미지 이벤트 핸들러 등록
   */
  registerEventHandlers(socket: AuthenticatedSocket): void {
    // 이미지 업로드 시작
    socket.on("image:upload_start", (data: { uploadId: string; sceneId: string; filename: string; totalBytes: number }) => {
      this.handleImageUploadStart(socket, data);
    });

    // 이미지 업로드 진행 상황
    socket.on("image:upload_progress", (data: ImageUploadProgressEventData) => {
      this.handleImageUploadProgress(socket, data);
    });

    // 이미지 업로드 완료
    socket.on("image:upload_complete", (data: ImageUploadEventData) => {
      this.handleImageUploadComplete(socket, data);
    });

    // 이미지 업로드 실패/취소
    socket.on("image:upload_error", (data: { uploadId: string; sceneId: string; error: string }) => {
      this.handleImageUploadError(socket, data);
    });

    // 이미지 정보 업데이트
    socket.on("image:update", (data: ImageUpdateEventData) => {
      this.handleImageUpdate(socket, data);
    });

    // 이미지 삭제
    socket.on("image:delete", (data: { imageId: string; sceneId: string; isHardDelete: boolean }) => {
      this.handleImageDelete(socket, data);
    });

    // 이미지 복원
    socket.on("image:restore", (data: { imageId: string; sceneId: string }) => {
      this.handleImageRestore(socket, data);
    });

    // 새 버전 생성
    socket.on("image:new_version", (data: ImageVersionEventData) => {
      this.handleImageNewVersion(socket, data);
    });

    // 이전 버전으로 복원
    socket.on("image:restore_version", (data: { imageId: string; versionId: string; sceneId: string }) => {
      this.handleImageRestoreVersion(socket, data);
    });

    // 이미지 비교 시작
    socket.on("image:start_comparison", (data: ImageComparisonEventData) => {
      this.handleImageStartComparison(socket, data);
    });

    // 이미지 비교 종료
    socket.on("image:end_comparison", (data: { comparisonId: string; sceneId: string }) => {
      this.handleImageEndComparison(socket, data);
    });

    // 이미지 확대/축소
    socket.on("image:zoom", (data: { imageId: string; zoom: number; center?: { x: number; y: number } }) => {
      this.handleImageZoom(socket, data);
    });

    // 이미지 필터 적용
    socket.on("image:filter", (data: { imageId: string; filter: string; settings: any }) => {
      this.handleImageFilter(socket, data);
    });

    // 이미지 선택
    socket.on("image:select", (data: { imageIds: string[]; sceneId: string; action: "select" | "deselect" }) => {
      this.handleImageSelection(socket, data);
    });
  }

  /**
   * 이미지 업로드 시작 처리
   */
  private handleImageUploadStart(socket: AuthenticatedSocket, data: { uploadId: string; sceneId: string; filename: string; totalBytes: number }): void {
    try {
      const sceneRoomId = `scene:${data.sceneId}`;

      // 업로드 세션 생성
      this.uploadSessions.set(data.uploadId, {
        userId: socket.userId,
        sceneId: data.sceneId,
        filename: data.filename,
        totalBytes: data.totalBytes,
        startTime: new Date(),
        lastUpdate: new Date(),
      });

      // 업로드 시작 알림
      socket.to(sceneRoomId).emit("image:upload_started", {
        uploadId: data.uploadId,
        filename: data.filename,
        uploader: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        totalBytes: data.totalBytes,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Image upload start event error:", error);
    }
  }

  /**
   * 이미지 업로드 진행 상황 처리
   */
  private handleImageUploadProgress(socket: AuthenticatedSocket, data: ImageUploadProgressEventData): void {
    try {
      const sceneRoomId = `scene:${data.sceneId}`;
      const session = this.uploadSessions.get(data.uploadId);

      if (session && session.userId === socket.userId) {
        session.lastUpdate = new Date();

        // 진행 상황을 같은 씬의 다른 사용자들에게 브로드캐스트
        socket.to(sceneRoomId).emit("image:upload_progress_update", {
          uploadId: data.uploadId,
          filename: data.filename,
          progress: data.progress,
          bytesUploaded: data.bytesUploaded,
          totalBytes: data.totalBytes,
          timestamp: new Date(),
        });
      }

    } catch (error) {
      console.error("Image upload progress event error:", error);
    }
  }

  /**
   * 이미지 업로드 완료 처리
   */
  private async handleImageUploadComplete(socket: AuthenticatedSocket, data: ImageUploadEventData): Promise<void> {
    try {
      const sceneRoomId = `scene:${data.sceneId}`;
      const projectRoomId = await this.getProjectRoomId(data.sceneId);

      // 업로드 완료 데이터 구성
      const uploadCompleteData = {
        imageId: data.imageId,
        filename: data.filename,
        type: data.type,
        fileSize: data.fileSize,
        dimensions: data.dimensions,
        uploader: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
          profileImageUrl: socket.user.profileImageUrl,
        },
        timestamp: new Date(),
      };

      // 씬 룸에 새 이미지 알림
      socket.to(sceneRoomId).emit("image:uploaded", uploadCompleteData);

      // 프로젝트 룸에도 알림
      if (projectRoomId) {
        socket.to(projectRoomId).emit("image:activity", {
          type: "uploaded",
          imageId: data.imageId,
          sceneId: data.sceneId,
          filename: data.filename,
          uploader: uploadCompleteData.uploader,
          timestamp: new Date(),
        });
      }

      // 업로드 세션 정리
      this.uploadSessions.delete(data.imageId);

      // 협업 로그 기록
      await CollaborationService.logActivity({
        projectId: await this.getProjectId(data.sceneId),
        userId: socket.userId,
        actionType: "upload_image",
        targetType: "scene",
        targetId: data.sceneId,
        sceneId: data.sceneId,
        description: `${data.type} 이미지를 업로드했습니다.`,
        metadata: {
          imageId: data.imageId,
          filename: data.filename,
          type: data.type,
          fileSize: data.fileSize,
          dimensions: data.dimensions,
        },
      });

      // 프로젝트 참여자들에게 알림
      const projectId = await this.getProjectId(data.sceneId);
      if (projectId) {
        await NotificationService.notifyImageUpload(
          data.imageId,
          socket.userId,
          projectId,
          data.sceneId
        );
      }

      socket.emit("image:upload_success", {
        imageId: data.imageId,
        filename: data.filename,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Image upload complete event error:", error);
      socket.emit("image:upload_error", {
        error: "이미지 업로드 완료 처리 중 오류가 발생했습니다.",
        timestamp: new Date(),
      });
    }
  }

  /**
   * 이미지 업로드 에러 처리
   */
  private handleImageUploadError(socket: AuthenticatedSocket, data: { uploadId: string; sceneId: string; error: string }): void {
    try {
      const sceneRoomId = `scene:${data.sceneId}`;

      // 업로드 실패 알림
      socket.to(sceneRoomId).emit("image:upload_failed", {
        uploadId: data.uploadId,
        error: data.error,
        timestamp: new Date(),
      });

      // 업로드 세션 정리
      this.uploadSessions.delete(data.uploadId);

    } catch (error) {
      console.error("Image upload error event error:", error);
    }
  }

  /**
   * 이미지 업데이트 처리
   */
  private async handleImageUpdate(socket: AuthenticatedSocket, data: ImageUpdateEventData): Promise<void> {
    try {
      const sceneRoomId = `scene:${data.sceneId}`;
      const imageRoomId = `image:${data.imageId}`;

      const updateData = {
        imageId: data.imageId,
        changes: data.changes,
        updatedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      // 관련 룸들에 업데이트 브로드캐스트
      socket.to(sceneRoomId).emit("image:updated", updateData);
      socket.to(imageRoomId).emit("image:updated", updateData);

      // 협업 로그 기록
      await CollaborationService.logActivity({
        projectId: await this.getProjectId(data.sceneId),
        userId: socket.userId,
        actionType: "update_image",
        targetType: "image",
        targetId: data.imageId,
        sceneId: data.sceneId,
        description: "이미지 정보를 수정했습니다.",
        metadata: {
          imageId: data.imageId,
          changes: Object.keys(data.changes),
        },
      });

      socket.emit("image:update_success", {
        imageId: data.imageId,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Image update event error:", error);
      socket.emit("image:update_error", {
        error: "이미지 업데이트 중 오류가 발생했습니다.",
        timestamp: new Date(),
      });
    }
  }

  /**
   * 이미지 삭제 처리
   */
  private async handleImageDelete(socket: AuthenticatedSocket, data: { imageId: string; sceneId: string; isHardDelete: boolean }): Promise<void> {
    try {
      const sceneRoomId = `scene:${data.sceneId}`;
      const imageRoomId = `image:${data.imageId}`;

      const deleteData = {
        imageId: data.imageId,
        isHardDelete: data.isHardDelete,
        deletedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      // 관련 룸들에 삭제 브로드캐스트
      socket.to(sceneRoomId).emit("image:deleted", deleteData);
      socket.to(imageRoomId).emit("image:deleted", deleteData);

      // 협업 로그 기록
      const description = data.isHardDelete ? "이미지를 완전히 삭제했습니다." : "이미지를 삭제했습니다.";
      await CollaborationService.logActivity({
        projectId: await this.getProjectId(data.sceneId),
        userId: socket.userId,
        actionType: "delete_image",
        targetType: "image",
        targetId: data.imageId,
        sceneId: data.sceneId,
        description,
        metadata: {
          imageId: data.imageId,
          isHardDelete: data.isHardDelete,
        },
      });

      socket.emit("image:delete_success", {
        imageId: data.imageId,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Image delete event error:", error);
      socket.emit("image:delete_error", {
        error: "이미지 삭제 중 오류가 발생했습니다.",
        timestamp: new Date(),
      });
    }
  }

  /**
   * 이미지 복원 처리
   */
  private async handleImageRestore(socket: AuthenticatedSocket, data: { imageId: string; sceneId: string }): Promise<void> {
    try {
      const sceneRoomId = `scene:${data.sceneId}`;
      const imageRoomId = `image:${data.imageId}`;

      const restoreData = {
        imageId: data.imageId,
        restoredBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      // 관련 룸들에 복원 브로드캐스트
      socket.to(sceneRoomId).emit("image:restored", restoreData);
      socket.to(imageRoomId).emit("image:restored", restoreData);

      // 협업 로그 기록
      await CollaborationService.logActivity({
        projectId: await this.getProjectId(data.sceneId),
        userId: socket.userId,
        actionType: "restore_image",
        targetType: "image",
        targetId: data.imageId,
        sceneId: data.sceneId,
        description: "삭제된 이미지를 복원했습니다.",
        metadata: {
          imageId: data.imageId,
        },
      });

      socket.emit("image:restore_success", {
        imageId: data.imageId,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Image restore event error:", error);
      socket.emit("image:restore_error", {
        error: "이미지 복원 중 오류가 발생했습니다.",
        timestamp: new Date(),
      });
    }
  }

  /**
   * 새 이미지 버전 생성 처리
   */
  private async handleImageNewVersion(socket: AuthenticatedSocket, data: ImageVersionEventData): Promise<void> {
    try {
      const sceneRoomId = `scene:${data.sceneId}`;
      const imageRoomId = `image:${data.imageId}`;

      const versionData = {
        imageId: data.imageId,
        newVersionId: data.newVersionId,
        version: data.version,
        filename: data.filename,
        description: data.description,
        createdBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      // 관련 룸들에 새 버전 브로드캐스트
      socket.to(sceneRoomId).emit("image:new_version", versionData);
      socket.to(imageRoomId).emit("image:new_version", versionData);

      // 협업 로그 기록
      await CollaborationService.logActivity({
        projectId: await this.getProjectId(data.sceneId),
        userId: socket.userId,
        actionType: "replace_image",
        targetType: "image",
        targetId: data.imageId,
        sceneId: data.sceneId,
        description: `이미지를 새 버전으로 교체했습니다 (v${data.version}).`,
        metadata: {
          imageId: data.imageId,
          newVersionId: data.newVersionId,
          version: data.version,
          filename: data.filename,
        },
      });

      socket.emit("image:new_version_success", {
        imageId: data.imageId,
        version: data.version,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Image new version event error:", error);
      socket.emit("image:new_version_error", {
        error: "새 버전 생성 중 오류가 발생했습니다.",
        timestamp: new Date(),
      });
    }
  }

  /**
   * 이미지 버전 복원 처리
   */
  private async handleImageRestoreVersion(socket: AuthenticatedSocket, data: { imageId: string; versionId: string; sceneId: string }): Promise<void> {
    try {
      const sceneRoomId = `scene:${data.sceneId}`;
      const imageRoomId = `image:${data.imageId}`;

      const restoreVersionData = {
        imageId: data.imageId,
        versionId: data.versionId,
        restoredBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      // 관련 룸들에 버전 복원 브로드캐스트
      socket.to(sceneRoomId).emit("image:version_restored", restoreVersionData);
      socket.to(imageRoomId).emit("image:version_restored", restoreVersionData);

      // 협업 로그 기록
      await CollaborationService.logActivity({
        projectId: await this.getProjectId(data.sceneId),
        userId: socket.userId,
        actionType: "restore_image",
        targetType: "image",
        targetId: data.imageId,
        sceneId: data.sceneId,
        description: "이미지를 이전 버전으로 복원했습니다.",
        metadata: {
          imageId: data.imageId,
          versionId: data.versionId,
        },
      });

      socket.emit("image:restore_version_success", {
        imageId: data.imageId,
        versionId: data.versionId,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Image restore version event error:", error);
      socket.emit("image:restore_version_error", {
        error: "버전 복원 중 오류가 발생했습니다.",
        timestamp: new Date(),
      });
    }
  }

  /**
   * 이미지 비교 시작 처리
   */
  private async handleImageStartComparison(socket: AuthenticatedSocket, data: ImageComparisonEventData): Promise<void> {
    try {
      const sceneRoomId = `scene:${data.sceneId}`;
      const comparisonId = `comparison_${Date.now()}_${socket.userId}`;

      const comparisonData = {
        comparisonId,
        imageIds: data.imageIds,
        comparisonType: data.comparisonType,
        settings: data.settings,
        startedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      // 같은 씬의 다른 사용자들에게 비교 시작 알림
      socket.to(sceneRoomId).emit("image:comparison_started", comparisonData);

      socket.emit("image:comparison_start_success", {
        comparisonId,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Image comparison start event error:", error);
      socket.emit("image:comparison_start_error", {
        error: "이미지 비교 시작 중 오류가 발생했습니다.",
        timestamp: new Date(),
      });
    }
  }

  /**
   * 이미지 비교 종료 처리
   */
  private handleImageEndComparison(socket: AuthenticatedSocket, data: { comparisonId: string; sceneId: string }): void {
    try {
      const sceneRoomId = `scene:${data.sceneId}`;

      const comparisonEndData = {
        comparisonId: data.comparisonId,
        endedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      socket.to(sceneRoomId).emit("image:comparison_ended", comparisonEndData);

    } catch (error) {
      console.error("Image comparison end event error:", error);
    }
  }

  /**
   * 이미지 확대/축소 처리
   */
  private handleImageZoom(socket: AuthenticatedSocket, data: { imageId: string; zoom: number; center?: { x: number; y: number } }): void {
    try {
      const imageRoomId = `image:${data.imageId}`;

      const zoomData = {
        imageId: data.imageId,
        zoom: data.zoom,
        center: data.center,
        zoomedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      socket.to(imageRoomId).emit("image:zoom_changed", zoomData);

      // 프레젠스 매니저에 뷰포트 업데이트
      if (data.center) {
        this.presenceManager.updateViewportPosition(
          socket,
          imageRoomId,
          { x: data.center.x, y: data.center.y, zoom: data.zoom }
        );
      }

    } catch (error) {
      console.error("Image zoom event error:", error);
    }
  }

  /**
   * 이미지 필터 적용 처리
   */
  private async handleImageFilter(socket: AuthenticatedSocket, data: { imageId: string; filter: string; settings: any }): Promise<void> {
    try {
      const imageRoomId = `image:${data.imageId}`;

      const filterData = {
        imageId: data.imageId,
        filter: data.filter,
        settings: data.settings,
        appliedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      socket.to(imageRoomId).emit("image:filter_applied", filterData);

    } catch (error) {
      console.error("Image filter event error:", error);
    }
  }

  /**
   * 이미지 선택 처리
   */
  private handleImageSelection(socket: AuthenticatedSocket, data: { imageIds: string[]; sceneId: string; action: "select" | "deselect" }): void {
    try {
      const sceneRoomId = `scene:${data.sceneId}`;

      const selectionData = {
        imageIds: data.imageIds,
        action: data.action,
        selectedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      socket.to(sceneRoomId).emit("image:selection_changed", selectionData);

    } catch (error) {
      console.error("Image selection event error:", error);
    }
  }

  /**
   * 씬으로부터 프로젝트 룸 ID 조회
   */
  private async getProjectRoomId(sceneId: string): Promise<string | null> {
    try {
      const projectId = await this.getProjectId(sceneId);
      return projectId ? `project:${projectId}` : null;
    } catch (error) {
      console.error("Error getting project room ID:", error);
      return null;
    }
  }

  /**
   * 씬으로부터 프로젝트 ID 조회
   */
  private async getProjectId(sceneId: string): Promise<string> {
    try {
      const scene = await prisma.scene.findUnique({
        where: { id: sceneId },
        select: { projectId: true },
      });
      return scene?.projectId || "";
    } catch (error) {
      console.error("Error getting project ID:", error);
      return "";
    }
  }

  /**
   * 업로드 세션 정리
   */
  cleanupUploadSessions(): void {
    const now = new Date();
    const maxSessionTime = 60 * 60 * 1000; // 1시간

    this.uploadSessions.forEach((session, uploadId) => {
      if (now.getTime() - session.startTime.getTime() > maxSessionTime) {
        this.uploadSessions.delete(uploadId);
        
        // 세션 타임아웃 알림
        const sceneRoomId = `scene:${session.sceneId}`;
        this.io.to(sceneRoomId).emit("image:upload_timeout", {
          uploadId,
          filename: session.filename,
          timestamp: new Date(),
        });
      }
    });
  }

  /**
   * 메모리 사용량 조회
   */
  getMemoryUsage(): {
    uploadSessions: number;
  } {
    return {
      uploadSessions: this.uploadSessions.size,
    };
  }
}

export default ImageEventHandler;