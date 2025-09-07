import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { prisma } from "@/lib/prisma";
import { verifyJWT } from "@/lib/utils/jwt";
import { CollaborationService } from "@/lib/services/collaboration";
import { NotificationService } from "@/lib/services/notification";

// 소켓 인증 인터페이스
export interface AuthenticatedSocket extends Socket {
  userId: string;
  user: {
    id: string;
    username: string;
    nickname: string;
    profileImageUrl?: string;
    isAdmin: boolean;
  };
}

// 룸 관리 인터페이스
export interface RoomData {
  projectId: string;
  sceneId?: string;
  imageId?: string;
  participants: Set<string>;
  createdAt: Date;
  lastActivity: Date;
}

// 사용자 프레젠스 인터페이스
export interface UserPresence {
  userId: string;
  username: string;
  nickname: string;
  profileImageUrl?: string;
  status: "active" | "idle" | "away";
  currentRoom: string;
  cursorPosition?: { x: number; y: number };
  currentTool?: string;
  lastActivity: Date;
}

export class SocketServer {
  private io: SocketIOServer;
  private httpServer: HTTPServer;
  private rooms: Map<string, RoomData> = new Map();
  private userPresence: Map<string, UserPresence> = new Map();
  private activeConnections: Map<string, Set<string>> = new Map(); // userId -> Set<socketId>

  constructor(httpServer: HTTPServer) {
    this.httpServer = httpServer;
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    this.startCleanupTasks();
  }

