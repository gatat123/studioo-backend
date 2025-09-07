import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";

const updateSceneSchema = z.object({
  description: z.string().optional(),
  notes: z.string().optional(),
});

interface SceneRouteParams {
  params: {
    id: string;
    sceneId: string;
  };
}

// GET /api/projects/[id]/scenes/[sceneId] - 씬 상세 정보 조회
export async function GET(
  req: NextRequest,
  { params }: SceneRouteParams
) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const { id: projectId, sceneId } = params;

      // 프로젝트 접근 권한 확인
      const participation = await prisma.projectParticipant.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: authReq.user.userId,
          },
        },
      });

      if (!participation && !authReq.user.isAdmin) {
        return NextResponse.json(
          { error: "프로젝트에 대한 접근 권한이 없습니다." },
          { status: 403 }
        );
      }

      const scene = await prisma.scene.findUnique({
        where: { id: sceneId },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              nickname: true,
              profileImageUrl: true,
            },
          },
          images: {
            where: { isCurrent: true },
            include: {
              uploader: {
                select: {
                  id: true,
                  username: true,
                  nickname: true,
                  profileImageUrl: true,
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
            },
            orderBy: [
              { type: "asc" },
              { uploadedAt: "desc" },
            ],
          },
          imageHistory: {
            include: {
              uploader: {
                select: {
                  id: true,
                  username: true,
                  nickname: true,
                },
              },
            },
            orderBy: { uploadedAt: "desc" },
            take: 20,
          },
          comments: {
            where: { parentCommentId: null },
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
            },
            orderBy: { createdAt: "desc" },
          },
          presence: {
            where: {
              lastActivity: {
                gte: new Date(Date.now() - 5 * 60 * 1000), // 5분 이내
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
          },
          _count: {
            select: {
              images: true,
              comments: true,
            },
          },
        },
      });

      if (!scene || scene.projectId !== projectId) {
        return NextResponse.json(
          { error: "씬을 찾을 수 없습니다." },
          { status: 404 }
        );
      }

      // 사용자 접근 기록 (마지막 조회 시간 업데이트)
      await prisma.projectParticipant.update({
        where: {
          projectId_userId: {
            projectId,
            userId: authReq.user.userId,
          },
        },
        data: { lastViewedAt: new Date() },
      });

      return NextResponse.json({ scene });

    } catch (error) {
      console.error("Scene fetch error:", error);
      return NextResponse.json(
        { error: "씬 조회 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }
  })(req);
}

// PUT /api/projects/[id]/scenes/[sceneId] - 씬 정보 수정
export async function PUT(
  req: NextRequest,
  { params }: SceneRouteParams
) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const { id: projectId, sceneId } = params;
      const body = await authReq.json();
      const validatedData = updateSceneSchema.parse(body);

      // 프로젝트 접근 권한 확인
      const participation = await prisma.projectParticipant.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: authReq.user.userId,
          },
        },
      });

      if (!participation && !authReq.user.isAdmin) {
        return NextResponse.json(
          { error: "프로젝트에 대한 접근 권한이 없습니다." },
          { status: 403 }
        );
      }

      // 씬 확인
      const existingScene = await prisma.scene.findUnique({
        where: { id: sceneId },
      });

      if (!existingScene || existingScene.projectId !== projectId) {
        return NextResponse.json(
          { error: "씬을 찾을 수 없습니다." },
          { status: 404 }
        );
      }

      const updatedScene = await prisma.$transaction(async (tx) => {
        // 씬 업데이트
        const scene = await tx.scene.update({
          where: { id: sceneId },
          data: validatedData,
          include: {
            creator: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true,
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

        // 프로젝트 업데이트 표시
        await tx.project.update({
          where: { id: projectId },
          data: { hasUpdates: true },
        });

        // 협업 로그 기록
        await tx.collaborationLog.create({
          data: {
            projectId,
            userId: authReq.user.userId,
            actionType: "update_scene",
            targetType: "scene",
            targetId: sceneId,
            description: `씬 ${scene.sceneNumber}를 수정했습니다.`,
            metadata: { sceneNumber: scene.sceneNumber, changes: validatedData },
          },
        });

        return scene;
      });

      return NextResponse.json({
        message: "씬이 업데이트되었습니다.",
        scene: updatedScene,
      });

    } catch (error) {
      console.error("Scene update error:", error);

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "입력 데이터가 유효하지 않습니다.", details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "씬 업데이트 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }
  })(req);
}

// DELETE /api/projects/[id]/scenes/[sceneId] - 씬 삭제
export async function DELETE(
  req: NextRequest,
  { params }: SceneRouteParams
) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const { id: projectId, sceneId } = params;

      // 권한 확인 - admin 역할 또는 시스템 관리자만 삭제 가능
      const participation = await prisma.projectParticipant.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: authReq.user.userId,
          },
        },
      });

      if (!participation || !["owner", "admin"].includes(participation.role)) {
        if (!authReq.user.isAdmin) {
          return NextResponse.json(
            { error: "씬 삭제 권한이 없습니다." },
            { status: 403 }
          );
        }
      }

      // 씬 확인
      const existingScene = await prisma.scene.findUnique({
        where: { id: sceneId },
      });

      if (!existingScene || existingScene.projectId !== projectId) {
        return NextResponse.json(
          { error: "씬을 찾을 수 없습니다." },
          { status: 404 }
        );
      }

      await prisma.$transaction(async (tx) => {
        // 씬 삭제 (CASCADE 설정으로 관련 데이터도 함께 삭제됨)
        await tx.scene.delete({
          where: { id: sceneId },
        });

        // 프로젝트 업데이트 표시
        await tx.project.update({
          where: { id: projectId },
          data: { hasUpdates: true },
        });

        // 협업 로그 기록
        await tx.collaborationLog.create({
          data: {
            projectId,
            userId: authReq.user.userId,
            actionType: "delete_scene",
            targetType: "scene",
            targetId: sceneId,
            description: `씬 ${existingScene.sceneNumber}를 삭제했습니다.`,
            metadata: { 
              sceneNumber: existingScene.sceneNumber,
              description: existingScene.description,
            },
          },
        });
      });

      return NextResponse.json({
        message: "씬이 삭제되었습니다.",
      });

    } catch (error) {
      console.error("Scene deletion error:", error);
      return NextResponse.json(
        { error: "씬 삭제 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }
  })(req);
}