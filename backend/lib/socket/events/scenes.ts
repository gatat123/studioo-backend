import { Server as SocketIOServer } from "socket.io";
import { AuthenticatedSocket } from "../auth";
import { NotificationService } from "@/lib/services/notification";
import { CollaborationService } from "@/lib/services/collaboration";
import RoomManager from "../rooms";
import PresenceManager from "../presence";
import { prisma } from "@/lib/prisma";

export interface SceneEventData {
  sceneId: string;
  projectId: string;
  sceneNumber: number;
  description?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface SceneUpdateEventData {
  sceneId: string;
  projectId: string;
  changes: {
    description?: string;
    notes?: string;
    status?: "active" | "archived" | "draft";
    metadata?: Record<string, any>;
  };
}

export interface SceneOrderEventData {
  projectId: string;
  sceneOrders: Array<{
    sceneId: string;
    newSceneNumber: number;
  }>;
}

export interface SceneCopyEventData {
  sourceSceneId: string;
  targetProjectId: string;
  newSceneNumber: number;
  copyImages: boolean;
  copyAnnotations: boolean;
}

export class SceneEventHandler {
  private io: SocketIOServer;
  private roomManager: RoomManager;
  private presenceManager: PresenceManager;

  constructor(io: SocketIOServer, roomManager: RoomManager, presenceManager: PresenceManager) {
    this.io = io;
    this.roomManager = roomManager;
    this.presenceManager = presenceManager;
  }

  /**
   * 씬 이벤트 핸들러 등록
   */
  registerEventHandlers(socket: AuthenticatedSocket): void {
    // 씬 생성 이벤트
    socket.on("scene:create", (data: SceneEventData) => {
      this.handleSceneCreate(socket, data);
    });

    // 씬 업데이트 이벤트
    socket.on("scene:update", (data: SceneUpdateEventData) => {
      this.handleSceneUpdate(socket, data);
    });

    // 씬 삭제 이벤트
    socket.on("scene:delete", (data: { sceneId: string; projectId: string }) => {
      this.handleSceneDelete(socket, data);
    });

    // 씬 순서 변경 이벤트
    socket.on("scene:reorder", (data: SceneOrderEventData) => {
      this.handleSceneReorder(socket, data);
    });

    // 씨 복사 이벤트
    socket.on("scene:copy", (data: SceneCopyEventData) => {
      this.handleSceneCopy(socket, data);
    });

    // 씬 상태 변경 이벤트
    socket.on("scene:status_change", (data: { sceneId: string; projectId: string; status: "active" | "archived" | "draft" }) => {
      this.handleSceneStatusChange(socket, data);
    });

    // 씬 선택 이벤트
    socket.on("scene:select", (data: { sceneIds: string[]; projectId: string; action: "select" | "deselect" }) => {
      this.handleSceneSelection(socket, data);
    });

    // 씬 잠금 이벤트 (편집 중 다른 사용자의 수정 방지)
    socket.on("scene:lock", (data: { sceneId: string; projectId: string; action: "lock" | "unlock" }) => {
      this.handleSceneLock(socket, data);
    });

    // 씬 템플릿 저장 이벤트
    socket.on("scene:save_as_template", (data: { sceneId: string; templateName: string; description?: string }) => {
      this.handleSceneSaveAsTemplate(socket, data);
    });

    // 씬 뷰 모드 변경 이벤트
    socket.on("scene:view_mode", (data: { sceneId: string; viewMode: "grid" | "list" | "timeline" }) => {
      this.handleSceneViewMode(socket, data);
    });
  }

