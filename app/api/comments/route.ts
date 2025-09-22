import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";

const createCommentSchema = z.object({
  content: z.string().min(1, "댓글 내용이 필요합니다.").max(2000, "댓글은 2000자를 초과할 수 없습니다."),
  sceneId: z.string().uuid("유효한 씬 ID가 필요합니다.").optional(),
  imageId: z.string().uuid("유효한 이미지 ID가 필요합니다.").optional(),
});

// GET /api/comments - 댓글 목록 조회
async function getComments(req: AuthenticatedRequest) {
  try {
    const url = new URL(req.url);
    const sceneId = url.searchParams.get("sceneId");
    const imageId = url.searchParams.get("imageId");
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const limit = parseInt(url.searchParams.get("limit") ?? "20");
    const orderBy = url.searchParams.get("orderBy") ?? "createdAt";
    const order = url.searchParams.get("order") ?? "desc";

    // 최소한 하나의 컨텍스트 ID가 필요함
    if (!sceneId && !imageId) {
      return NextResponse.json(
        { success: false, error: "sceneId 또는 imageId 중 하나가 필요합니다." },
        { status: 400 }
      );
    }

    // 권한 확인 (현재는 단순화)
    let accessCheck = null;

    if (sceneId) {
      accessCheck = await prisma.scene.findUnique({
        where: { id: sceneId },
      });
    } else if (imageId) {
      accessCheck = await prisma.image.findUnique({
        where: { id: imageId },
      });
    }

    if (!accessCheck) {
      return NextResponse.json(
        { success: false, error: "리소스를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const skip = (page - 1) * limit;

    // 쿼리 조건 구성 (Comment는 sceneId 또는 imageId만 가짐)
    const where: any = {};

    if (sceneId) {
      where.sceneId = sceneId;
    } else if (imageId) {
      where.imageId = imageId;
    }

    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderBy]: order },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
              profileImageUrl: true,
            },
          },
          scene: true,
          image: true,
        },
      }),
      prisma.comment.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        comments,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
    });

  } catch (error) {
    console.error("Comments fetch error:", error);
    return NextResponse.json(
      { success: false, error: "댓글 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST /api/comments - 새 댓글 생성
async function createComment(req: AuthenticatedRequest) {
  try {
    const body = await req.json();
    const { content, sceneId, imageId } = createCommentSchema.parse(body);

    // 최소한 하나의 컨텍스트 ID가 필요함
    if (!sceneId && !imageId) {
      return NextResponse.json(
        { success: false, error: "sceneId 또는 imageId 중 하나가 필요합니다." },
        { status: 400 }
      );
    }

    // 리소스 존재 확인
    let accessCheck = null;
    if (sceneId) {
      accessCheck = await prisma.scene.findUnique({
        where: { id: sceneId },
      });
    } else if (imageId) {
      accessCheck = await prisma.image.findUnique({
        where: { id: imageId },
      });
    }

    if (!accessCheck) {
      return NextResponse.json(
        { success: false, error: "리소스를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        userId: req.user.userId,
        sceneId: sceneId || undefined,
        imageId: imageId || undefined,
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
        scene: true,
        image: true,
      },
    });

    // 협업 로그 기록 (Scene이 있는 경우에만)
    try {
      if (comment.scene) {
        await prisma.collaborationLog.create({
          data: {
            projectId: comment.scene.projectId,
            userId: req.user.userId,
            action: "create_comment",
            details: "댓글을 작성했습니다.",
          },
        });
      }
    } catch (error) {
      // CollaborationLog 실패해도 댓글 생성은 성공으로 처리
      console.warn('CollaborationLog creation failed:', error);
    }

    return NextResponse.json({
      success: true,
      message: "댓글이 작성되었습니다.",
      data: { comment },
    });

  } catch (error) {
    console.error("Comment creation error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "입력 데이터가 유효하지 않습니다.", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "댓글 작성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getComments);
export const POST = withAuth(createComment);