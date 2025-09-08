import { AuthenticatedSocket } from "./auth";
import { Server as SocketIOServer } from "socket.io";
import { prisma } from "@/lib/prisma";

export interface RoomData {
  id: string;
  type: "project" | "scene" | "image";
  resourceId: string;
  projectId: string;
  sceneId?: string;
  imageId?: string;
  participants: Map<string, ParticipantData>;
  createdAt: Date;
  lastActivity: Date;
  metadata?: Record<string, any>;
}

export interface ParticipantData {
  userId: string;
  username: string;
  nickname: string;
  profileImageUrl?: string;
  joinedAt: Date;
  lastActivity: Date;
  role: "owner" | "admin" | "member";
  status: "active" | "idle" | "away";
  presence?: {
    cursorPosition?: { x: number; y: number };
    currentTool?: string;
    isTyping?: boolean;
    viewportPosition?: { x: number; y: number; zoom: number };
  };
}

export class RoomManager {
  private rooms: Map<string, RoomData> = new Map();
  private userRooms: Map<string, Set<string>> = new Map(); // userId -> Set<roomId>
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.startCleanupTasks();
  }

  /**
   * 프로젝트 룸 생성/참여
   */
  async joinProjectRoom(socket: AuthenticatedSocket, projectId: string): Promise<RoomData> {
    const roomId = this.generateRoomId("project", projectId);
    
    // 룸이 존재하지 않으면 생성
    if (!this.rooms.has(roomId)) {
      const roomData: RoomData = {
        id: roomId,
        type: "project",
        resourceId: projectId,
        projectId,
        participants: new Map(),
        createdAt: new Date(),
        lastActivity: new Date(),
      };
      this.rooms.set(roomId, roomData);
    }

    await this.addParticipantToRoom(socket, roomId);
    return this.rooms.get(roomId)!;
  }

  /**
   * 씬 룸 생성/참여
   */
  async joinSceneRoom(socket: AuthenticatedSocket, projectId: string, sceneId: string): Promise<RoomData> {
    const roomId = this.generateRoomId("scene", sceneId);
    
    if (!this.rooms.has(roomId)) {
      const roomData: RoomData = {
        id: roomId,
        type: "scene",
        resourceId: sceneId,
        projectId,
        sceneId,
        participants: new Map(),
        createdAt: new Date(),
        lastActivity: new Date(),
      };
      this.rooms.set(roomId, roomData);
    }

    await this.addParticipantToRoom(socket, roomId);
    return this.rooms.get(roomId)!;
  }

  /**
   * 이미지 룸 생성/참여
   */
  async joinImageRoom(socket: AuthenticatedSocket, projectId: string, sceneId: string, imageId: string): Promise<RoomData> {
    const roomId = this.generateRoomId("image", imageId);
    
    if (!this.rooms.has(roomId)) {
      const roomData: RoomData = {
        id: roomId,
        type: "image",
        resourceId: imageId,
        projectId,
        sceneId,
        imageId,
        participants: new Map(),
        createdAt: new Date(),
        lastActivity: new Date(),
      };
      this.rooms.set(roomId, roomData);
    }

    await this.addParticipantToRoom(socket, roomId);
    return this.rooms.get(roomId)!;
  }

  /**
   * 룸에 참여자 추가
   */
  private async addParticipantToRoom(socket: AuthenticatedSocket, roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Socket.io 룸에 참여
    await socket.join(roomId);

    // 사용자 권한 확인
    const role = await this.getUserRoleInRoom(socket.userId, room);

    // 참여자 데이터 생성
    const participantData: ParticipantData = {
      userId: socket.userId,
      username: socket.user.username,
      nickname: socket.user.nickname,
      profileImageUrl: socket.user.profileImageUrl,
      joinedAt: new Date(),
      lastActivity: new Date(),
      role,
      status: "active",
      presence: {},
    };

    // 룸에 참여자 추가
    room.participants.set(socket.userId, participantData);
    room.lastActivity = new Date();

    // 사용자 룸 목록 업데이트
    if (!this.userRooms.has(socket.userId)) {
      this.userRooms.set(socket.userId, new Set());
    }
    this.userRooms.get(socket.userId)!.add(roomId);

    // 다른 참여자들에게 참여 알림
    socket.to(roomId).emit("user_joined_room", {
      roomId,
      user: {
        userId: socket.userId,
        username: socket.user.username,
        nickname: socket.user.nickname,
        profileImageUrl: socket.user.profileImageUrl,
        role,
      },
      timestamp: new Date(),
    });

    // 참여자에게 룸 정보 전송
    socket.emit("room_joined", {
      roomId,
      roomType: room.type,
      resourceId: room.resourceId,
      participants: this.getParticipantList(room),
      timestamp: new Date(),
    });

    console.log(`User ${socket.user.username} joined room ${roomId}`);
  }

  /**
   * 룸에서 참여자 제거
   */
  async removeParticipantFromRoom(socket: AuthenticatedSocket, roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Socket.io 룸에서 나가기
    await socket.leave(roomId);

    // 참여자 제거
    room.participants.delete(socket.userId);
    room.lastActivity = new Date();

    // 사용자 룸 목록에서 제거
    if (this.userRooms.has(socket.userId)) {
      this.userRooms.get(socket.userId)!.delete(roomId);
      if (this.userRooms.get(socket.userId)!.size === 0) {
        this.userRooms.delete(socket.userId);
      }
    }

    // 다른 참여자들에게 떠남 알림
    socket.to(roomId).emit("user_left_room", {
      roomId,
      userId: socket.userId,
      timestamp: new Date(),
    });

    // 룸이 비어있으면 삭제
    if (room.participants.size === 0) {
      this.rooms.delete(roomId);
      console.log(`Room ${roomId} deleted (empty)`);
    }

    console.log(`User ${socket.user.username} left room ${roomId}`);
  }

  /**
   * 사용자의 모든 룸에서 제거
   */
  async removeUserFromAllRooms(socket: AuthenticatedSocket): Promise<void> {
    const userRooms = this.userRooms.get(socket.userId);
    if (!userRooms) return;

    const roomIds = Array.from(userRooms);
    for (const roomId of roomIds) {
      await this.removeParticipantFromRoom(socket, roomId);
    }
  }

  /**
   * 참여자 상태 업데이트
   */
  updateParticipantStatus(
    userId: string, 
    roomId: string, 
    status: "active" | "idle" | "away"
  ): void {
    const room = this.rooms.get(roomId);
    if (!room || !room.participants.has(userId)) return;

    const participant = room.participants.get(userId)!;
    participant.status = status;
    participant.lastActivity = new Date();
    room.lastActivity = new Date();

    // 룸 참여자들에게 상태 변경 알림
    this.io.to(roomId).emit("participant_status_changed", {
      roomId,
      userId,
      status,
      timestamp: new Date(),
    });
  }

  /**
   * 참여자 프레젠스 업데이트
   */
  updateParticipantPresence(
    userId: string,
    roomId: string,
    presence: Partial<ParticipantData["presence"]>
  ): void {
    const room = this.rooms.get(roomId);
    if (!room || !room.participants.has(userId)) return;

    const participant = room.participants.get(userId)!;
    participant.presence = { ...participant.presence, ...presence };
    participant.lastActivity = new Date();
    room.lastActivity = new Date();

    // 다른 참여자들에게 프레젠스 변경 알림
    this.io.to(roomId).except(userId).emit("participant_presence_updated", {
      roomId,
      userId,
      presence: participant.presence,
      timestamp: new Date(),
    });
  }

  /**
   * 룸 정보 조회
   */
  getRoomInfo(roomId: string): RoomData | null {
    return this.rooms.get(roomId) || null;
  }

  /**
   * 사용자가 참여 중인 룸 목록 조회
   */
  getUserRooms(userId: string): string[] {
    return Array.from(this.userRooms.get(userId) || []);
  }

  /**
   * 룸의 참여자 목록 조회
   */
  getRoomParticipants(roomId: string): ParticipantData[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    return this.getParticipantList(room);
  }

  /**
   * 특정 타입의 모든 룸 조회
   */
  getRoomsByType(type: "project" | "scene" | "image"): RoomData[] {
    return Array.from(this.rooms.values()).filter(room => room.type === type);
  }

  /**
   * 프로젝트의 모든 룸 조회
   */
  getProjectRooms(projectId: string): RoomData[] {
    return Array.from(this.rooms.values()).filter(room => room.projectId === projectId);
  }

  /**
   * 룸 통계 조회
   */
  getRoomStats(): {
    totalRooms: number;
    totalParticipants: number;
    roomsByType: Record<string, number>;
    averageParticipants: number;
  } {
    const totalRooms = this.rooms.size;
    const totalParticipants = Array.from(this.rooms.values())
      .reduce((sum, room) => sum + room.participants.size, 0);
    
    const roomsByType = Array.from(this.rooms.values()).reduce((acc, room) => {
      acc[room.type] = (acc[room.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRooms,
      totalParticipants,
      roomsByType,
      averageParticipants: totalRooms > 0 ? totalParticipants / totalRooms : 0,
    };
  }

  /**
   * 룸에 메시지 브로드캐스트
   */
  broadcastToRoom(roomId: string, event: string, data: any, excludeUserId?: string): void {
    if (excludeUserId) {
      this.io.to(roomId).except(excludeUserId).emit(event, data);
    } else {
      this.io.to(roomId).emit(event, data);
    }
  }

  /**
   * 프로젝트의 모든 룸에 브로드캐스트
   */
  broadcastToProject(projectId: string, event: string, data: any, excludeUserId?: string): void {
    const projectRooms = this.getProjectRooms(projectId);
    projectRooms.forEach(room => {
      this.broadcastToRoom(room.id, event, data, excludeUserId);
    });
  }

  /**
   * 사용자 권한 확인
   */
  private async getUserRoleInRoom(userId: string, room: RoomData): Promise<"owner" | "admin" | "member"> {
    try {
      // 프로젝트에서 사용자 역할 확인
      const participation = await prisma.projectParticipant.findUnique({
        where: {
          projectId_userId: {
            projectId: room.projectId,
            userId,
          },
        },
        include: {
          project: true,
        },
      });

      if (participation?.project.creatorId === userId) {
        return "owner";
      }

      if (participation?.role === "admin") {
        return "admin";
      }

      return "member";
    } catch (error) {
      console.error("Error getting user role in room:", error);
      return "member";
    }
  }

  /**
   * 룸 ID 생성
   */
  private generateRoomId(type: string, resourceId: string): string {
    return `${type}:${resourceId}`;
  }

  /**
   * 참여자 목록 변환
   */
  private getParticipantList(room: RoomData): ParticipantData[] {
    return Array.from(room.participants.values()).sort((a, b) => {
      // 역할 순서: owner > admin > member
      const roleOrder = { owner: 3, admin: 2, member: 1 };
      const roleComparison = roleOrder[b.role] - roleOrder[a.role];
      if (roleComparison !== 0) return roleComparison;

      // 참여 시간 순서
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });
  }

  /**
   * 정리 작업 시작
   */
  private startCleanupTasks(): void {
    // 5분마다 비활성 룸 정리
    setInterval(() => {
      this.cleanupInactiveRooms();
    }, 5 * 60 * 1000);

    // 1분마다 비활성 참여자 정리
    setInterval(() => {
      this.cleanupInactiveParticipants();
    }, 60 * 1000);
  }

  /**
   * 비활성 룸 정리
   */
  private cleanupInactiveRooms(): void {
    const now = new Date();
    const inactiveThreshold = 30 * 60 * 1000; // 30분

    this.rooms.forEach((room, roomId) => {
      // 참여자가 없거나 오랜 시간 비활성 상태인 룸 삭제
      if (room.participants.size === 0 || 
          (now.getTime() - room.lastActivity.getTime() > inactiveThreshold)) {
        this.rooms.delete(roomId);
        console.log(`Cleaned up inactive room: ${roomId}`);
      }
    });
  }

  /**
   * 비활성 참여자 정리
   */
  private cleanupInactiveParticipants(): void {
    const now = new Date();
    const inactiveThreshold = 15 * 60 * 1000; // 15분

    this.rooms.forEach((room, roomId) => {
      const inactiveParticipants: string[] = [];

      room.participants.forEach((participant, userId) => {
        if (now.getTime() - participant.lastActivity.getTime() > inactiveThreshold) {
          inactiveParticipants.push(userId);
        }
      });

      // 비활성 참여자 제거
      inactiveParticipants.forEach(userId => {
        room.participants.delete(userId);
        
        // 사용자 룸 목록에서도 제거
        if (this.userRooms.has(userId)) {
          this.userRooms.get(userId)!.delete(roomId);
          if (this.userRooms.get(userId)!.size === 0) {
            this.userRooms.delete(userId);
          }
        }

        // 다른 참여자들에게 알림
        this.io.to(roomId).emit("participant_inactive_removed", {
          roomId,
          userId,
          timestamp: new Date(),
        });

        console.log(`Removed inactive participant ${userId} from room ${roomId}`);
      });

      // 룸 업데이트
      if (inactiveParticipants.length > 0) {
        room.lastActivity = new Date();
      }
    });
  }

  /**
   * 메모리 사용량 모니터링
   */
  getMemoryUsage(): {
    rooms: number;
    participants: number;
    userRoomMappings: number;
  } {
    const totalParticipants = Array.from(this.rooms.values())
      .reduce((sum, room) => sum + room.participants.size, 0);

    const totalUserRoomMappings = Array.from(this.userRooms.values())
      .reduce((sum, rooms) => sum + rooms.size, 0);

    return {
      rooms: this.rooms.size,
      participants: totalParticipants,
      userRoomMappings: totalUserRoomMappings,
    };
  }
}

export default RoomManager;