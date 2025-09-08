import { Server as SocketIOServer } from "socket.io";
import { AuthenticatedSocket } from "./auth";
import { CollaborationService } from "@/lib/services/collaboration";

export interface UserPresence {
  userId: string;
  username: string;
  nickname: string;
  profileImageUrl?: string;
  status: "active" | "idle" | "away" | "offline";
  
  // 위치 정보
  projectId?: string;
  sceneId?: string;
  imageId?: string;
  
  // 실시간 상호작용
  cursorPosition?: { x: number; y: number };
  viewportPosition?: { x: number; y: number; zoom: number };
  selectedTool?: string;
  selectedColor?: string;
  
  // 상태 정보
  isTyping?: boolean;
  typingContext?: string; // 어디에 타이핑 중인지
  lastActivity: Date;
  connectionId: string;
  
  // 메타데이터
  metadata?: Record<string, any>;
}

export interface CursorData {
  userId: string;
  username: string;
  nickname: string;
  x: number;
  y: number;
  color?: string;
  tool?: string;
  timestamp: Date;
}

export interface ViewportData {
  userId: string;
  x: number;
  y: number;
  zoom: number;
  timestamp: Date;
}

export interface TypingData {
  userId: string;
  username: string;
  nickname: string;
  isTyping: boolean;
  context?: string;
  timestamp: Date;
}

export class PresenceManager {
  private io: SocketIOServer;
  private userPresence: Map<string, UserPresence> = new Map();
  private cursorPositions: Map<string, Map<string, CursorData>> = new Map(); // roomId -> userId -> CursorData
  private viewportPositions: Map<string, Map<string, ViewportData>> = new Map(); // roomId -> userId -> ViewportData
  private typingUsers: Map<string, Set<string>> = new Map(); // roomId -> Set<userId>

  constructor(io: SocketIOServer) {
    this.io = io;
    this.startPresenceCleanup();
  }

  /**
   * 사용자 프레젠스 초기화
   */
  initializeUserPresence(socket: AuthenticatedSocket): UserPresence {
    const presence: UserPresence = {
      userId: socket.userId,
      username: socket.user.username,
      nickname: socket.user.nickname,
      profileImageUrl: socket.user.profileImageUrl,
      status: "active",
      lastActivity: new Date(),
      connectionId: socket.id,
    };

    this.userPresence.set(socket.userId, presence);
    
    // 데이터베이스에도 프레젠스 기록
    this.updateDatabasePresence(presence);

    return presence;
  }

  /**
   * 사용자 상태 업데이트
   */
  updateUserStatus(userId: string, status: "active" | "idle" | "away"): void {
    const presence = this.userPresence.get(userId);
    if (!presence) return;

    const oldStatus = presence.status;
    presence.status = status;
    presence.lastActivity = new Date();

    // 상태 변경이 있는 경우만 알림
    if (oldStatus !== status) {
      this.broadcastPresenceUpdate(presence, "status_changed");
      this.updateDatabasePresence(presence);
    }
  }

  /**
   * 사용자 위치 업데이트
   */
  updateUserLocation(
    userId: string, 
    location: { projectId?: string; sceneId?: string; imageId?: string }
  ): void {
    const presence = this.userPresence.get(userId);
    if (!presence) return;

    presence.projectId = location.projectId;
    presence.sceneId = location.sceneId;
    presence.imageId = location.imageId;
    presence.lastActivity = new Date();

    this.broadcastPresenceUpdate(presence, "location_changed");
    this.updateDatabasePresence(presence);
  }

