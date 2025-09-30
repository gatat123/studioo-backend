import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { prisma } from "@/lib/prisma";
import { verifyJWT } from "@/lib/utils/jwt";
import { CollaborationService } from "@/lib/services/collaboration";
import { NotificationService } from "@/lib/services/notification";
import { setupWorkTaskHandlers } from "./work-task-handlers";
import { setGlobalSocketInstance, setGlobalSocketServer, getGlobalSocketInstance, getGlobalSocketServer } from "./global-socket";

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
  private readonly io: SocketIOServer;
  private readonly httpServer: HTTPServer;
  private rooms: Map<string, RoomData> = new Map();
  private userPresence: Map<string, UserPresence> = new Map();
  private activeConnections: Map<string, Set<string>> = new Map(); // userId -> Set<socketId>

  constructor(httpServer: HTTPServer) {
    this.httpServer = httpServer;

    // Configure CORS origins based on environment
    const corsOrigins = process.env.NODE_ENV === 'production'
      ? [
          "https://studioo-production-eb03.up.railway.app",
          "https://studioo-fix-production.up.railway.app",
          process.env.CORS_ORIGIN
        ].filter((origin): origin is string => Boolean(origin))
      : ["http://localhost:3000", "http://localhost:3001"];

    console.log("[Socket Server] Initializing with CORS origins:", corsOrigins);

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: corsOrigins,
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
        (socket as AuthenticatedSocket).user = {
          ...user,
          profileImageUrl: user.profileImageUrl || undefined,
        };

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
    this.io.on("connection", (socket: Socket) => {
      // 타입 가드로 인증된 소켓인지 확인
      if (!this.isAuthenticatedSocket(socket)) {
        console.log(`Unauthenticated socket connected: ${socket.id}`);
        socket.disconnect();
        return;
      }
      
      const authSocket = socket as AuthenticatedSocket;
      console.log(`User ${authSocket.user.username} connected with socket ${authSocket.id}`);

      // 사용자 연결 관리
      this.handleUserConnection(authSocket);

      // 기본 이벤트 핸들러
      this.setupBasicEventHandlers(authSocket);

      // 룸 관리 이벤트 핸들러
      this.setupRoomEventHandlers(authSocket);

      // 프레젠스 이벤트 핸들러
      this.setupPresenceEventHandlers(authSocket);

      // 실시간 협업 이벤트 핸들러
      this.setupCollaborationEventHandlers(authSocket);

      // 댓글 실시간 이벤트 핸들러
      this.setupCommentEventHandlers(authSocket);

      // 주석 실시간 이벤트 핸들러
      this.setupAnnotationEventHandlers(authSocket);

      // 씬 실시간 이벤트 핸들러
      this.setupSceneEventHandlers(authSocket);

      // 이미지 실시간 이벤트 핸들러
      this.setupImageEventHandlers(authSocket);

      // 친구 실시간 이벤트 핸들러
      this.setupFriendEventHandlers(authSocket);

      // 메시지 실시간 이벤트 핸들러
      this.setupMessageEventHandlers(authSocket);

      // 채널 실시간 이벤트 핸들러
      this.setupChannelEventHandlers(authSocket);

      // Work Task 실시간 이벤트 핸들러
      setupWorkTaskHandlers(authSocket, this.io);

      // 연결 해제 처리
      socket.on("disconnect", (reason) => {
        this.handleUserDisconnection(authSocket, reason);
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

    // 사용자의 개인 룸에 참여 (실시간 알림용)
    const userRoom = `user:${userId}`;
    socket.join(userRoom);
    console.log(`User ${socket.user.username} joined personal room: ${userRoom}`);

    // 전역 공지사항 룸에 참여
    socket.join('global');
    console.log(`User ${socket.user.username} joined global room for announcements`);

    // 사용자 프레젠스 업데이트
    this.userPresence.set(userId, {
      userId: socket.userId,
      username: socket.user.username,
      nickname: socket.user.nickname,
      profileImageUrl: socket.user.profileImageUrl,
      status: "active",
      currentRoom: userRoom,
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
        // 모든 연결이 끊어진 경우에만 오프라인 상태로 알림
        this.activeConnections.delete(userId);
        this.userPresence.delete(userId);
        
        // 친구들에게 오프라인 상태 알림
        this.notifyFriendsOfPresence(socket, 'offline');
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

        console.log(`[SocketServer] 🚪 User ${socket.user.username} attempting to join scene: ${sceneId}`);

        // 프로젝트 및 씬 접근 권한 확인
        const hasAccess = await this.checkSceneAccess(socket.userId, projectId, sceneId);
        if (!hasAccess) {
          console.error(`[SocketServer] ❌ Access denied for user ${socket.user.username} to scene ${sceneId}`);
          socket.emit("error", {
            type: "access_denied",
            message: "씬 접근 권한이 없습니다.",
          });
          return;
        }

        const roomId = `scene:${sceneId}`;
        console.log(`[SocketServer] 📍 Room ID: ${roomId}`);

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

        console.log(`[SocketServer] ✅ User ${socket.user.username} successfully joined scene room ${roomId}`);
        console.log(`[SocketServer] 👥 Active users in room: ${activeUsers.length}`);

        socket.emit("scene_joined", {
          projectId,
          sceneId,
          roomId,
          activeUsers,
          timestamp: new Date(),
        });

      } catch (error) {
        console.error("[SocketServer] ❌ Join scene error:", error);
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
   * 씬 실시간 이벤트 핸들러 설정
   */
  private setupSceneEventHandlers(socket: AuthenticatedSocket) {
    // 씬 생성 이벤트
    socket.on("scene_created", (data: {
      projectId: string;
      scene: any;
    }) => {
      const projectRoomId = `project:${data.projectId}`;
      
      // 프로젝트 룸의 모든 사용자에게 브로드캐스트
      socket.to(projectRoomId).emit("new_scene", {
        scene: data.scene,
        user: {
          id: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      });
      
      console.log(`Scene created by ${socket.user.username} in project ${data.projectId}`);
    });

    // 씬 업데이트 이벤트
    socket.on("scene_updated", (data: {
      projectId: string;
      sceneId: string;
      changes: any;
    }) => {
      const projectRoomId = `project:${data.projectId}`;
      
      socket.to(projectRoomId).emit("scene_updated", {
        sceneId: data.sceneId,
        changes: data.changes,
        updatedBy: socket.userId,
        timestamp: new Date(),
      });
    });

    // 씬 삭제 이벤트
    socket.on("scene_deleted", (data: {
      projectId: string;
      sceneId: string;
    }) => {
      const projectRoomId = `project:${data.projectId}`;
      
      socket.to(projectRoomId).emit("scene_deleted", {
        sceneId: data.sceneId,
        deletedBy: socket.userId,
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
      projectId: string;
      imageId: string;
      sceneId: string;
      filename: string;
      type: string;
    }) => {
      // 프로젝트 룸으로 방송하여 모든 프로젝트 참여자가 받을 수 있도록
      const projectRoomId = `project:${data.projectId}`;
      socket.to(projectRoomId).emit("new_image", {
        imageId: data.imageId,
        sceneId: data.sceneId,
        filename: data.filename,
        type: data.type,
        uploader: {
          id: socket.userId,
          username: socket.user.username,
          nickname: socket.user.nickname,
        },
        timestamp: new Date(),
      });
      
      console.log(`Image uploaded by ${socket.user.username} in project ${data.projectId}, scene ${data.sceneId}`);
    });
  }

  /**
   * 친구 실시간 이벤트 핸들러 설정
   */
  private setupFriendEventHandlers(socket: AuthenticatedSocket) {
    // 친구 요청 보내기 알림
    socket.on("friend_request_sent", async (data: {
      receiverId: string;
      message?: string;
    }) => {
      try {
        // 받는 사람이 온라인인지 확인
        const receiverSockets = this.activeConnections.get(data.receiverId);
        if (receiverSockets && receiverSockets.size > 0) {
          // 받는 사람의 모든 소켓에 알림 전송
          receiverSockets.forEach((socketId) => {
            this.io.to(socketId).emit("friend_request_received", {
              sender: {
                id: socket.userId,
                username: socket.user.username,
                nickname: socket.user.nickname,
                profileImageUrl: socket.user.profileImageUrl,
              },
              message: data.message,
              timestamp: new Date(),
            });
          });
        }
      } catch (error) {
        console.error("Friend request notification error:", error);
      }
    });

    // 친구 요청 수락 알림
    socket.on("friend_request_accepted", (data: {
      senderId: string;
      requestId: string;
    }) => {
      const senderSockets = this.activeConnections.get(data.senderId);
      if (senderSockets && senderSockets.size > 0) {
        senderSockets.forEach((socketId) => {
          this.io.to(socketId).emit("friend_request_accepted", {
            acceptedBy: {
              id: socket.userId,
              username: socket.user.username,
              nickname: socket.user.nickname,
              profileImageUrl: socket.user.profileImageUrl,
            },
            requestId: data.requestId,
            timestamp: new Date(),
          });
        });
      }
    });

    // 친구 삭제 알림
    socket.on("friend_removed", (data: {
      friendId: string;
    }) => {
      const friendSockets = this.activeConnections.get(data.friendId);
      if (friendSockets && friendSockets.size > 0) {
        friendSockets.forEach((socketId) => {
          this.io.to(socketId).emit("friend_removed", {
            removedBy: socket.userId,
            timestamp: new Date(),
          });
        });
      }
    });

    // 친구 온라인 상태 변경
    socket.on("request_friend_status", async (data: {
      friendIds: string[];
    }) => {
      try {
        const onlineFriends = data.friendIds.filter(friendId => 
          this.activeConnections.has(friendId)
        );

        socket.emit("friend_status_update", {
          onlineFriends,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error("Friend status check error:", error);
      }
    });

    // 친구 프레젠스 업데이트 (사용자가 로그인했을 때)
    this.notifyFriendsOfPresence(socket, 'online');
  }

  /**
   * 메시지 실시간 이벤트 핸들러 설정
   */
  private setupMessageEventHandlers(socket: AuthenticatedSocket) {
    // 메시지 전송
    socket.on("send_message", async (data: {
      receiverId: string;
      content: string;
      tempId?: string;
    }) => {
      try {
        // 친구 관계 확인
        const friendship = await prisma.friendship.findFirst({
          where: {
            OR: [
              { user1Id: socket.userId, user2Id: data.receiverId },
              { user1Id: data.receiverId, user2Id: socket.userId }
            ]
          }
        });

        if (!friendship) {
          socket.emit("message_error", {
            error: "Not friends with this user",
            tempId: data.tempId
          });
          return;
        }

        // 메시지 생성
        const message = await prisma.message.create({
          data: {
            senderId: socket.userId,
            receiverId: data.receiverId,
            content: data.content
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true
              }
            },
            receiver: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true
              }
            }
          }
        });

        // 보낸 사람에게 확인
        socket.emit("message_sent", {
          message,
          tempId: data.tempId
        });

        // 받는 사람이 온라인이면 실시간으로 전송
        const receiverSockets = this.activeConnections.get(data.receiverId);
        if (receiverSockets && receiverSockets.size > 0) {
          receiverSockets.forEach((socketId) => {
            this.io.to(socketId).emit("new_message", {
              message,
              timestamp: new Date()
            });
          });
        }
      } catch (error) {
        console.error("Message send error:", error);
        socket.emit("message_error", {
          error: "Failed to send message",
          tempId: data.tempId
        });
      }
    });

    // 메시지 읽음 처리
    socket.on("mark_messages_read", async (data: {
      messageIds: string[];
      senderId: string;
    }) => {
      try {
        await prisma.message.updateMany({
          where: {
            id: { in: data.messageIds },
            senderId: data.senderId,
            receiverId: socket.userId,
            isRead: false
          },
          data: {
            isRead: true,
            readAt: new Date()
          }
        });

        // 보낸 사람에게 읽음 알림
        const senderSockets = this.activeConnections.get(data.senderId);
        if (senderSockets && senderSockets.size > 0) {
          senderSockets.forEach((socketId) => {
            this.io.to(socketId).emit("messages_read", {
              messageIds: data.messageIds,
              readBy: socket.userId,
              timestamp: new Date()
            });
          });
        }
      } catch (error) {
        console.error("Mark messages read error:", error);
      }
    });

    // 타이핑 시작
    socket.on("typing_start_chat", (data: {
      receiverId: string;
    }) => {
      const receiverSockets = this.activeConnections.get(data.receiverId);
      if (receiverSockets && receiverSockets.size > 0) {
        receiverSockets.forEach((socketId) => {
          this.io.to(socketId).emit("user_typing_chat", {
            userId: socket.userId,
            user: {
              username: socket.user.username,
              nickname: socket.user.nickname,
              profileImageUrl: socket.user.profileImageUrl
            },
            timestamp: new Date()
          });
        });
      }
    });

    // 타이핑 중지
    socket.on("typing_stop_chat", (data: {
      receiverId: string;
    }) => {
      const receiverSockets = this.activeConnections.get(data.receiverId);
      if (receiverSockets && receiverSockets.size > 0) {
        receiverSockets.forEach((socketId) => {
          this.io.to(socketId).emit("user_stopped_typing_chat", {
            userId: socket.userId,
            timestamp: new Date()
          });
        });
      }
    });

    // 메시지 내역 요청
    socket.on("request_message_history", async (data: {
      friendId: string;
      limit?: number;
      offset?: number;
    }) => {
      try {
        // 친구 관계 확인
        const friendship = await prisma.friendship.findFirst({
          where: {
            OR: [
              { user1Id: socket.userId, user2Id: data.friendId },
              { user1Id: data.friendId, user2Id: socket.userId }
            ]
          }
        });

        if (!friendship) {
          socket.emit("message_history_error", {
            error: "Not friends with this user"
          });
          return;
        }

        // 메시지 조회
        const messages = await prisma.message.findMany({
          where: {
            OR: [
              { senderId: socket.userId, receiverId: data.friendId },
              { senderId: data.friendId, receiverId: socket.userId }
            ]
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true
              }
            },
            receiver: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: data.limit || 50,
          skip: data.offset || 0
        });

        // 읽지 않은 메시지 읽음 처리
        await prisma.message.updateMany({
          where: {
            senderId: data.friendId,
            receiverId: socket.userId,
            isRead: false
          },
          data: {
            isRead: true,
            readAt: new Date()
          }
        });

        socket.emit("message_history", {
          friendId: data.friendId,
          messages: messages.reverse(),
          timestamp: new Date()
        });
      } catch (error) {
        console.error("Message history error:", error);
        socket.emit("message_history_error", {
          error: "Failed to fetch message history"
        });
      }
    });
  }

  /**
   * 채널 실시간 이벤트 핸들러 설정
   */
  private setupChannelEventHandlers(socket: AuthenticatedSocket) {
    // 채널 참여
    socket.on("join_channel", async (data: { channelId: string }) => {
      try {
        // 채널 멤버십 확인
        const membership = await prisma.channelMember.findUnique({
          where: {
            channelId_userId: {
              channelId: data.channelId,
              userId: socket.userId
            }
          }
        });

        if (!membership) {
          socket.emit("error", {
            type: "channel_access_denied",
            message: "채널 접근 권한이 없습니다."
          });
          return;
        }

        const roomId = `channel:${data.channelId}`;
        await socket.join(roomId);

        // 채널의 현재 활성 사용자들 전송
        const activeUsers = Array.from(this.io.sockets.adapter.rooms.get(roomId) || [])
          .map((socketId) => {
            const otherSocket = this.io.sockets.sockets.get(socketId) as AuthenticatedSocket;
            return otherSocket ? {
              userId: otherSocket.userId,
              user: {
                username: otherSocket.user.username,
                nickname: otherSocket.user.nickname,
                profileImageUrl: otherSocket.user.profileImageUrl,
              }
            } : null;
          })
          .filter(Boolean);

        socket.emit("channel_joined", {
          channelId: data.channelId,
          activeUsers,
          timestamp: new Date()
        });

        // 다른 멤버들에게 입장 알림
        socket.to(roomId).emit("member_joined_channel", {
          userId: socket.userId,
          user: {
            username: socket.user.username,
            nickname: socket.user.nickname,
            profileImageUrl: socket.user.profileImageUrl
          },
          timestamp: new Date()
        });
      } catch (error) {
        console.error("Join channel error:", error);
        socket.emit("error", {
          type: "join_channel_failed",
          message: "채널 참여 중 오류가 발생했습니다."
        });
      }
    });

    // 채널 나가기
    socket.on("leave_channel", (data: { channelId: string }) => {
      const roomId = `channel:${data.channelId}`;
      socket.leave(roomId);

      socket.to(roomId).emit("member_left_channel", {
        userId: socket.userId,
        timestamp: new Date()
      });
    });

    // 채널 메시지 전송
    socket.on("send_channel_message", async (data: {
      channelId: string;
      content: string;
      type?: string;
      metadata?: any;
      tempId?: string;
    }) => {
      try {
        // 채널 멤버십 확인
        const membership = await prisma.channelMember.findUnique({
          where: {
            channelId_userId: {
              channelId: data.channelId,
              userId: socket.userId
            }
          }
        });

        if (!membership) {
          socket.emit("channel_message_error", {
            error: "Not a member of this channel",
            tempId: data.tempId
          });
          return;
        }

        // 메시지 생성
        const message = await prisma.channelMessage.create({
          data: {
            channelId: data.channelId,
            senderId: socket.userId,
            content: data.content,
            type: data.type || 'text',
            metadata: data.metadata
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true
              }
            },
            files: true
          }
        });

        // 채널 업데이트 시간 갱신
        await prisma.channel.update({
          where: { id: data.channelId },
          data: { updatedAt: new Date() }
        });

        // 보낸 사람에게 확인
        socket.emit("channel_message_sent", {
          message,
          tempId: data.tempId
        });

        // 채널의 다른 멤버들에게 브로드캐스트
        const roomId = `channel:${data.channelId}`;
        socket.to(roomId).emit("new_channel_message", {
          message,
          timestamp: new Date()
        });
      } catch (error) {
        console.error("Channel message send error:", error);
        socket.emit("channel_message_error", {
          error: "Failed to send message",
          tempId: data.tempId
        });
      }
    });

    // 채널 타이핑 시작
    socket.on("typing_start_channel", (data: {
      channelId: string;
    }) => {
      const roomId = `channel:${data.channelId}`;
      socket.to(roomId).emit("user_typing_channel", {
        userId: socket.userId,
        user: {
          username: socket.user.username,
          nickname: socket.user.nickname,
          profileImageUrl: socket.user.profileImageUrl
        },
        timestamp: new Date()
      });
    });

    // 채널 타이핑 중지
    socket.on("typing_stop_channel", (data: {
      channelId: string;
    }) => {
      const roomId = `channel:${data.channelId}`;
      socket.to(roomId).emit("user_stopped_typing_channel", {
        userId: socket.userId,
        timestamp: new Date()
      });
    });

    // 채널 메시지 내역 요청
    socket.on("request_channel_history", async (data: {
      channelId: string;
      limit?: number;
      cursor?: string;
    }) => {
      try {
        // 채널 멤버십 확인
        const membership = await prisma.channelMember.findUnique({
          where: {
            channelId_userId: {
              channelId: data.channelId,
              userId: socket.userId
            }
          }
        });

        if (!membership) {
          socket.emit("channel_history_error", {
            error: "Not a member of this channel"
          });
          return;
        }

        // 메시지 조회
        const messages = await prisma.channelMessage.findMany({
          where: {
            channelId: data.channelId,
            deletedAt: null,
            ...(data.cursor ? { createdAt: { lt: new Date(data.cursor) } } : {})
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true
              }
            },
            files: true
          },
          orderBy: { createdAt: 'desc' },
          take: data.limit || 50
        });

        // 마지막 읽은 시간 업데이트
        await prisma.channelMember.update({
          where: {
            channelId_userId: {
              channelId: data.channelId,
              userId: socket.userId
            }
          },
          data: {
            lastReadAt: new Date()
          }
        });

        socket.emit("channel_history", {
          channelId: data.channelId,
          messages: messages.reverse(),
          hasMore: messages.length === (data.limit || 50),
          nextCursor: messages.length > 0 ? messages[0].createdAt.toISOString() : null,
          timestamp: new Date()
        });
      } catch (error) {
        console.error("Channel history error:", error);
        socket.emit("channel_history_error", {
          error: "Failed to fetch channel history"
        });
      }
    });

    // 파일 업로드 진행률
    socket.on("file_upload_progress", (data: {
      channelId: string;
      fileName: string;
      progress: number;
      tempId: string;
    }) => {
      const roomId = `channel:${data.channelId}`;
      socket.to(roomId).emit("file_upload_progress", {
        userId: socket.userId,
        fileName: data.fileName,
        progress: data.progress,
        tempId: data.tempId,
        timestamp: new Date()
      });
    });

    // 채널 초대 전송
    socket.on("send_channel_invite", async (data: {
      channelId: string;
      inviteeId: string;
    }) => {
      try {
        // 채널 멤버십 확인 (초대하는 사람이 채널 멤버인지)
        const membership = await prisma.channelMember.findUnique({
          where: {
            channelId_userId: {
              channelId: data.channelId,
              userId: socket.userId
            }
          }
        });

        if (!membership) {
          socket.emit("channel_invite_error", {
            error: "Not a member of this channel"
          });
          return;
        }

        // 이미 멤버인지 확인
        const existingMember = await prisma.channelMember.findUnique({
          where: {
            channelId_userId: {
              channelId: data.channelId,
              userId: data.inviteeId
            }
          }
        });

        if (existingMember) {
          socket.emit("channel_invite_error", {
            error: "User is already a member"
          });
          return;
        }

        // 이미 초대가 있는지 확인
        const existingInvite = await prisma.channelInvite.findFirst({
          where: {
            channelId: data.channelId,
            inviteeId: data.inviteeId,
            status: 'pending'
          }
        });

        if (existingInvite) {
          socket.emit("channel_invite_error", {
            error: "Invite already sent"
          });
          return;
        }

        // 채널 정보 조회
        const channel = await prisma.channel.findUnique({
          where: { id: data.channelId },
          select: {
            id: true,
            name: true,
            description: true
          }
        });

        // 초대 생성
        const invite = await prisma.channelInvite.create({
          data: {
            channelId: data.channelId,
            inviterId: socket.userId,
            inviteeId: data.inviteeId,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
          },
          include: {
            channel: {
              select: {
                id: true,
                name: true,
                description: true
              }
            },
            inviter: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true
              }
            },
            invitee: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true
              }
            }
          }
        });

        // 초대 전송 확인
        socket.emit("channel_invite_sent", {
          invite,
          timestamp: new Date()
        });

        // 초대받는 사람에게 실시간 알림
        const inviteeSockets = this.activeConnections.get(data.inviteeId);
        if (inviteeSockets && inviteeSockets.size > 0) {
          inviteeSockets.forEach((socketId) => {
            this.io.to(socketId).emit("channel_invite_received", {
              invite,
              timestamp: new Date()
            });
          });
        }

        // 알림 생성
        await prisma.notification.create({
          data: {
            userId: data.inviteeId,
            type: 'channel_invite',
            title: '채널 초대',
            content: `${socket.user.nickname}님이 ${channel?.name} 채널에 초대했습니다`
          }
        });
      } catch (error) {
        console.error("Channel invite error:", error);
        socket.emit("channel_invite_error", {
          error: "Failed to send invite"
        });
      }
    });

    // 채널 초대 수락
    socket.on("accept_channel_invite", async (data: {
      inviteId: string;
    }) => {
      try {
        // 초대 조회
        const invite = await prisma.channelInvite.findUnique({
          where: { id: data.inviteId },
          include: {
            channel: true,
            inviter: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true
              }
            }
          }
        });

        if (!invite || invite.inviteeId !== socket.userId) {
          socket.emit("channel_invite_error", {
            error: "Invalid invite"
          });
          return;
        }

        if (invite.status !== 'pending') {
          socket.emit("channel_invite_error", {
            error: "Invite already processed"
          });
          return;
        }

        // 채널 멤버 추가
        await prisma.channelMember.create({
          data: {
            channelId: invite.channelId,
            userId: socket.userId,
            role: 'member'
          }
        });

        // 초대 상태 업데이트
        await prisma.channelInvite.update({
          where: { id: data.inviteId },
          data: {
            status: 'accepted',
            acceptedAt: new Date()
          }
        });

        // 수락 확인
        socket.emit("channel_invite_accepted", {
          channelId: invite.channelId,
          channel: invite.channel,
          timestamp: new Date()
        });

        // 채널 멤버들에게 알림
        const roomId = `channel:${invite.channelId}`;
        this.io.to(roomId).emit("member_joined_channel", {
          userId: socket.userId,
          user: socket.user,
          timestamp: new Date()
        });

        // 초대한 사람에게 알림
        const inviterSockets = this.activeConnections.get(invite.inviterId);
        if (inviterSockets && inviterSockets.size > 0) {
          inviterSockets.forEach((socketId) => {
            this.io.to(socketId).emit("channel_invite_accepted_notification", {
              acceptedBy: socket.user,
              channel: invite.channel,
              timestamp: new Date()
            });
          });
        }
      } catch (error) {
        console.error("Accept channel invite error:", error);
        socket.emit("channel_invite_error", {
          error: "Failed to accept invite"
        });
      }
    });
  }

  /**
   * 친구들에게 사용자의 현재 상태 알림
   */
  private async notifyFriendsOfPresence(socket: AuthenticatedSocket, status: 'online' | 'offline') {
    try {
      // 사용자의 친구 목록 조회
      const friendships = await prisma.friendship.findMany({
        where: {
          OR: [
            { user1Id: socket.userId },
            { user2Id: socket.userId }
          ]
        },
        select: {
          user1Id: true,
          user2Id: true,
        }
      });

      // 친구 ID 목록 추출
      const friendIds = friendships.map(friendship => 
        friendship.user1Id === socket.userId ? friendship.user2Id : friendship.user1Id
      );

      // 온라인 친구들에게 상태 알림
      friendIds.forEach(friendId => {
        const friendSockets = this.activeConnections.get(friendId);
        if (friendSockets && friendSockets.size > 0) {
          friendSockets.forEach((socketId) => {
            this.io.to(socketId).emit("friend_presence_update", {
              userId: socket.userId,
              user: {
                username: socket.user.username,
                nickname: socket.user.nickname,
                profileImageUrl: socket.user.profileImageUrl,
              },
              status,
              timestamp: new Date(),
            });
          });
        }
      });
    } catch (error) {
      console.error("Friend presence notification error:", error);
    }
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
   * 인증된 소켓인지 확인하는 타입 가드
   */
  private isAuthenticatedSocket(socket: Socket): socket is AuthenticatedSocket {
    return 'userId' in socket && 'user' in socket;
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
  // Check for existing global instance first
  const existingServer = getGlobalSocketServer();
  if (existingServer) {
    console.log("Socket.io server already initialized (global)");
    socketServer = existingServer;
    return existingServer;
  }

  if (!socketServer) {
    socketServer = new SocketServer(httpServer);
    setGlobalSocketServer(socketServer);
    setGlobalSocketInstance(socketServer.getIO());
    console.log("Socket.io server initialized and registered globally");
  }
  return socketServer;
}

export function getSocketServer(): SocketServer | null {
  return socketServer;
}

export function getSocketInstance(): SocketIOServer | null {
  // Try to get from global first (for Next.js API routes)
  const globalInstance = getGlobalSocketInstance();
  if (globalInstance) {
    return globalInstance;
  }

  // Fallback to local instance
  return socketServer ? socketServer.getIO() : null;
}

export default SocketServer;