  /**
   * 새 씬 생성 처리
   */
  private async handleSceneCreate(socket: AuthenticatedSocket, data: SceneEventData): Promise<void> {
    try {
      const projectRoomId = `project:${data.projectId}`;

      // 새 씬 데이터 구성
      const sceneData = {
        sceneId: data.sceneId,
        sceneNumber: data.sceneNumber,
        description: data.description,
        notes: data.notes,
        metadata: data.metadata,
        creator: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
          profileImageUrl: socket.user.profileImageUrl,
        },
        timestamp: new Date(),
      };

      // 프로젝트 룸에 새 씬 생성 브로드캐스트
      socket.to(projectRoomId).emit("scene:created", sceneData);

      // 협업 로그 기록
      await CollaborationService.logActivity({
        projectId: data.projectId,
        userId: socket.userId,
        actionType: "create_scene",
        targetType: "scene",
        targetId: data.sceneId,
        sceneId: data.sceneId,
        description: `씬 ${data.sceneNumber}를 생성했습니다.`,
        metadata: {
          sceneId: data.sceneId,
          sceneNumber: data.sceneNumber,
          description: data.description,
        },
      });

      // 씬 업데이트 알림 - 프로젝트 참여자들에게 알림
      await NotificationService.notifyProjectParticipants(
        data.projectId,
        "scene_created",
        "새로운 씬이 생성되었습니다",
        `${socket.user.nickname || socket.user.username}님이 씬 ${data.sceneNumber}을 생성했습니다.`,
        socket.userId,
        {
          sceneId: data.sceneId,
          sceneNumber: data.sceneNumber
        }
      );

      socket.emit("scene:create_success", {
        sceneId: data.sceneId,
        sceneNumber: data.sceneNumber,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Scene create event error:", error);
      socket.emit("scene:create_error", {
        error: "씬 생성 중 오류가 발생했습니다.",
        timestamp: new Date(),
      });
    }
  }

  /**
   * 씬 업데이트 처리
   */
  private async handleSceneUpdate(socket: AuthenticatedSocket, data: SceneUpdateEventData): Promise<void> {
    try {
      const projectRoomId = `project:${data.projectId}`;
      const sceneRoomId = `scene:${data.sceneId}`;

      const updateData = {
        sceneId: data.sceneId,
        changes: data.changes,
        updatedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      // 관련 룸들에 업데이트 브로드캐스트
      socket.to(projectRoomId).emit("scene:updated", updateData);
      socket.to(sceneRoomId).emit("scene:updated", updateData);

      // 협업 로그 기록
      await CollaborationService.logActivity({
        projectId: data.projectId,
        userId: socket.userId,
        actionType: "update_scene",
        targetType: "scene",
        targetId: data.sceneId,
        sceneId: data.sceneId,
        description: "씬 정보를 수정했습니다.",
        metadata: {
          sceneId: data.sceneId,
          changes: Object.keys(data.changes),
        },
      });

      // 씬 업데이트 알림 - 프로젝트 참여자들에게 알림
      await NotificationService.notifyProjectParticipants(
        data.projectId,
        "scene_updated",
        "씬이 업데이트되었습니다",
        `${socket.user.nickname || socket.user.username}님이 씬을 업데이트했습니다.`,
        socket.userId,
        {
          sceneId: data.sceneId,
          changes: data.changes
        }
      );

      socket.emit("scene:update_success", {
        sceneId: data.sceneId,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Scene update event error:", error);
      socket.emit("scene:update_error", {
        error: "씬 수정 중 오류가 발생했습니다.",
        timestamp: new Date(),
      });
    }
  }

  /**
   * 씬 삭제 처리
   */
  private async handleSceneDelete(socket: AuthenticatedSocket, data: { sceneId: string; projectId: string }): Promise<void> {
    try {
      const projectRoomId = `project:${data.projectId}`;
      const sceneRoomId = `scene:${data.sceneId}`;

      const deleteData = {
        sceneId: data.sceneId,
        deletedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      // 관련 룸들에 삭제 브로드캐스트
      socket.to(projectRoomId).emit("scene:deleted", deleteData);
      socket.to(sceneRoomId).emit("scene:deleted", deleteData);

      // 씬 룸에 있는 모든 사용자들을 프로젝트 룸으로 이동
      const sceneRoom = this.roomManager.getRoomInfo(sceneRoomId);
      if (sceneRoom) {
        sceneRoom.participants.forEach((participant, userId) => {
          const userSocket = this.io.sockets.sockets.get(participant.userId);
          if (userSocket) {
            userSocket.emit("scene:force_leave", {
              sceneId: data.sceneId,
              reason: "Scene deleted",
              redirectTo: projectRoomId,
              timestamp: new Date(),
            });
          }
        });
      }

      // 협업 로그 기록
      await CollaborationService.logActivity({
        projectId: data.projectId,
        userId: socket.userId,
        actionType: "delete_scene",
        targetType: "scene",
        targetId: data.sceneId,
        sceneId: data.sceneId,
        description: "씬을 삭제했습니다.",
        metadata: {
          sceneId: data.sceneId,
        },
      });

      // 씬 업데이트 알림
      await NotificationService.notifyProjectParticipants(
        data.projectId,
        "scene_deleted",
        "씬이 삭제되었습니다",
        `${socket.user.nickname || socket.user.username}님이 씬을 삭제했습니다.`,
        socket.userId,
        {
          sceneId: data.sceneId
        }
      );

      socket.emit("scene:delete_success", {
        sceneId: data.sceneId,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Scene delete event error:", error);
      socket.emit("scene:delete_error", {
        error: "씬 삭제 중 오류가 발생했습니다.",
        timestamp: new Date(),
      });
    }
  }

  /**
   * 씬 순서 변경 처리
   */
  private async handleSceneReorder(socket: AuthenticatedSocket, data: SceneOrderEventData): Promise<void> {
    try {
      const projectRoomId = `project:${data.projectId}`;

      const reorderData = {
        projectId: data.projectId,
        sceneOrders: data.sceneOrders,
        reorderedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      // 프로젝트 룸에 순서 변경 브로드캐스트
      socket.to(projectRoomId).emit("scene:reordered", reorderData);

      // 협업 로그 기록
      await CollaborationService.logActivity({
        projectId: data.projectId,
        userId: socket.userId,
        actionType: "reorder_scenes",
        targetType: "project",
        targetId: data.projectId,
        description: `${data.sceneOrders.length}개 씬의 순서를 변경했습니다.`,
        metadata: {
          sceneOrders: data.sceneOrders,
        },
      });

      socket.emit("scene:reorder_success", {
        projectId: data.projectId,
        changedCount: data.sceneOrders.length,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Scene reorder event error:", error);
      socket.emit("scene:reorder_error", {
        error: "씬 순서 변경 중 오류가 발생했습니다.",
        timestamp: new Date(),
      });
    }
  }

  /**
   * 씬 복사 처리
   */
  private async handleSceneCopy(socket: AuthenticatedSocket, data: SceneCopyEventData): Promise<void> {
    try {
      const sourceProjectRoomId = await this.getProjectRoomId(data.sourceSceneId);
      const targetProjectRoomId = `project:${data.targetProjectId}`;

      const copyData = {
        sourceSceneId: data.sourceSceneId,
        targetProjectId: data.targetProjectId,
        newSceneNumber: data.newSceneNumber,
        copyImages: data.copyImages,
        copyAnnotations: data.copyAnnotations,
        copiedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      // 대상 프로젝트 룸에 복사 시작 알림
      socket.to(targetProjectRoomId).emit("scene:copy_started", copyData);

      // 소스와 대상이 다른 프로젝트인 경우 소스 프로젝트 룸에도 알림
      if (sourceProjectRoomId && sourceProjectRoomId !== targetProjectRoomId) {
        socket.to(sourceProjectRoomId).emit("scene:copy_started", copyData);
      }

      // 협업 로그 기록 (소스 프로젝트)
      if (sourceProjectRoomId) {
        const sourceProjectId = sourceProjectRoomId.replace("project:", "");
        await CollaborationService.logActivity({
          projectId: sourceProjectId,
          userId: socket.userId,
          actionType: "copy_scene",
          targetType: "scene",
          targetId: data.sourceSceneId,
          sceneId: data.sourceSceneId,
          description: "씬이 다른 프로젝트로 복사되었습니다.",
          metadata: {
            targetProjectId: data.targetProjectId,
            copyOptions: {
              copyImages: data.copyImages,
              copyAnnotations: data.copyAnnotations,
            },
          },
        });
      }

      // 협업 로그 기록 (대상 프로젝트)
      await CollaborationService.logActivity({
        projectId: data.targetProjectId,
        userId: socket.userId,
        actionType: "paste_scene",
        targetType: "project",
        targetId: data.targetProjectId,
        description: "다른 프로젝트에서 씬을 복사했습니다.",
        metadata: {
          sourceSceneId: data.sourceSceneId,
          newSceneNumber: data.newSceneNumber,
          copyOptions: {
            copyImages: data.copyImages,
            copyAnnotations: data.copyAnnotations,
          },
        },
      });

      socket.emit("scene:copy_success", {
        sourceSceneId: data.sourceSceneId,
        targetProjectId: data.targetProjectId,
        newSceneNumber: data.newSceneNumber,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Scene copy event error:", error);
      socket.emit("scene:copy_error", {
        error: "씬 복사 중 오류가 발생했습니다.",
        timestamp: new Date(),
      });
    }
  }

  /**
   * 씬 상태 변경 처리
   */
  private async handleSceneStatusChange(socket: AuthenticatedSocket, data: { sceneId: string; projectId: string; status: "active" | "archived" | "draft" }): Promise<void> {
    try {
      const projectRoomId = `project:${data.projectId}`;
      const sceneRoomId = `scene:${data.sceneId}`;

      const statusData = {
        sceneId: data.sceneId,
        status: data.status,
        changedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      // 관련 룸들에 상태 변경 브로드캐스트
      socket.to(projectRoomId).emit("scene:status_changed", statusData);
      socket.to(sceneRoomId).emit("scene:status_changed", statusData);

      // 협업 로그 기록
      await CollaborationService.logActivity({
        projectId: data.projectId,
        userId: socket.userId,
        actionType: "update_scene",
        targetType: "scene",
        targetId: data.sceneId,
        sceneId: data.sceneId,
        description: `씬 상태를 ${data.status}로 변경했습니다.`,
        metadata: {
          sceneId: data.sceneId,
          newStatus: data.status,
        },
      });

      socket.emit("scene:status_change_success", {
        sceneId: data.sceneId,
        status: data.status,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Scene status change event error:", error);
      socket.emit("scene:status_change_error", {
        error: "씬 상태 변경 중 오류가 발생했습니다.",
        timestamp: new Date(),
      });
    }
  }

  /**
   * 씬 선택 처리
   */
  private handleSceneSelection(socket: AuthenticatedSocket, data: { sceneIds: string[]; projectId: string; action: "select" | "deselect" }): void {
    try {
      const projectRoomId = `project:${data.projectId}`;

      const selectionData = {
        sceneIds: data.sceneIds,
        action: data.action,
        selectedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      // 프로젝트 룸에 선택 상태 브로드캐스트
      socket.to(projectRoomId).emit("scene:selection_changed", selectionData);

    } catch (error) {
      console.error("Scene selection event error:", error);
    }
  }

  /**
   * 씬 잠금 처리
   */
  private handleSceneLock(socket: AuthenticatedSocket, data: { sceneId: string; projectId: string; action: "lock" | "unlock" }): void {
    try {
      const projectRoomId = `project:${data.projectId}`;
      const sceneRoomId = `scene:${data.sceneId}`;

      const lockData = {
        sceneId: data.sceneId,
        action: data.action,
        lockedBy: data.action === "lock" ? {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        } : null,
        timestamp: new Date(),
      };

      // 관련 룸들에 잠금 상태 브로드캐스트
      socket.to(projectRoomId).emit("scene:lock_changed", lockData);
      socket.to(sceneRoomId).emit("scene:lock_changed", lockData);

    } catch (error) {
      console.error("Scene lock event error:", error);
    }
  }

  /**
   * 씬 템플릿 저장 처리
   */
  private async handleSceneSaveAsTemplate(socket: AuthenticatedSocket, data: { sceneId: string; templateName: string; description?: string }): Promise<void> {
    try {
      const projectId = await this.getProjectId(data.sceneId);
      const projectRoomId = `project:${projectId}`;

      const templateData = {
        sceneId: data.sceneId,
        templateName: data.templateName,
        description: data.description,
        savedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      // 프로젝트 룸에 템플릿 저장 알림
      socket.to(projectRoomId).emit("scene:template_saved", templateData);

      // 협업 로그 기록
      await CollaborationService.logActivity({
        projectId,
        userId: socket.userId,
        actionType: "save_template",
        targetType: "scene",
        targetId: data.sceneId,
        sceneId: data.sceneId,
        description: `씬을 템플릿 "${data.templateName}"로 저장했습니다.`,
        metadata: {
          sceneId: data.sceneId,
          templateName: data.templateName,
          description: data.description,
        },
      });

      socket.emit("scene:save_template_success", {
        sceneId: data.sceneId,
        templateName: data.templateName,
        timestamp: new Date(),
      });

    } catch (error) {
      console.error("Scene save as template event error:", error);
      socket.emit("scene:save_template_error", {
        error: "씬 템플릿 저장 중 오류가 발생했습니다.",
        timestamp: new Date(),
      });
    }
  }

  /**
   * 씬 뷰 모드 변경 처리
   */
  private handleSceneViewMode(socket: AuthenticatedSocket, data: { sceneId: string; viewMode: "grid" | "list" | "timeline" }): void {
    try {
      const sceneRoomId = `scene:${data.sceneId}`;

      const viewModeData = {
        sceneId: data.sceneId,
        viewMode: data.viewMode,
        changedBy: {
          userId: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      };

      // 씬 룸에 뷰 모드 변경 브로드캐스트
      socket.to(sceneRoomId).emit("scene:view_mode_changed", viewModeData);

    } catch (error) {
      console.error("Scene view mode event error:", error);
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
}

export default SceneEventHandler;