  /**
   * 커서 위치 업데이트
   */
  updateCursorPosition(
    socket: AuthenticatedSocket,
    roomId: string,
    position: { x: number; y: number },
    options?: { tool?: string; color?: string }
  ): void {
    const presence = this.userPresence.get(socket.userId);
    if (!presence) return;

    // 프레젠스 업데이트
    presence.cursorPosition = position;
    presence.selectedTool = options?.tool || presence.selectedTool;
    presence.selectedColor = options?.color || presence.selectedColor;
    presence.lastActivity = new Date();

    // 룸별 커서 데이터 업데이트
    if (!this.cursorPositions.has(roomId)) {
      this.cursorPositions.set(roomId, new Map());
    }

    const cursorData: CursorData = {
      userId: socket.userId,
      username: socket.user.username,
      nickname: socket.user.nickname,
      x: position.x,
      y: position.y,
      color: options?.color,
      tool: options?.tool,
      timestamp: new Date(),
    };

    this.cursorPositions.get(roomId)!.set(socket.userId, cursorData);

    // 같은 룸의 다른 사용자들에게 커서 위치 전송 (본인 제외)
    socket.to(roomId).emit("cursor_moved", cursorData);
  }

  /**
   * 뷰포트 위치 업데이트
   */
  updateViewportPosition(
    socket: AuthenticatedSocket,
    roomId: string,
    viewport: { x: number; y: number; zoom: number }
  ): void {
    const presence = this.userPresence.get(socket.userId);
    if (!presence) return;

    presence.viewportPosition = viewport;
    presence.lastActivity = new Date();

    // 룸별 뷰포트 데이터 업데이트
    if (!this.viewportPositions.has(roomId)) {
      this.viewportPositions.set(roomId, new Map());
    }

    const viewportData: ViewportData = {
      userId: socket.userId,
      x: viewport.x,
      y: viewport.y,
      zoom: viewport.zoom,
      timestamp: new Date(),
    };

    this.viewportPositions.get(roomId)!.set(socket.userId, viewportData);

    // 같은 룸의 다른 사용자들에게 뷰포트 위치 전송
    socket.to(roomId).emit("viewport_changed", viewportData);
  }

  /**
   * 타이핑 상태 시작
   */
  startTyping(
    socket: AuthenticatedSocket,
    roomId: string,
    context?: string
  ): void {
    const presence = this.userPresence.get(socket.userId);
    if (!presence) return;

    presence.isTyping = true;
    presence.typingContext = context;
    presence.lastActivity = new Date();

    // 룸별 타이핑 사용자 추가
    if (!this.typingUsers.has(roomId)) {
      this.typingUsers.set(roomId, new Set());
    }
    this.typingUsers.get(roomId)!.add(socket.userId);

    const typingData: TypingData = {
      userId: socket.userId,
      username: socket.user.username,
      nickname: socket.user.nickname,
      isTyping: true,
      context,
      timestamp: new Date(),
    };

    // 같은 룸의 다른 사용자들에게 타이핑 시작 알림
    socket.to(roomId).emit("user_typing", typingData);
  }

  /**
   * 타이핑 상태 종료
   */
  stopTyping(
    socket: AuthenticatedSocket,
    roomId: string,
    context?: string
  ): void {
    const presence = this.userPresence.get(socket.userId);
    if (!presence) return;

    presence.isTyping = false;
    presence.typingContext = undefined;
    presence.lastActivity = new Date();

    // 룸별 타이핑 사용자에서 제거
    if (this.typingUsers.has(roomId)) {
      this.typingUsers.get(roomId)!.delete(socket.userId);
    }

    const typingData: TypingData = {
      userId: socket.userId,
      username: socket.user.username,
      nickname: socket.user.nickname,
      isTyping: false,
      context,
      timestamp: new Date(),
    };

    // 같은 룸의 다른 사용자들에게 타이핑 종료 알림
    socket.to(roomId).emit("user_typing", typingData);
  }

  /**
   * 사용자 연결 해제 처리
   */
  removeUserPresence(userId: string): void {
    const presence = this.userPresence.get(userId);
    if (!presence) return;

    // 상태를 오프라인으로 변경
    presence.status = "offline";
    presence.lastActivity = new Date();

    // 프레젠스 변경 알림
    this.broadcastPresenceUpdate(presence, "disconnected");

    // 모든 룸에서 사용자 커서/뷰포트 제거
    this.cursorPositions.forEach((cursors, roomId) => {
      if (cursors.has(userId)) {
        cursors.delete(userId);
        this.io.to(roomId).emit("cursor_removed", { userId, timestamp: new Date() });
      }
    });

    this.viewportPositions.forEach((viewports, roomId) => {
      if (viewports.has(userId)) {
        viewports.delete(userId);
      }
    });

    // 타이핑 상태에서 제거
    this.typingUsers.forEach((typingSet, roomId) => {
      if (typingSet.has(userId)) {
        typingSet.delete(userId);
        this.io.to(roomId).emit("user_typing", {
          userId,
          isTyping: false,
          timestamp: new Date(),
        });
      }
    });

    // 데이터베이스 프레젠스 업데이트
    this.updateDatabasePresence(presence);

    // 메모리에서 제거
    this.userPresence.delete(userId);
  }

