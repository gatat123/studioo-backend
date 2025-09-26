import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";
import { sceneEvents } from "@/lib/socket/emit-helper";
const updateAnnotationSchema = z.object({
  type: z.enum(["point", "rectangle", "circle", "arrow", "text", "freehand"]).optional(),
  position: z.object({
    x: z.number().min(0, "X 좌표는 0 이상이어야 합니다."),
    y: z.number().min(0, "Y 좌표는 0 이상이어야 합니다."),
  }).optional(),
  dimensions: z.object({
    width: z.number().min(0).optional(),
    height: z.number().min(0).optional(),
    radius: z.number().min(0).optional(),
  }).optional(),
  style: z.object({
    color: z.string().regex(/^#[0-9A-F]{6}$/i, "유효한 색상 코드가 필요합니다.").optional(),
    strokeWidth: z.number().min(1).max(10).optional(),
    opacity: z.number().min(0).max(1).optional(),
    fill: z.boolean().optional(),
  }).optional(),
  content: z.string().max(1000, "내용은 1000자를 초과할 수 없습니다.").optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// 공통 함수: 주석 조회 및 권한 확인
async function getAnnotationWithPermission(
  annotationId: string,
  userId: string,
  isAdmin: boolean
) {
  const annotation = await prisma.annotation.findUnique({
    where: { id: annotationId },
    include: {
      image: {
        include: {
          scene: {
            include: {
              project: {
                include: {
                  participants: {
                    where: { userId },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!annotation) {
    return { error: "주석을 찾을 수 없습니다.", status: 404 };
  }

  const participation = annotation.image.scene.project.participants[0];
  const isAuthor = annotation.userId === userId;
  const isProjectCreator = annotation.image.scene.project.creatorId === userId;
  const isProjectAdmin = participation?.role === "admin";

  return {
    annotation,
    hasPermission: isAuthor || isProjectCreator || isProjectAdmin || isAdmin,
    isAuthor,
    isProjectCreator,
    isProjectAdmin,
  };
}

// GET /api/annotations/[id] - 특정 주석 상세 조회
async function getAnnotation(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const annotationId = params.id;
    const annotation = await prisma.annotation.findUnique({
      where: { id: annotationId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
          },
        },
        image: {
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
        },
      },
    });
    if (!annotation) {
      return NextResponse.json(
        { success: false, error: "주석을 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    // 접근 권한 확인
    const participation = annotation.image.scene.project.participants[0];
    const isProjectCreator = annotation.image.scene.project.creatorId === req.user.userId;
    const hasAccess = isProjectCreator || participation || req.user.isAdmin;
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "주석 조회 권한이 없습니다." },
        { status: 403 }
      );
    }
    return NextResponse.json({
      success: true,
      data: { annotation },
    });
  } catch (error) {
    console.error("Annotation fetch error:", error);
    return NextResponse.json(
      { success: false, error: "주석 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
// PUT /api/annotations/[id] - 주석 수정
async function updateAnnotation(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const annotationId = params.id;
    const body = await req.json();
    const validatedData = updateAnnotationSchema.parse(body);
    
    // 공통 함수로 주석 조회 및 권한 확인
    const result = await getAnnotationWithPermission(
      annotationId,
      req.user.userId,
      req.user.isAdmin
    );
    
    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }
    
    if (!result.hasPermission) {
      return NextResponse.json(
        { success: false, error: "주석 수정 권한이 없습니다." },
        { status: 403 }
      );
    }
    
    const { annotation } = result;
    
    if (annotation.image.scene.project.status !== "active") {
      return NextResponse.json(
        { success: false, error: "활성 상태인 프로젝트에서만 주석을 수정할 수 있습니다." },
        { status: 400 }
      );
    }
    // 좌표 유효성 검사 (위치가 변경되는 경우)
    if (validatedData.position) {
      const { width, height } = annotation.image;
      if (width && height && (validatedData.position.x > width || validatedData.position.y > height)) {
        return NextResponse.json(
          { success: false, error: "주석 위치가 이미지 범위를 벗어났습니다." },
          { status: 400 }
        );
      }
    }
    const updatedAnnotation = await prisma.$transaction(async (tx) => {
      // 주석 업데이트 데이터 변환
      const updateData: any = {};
      
      if (validatedData.type) updateData.type = validatedData.type;
      if (validatedData.position) {
        updateData.positionX = validatedData.position.x;
        updateData.positionY = validatedData.position.y;
      }
      if (validatedData.dimensions) {
        if (validatedData.dimensions.width) updateData.width = validatedData.dimensions.width;
        if (validatedData.dimensions.height) updateData.height = validatedData.dimensions.height;
      }
      if (validatedData.content) updateData.content = validatedData.content;
      if (validatedData.style?.color) updateData.color = validatedData.style.color;
      if (validatedData.metadata && validatedData.type === 'freehand') {
        updateData.drawingData = validatedData.metadata;
      }
      
      updateData.updatedAt = new Date();
      
      // 주석 업데이트
      const updated = await tx.annotation.update({
        where: { id: annotationId },
        data: updateData,
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
      });
      // 협업 로그 기록
      const actionType = "update_annotation";
      const description = "주석을 수정했습니다.";
      await tx.collaborationLog.create({
        data: {
          projectId: annotation.image.scene.project.id,
          userId: req.user.userId,
          actionType,
          targetType: "annotation",
          targetId: annotationId,
          description,
          metadata: {
            annotationType: updated.type,
            changes: Object.keys(validatedData),
            sceneNumber: annotation.image.scene.sceneNumber,
          },
        },
      });
      return updated;
    });

    // Socket.io 이벤트 발송 - 주석 업데이트
    await sceneEvents.updated(annotation.image.sceneId, {
      ...annotation.image.scene,
      annotations: [updatedAnnotation]
    });

    return NextResponse.json({
      success: true,
      message: "주석이 업데이트되었습니다.",
      data: { annotation: updatedAnnotation },
    });
  } catch (error) {
    console.error("Annotation update error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "입력 데이터가 유효하지 않습니다.", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "주석 업데이트 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
// DELETE /api/annotations/[id] - 주석 삭제
async function deleteAnnotation(
  req: AuthenticatedRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    const annotationId = params.id;
    
    // 공통 함수로 주석 조회 및 권한 확인
    const result = await getAnnotationWithPermission(
      annotationId,
      req.user.userId,
      req.user.isAdmin
    );
    
    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status }
      );
    }
    
    if (!result.hasPermission) {
      return NextResponse.json(
        { success: false, error: "주석 삭제 권한이 없습니다." },
        { status: 403 }
      );
    }
    
    const { annotation } = result;
    
    await prisma.$transaction(async (tx) => {
      // 주석 삭제
      await tx.annotation.delete({
        where: { id: annotationId },
      });
      // 협업 로그 기록
      await tx.collaborationLog.create({
        data: {
          projectId: annotation.image.scene.project.id,
          userId: req.user.userId,
          actionType: "delete_annotation",
          targetType: "annotation",
          targetId: annotationId,
          description: `${annotation.type} 주석을 삭제했습니다.`,
          metadata: {
            annotationType: annotation.type,
            positionX: annotation.positionX,
            positionY: annotation.positionY,
            sceneNumber: annotation.image.scene.sceneNumber,
          },
        },
      });
    });

    // Socket.io 이벤트 발송 - 주석 삭제
    await sceneEvents.updated(annotation.image.sceneId, {
      ...annotation.image.scene,
      annotationDeleted: annotationId
    });

    return NextResponse.json({
      success: true,
      message: "주석이 삭제되었습니다.",
    });
  } catch (error) {
    console.error("Annotation deletion error:", error);
    return NextResponse.json(
      { success: false, error: "주석 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getAnnotation);
export const PUT = withAuth(updateAnnotation);
export const DELETE = withAuth(deleteAnnotation);
