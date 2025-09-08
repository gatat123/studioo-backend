import { Socket } from "socket.io";
import { prisma } from "@/lib/prisma";
import { verifyJWT } from "@/lib/utils/jwt";
import jwt from "jsonwebtoken";

export interface SocketUser {
  id: string;
  username: string;
  nickname: string;
  profileImageUrl?: string;
  isAdmin: boolean;
  studios?: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

export interface AuthenticatedSocket extends Socket {
  userId: string;
  user: SocketUser;
  sessionId: string;
}

/**
 * Socket.io 인증 미들웨어
 */
export async function authenticateSocket(socket: Socket, next: (err?: Error) => void) {
  try {
    const token = extractToken(socket);
    
    if (!token) {
      return next(new Error("Authentication token required"));
    }

    const user = await validateToken(token);
    
    if (!user) {
      return next(new Error("Invalid or expired token"));
    }

    // 소켓에 사용자 정보 추가
    (socket as AuthenticatedSocket).userId = user.id;
    (socket as AuthenticatedSocket).user = user;
    (socket as AuthenticatedSocket).sessionId = generateSessionId();

    // 연결 로깅
    console.log(`Socket authenticated: ${user.username} (${user.id}) from ${socket.handshake.address}`);
    
    next();
  } catch (error) {
    console.error("Socket authentication error:", error);
    next(new Error("Authentication failed"));
  }
}

/**
 * 토큰 추출
 */
function extractToken(socket: Socket): string | null {
  // Authorization header에서 추출
  const authHeader = socket.handshake.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // auth 객체에서 추출
  const authToken = socket.handshake.auth?.token;
  if (authToken) {
    return authToken;
  }

  // query parameter에서 추출
  const queryToken = socket.handshake.query?.token;
  if (queryToken && typeof queryToken === "string") {
    return queryToken;
  }

  return null;
}

/**
 * 토큰 검증 및 사용자 정보 조회
 */
async function validateToken(token: string): Promise<SocketUser | null> {
  try {
    // JWT 토큰 검증
    const decoded = await verifyJWT(token);
    
    if (!decoded || !decoded.userId) {
      return null;
    }

    // 사용자 정보 조회
    const user = await prisma.user.findUnique({
      where: { 
        id: decoded.userId,
        // 활성 사용자만 허용
        deletedAt: null,
      },
      select: {
        id: true,
        username: true,
        nickname: true,
        profileImageUrl: true,
        isAdmin: true,
        studioMembers: {
          select: {
            role: true,
            studio: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      profileImageUrl: user.profileImageUrl,
      isAdmin: user.isAdmin,
      studios: user.studioMembers.map(member => ({
        id: member.studio.id,
        name: member.studio.name,
        role: member.role,
      })),
    };

  } catch (error) {
    console.error("Token validation error:", error);
    return null;
  }
}

/**
 * 세션 ID 생성
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
}

/**
 * 프로젝트 접근 권한 확인 미들웨어
 */
export function requireProjectAccess(projectId: string) {
  return async (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
    try {
      const hasAccess = await checkProjectAccess(socket.userId, projectId);
      
      if (!hasAccess) {
        return next(new Error(`Access denied to project ${projectId}`));
      }

      next();
    } catch (error) {
      console.error("Project access check error:", error);
      next(new Error("Access check failed"));
    }
  };
}

/**
 * 씬 접근 권한 확인 미들웨어
 */
export function requireSceneAccess(projectId: string, sceneId: string) {
  return async (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
    try {
      const hasAccess = await checkSceneAccess(socket.userId, projectId, sceneId);
      
      if (!hasAccess) {
        return next(new Error(`Access denied to scene ${sceneId} in project ${projectId}`));
      }

      next();
    } catch (error) {
      console.error("Scene access check error:", error);
      next(new Error("Access check failed"));
    }
  };
}

/**
 * 관리자 권한 확인 미들웨어
 */
export function requireAdmin(socket: AuthenticatedSocket, next: (err?: Error) => void) {
  if (!socket.user.isAdmin) {
    return next(new Error("Admin access required"));
  }
  next();
}

/**
 * 프로젝트 소유자 권한 확인 미들웨어
 */
export function requireProjectOwner(projectId: string) {
  return async (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
    try {
      const isOwner = await checkProjectOwnership(socket.userId, projectId);
      
      if (!isOwner && !socket.user.isAdmin) {
        return next(new Error(`Owner access required for project ${projectId}`));
      }

      next();
    } catch (error) {
      console.error("Project ownership check error:", error);
      next(new Error("Ownership check failed"));
    }
  };
}

/**
 * 프로젝트 접근 권한 확인
 */
export async function checkProjectAccess(userId: string, projectId: string): Promise<boolean> {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: userId },
          { 
            participants: {
              some: { 
                userId,
                // 활성 참여자만
                leftAt: null,
              },
            },
          },
        ],
        // 활성 프로젝트만
        deletedAt: null,
      },
    });

