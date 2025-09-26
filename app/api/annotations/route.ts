import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";
import { NotificationService } from "@/lib/services/notification";
import { sceneEvents } from "@/lib/socket/emit-helper";

const createAnnotationSchema = z.object({
  imageId: z.string().uuid("유효한 이미지 ID가 필요합니다."),
  type: z.enum(["point", "rectangle", "circle", "arrow", "text", "freehand"]),
  position: z.object({
    x: z.number().min(0, "X 좌표는 0 이상이어야 합니다."),
    y: z.number().min(0, "Y 좌표는 0 이상이어야 합니다."),
  }),
  dimensions: z.object({
    width: z.number().min(0).optional(),
    height: z.number().min(0).optional(),
    radius: z.number().min(0).optional(),
  }).optional(),
  style: z.object({
    color: z.string().regex(/^#[0-9A-F]{6}$/i, "유효한 색상 코드가 필요합니다.").default("#FF0000"),
    strokeWidth: z.number().min(1).max(10).default(2),
    opacity: z.number().min(0).max(1).default(1),
    fill: z.boolean().default(false),
  }).optional(),
  content: z.string().max(1000, "내용은 1000자를 초과할 수 없습니다.").optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const getAnnotationsSchema = z.object({
  imageId: z.string().uuid("유효한 이미지 ID가 필요합니다."),
});

// GET /api/annotations - 이미지의 주석 목록 조회
async function getAnnotations(req: AuthenticatedRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = Object.fromEntries(searchParams.entries());
    const { imageId } = getAnnotationsSchema.parse(query);

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

    const participation = image.scene.project.participants[0];
    const isProjectCreator = image.scene.project.creatorId === req.user.userId;
    const hasAccess = isProjectCreator || participation || req.user.isAdmin;

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "주석 조회 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 주석 조회 조건 구성
    const where: any = { imageId };

    const annotations = await prisma.annotation.findMany({
      where,
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
    });

    return NextResponse.json({
      success: true,
      data: {
        annotations,
        image: {
          id: image.id,
          fileUrl: image.fileUrl,
          width: image.width,
          height: image.height,
        },
        statistics: {
          total: annotations.length,
        },
      },
    });

  } catch (error) {
    console.error("Annotations fetch error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "잘못된 쿼리 파라미터입니다.", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "주석 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST /api/annotations - 새 주석 생성
async function createAnnotation(req: AuthenticatedRequest) {
  try {
    const body = await req.json();
    const validatedData = createAnnotationSchema.parse(body);

    // 이미지 접근 권한 확인
    const image = await prisma.image.findUnique({
      where: { id: validatedData.imageId },
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

    const participation = image.scene.project.participants[0];
    const isProjectCreator = image.scene.project.creatorId === req.user.userId;
    const hasAccess = isProjectCreator || participation || req.user.isAdmin;

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "주석 생성 권한이 없습니다." },
        { status: 403 }
      );
    }

    if (image.scene.project.status !== "active") {
      return NextResponse.json(
        { success: false, error: "활성 상태인 프로젝트에서만 주석을 생성할 수 있습니다." },
        { status: 400 }
      );
    }

    // 좌표 유효성 검사 (이미지 범위 내인지 확인)
    if (image.width && image.height && 
        (validatedData.position.x > image.width || validatedData.position.y > image.height)) {
      return NextResponse.json(
        { success: false, error: "주석 위치가 이미지 범위를 벗어났습니다." },
        { status: 400 }
      );
    }

    const annotation = await prisma.$transaction(async (tx) => {
      // 주석 생성
      const newAnnotation = await tx.annotation.create({
        data: {
          imageId: validatedData.imageId,
          userId: req.user.userId,
          type: validatedData.type,
          positionX: validatedData.position.x,
          positionY: validatedData.position.y,
          width: validatedData.dimensions?.width || 0,
          height: validatedData.dimensions?.height || 0,
          content: validatedData.content || '',
          drawingData: validatedData.type === 'freehand' && validatedData.metadata ? validatedData.metadata : undefined,
          color: validatedData.style?.color || '#FF0000',
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
      });

      // 협업 로그 기록
      await tx.collaborationLog.create({
        data: {
          projectId: image.scene.project.id,
          userId: req.user.userId,
          actionType: "create_annotation",
          targetType: "image",
          targetId: validatedData.imageId,
          description: `이미지에 ${validatedData.type} 주석을 추가했습니다.`,
          metadata: {
            annotationType: validatedData.type,
            position: validatedData.position,
            sceneNumber: image.scene.sceneNumber,
          },
        },
      });

      return newAnnotation;
    });

    // 프로젝트 참여자들에게 알림
    await NotificationService.notifyProjectParticipants(
      image.scene.project.id,
      "annotation_created",
      "새 주석 추가",
      `${image.scene.project.name} - 씬 ${image.scene.sceneNumber}에 새 주석이 추가되었습니다.`,
      req.user.userId,
      {
        annotationId: annotation.id,
        annotationType: validatedData.type,
        imageFileUrl: image.fileUrl,
      }
    );

    // Socket.io 이벤트 발송 - 주석 생성
    await sceneEvents.updated(image.sceneId, {
      ...image.scene,
      annotations: [annotation]
    });

    return NextResponse.json({
      success: true,
      message: "주석이 생성되었습니다.",
      data: { annotation },
    });

  } catch (error) {
    console.error("Annotation creation error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "입력 데이터가 유효하지 않습니다.", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "주석 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getAnnotations);
export const POST = withAuth(createAnnotation);