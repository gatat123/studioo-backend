import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";
import { announcementEvents } from "@/lib/socket/emit-helper";

const updateAnnouncementSchema = z.object({
  content: z.string().min(1, "공지사항 내용이 필요합니다.").max(5000, "공지사항은 5000자를 초과할 수 없습니다."),
});

// GET /api/announcements/[id] - 특정 공지사항 조회 (모든 사용자 가능)
async function getAnnouncement(req: AuthenticatedRequest, { params }: { params: { id: string } }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "공지사항 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const announcement = await prisma.announcement.findUnique({
      where: { id },
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
        { success: false, error: "공지사항을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { announcement },
    });

  } catch (error) {
    console.error("Announcement fetch error:", error);
    return NextResponse.json(
      { success: false, error: "공지사항 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PUT /api/announcements/[id] - 공지사항 수정 (관리자만 가능)
async function updateAnnouncement(req: AuthenticatedRequest, { params }: { params: { id: string } }) {
  try {
    // 관리자 권한 확인
    if (!req.user.isAdmin) {
      return NextResponse.json(
        { success: false, error: "공지사항 수정 권한이 없습니다. 관리자만 공지사항을 수정할 수 있습니다." },
        { status: 403 }
      );
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "공지사항 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { content } = updateAnnouncementSchema.parse(body);

    // 공지사항 존재 확인
    const existingAnnouncement = await prisma.announcement.findUnique({
      where: { id },
    });

    if (!existingAnnouncement) {
      return NextResponse.json(
        { success: false, error: "공지사항을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const announcement = await prisma.announcement.update({
      where: { id },
      data: {
        content,
        updatedAt: new Date(),
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
    await announcementEvents.updated(announcement);

    return NextResponse.json({
      success: true,
      message: "공지사항이 수정되었습니다.",
      data: { announcement },
    });

  } catch (error) {
    console.error("Announcement update error:", error);

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

// DELETE /api/announcements/[id] - 공지사항 삭제 (관리자만 가능)
async function deleteAnnouncement(req: AuthenticatedRequest, { params }: { params: { id: string } }) {
  try {
    // 관리자 권한 확인
    if (!req.user.isAdmin) {
      return NextResponse.json(
        { success: false, error: "공지사항 삭제 권한이 없습니다. 관리자만 공지사항을 삭제할 수 있습니다." },
        { status: 403 }
      );
    }

    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "공지사항 ID가 필요합니다." },
        { status: 400 }
      );
    }

    // 공지사항 존재 확인
    const existingAnnouncement = await prisma.announcement.findUnique({
      where: { id },
    });

    if (!existingAnnouncement) {
      return NextResponse.json(
        { success: false, error: "공지사항을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    await prisma.announcement.delete({
      where: { id },
    });

    // Socket.io 이벤트 발송
    await announcementEvents.deleted(id);

    return NextResponse.json({
      success: true,
      message: "공지사항이 삭제되었습니다.",
    });

  } catch (error) {
    console.error("Announcement deletion error:", error);
    return NextResponse.json(
      { success: false, error: "공지사항 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getAnnouncement);
export const PUT = withAuth(updateAnnouncement);
export const DELETE = withAuth(deleteAnnouncement);