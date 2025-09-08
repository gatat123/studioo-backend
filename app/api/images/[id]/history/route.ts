import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";

// GET /api/images/[id]/history - 이미지 버전 히스토리 조회
async function getImageHistory(req: AuthenticatedRequest, imageId: string) {
  try {
    // 현재 이미지 정보 조회
    const currentImage = await prisma.image.findUnique({
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

    if (!currentImage) {
      return NextResponse.json(
        { success: false, error: "이미지를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 프로젝트 접근 권한 확인
    const hasAccess = currentImage.scene.project.creatorId === req.user.userId ||
      currentImage.scene.project.participants.length > 0 ||
      req.user.isAdmin;

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "이미지 히스토리 접근 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 같은 씬의 모든 이미지 버전 조회 (히스토리)
    const imageHistory = await prisma.image.findMany({
      where: { 
        sceneId: currentImage.sceneId 
      },
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
          },
        },
        _count: {
          select: {
            annotations: true,
          },
        },
      },
      orderBy: [
        { version: "desc" },
        { createdAt: "desc" },
      ],
    });

    // 협업 로그에서 이미지 관련 활동 조회
    const activityLogs = await prisma.collaborationLog.findMany({
      where: {
        projectId: currentImage.scene.project.id,
        OR: [
          { targetId: currentImage.sceneId, targetType: "scene" },
          { 
            targetType: "image",
            targetId: { 
              in: imageHistory.map(img => img.id)
            }
          },
        ],
        actionType: { 
          in: ["upload_image", "delete_image", "create_annotation", "update_annotation", "delete_annotation"]
        },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50, // 최근 50개 활동
    });

    // 각 이미지 버전의 변경 사항 요약
    const versionsWithChanges = imageHistory.map((image, index) => {
      const previousVersion = imageHistory[index + 1];
      const changes = [];

      if (!previousVersion) {
        changes.push("최초 업로드");
      } else {
        if (image.description !== previousVersion.description) {
          changes.push("설명 변경");
        }
        if (image._count.annotations > previousVersion._count.annotations) {
          changes.push(`어노테이션 ${image._count.annotations - previousVersion._count.annotations}개 추가`);
        } else if (image._count.annotations < previousVersion._count.annotations) {
          changes.push(`어노테이션 ${previousVersion._count.annotations - image._count.annotations}개 삭제`);
        }
      }

      return {
        ...image,
        changes,
        isCurrentVersion: image.id === imageId,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        currentImage,
        history: versionsWithChanges,
        activityLogs,
        statistics: {
          totalVersions: imageHistory.length,
          totalAnnotations: imageHistory.reduce((sum, img) => sum + img._count.annotations, 0),
          firstUpload: imageHistory[imageHistory.length - 1]?.createdAt,
          lastUpdate: imageHistory[0]?.createdAt,
        },
      },
    });

  } catch (error) {
    console.error("Image history fetch error:", error);
    return NextResponse.json(
      { success: false, error: "이미지 히스토리 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getImageHistory);