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

// GET /api/announcements - 공지사항 목록 조회 (모든 사용자 가능)
async function getAnnouncements(req: AuthenticatedRequest) {
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const limit = parseInt(url.searchParams.get("limit") ?? "10");

    const skip = (page - 1) * limit;

    const [announcements, total] = await Promise.all([
      prisma.announcement.findMany({
        skip,
        take: limit,
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
      }),
      prisma.announcement.count(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        announcements,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
    });

  } catch (error) {
    console.error("Announcements fetch error:", error);
    return NextResponse.json(
      { success: false, error: "공지사항 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST /api/announcements - 새 공지사항 생성 (관리자만 가능)
async function createAnnouncement(req: AuthenticatedRequest) {
  try {
    // 관리자 권한 확인
    if (!req.user.isAdmin) {
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

export const GET = withAuth(getAnnouncements);
export const POST = withAuth(createAnnouncement);