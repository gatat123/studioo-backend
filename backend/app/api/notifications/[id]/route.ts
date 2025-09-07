import { NextRequest, NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";
import { NotificationService } from "@/lib/services/notification";

// PUT /api/notifications/[id] - 특정 알림 읽음 처리
async function markNotificationAsRead(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const notificationId = params.id;

    if (!notificationId) {
      return NextResponse.json(
        { success: false, error: "알림 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const notification = await NotificationService.markAsRead(
      notificationId,
      req.user.userId
    );

    // 업데이트된 읽지 않은 알림 개수 반환
    const unreadCount = await NotificationService.getUnreadCount(req.user.userId);

    return NextResponse.json({
      success: true,
      message: "알림이 읽음 처리되었습니다.",
      data: {
        notification,
        unreadCount,
      },
    });

  } catch (error) {
    console.error("Mark notification as read error:", error);

    // Prisma에서 해당 알림을 찾을 수 없는 경우
    if (error.code === "P2025") {
      return NextResponse.json(
        { success: false, error: "알림을 찾을 수 없거나 접근 권한이 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: "알림 읽음 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications/[id] - 특정 알림 삭제
async function deleteNotification(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  try {
    const notificationId = params.id;

    if (!notificationId) {
      return NextResponse.json(
        { success: false, error: "알림 ID가 필요합니다." },
        { status: 400 }
      );
    }

    await NotificationService.deleteNotification(notificationId, req.user.userId);

    // 업데이트된 읽지 않은 알림 개수 반환
    const unreadCount = await NotificationService.getUnreadCount(req.user.userId);

    return NextResponse.json({
      success: true,
      message: "알림이 삭제되었습니다.",
      data: {
        unreadCount,
      },
    });

  } catch (error) {
    console.error("Delete notification error:", error);

    // Prisma에서 해당 알림을 찾을 수 없는 경우
    if (error.code === "P2025") {
      return NextResponse.json(
        { success: false, error: "알림을 찾을 수 없거나 접근 권한이 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: "알림 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const PUT = withAuth(markNotificationAsRead);
export const DELETE = withAuth(deleteNotification);