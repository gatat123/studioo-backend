import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";
import { NotificationService } from "@/lib/services/notification";

const getNotificationsSchema = z.object({
  isRead: z.string().optional().transform((val) => val === "true" ? true : val === "false" ? false : undefined),
  type: z.string().optional(),
  projectId: z.string().uuid().optional(),
  limit: z.string().optional().transform((val) => val ? parseInt(val, 10) : 20),
  offset: z.string().optional().transform((val) => val ? parseInt(val, 10) : 0),
});

const markAsReadSchema = z.object({
  notificationIds: z.array(z.string().uuid()).optional(),
  markAllAsRead: z.boolean().optional(),
  projectId: z.string().uuid().optional(),
});

// GET /api/notifications - 알림 목록 조회
async function getNotifications(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = Object.fromEntries(searchParams.entries());
    
    const validatedQuery = getNotificationsSchema.parse(query);

    const result = await NotificationService.getNotifications(
      req.user.userId,
      {
        isRead: validatedQuery.isRead,
        type: validatedQuery.type as any,
        projectId: validatedQuery.projectId,
        limit: validatedQuery.limit,
        offset: validatedQuery.offset,
      }
    );

    // 읽지 않은 알림 개수도 함께 반환
    const unreadCount = await NotificationService.getUnreadCount(
      req.user.userId,
      validatedQuery.projectId
    );

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        unreadCount,
      },
    });

  } catch (error) {
    console.error("Get notifications error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "잘못된 쿼리 파라미터입니다.", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "알림 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PUT /api/notifications - 알림 읽음 처리
async function updateNotifications(req: AuthenticatedRequest) {
  try {
    const body = await req.json();
    const { notificationIds, markAllAsRead, projectId } = markAsReadSchema.parse(body);

    let result;

    if (markAllAsRead) {
      // 모든 알림 읽음 처리
      result = await NotificationService.markAllAsRead(req.user.userId, projectId);
    } else if (notificationIds && notificationIds.length > 0) {
      // 특정 알림들 읽음 처리
      result = await NotificationService.markMultipleAsRead(notificationIds, req.user.userId);
    } else {
      return NextResponse.json(
        { success: false, error: "처리할 알림을 지정해주세요." },
        { status: 400 }
      );
    }

    // 업데이트된 읽지 않은 알림 개수 반환
    const unreadCount = await NotificationService.getUnreadCount(
      req.user.userId,
      projectId
    );

    return NextResponse.json({
      success: true,
      message: `${result.count}개의 알림이 읽음 처리되었습니다.`,
      data: {
        updatedCount: result.count,
        unreadCount,
      },
    });

  } catch (error) {
    console.error("Update notifications error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "입력 데이터가 유효하지 않습니다.", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "알림 업데이트 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getNotifications);
export const PUT = withAuth(updateNotifications);