    return !!project;
  } catch (error) {
    console.error("Project access check error:", error);
    return false;
  }
}

/**
 * 씬 접근 권한 확인
 */
export async function checkSceneAccess(userId: string, projectId: string, sceneId: string): Promise<boolean> {
  try {
    const scene = await prisma.scene.findFirst({
      where: {
        id: sceneId,
        projectId,
        project: {
          OR: [
            { creatorId: userId },
            { 
              participants: {
                some: { 
                  userId,
                  leftAt: null,
                },
              },
            },
          ],
          deletedAt: null,
        },
      },
    });

    return !!scene;
  } catch (error) {
    console.error("Scene access check error:", error);
    return false;
  }
}

/**
 * 프로젝트 소유권 확인
 */
export async function checkProjectOwnership(userId: string, projectId: string): Promise<boolean> {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        creatorId: userId,
        deletedAt: null,
      },
    });

    return !!project;
  } catch (error) {
    console.error("Project ownership check error:", error);
    return false;
  }
}

/**
 * 사용자 권한 레벨 확인
 */
export async function getUserPermissionLevel(userId: string, projectId: string): Promise<'owner' | 'admin' | 'member' | 'none'> {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        participants: {
          where: { 
            userId,
            leftAt: null,
          },
        },
      },
    });

    if (!project) {
      return 'none';
    }

    if (project.creatorId === userId) {
      return 'owner';
    }

    const participation = project.participants[0];
    if (participation) {
      return participation.role === 'admin' ? 'admin' : 'member';
    }

    return 'none';
  } catch (error) {
    console.error("Permission level check error:", error);
    return 'none';
  }
}

/**
 * Socket 연결 비율 제한
 */
export class ConnectionRateLimit {
  private connections: Map<string, number[]> = new Map();
  private readonly maxConnections: number;
  private readonly timeWindow: number; // milliseconds

  constructor(maxConnections: number = 10, timeWindowMinutes: number = 5) {
    this.maxConnections = maxConnections;
    this.timeWindow = timeWindowMinutes * 60 * 1000;
  }

  /**
   * 연결 시도 확인
   */
  checkConnection(ipAddress: string): boolean {
    const now = Date.now();
    const userConnections = this.connections.get(ipAddress) || [];

    // 시간 창 밖의 연결들 제거
    const validConnections = userConnections.filter(
      timestamp => now - timestamp < this.timeWindow
    );

    // 최대 연결 수 확인
    if (validConnections.length >= this.maxConnections) {
      return false;
    }

    // 새 연결 기록
    validConnections.push(now);
    this.connections.set(ipAddress, validConnections);

    return true;
  }

  /**
   * 연결 기록 정리
   */
  cleanup() {
    const now = Date.now();
    
    this.connections.forEach((timestamps, ip) => {
      const validConnections = timestamps.filter(
        timestamp => now - timestamp < this.timeWindow
      );
      
      if (validConnections.length === 0) {
        this.connections.delete(ip);
      } else {
        this.connections.set(ip, validConnections);
      }
    });
  }
}

/**
 * 토큰 갱신 처리
 */
export async function refreshSocketToken(socket: AuthenticatedSocket): Promise<string | null> {
  try {
    const refreshToken = socket.handshake.auth?.refreshToken;
    
    if (!refreshToken) {
      return null;
    }

    // 리프레시 토큰 검증
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
    
    if (!decoded || !decoded.userId) {
      return null;
    }

    // 새 액세스 토큰 생성
    const newAccessToken = jwt.sign(
      { 
        userId: decoded.userId,
        type: 'access',
      },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    return newAccessToken;
  } catch (error) {
    console.error("Token refresh error:", error);
    return null;
  }
}

/**
 * Socket 인증 상태 확인
 */
export function isSocketAuthenticated(socket: Socket): socket is AuthenticatedSocket {
  return 'userId' in socket && 'user' in socket;
}

export default {
  authenticateSocket,
  requireProjectAccess,
  requireSceneAccess,
  requireAdmin,
  requireProjectOwner,
  checkProjectAccess,
  checkSceneAccess,
  checkProjectOwnership,
  getUserPermissionLevel,
  ConnectionRateLimit,
  refreshSocketToken,
  isSocketAuthenticated,
};