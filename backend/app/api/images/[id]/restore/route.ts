import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";
import { ImageHistoryService } from "@/lib/services/imageHistory";
import { prisma } from "@/lib/prisma";

const restoreImageSchema = z.object({
  versionId: z.string().uuid("유효한 버전 ID가 필요합니다."),
});

// POST /api/images/[id]/restore - 이미지 버전 복원
async function restoreImageVersion(
  req: AuthenticatedRequest,
  ctx: { params: any }
) {
  try {
    const params = ctx.params;
    const imageId = params.id;
    const body = await req.json();
    const { versionId } = restoreImageSchema.parse(body);

    // 이미지 접근 권한 확인
    const image = await prisma.image.findUnique({
      where: { id: imageId },
      include: {
        scene: {
          include: {
            project: {
              include: {
                participants: {
                  where: { userId: req.user.userId },
                },
              },
            },
          },
        },
      },
    });

    if (!image) {
      return NextResponse.json(
        { success: false, error: "이미지를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 프로젝트 접근 권한 확인
    const participation = image.scene.project.participants[0];
    const isProjectCreator = image.scene.project.creatorId === req.user.userId;
    const hasEditPermission = participation && ["owner", "admin"].includes(participation.role);

    if (!isProjectCreator && !hasEditPermission && !req.user.isAdmin) {
      return NextResponse.json(
        { success: false, error: "이미지 복원 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 이미지 버전 복원
    const restoredImage = await ImageHistoryService.restoreImageVersion(
      imageId,
      versionId,
      req.user.userId
    );

    return NextResponse.json({
      success: true,
      message: "이미지 버전이 성공적으로 복원되었습니다.",
      data: {
        image: restoredImage,
      },
    });

  } catch (error) {
    console.error("Image restore error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "입력 데이터가 유효하지 않습니다.", details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "Version not found or does not belong to this image") {
      return NextResponse.json(
        { success: false, error: "복원할 버전을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: "이미지 복원 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const POST = withAuth(restoreImageVersion);