import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";
import { announcementEvents } from "@/lib/socket/emit-helper";

const createAnnouncementSchema = z.object({
  content: z.string().min(1, "공지사항 내용이 필요합니다.").max(5000, "공지사항은 5000자를 초과할 수 없습니다."),
});

const updateAnnouncementSchema = z.object({
  content: z.string().min(1, "공지사항 내용이 필요합니다.").max(5000, "공지사항은 5000자를 초과할 수 없습니다."),
});

// GET /api/announcements - 최신 공지사항 조회 (모든 사용자 가능)
async function getLatestAnnouncement(req: AuthenticatedRequest) {
  try {
    const announcement = await prisma.announcement.findFirst({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
            isAdmin: true,
          },
        },
      },
    });

    if (!announcement) {
      return NextResponse.json(
        { success: false, error: "공지사항이 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: announcement,
    });

  } catch (error) {
    console.error("Announcement fetch error:", error);
    return NextResponse.json(
      { success: false, error: "공지사항 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST /api/announcements - 새 공지사항 생성 (관리자만 가능)
async function createAnnouncement(req: AuthenticatedRequest) {
  try {
    // 관리자 권한 확인
    if (!req.user.is_admin) {
      return NextResponse.json(
        { success: false, error: "공지사항 작성 권한이 없습니다. 관리자만 공지사항을 작성할 수 있습니다." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { content } = createAnnouncementSchema.parse(body);

    const announcement = await prisma.announcement.create({
      data: {
        content,
        userId: req.user.userId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
            isAdmin: true,
          },
        },
      },
    });

    // Socket.io 이벤트 발송
    await announcementEvents.created(announcement);

    return NextResponse.json({
      success: true,
      message: "공지사항이 작성되었습니다.",
      data: { announcement },
    });

  } catch (error) {
    console.error("Announcement creation error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "입력 데이터가 유효하지 않습니다.", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "공지사항 작성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PUT /api/announcements - 최신 공지사항 수정 또는 생성 (관리자만 가능)
async function updateOrCreateAnnouncement(req: AuthenticatedRequest) {
  try {
    // 관리자 권한 확인
    if (!req.user.is_admin) {
      return NextResponse.json(
        { success: false, error: "공지사항 수정 권한이 없습니다. 관리자만 공지사항을 수정할 수 있습니다." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { content } = updateAnnouncementSchema.parse(body);

    // 최신 공지사항 찾기
    const latestAnnouncement = await prisma.announcement.findFirst({
      orderBy: { createdAt: "desc" },
    });

    let announcement;

    if (latestAnnouncement) {
      // 기존 공지사항 업데이트
      announcement = await prisma.announcement.update({
        where: { id: latestAnnouncement.id },
        data: {
          content,
          userId: req.user.userId,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
              profileImageUrl: true,
              isAdmin: true,
            },
          },
        },
      });

      // Socket.io 이벤트 발송
      await announcementEvents.updated(announcement.id, announcement);

      return NextResponse.json({
        success: true,
        message: "공지사항이 수정되었습니다.",
        data: announcement,
      });
    } else {
      // 공지사항이 없으면 새로 생성
      announcement = await prisma.announcement.create({
        data: {
          content,
          userId: req.user.userId,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
              profileImageUrl: true,
              isAdmin: true,
            },
          },
        },
      });

      // Socket.io 이벤트 발송
      await announcementEvents.created(announcement);

      return NextResponse.json({
        success: true,
        message: "공지사항이 작성되었습니다.",
        data: announcement,
      });
    }

  } catch (error) {
    console.error("Announcement update/create error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "입력 데이터가 유효하지 않습니다.", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "공지사항 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getLatestAnnouncement);
export const POST = withAuth(createAnnouncement);
export const PUT = withAuth(updateOrCreateAnnouncement);