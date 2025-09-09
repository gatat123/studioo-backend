import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";

const createCommentSchema = z.object({
  content: z.string().min(1, "댓글 내용이 필요합니다.").max(20000, "댓글은 20000자를 초과할 수 없습니다."), // Increased for annotation data
  projectId: z.string().uuid("유효한 프로젝트 ID가 필요합니다.").optional(),
  sceneId: z.string().uuid("유효한 씬 ID가 필요합니다.").optional(),
  parentCommentId: z.string().uuid("유효한 부모 댓글 ID가 필요합니다.").optional(),
  metadata: z.any().optional(), // For annotation data
});

// GET /api/comments - 댓글 목록 조회
async function getComments(req: AuthenticatedRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const sceneId = url.searchParams.get("sceneId");
    const parentCommentId = url.searchParams.get("parentCommentId");
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const limit = parseInt(url.searchParams.get("limit") ?? "20");
    const orderBy = url.searchParams.get("orderBy") ?? "createdAt";
    const order = url.searchParams.get("order") ?? "desc";

    // 최소한 하나의 컨텍스트 ID가 필요함
    if (!projectId && !sceneId) {
      return NextResponse.json(
        { success: false, error: "projectId 또는 sceneId 중 하나가 필요합니다." },
        { status: 400 }
      );
    }

    let accessCheck = null;

    // 접근 권한 확인
    if (sceneId) {
      accessCheck = await prisma.scene.findUnique({
        where: { id: sceneId },
        include: {
          project: {
            include: {
              participants: {
                where: { userId: req.user.userId },
              },
            },
          },
        },
      });

      if (accessCheck) {
        const hasAccess = accessCheck.project.creatorId === req.user.userId ||
          accessCheck.project.participants.length > 0 ||
          req.user.isAdmin;

        if (!hasAccess) {
          return NextResponse.json(
            { success: false, error: "댓글 조회 권한이 없습니다." },
            { status: 403 }
          );
        }
      }
    } else if (projectId) {
      accessCheck = await prisma.project.findFirst({
        where: {
          id: projectId,
          OR: [
            { creatorId: req.user.userId },
            { 
              participants: {
                some: { userId: req.user.userId }
              }
            }
          ]
        }
      });

      if (!accessCheck && !req.user.isAdmin) {
        return NextResponse.json(
          { success: false, error: "댓글 조회 권한이 없습니다." },
          { status: 403 }
        );
      }
    }

    if (!accessCheck) {
      return NextResponse.json(
        { success: false, error: "리소스를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const skip = (page - 1) * limit;

    // 쿼리 조건 구성
    const where: any = {};
    
    if (parentCommentId) {
      where.parentCommentId = parentCommentId;
    } else {
      where.parentCommentId = null; // 최상위 댓글만
    }

    if (sceneId) {
      where.sceneId = sceneId;
    } else if (projectId) {
      where.projectId = projectId;
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
          replies: {
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
            orderBy: { createdAt: "asc" },
            take: 5, // 최근 답글 5개만
          },
          _count: {
            select: {
              replies: true,
            },
          },
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
    const { content, projectId, sceneId, parentCommentId, metadata } = createCommentSchema.parse(body);

    // 최소한 하나의 컨텍스트 ID가 필요함
    if (!projectId && !sceneId) {
      return NextResponse.json(
        { success: false, error: "projectId 또는 sceneId 중 하나가 필요합니다." },
        { status: 400 }
      );
    }

    let targetProjectId = projectId;
    let accessCheck = null;

    // 접근 권한 확인 및 프로젝트 ID 확인
    if (sceneId) {
      accessCheck = await prisma.scene.findUnique({
        where: { id: sceneId },
        include: {
          project: {
            include: {
              participants: {
                where: { userId: req.user.userId },
              },
            },
          },
        },
      });

      if (accessCheck) {
        targetProjectId = accessCheck.project.id;
        const hasAccess = accessCheck.project.creatorId === req.user.userId ||
          accessCheck.project.participants.length > 0 ||
          req.user.isAdmin;

        if (!hasAccess) {
          return NextResponse.json(
            { success: false, error: "댓글 작성 권한이 없습니다." },
            { status: 403 }
          );
        }

        if (accessCheck.project.status !== "active") {
          return NextResponse.json(
            { success: false, error: "활성 상태인 프로젝트에만 댓글을 작성할 수 있습니다." },
            { status: 400 }
          );
        }
      }
    } else if (projectId) {
      accessCheck = await prisma.project.findFirst({
        where: {
          id: projectId,
          OR: [
            { creatorId: req.user.userId },
            { 
              participants: {
                some: { userId: req.user.userId }
              }
            }
          ]
        }
      });

      if (!accessCheck && !req.user.isAdmin) {
        return NextResponse.json(
          { success: false, error: "댓글 작성 권한이 없습니다." },
          { status: 403 }
        );
      }

      if (accessCheck && accessCheck.status !== "active") {
        return NextResponse.json(
          { success: false, error: "활성 상태인 프로젝트에만 댓글을 작성할 수 있습니다." },
          { status: 400 }
        );
      }
    }

    if (!accessCheck) {
      return NextResponse.json(
        { success: false, error: "리소스를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 부모 댓글 존재 확인 (답글인 경우)
    if (parentCommentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentCommentId },
      });

      if (!parentComment) {
        return NextResponse.json(
          { success: false, error: "부모 댓글을 찾을 수 없습니다." },
          { status: 404 }
        );
      }

      // 부모 댓글이 같은 컨텍스트에 있는지 확인
      const sameContext = 
        (sceneId && parentComment.sceneId === sceneId) ||
        (projectId && !sceneId && parentComment.projectId === projectId);

      if (!sameContext) {
        return NextResponse.json(
          { success: false, error: "부모 댓글과 같은 컨텍스트에서만 답글을 작성할 수 있습니다." },
          { status: 400 }
        );
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        userId: req.user.userId,
        projectId: targetProjectId,
        sceneId: sceneId || undefined,
        parentCommentId: parentCommentId || undefined,
        metadata: metadata || undefined,
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
        replies: {
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
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: {
            replies: true,
          },
        },
      },
    });

    // 협업 로그 기록
    const targetType = sceneId ? "scene" : "project";
    const targetId = sceneId || projectId;
    const description = parentCommentId ? "답글을 작성했습니다." : "댓글을 작성했습니다.";

    await prisma.collaborationLog.create({
      data: {
        projectId: targetProjectId!,
        userId: req.user.userId,
        actionType: "create_comment",
        targetType,
        targetId: targetId!,
        description,
        metadata: { 
          commentLength: content.length,
          isReply: !!parentCommentId,
        },
      },
    });

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