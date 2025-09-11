import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";
import { unlink } from "fs/promises";
import path from "path";

// GET /api/images/[id] - 이미지 상세 정보 조회
async function getImage(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const imageId = params.id;
  try {
    const image = await prisma.image.findUnique({
      where: { id: imageId },
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
          },
        },
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
        annotations: {
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
        },
        _count: {
          select: {
            annotations: true,
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
    const hasAccess = image.scene.project.creatorId === req.user.userId ||
      image.scene.project.participants.length > 0 ||
      req.user.isAdmin;

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "이미지 접근 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 현재 사용자의 프로젝트 역할 확인
    const currentUserParticipation = image.scene.project.participants[0];

    return NextResponse.json({
      success: true,
      data: {
        image: {
          ...image,
          scene: {
            ...image.scene,
            project: {
              ...image.scene.project,
              currentUserRole: currentUserParticipation?.role || 
                (image.scene.project.creatorId === req.user.userId ? "owner" : null),
            },
          },
        },
      },
    });

  } catch (error) {
    console.error("Image fetch error:", error);
    return NextResponse.json(
      { success: false, error: "이미지 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// DELETE /api/images/[id] - 이미지 삭제
async function deleteImage(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const imageId = params.id;
  try {
    // 이미지 정보 조회
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
        annotations: true,
      },
    });

    if (!image) {
      return NextResponse.json(
        { success: false, error: "이미지를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 권한 확인 - 업로더, 프로젝트 owner/admin, 또는 시스템 관리자만 삭제 가능
    const participation = image.scene.project.participants[0];
    const isUploader = image.uploadedBy === req.user.userId;
    const isProjectOwner = image.scene.project.creatorId === req.user.userId;
    const isProjectAdmin = participation?.role === "admin";

    if (!isUploader && !isProjectOwner && !isProjectAdmin && !req.user.isAdmin) {
      return NextResponse.json(
        { success: false, error: "이미지 삭제 권한이 없습니다." },
        { status: 403 }
      );
    }

    try {
      // 파일 시스템에서 이미지 파일 삭제
      const uploadDir = path.join(process.cwd(), "uploads", "images");
      
      const filename = path.basename(image.fileUrl);
      // thumbnailUrl 필드가 없으므로 썸네일 삭제는 생략
      
      // 원본 파일 삭제 시도
      try {
        await unlink(path.join(uploadDir, filename));
      } catch (error) {
        console.warn(`Failed to delete original file: ${filename}`, error);
      }

      // 썸네일 파일 삭제는 필드가 없으므로 생략
    } catch (fileError) {
      console.error("File deletion error:", fileError);
      // 파일 삭제 실패해도 데이터베이스 삭제는 진행
    }

    // 데이터베이스에서 이미지 삭제 (CASCADE로 annotation도 함께 삭제)
    await prisma.image.delete({
      where: { id: imageId },
    });

    // 협업 로그 기록
    await prisma.collaborationLog.create({
      data: {
        projectId: image.scene.project.id,
        userId: req.user.userId,
        actionType: "delete_image",
        targetType: "image",
        targetId: imageId,
        description: `씬 ${image.scene.sceneNumber}에서 이미지를 삭제했습니다.`,
        metadata: { 
          annotationCount: image.annotations.length,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "이미지가 삭제되었습니다.",
    });

  } catch (error) {
    console.error("Image deletion error:", error);
    return NextResponse.json(
      { success: false, error: "이미지 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getImage);
export const DELETE = withAuth(deleteImage);