  /**
   * 룸의 모든 프레젠스 정보 조회
   */
  getRoomPresence(roomId: string): {
    users: UserPresence[];
    cursors: CursorData[];
    viewports: ViewportData[];
    typingUsers: string[];
  } {
    const users = Array.from(this.userPresence.values()).filter(presence => 
      presence.status !== "offline"
    );

    const cursors = Array.from(this.cursorPositions.get(roomId)?.values() || []);
    const viewports = Array.from(this.viewportPositions.get(roomId)?.values() || []);
    const typingUsers = Array.from(this.typingUsers.get(roomId) || []);

    return { users, cursors, viewports, typingUsers };
  }

  /**
   * 특정 사용자의 프레젠스 조회
   */
  getUserPresence(userId: string): UserPresence | null {
    return this.userPresence.get(userId) || null;
  }

  /**
   * 활성 사용자 목록 조회
   */
  getActiveUsers(projectId?: string, sceneId?: string): UserPresence[] {
    return Array.from(this.userPresence.values()).filter(presence => {
      if (presence.status === "offline") return false;
      if (projectId && presence.projectId !== projectId) return false;
      if (sceneId && presence.sceneId !== sceneId) return false;
      return true;
    });
  }

  /**
   * 프레젠스 통계
   */
  getPresenceStats(): {
    totalUsers: number;
    activeUsers: number;
    usersByStatus: Record<string, number>;
    usersByProject: Record<string, number>;
  } {
    const allUsers = Array.from(this.userPresence.values());
    
    const usersByStatus = allUsers.reduce((acc, presence) => {
      acc[presence.status] = (acc[presence.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const usersByProject = allUsers.reduce((acc, presence) => {
      if (presence.projectId) {
        acc[presence.projectId] = (acc[presence.projectId] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      totalUsers: allUsers.length,
      activeUsers: allUsers.filter(p => p.status === "active").length,
      usersByStatus,
      usersByProject,
    };
  }

  /**
   * 프레젠스 변경사항 브로드캐스트
   */
  private broadcastPresenceUpdate(presence: UserPresence, changeType: string): void {
    // 사용자가 있는 프로젝트의 모든 룸에 알림
    if (presence.projectId) {
      const projectRoomId = `project:${presence.projectId}`;
      this.io.to(projectRoomId).emit("presence_updated", {
        user: presence,
        changeType,
        timestamp: new Date(),
      });
    }

    // 사용자가 있는 씬 룸에도 알림
    if (presence.sceneId) {
      const sceneRoomId = `scene:${presence.sceneId}`;
      this.io.to(sceneRoomId).emit("presence_updated", {
        user: presence,
        changeType,
        timestamp: new Date(),
      });
    }
  }

  /**
   * 데이터베이스 프레젠스 업데이트
   */
  private async updateDatabasePresence(presence: UserPresence): Promise<void> {
    try {
      if (presence.projectId) {
        await CollaborationService.updateUserPresence({
          userId: presence.userId,
          projectId: presence.projectId,
          sceneId: presence.sceneId,
          imageId: presence.imageId,
          status: presence.status,
          cursorPosition: presence.cursorPosition,
          currentTool: presence.selectedTool,
          metadata: {
            viewportPosition: presence.viewportPosition,
            selectedColor: presence.selectedColor,
            isTyping: presence.isTyping,
            typingContext: presence.typingContext,
            connectionId: presence.connectionId,
          },
        });
      }
    } catch (error) {
      console.error("Failed to update database presence:", error);
    }
  }

  /**
   * 자동 상태 변경 (활동 기반)
   */
  private checkUserActivityStatus(): void {
    const now = new Date();
    const idleThreshold = 5 * 60 * 1000; // 5분
    const awayThreshold = 15 * 60 * 1000; // 15분

    this.userPresence.forEach((presence, userId) => {
      const timeSinceLastActivity = now.getTime() - presence.lastActivity.getTime();

      let newStatus: "active" | "idle" | "away" = presence.status as any;

      if (timeSinceLastActivity > awayThreshold) {
        newStatus = "away";
      } else if (timeSinceLastActivity > idleThreshold && presence.status === "active") {
        newStatus = "idle";
      }

      if (newStatus !== presence.status) {
        this.updateUserStatus(userId, newStatus);
      }
    });
  }

  /**
   * 타이핑 상태 자동 정리
   */
  private cleanupTypingStates(): void {
    const now = new Date();
    const typingTimeout = 10 * 1000; // 10초

    this.typingUsers.forEach((typingSet, roomId) => {
      const usersToRemove: string[] = [];

      typingSet.forEach(userId => {
        const presence = this.userPresence.get(userId);
        if (!presence || 
            !presence.isTyping || 
            now.getTime() - presence.lastActivity.getTime() > typingTimeout) {
          usersToRemove.push(userId);
        }
      });

      usersToRemove.forEach(userId => {
        typingSet.delete(userId);
        
        const presence = this.userPresence.get(userId);
        if (presence) {
          presence.isTyping = false;
          presence.typingContext = undefined;
        }

        this.io.to(roomId).emit("user_typing", {
          userId,
          isTyping: false,
          timestamp: new Date(),
        });
      });
    });
  }

  /**
   * 정리 작업 시작
   */
  private startPresenceCleanup(): void {
    // 30초마다 사용자 활동 상태 확인
    setInterval(() => {
      this.checkUserActivityStatus();
    }, 30 * 1000);

    // 5초마다 타이핑 상태 정리
    setInterval(() => {
      this.cleanupTypingStates();
    }, 5 * 1000);

    // 5분마다 오래된 커서/뷰포트 데이터 정리
    setInterval(() => {
      this.cleanupOldPositionData();
    }, 5 * 60 * 1000);
  }

  /**
   * 오래된 위치 데이터 정리
   */
  private cleanupOldPositionData(): void {
    const now = new Date();
    const cleanupThreshold = 30 * 60 * 1000; // 30분

    // 커서 위치 정리
    this.cursorPositions.forEach((cursors, roomId) => {
      const usersToRemove: string[] = [];

      cursors.forEach((cursor, userId) => {
        if (now.getTime() - cursor.timestamp.getTime() > cleanupThreshold) {
          usersToRemove.push(userId);
        }
      });

      usersToRemove.forEach(userId => {
        cursors.delete(userId);
      });

      if (cursors.size === 0) {
        this.cursorPositions.delete(roomId);
      }
    });

    // 뷰포트 위치 정리
    this.viewportPositions.forEach((viewports, roomId) => {
      const usersToRemove: string[] = [];

      viewports.forEach((viewport, userId) => {
        if (now.getTime() - viewport.timestamp.getTime() > cleanupThreshold) {
          usersToRemove.push(userId);
        }
      });

      usersToRemove.forEach(userId => {
        viewports.delete(userId);
      });

      if (viewports.size === 0) {
        this.viewportPositions.delete(roomId);
      }
    });
  }

  /**
   * 메모리 사용량 조회
   */
  getMemoryUsage(): {
    userPresence: number;
    cursorPositions: number;
    viewportPositions: number;
    typingUsers: number;
  } {
    return {
      userPresence: this.userPresence.size,
      cursorPositions: Array.from(this.cursorPositions.values())
        .reduce((sum, cursors) => sum + cursors.size, 0),
      viewportPositions: Array.from(this.viewportPositions.values())
        .reduce((sum, viewports) => sum + viewports.size, 0),
      typingUsers: Array.from(this.typingUsers.values())
        .reduce((sum, users) => sum + users.size, 0),
    };
  }
}

export default PresenceManager;