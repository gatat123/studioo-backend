import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";
import { sceneEvents } from "@/lib/socket/emit-helper";

const createSceneSchema = z.object({
  projectId: z.string().uuid("유효한 프로젝트 ID가 필요합니다."),
  sceneNumber: z.number().int().positive("씬 번호는 양수여야 합니다."),
  description: z.string().max(1000, "설명은 1000자를 초과할 수 없습니다.").optional(),
  notes: z.string().max(2000, "노트는 2000자를 초과할 수 없습니다.").optional(),
});

// GET /api/scenes - 프로젝트의 씬 목록 조회
async function getScenes(req: AuthenticatedRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const limit = parseInt(url.searchParams.get("limit") ?? "20");
    const search = url.searchParams.get("search");

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "프로젝트 ID가 필요합니다." },
        { status: 400 }
      );
    }

    // 프로젝트 접근 권한 확인
    const hasAccess = await prisma.project.findFirst({
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

    if (!hasAccess && !req.user.isAdmin) {
      return NextResponse.json(
        { success: false, error: "프로젝트 접근 권한이 없습니다." },
        { status: 403 }
      );
    }

    const skip = (page - 1) * limit;

    // 검색 조건 구성
    const where: any = { projectId };
    
    if (search) {
      where.OR = [
        { description: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { sceneNumber: { equals: parseInt(search) || undefined } },
      ];
    }

    const [scenes, total] = await Promise.all([
      prisma.scene.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sceneNumber: "asc" },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
          images: {
            select: {
              id: true,
              type: true,
              fileUrl: true,
              fileSize: true,
              width: true,
              height: true,
              format: true,
              isCurrent: true,
              uploadedAt: true,
            },
            where: { isCurrent: true },
            orderBy: { uploadedAt: "desc" },
            take: 1, // 최신 버전만
          },
          comments: {
            where: { parentCommentId: null },
            select: {
              id: true,
              content: true,
              createdAt: true,
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
            take: 3, // 최근 댓글 3개
          },
          _count: {
            select: {
              images: true,
              comments: true,
            },
          },
        },
      }),
      prisma.scene.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        scenes,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
    });

  } catch (error) {
    console.error("Scenes fetch error:", error);
    return NextResponse.json(
      { success: false, error: "씬 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST /api/scenes - 새 씬 생성
async function createScene(req: AuthenticatedRequest) {
  try {
    const body = await req.json();
    const { projectId, sceneNumber, description, notes } = createSceneSchema.parse(body);

    // 프로젝트 접근 권한 확인
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: req.user.userId },
          { 
            participants: {
              some: { 
                userId: req.user.userId,
                role: { in: ["owner", "admin", "member"] }
              }
            }
          }
        ]
      },
      include: {
        participants: {
          where: { userId: req.user.userId },
          select: { role: true }
        }
      }
    });

    if (!project && !req.user.isAdmin) {
      return NextResponse.json(
        { success: false, error: "프로젝트 접근 권한이 없습니다." },
        { status: 403 }
      );
    }

    if (project?.status !== "active") {
      return NextResponse.json(
        { success: false, error: "활성 상태인 프로젝트에만 씬을 추가할 수 있습니다." },
        { status: 400 }
      );
    }

    // 씬 번호 중복 확인
    const existingScene = await prisma.scene.findUnique({
      where: {
        projectId_sceneNumber: {
          projectId,
          sceneNumber,
        },
      },
    });

    if (existingScene) {
      return NextResponse.json(
        { success: false, error: "해당 씬 번호가 이미 존재합니다." },
        { status: 400 }
      );
    }

    const scene = await prisma.scene.create({
      data: {
        projectId,
        sceneNumber,
        description,
        notes,
        createdBy: req.user.userId,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        _count: {
          select: {
            images: true,
            comments: true,
          },
        },
      },
    });

    // 협업 로그 기록
    await prisma.collaborationLog.create({
      data: {
        projectId,
        userId: req.user.userId,
        actionType: "create_scene",
        targetType: "scene",
        targetId: scene.id,
        description: `씬 ${sceneNumber}을(를) 생성했습니다.`,
        metadata: { sceneNumber, description },
      },
    });

    // Socket.io 이벤트 발송
    await sceneEvents.created(projectId, scene);

    return NextResponse.json({
      success: true,
      message: "씬이 생성되었습니다.",
      data: { scene },
    });

  } catch (error) {
    console.error("Scene creation error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "입력 데이터가 유효하지 않습니다.", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "씬 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getScenes);
export const POST = withAuth(createScene);