  /**
   * 미들웨어 설정
   */
  private setupMiddleware() {
    // 인증 미들웨어
    this.io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;

        if (!token) {
          return next(new Error("Authentication token required"));
        }

        const decoded = await verifyJWT(token as string);
        if (!decoded || !decoded.userId) {
          return next(new Error("Invalid authentication token"));
        }

        // 사용자 정보 조회
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
            isAdmin: true,
          },
        });

        if (!user) {
          return next(new Error("User not found"));
        }

        // 소켓에 사용자 정보 추가
        (socket as AuthenticatedSocket).userId = user.id;
        (socket as AuthenticatedSocket).user = user;

        next();
      } catch (error) {
        console.error("Socket authentication error:", error);
        next(new Error("Authentication failed"));
      }
    });

    // 연결 로깅 미들웨어
    this.io.use((socket, next) => {
      console.log(`Socket connection attempt: ${socket.id} from ${socket.handshake.address}`);
      next();
    });
  }

  /**
   * 이벤트 핸들러 설정
   */
  private setupEventHandlers() {
    this.io.on("connection", (socket: AuthenticatedSocket) => {
      console.log(`User ${socket.user.username} connected with socket ${socket.id}`);

      // 사용자 연결 관리
      this.handleUserConnection(socket);

      // 기본 이벤트 핸들러
      this.setupBasicEventHandlers(socket);

      // 룸 관리 이벤트 핸들러
      this.setupRoomEventHandlers(socket);

      // 프레젠스 이벤트 핸들러
      this.setupPresenceEventHandlers(socket);

      // 실시간 협업 이벤트 핸들러
      this.setupCollaborationEventHandlers(socket);

      // 댓글 실시간 이벤트 핸들러
      this.setupCommentEventHandlers(socket);

      // 주석 실시간 이벤트 핸들러
      this.setupAnnotationEventHandlers(socket);

      // 이미지 실시간 이벤트 핸들러
      this.setupImageEventHandlers(socket);

      // 연결 해제 처리
      socket.on("disconnect", (reason) => {
        this.handleUserDisconnection(socket, reason);
      });
    });
  }

  /**
   * 사용자 연결 처리
   */
  private handleUserConnection(socket: AuthenticatedSocket) {
    const userId = socket.userId;

    // 활성 연결 추가
    if (!this.activeConnections.has(userId)) {
      this.activeConnections.set(userId, new Set());
    }
    this.activeConnections.get(userId)!.add(socket.id);

    // 사용자 프레젠스 업데이트
    this.userPresence.set(userId, {
      userId: socket.userId,
      username: socket.user.username,
      nickname: socket.user.nickname,
      profileImageUrl: socket.user.profileImageUrl,
      status: "active",
      currentRoom: "",
      lastActivity: new Date(),
    });

    // 연결 확인 응답
    socket.emit("connection_confirmed", {
      userId: socket.userId,
      user: socket.user,
      timestamp: new Date(),
    });
  }

  /**
   * 사용자 연결 해제 처리
   */
  private handleUserDisconnection(socket: AuthenticatedSocket, reason: string) {
    const userId = socket.userId;

    console.log(`User ${socket.user.username} disconnected: ${reason}`);

    // 활성 연결에서 제거
    if (this.activeConnections.has(userId)) {
      this.activeConnections.get(userId)!.delete(socket.id);
      if (this.activeConnections.get(userId)!.size === 0) {
        this.activeConnections.delete(userId);
        this.userPresence.delete(userId);
      }
    }

    // 모든 룸에서 사용자 제거
    socket.rooms.forEach((roomId) => {
      if (roomId !== socket.id) {
        this.leaveRoom(socket, roomId);
      }
    });
  }

  /**
   * 기본 이벤트 핸들러 설정
   */
  private setupBasicEventHandlers(socket: AuthenticatedSocket) {
    // 핑-퐁 유지
    socket.on("ping", () => {
      socket.emit("pong", { timestamp: new Date() });
    });

    // 에러 처리
    socket.on("error", (error) => {
      console.error(`Socket error from ${socket.user.username}:`, error);
    });

    // 사용자 상태 업데이트
    socket.on("update_status", (data: { status: "active" | "idle" | "away" }) => {
      if (this.userPresence.has(socket.userId)) {
        const presence = this.userPresence.get(socket.userId)!;
        presence.status = data.status;
        presence.lastActivity = new Date();

        // 모든 룸에 상태 변경 알림
        socket.rooms.forEach((roomId) => {
          if (roomId !== socket.id) {
            socket.to(roomId).emit("user_status_updated", {
              userId: socket.userId,
              status: data.status,
              timestamp: new Date(),
            });
          }
        });
      }
    });
  }

  /**
   * 룸 관리 이벤트 핸들러 설정
   */
  private setupRoomEventHandlers(socket: AuthenticatedSocket) {
    // 프로젝트 룸 참여
    socket.on("join_project", async (data: { projectId: string }) => {
      try {
        const { projectId } = data;

        // 프로젝트 접근 권한 확인
        const hasAccess = await this.checkProjectAccess(socket.userId, projectId);
        if (!hasAccess) {
          socket.emit("error", {
            type: "access_denied",
            message: "프로젝트 접근 권한이 없습니다.",
          });
          return;
        }

        const roomId = `project:${projectId}`;
        await this.joinRoom(socket, roomId, { projectId });

        socket.emit("project_joined", {
          projectId,
          roomId,
          timestamp: new Date(),
        });

      } catch (error) {
        console.error("Join project error:", error);
        socket.emit("error", {
          type: "join_project_failed",
          message: "프로젝트 참여 중 오류가 발생했습니다.",
        });
      }
    });

    // 씬 룸 참여
    socket.on("join_scene", async (data: { projectId: string; sceneId: string }) => {
      try {
        const { projectId, sceneId } = data;

        // 프로젝트 및 씬 접근 권한 확인
        const hasAccess = await this.checkSceneAccess(socket.userId, projectId, sceneId);
        if (!hasAccess) {
          socket.emit("error", {
            type: "access_denied",
            message: "씬 접근 권한이 없습니다.",
          });
          return;
        }

        const roomId = `scene:${sceneId}`;
        await this.joinRoom(socket, roomId, { projectId, sceneId });

        // 씬의 현재 활성 사용자들 전송
        const activeUsers = Array.from(this.io.sockets.adapter.rooms.get(roomId) || [])
          .map((socketId) => {
            const otherSocket = this.io.sockets.sockets.get(socketId) as AuthenticatedSocket;
            return otherSocket ? {
              userId: otherSocket.userId,
              user: {
                username: otherSocket.user.username,
                nickname: otherSocket.user.nickname,
                profileImageUrl: otherSocket.user.profileImageUrl,
              },
              presence: this.userPresence.get(otherSocket.userId),
            } : null;
          })
          .filter(Boolean);

        socket.emit("scene_joined", {
          projectId,
          sceneId,
          roomId,
          activeUsers,
          timestamp: new Date(),
        });

      } catch (error) {
        console.error("Join scene error:", error);
        socket.emit("error", {
          type: "join_scene_failed",
          message: "씬 참여 중 오류가 발생했습니다.",
        });
      }
    });

    // 룸 떠나기
    socket.on("leave_room", (data: { roomId: string }) => {
      this.leaveRoom(socket, data.roomId);
    });
  }

  /**
   * 프레젠스 이벤트 핸들러 설정
   */
  private setupPresenceEventHandlers(socket: AuthenticatedSocket) {
    // 커서 위치 업데이트
    socket.on("cursor_move", (data: { x: number; y: number; roomId: string }) => {
      if (this.userPresence.has(socket.userId)) {
        const presence = this.userPresence.get(socket.userId)!;
        presence.cursorPosition = { x: data.x, y: data.y };
        presence.lastActivity = new Date();

        // 같은 룸의 다른 사용자들에게 커서 위치 전송
        socket.to(data.roomId).emit("user_cursor_moved", {
          userId: socket.userId,
          position: { x: data.x, y: data.y },
          timestamp: new Date(),
        });
      }
    });

    // 현재 도구 변경
    socket.on("tool_changed", (data: { tool: string; roomId: string }) => {
      if (this.userPresence.has(socket.userId)) {
        const presence = this.userPresence.get(socket.userId)!;
        presence.currentTool = data.tool;
        presence.lastActivity = new Date();

        socket.to(data.roomId).emit("user_tool_changed", {
          userId: socket.userId,
          tool: data.tool,
          timestamp: new Date(),
        });
      }
    });

    // 타이핑 상태
    socket.on("typing_start", (data: { roomId: string; context?: string }) => {
      socket.to(data.roomId).emit("user_typing_start", {
        userId: socket.userId,
        user: {
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        context: data.context,
        timestamp: new Date(),
      });
    });

    socket.on("typing_stop", (data: { roomId: string; context?: string }) => {
      socket.to(data.roomId).emit("user_typing_stop", {
        userId: socket.userId,
        context: data.context,
        timestamp: new Date(),
      });
    });
  }

  /**
   * 협업 이벤트 핸들러 설정
   */
  private setupCollaborationEventHandlers(socket: AuthenticatedSocket) {
    // 활동 로깅
    socket.on("log_activity", async (data: {
      projectId: string;
      actionType: string;
      targetType: string;
      targetId: string;
      description: string;
      sceneId?: string;
      metadata?: Record<string, any>;
    }) => {
      try {
        await CollaborationService.logActivity({
          projectId: data.projectId,
          userId: socket.userId,
          actionType: data.actionType as any,
          targetType: data.targetType as any,
          targetId: data.targetId,
          sceneId: data.sceneId,
          description: data.description,
          metadata: data.metadata,
        });

        // 프로젝트 룸에 활동 알림
        const projectRoomId = `project:${data.projectId}`;
        this.io.to(projectRoomId).emit("activity_logged", {
          userId: socket.userId,
          user: {
            username: socket.user.username,
            nickname: socket.user.nickname,
          },
          actionType: data.actionType,
          description: data.description,
          timestamp: new Date(),
        });

      } catch (error) {
        console.error("Activity logging error:", error);
      }
    });
  }

  /**
   * 댓글 실시간 이벤트 핸들러 설정
   */
  private setupCommentEventHandlers(socket: AuthenticatedSocket) {
    // 새 댓글 알림
    socket.on("comment_created", (data: {
      commentId: string;
      projectId: string;
      sceneId?: string;
      imageId?: string;
      content: string;
      parentCommentId?: string;
    }) => {
      const roomIds = [];
      roomIds.push(`project:${data.projectId}`);
      if (data.sceneId) roomIds.push(`scene:${data.sceneId}`);
      if (data.imageId) roomIds.push(`image:${data.imageId}`);

      roomIds.forEach((roomId) => {
        socket.to(roomId).emit("new_comment", {
          commentId: data.commentId,
          content: data.content,
          user: {
            id: socket.userId,
            username: socket.user.username,
            nickname: socket.user.nickname,
            profileImageUrl: socket.user.profileImageUrl,
          },
          parentCommentId: data.parentCommentId,
          timestamp: new Date(),
        });
      });
    });

    // 댓글 수정 알림
    socket.on("comment_updated", (data: {
      commentId: string;
      projectId: string;
      sceneId?: string;
      imageId?: string;
      content: string;
    }) => {
      const roomIds = [];
      roomIds.push(`project:${data.projectId}`);
      if (data.sceneId) roomIds.push(`scene:${data.sceneId}`);
      if (data.imageId) roomIds.push(`image:${data.imageId}`);

      roomIds.forEach((roomId) => {
        socket.to(roomId).emit("comment_updated", {
          commentId: data.commentId,
          content: data.content,
          updatedBy: socket.userId,
          timestamp: new Date(),
        });
      });
    });

    // 댓글 삭제 알림
    socket.on("comment_deleted", (data: {
      commentId: string;
      projectId: string;
      sceneId?: string;
      imageId?: string;
    }) => {
      const roomIds = [];
      roomIds.push(`project:${data.projectId}`);
      if (data.sceneId) roomIds.push(`scene:${data.sceneId}`);
      if (data.imageId) roomIds.push(`image:${data.imageId}`);

      roomIds.forEach((roomId) => {
        socket.to(roomId).emit("comment_deleted", {
          commentId: data.commentId,
          deletedBy: socket.userId,
          timestamp: new Date(),
        });
      });
    });
  }

  /**
   * 주석 실시간 이벤트 핸들러 설정
   */
  private setupAnnotationEventHandlers(socket: AuthenticatedSocket) {
    // 주석 생성 실시간 동기화
    socket.on("annotation_created", (data: {
      annotationId: string;
      imageId: string;
      type: string;
      position: { x: number; y: number };
      style?: any;
      content?: string;
    }) => {
      socket.to(`image:${data.imageId}`).emit("new_annotation", {
        annotationId: data.annotationId,
        type: data.type,
        position: data.position,
        style: data.style,
        content: data.content,
        user: {
          id: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      });
    });

    // 주석 업데이트 동기화
    socket.on("annotation_updated", (data: {
      annotationId: string;
      imageId: string;
      changes: any;
    }) => {
      socket.to(`image:${data.imageId}`).emit("annotation_updated", {
        annotationId: data.annotationId,
        changes: data.changes,
        updatedBy: socket.userId,
        timestamp: new Date(),
      });
    });

    // 주석 삭제 동기화
    socket.on("annotation_deleted", (data: {
      annotationId: string;
      imageId: string;
    }) => {
      socket.to(`image:${data.imageId}`).emit("annotation_deleted", {
        annotationId: data.annotationId,
        deletedBy: socket.userId,
        timestamp: new Date(),
      });
    });

    // 실시간 드로잉 (자유 그리기 주석)
    socket.on("drawing_data", (data: {
      imageId: string;
      drawingData: any;
      isComplete: boolean;
    }) => {
      socket.to(`image:${data.imageId}`).emit("drawing_update", {
        userId: socket.userId,
        drawingData: data.drawingData,
        isComplete: data.isComplete,
        timestamp: new Date(),
      });
    });
  }

  /**
   * 이미지 실시간 이벤트 핸들러 설정
   */
  private setupImageEventHandlers(socket: AuthenticatedSocket) {
    // 이미지 업로드 진행 상황
    socket.on("image_upload_progress", (data: {
      sceneId: string;
      filename: string;
      progress: number;
    }) => {
      socket.to(`scene:${data.sceneId}`).emit("upload_progress", {
        userId: socket.userId,
        filename: data.filename,
        progress: data.progress,
        timestamp: new Date(),
      });
    });

    // 이미지 업로드 완료
    socket.on("image_uploaded", (data: {
      imageId: string;
      sceneId: string;
      filename: string;
      type: string;
    }) => {
      socket.to(`scene:${data.sceneId}`).emit("new_image", {
        imageId: data.imageId,
        filename: data.filename,
        type: data.type,
        uploader: {
          id: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      });
    });
  }

  /**
   * 룸 참여 처리
   */
  private async joinRoom(socket: AuthenticatedSocket, roomId: string, roomData: Partial<RoomData>) {
    await socket.join(roomId);

    // 룸 데이터 업데이트
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        projectId: roomData.projectId!,
        sceneId: roomData.sceneId,
        imageId: roomData.imageId,
        participants: new Set(),
        createdAt: new Date(),
        lastActivity: new Date(),
      });
    }

    const room = this.rooms.get(roomId)!;
    room.participants.add(socket.userId);
    room.lastActivity = new Date();

    // 사용자 프레젠스 업데이트
    if (this.userPresence.has(socket.userId)) {
      this.userPresence.get(socket.userId)!.currentRoom = roomId;
    }

    // 룸의 다른 사용자들에게 참여 알림
    socket.to(roomId).emit("user_joined", {
      userId: socket.userId,
      user: {
        username: socket.user.username,
        nickname: socket.user.nickname,
        profileImageUrl: socket.user.profileImageUrl,
      },
      timestamp: new Date(),
    });

    console.log(`User ${socket.user.username} joined room ${roomId}`);
  }

  /**
   * 룸 떠나기 처리
   */
  private leaveRoom(socket: AuthenticatedSocket, roomId: string) {
    socket.leave(roomId);

    if (this.rooms.has(roomId)) {
      const room = this.rooms.get(roomId)!;
      room.participants.delete(socket.userId);

      // 룸이 비어있으면 삭제
      if (room.participants.size === 0) {
        this.rooms.delete(roomId);
      }
    }

    // 룸의 다른 사용자들에게 떠남 알림
    socket.to(roomId).emit("user_left", {
      userId: socket.userId,
      timestamp: new Date(),
    });

    console.log(`User ${socket.user.username} left room ${roomId}`);
  }

  /**
   * 프로젝트 접근 권한 확인
   */
  private async checkProjectAccess(userId: string, projectId: string): Promise<boolean> {
    try {
      const access = await prisma.project.findFirst({
        where: {
          id: projectId,
          OR: [
            { creatorId: userId },
            { participants: { some: { userId } } },
          ],
        },
      });

      return !!access;
    } catch (error) {
      console.error("Project access check error:", error);
      return false;
    }
  }

  /**
   * 씬 접근 권한 확인
   */
  private async checkSceneAccess(userId: string, projectId: string, sceneId: string): Promise<boolean> {
    try {
      const access = await prisma.scene.findFirst({
        where: {
          id: sceneId,
          projectId,
          project: {
            OR: [
              { creatorId: userId },
              { participants: { some: { userId } } },
            ],
          },
        },
      });

      return !!access;
    } catch (error) {
      console.error("Scene access check error:", error);
      return false;
    }
  }

  /**
   * 정리 작업 시작
   */
  private startCleanupTasks() {
    // 5분마다 비활성 룸 정리
    setInterval(() => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      this.rooms.forEach((room, roomId) => {
        if (room.lastActivity < fiveMinutesAgo && room.participants.size === 0) {
          this.rooms.delete(roomId);
          console.log(`Cleaned up inactive room: ${roomId}`);
        }
      });
    }, 5 * 60 * 1000);

    // 10분마다 비활성 사용자 프레젠스 정리
    setInterval(() => {
      const now = new Date();
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

      this.userPresence.forEach((presence, userId) => {
        if (presence.lastActivity < tenMinutesAgo) {
          this.userPresence.delete(userId);
          console.log(`Cleaned up inactive presence for user: ${userId}`);
        }
      });
    }, 10 * 60 * 1000);
  }

  /**
   * 서버 통계 조회
   */
  public getServerStats() {
    return {
      connectedUsers: this.userPresence.size,
      activeRooms: this.rooms.size,
      totalConnections: this.io.engine.clientsCount,
      rooms: Array.from(this.rooms.entries()).map(([roomId, room]) => ({
        roomId,
        participants: room.participants.size,
        lastActivity: room.lastActivity,
      })),
    };
  }

  /**
   * Socket.IO 서버 인스턴스 반환
   */
  public getIO(): SocketIOServer {
    return this.io;
  }
}

// 전역 소켓 서버 인스턴스
let socketServer: SocketServer | null = null;

export function initializeSocketServer(httpServer: HTTPServer): SocketServer {
  if (!socketServer) {
    socketServer = new SocketServer(httpServer);
    console.log("Socket.io server initialized");
  }
  return socketServer;
}

export function getSocketServer(): SocketServer | null {
  return socketServer;
}

export default SocketServer;