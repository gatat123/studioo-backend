import { NextRequest, NextResponse } from "next/server";
import { Server as HTTPServer } from "http";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";
import { getSocketServer, initializeSocketServer } from "@/lib/socket/server";

// GET /api/socket - Socket.io 서버 상태 조회
async function getSocketStatus(req: AuthenticatedRequest) {
  try {
    const socketServer = getSocketServer();
    
    if (!socketServer) {
      return NextResponse.json({
        success: false,
        status: "not_initialized",
        message: "Socket.io 서버가 초기화되지 않았습니다.",
      });
    }

    const stats = socketServer.getServerStats();
    
    return NextResponse.json({
      success: true,
      status: "running",
      stats,
      timestamp: new Date(),
    });

  } catch (error) {
    console.error("Socket status error:", error);
    return NextResponse.json(
      { success: false, error: "Socket 상태 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST /api/socket - Socket.io 서버 초기화 (개발/테스트용)
async function initializeSocket(req: AuthenticatedRequest) {
  try {
    // 관리자만 접근 가능
    if (!req.user.isAdmin) {
      return NextResponse.json(
        { success: false, error: "관리자 권한이 필요합니다." },
        { status: 403 }
      );
    }

    const socketServer = getSocketServer();
    
    if (socketServer) {
      return NextResponse.json({
        success: true,
        message: "Socket.io 서버가 이미 실행 중입니다.",
        stats: socketServer.getServerStats(),
      });
    }

    // 개발 환경에서만 수동 초기화 허용
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json(
        { success: false, error: "Socket.io 서버는 애플리케이션 시작 시에만 초기화됩니다." },
        { status: 400 }
      );
    }

    // HTTP 서버가 필요하지만 여기서는 모의 응답
    return NextResponse.json({
      success: true,
      message: "Socket.io 서버는 Next.js 서버와 함께 초기화되어야 합니다.",
      note: "사용자 정의 서버에서 initializeSocketServer()를 호출하세요.",
    });

  } catch (error) {
    console.error("Socket initialization error:", error);
    return NextResponse.json(
      { success: false, error: "Socket 초기화 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getSocketStatus);
export const POST = withAuth(initializeSocket);