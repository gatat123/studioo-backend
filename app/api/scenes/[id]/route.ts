import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withSceneAccess, type AuthenticatedRequest } from "@/middleware/auth";

const updateSceneSchema = z.object({
  sceneNumber: z.number().int().positive("씬 번호는 양수여야 합니다.").optional(),
  description: z.string().max(1000, "설명은 1000자를 초과할 수 없습니다.").optional(),
  notes: z.string().max(2000, "노트는 2000자를 초과할 수 없습니다.").optional(),
});

// GET /api/scenes/[id] - 씬 상세 정보 조회
async function getScene(req: AuthenticatedRequest, sceneId: string) {
  try {
    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            status: true,
            creator: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true,
              },
            },
            participants: {
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
          },
        },
        images: {
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
            _count: {
              select: {
                annotations: true,
              },
            },
          },
          orderBy: { uploadedAt: "desc" },
        },
        comments: {
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
            images: true,
            comments: true,
          },
        },
      },
    });

    if (!scene) {
      return NextResponse.json(
        { success: false, error: "씬을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 현재 사용자의 프로젝트 역할 확인
    const currentUserParticipation = scene.project.participants.find(
      (p) => p.userId === req.user.userId
    );

    return NextResponse.json({
      success: true,
      data: {
        scene: {
          ...scene,
          project: {
            ...scene.project,
            currentUserRole: currentUserParticipation?.role || 
              (scene.project.creator.id === req.user.userId ? "owner" : null),
          },
        },
      },
    });

  } catch (error) {
    console.error("Scene fetch error:", error);
    return NextResponse.json(
      { success: false, error: "씬 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PUT /api/scenes/[id] - 씬 정보 수정
async function updateScene(req: AuthenticatedRequest, sceneId: string) {
  try {
    const body = await req.json();
    const validatedData = updateSceneSchema.parse(body);

    // 씬과 프로젝트 정보 조회
    const scene = await prisma.scene.findUnique({
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

    if (!scene) {
      return NextResponse.json(
        { success: false, error: "씬을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 권한 확인 - 프로젝트 참여자만 수정 가능
    const hasAccess = scene.project.creatorId === req.user.userId ||
      scene.project.participants.length > 0 ||
      req.user.isAdmin;

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "씬 수정 권한이 없습니다." },
        { status: 403 }
      );
    }

    if (scene.project.status !== "active") {
      return NextResponse.json(
        { success: false, error: "활성 상태인 프로젝트의 씬만 수정할 수 있습니다." },
        { status: 400 }
      );
    }

    // 씬 번호 중복 확인 (변경하는 경우)
    if (validatedData.sceneNumber && validatedData.sceneNumber !== scene.sceneNumber) {
      const existingScene = await prisma.scene.findFirst({
        where: {
          projectId: scene.projectId,
          sceneNumber: validatedData.sceneNumber,
          id: { not: sceneId }, // 현재 씬은 제외
        },
      });

      if (existingScene) {
        return NextResponse.json(
          { success: false, error: "해당 씬 번호가 이미 존재합니다." },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};
    if (validatedData.sceneNumber !== undefined) updateData.sceneNumber = validatedData.sceneNumber;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.notes !== undefined) updateData.notes = validatedData.notes;

    const updatedScene = await prisma.scene.update({
      where: { id: sceneId },
      data: updateData,
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
        projectId: scene.projectId,
        userId: req.user.userId,
        action: "update_scene",
        details: `씬 ${updatedScene.sceneNumber}을(를) 수정했습니다.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "씬이 업데이트되었습니다.",
      data: { scene: updatedScene },
    });

  } catch (error) {
    console.error("Scene update error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "입력 데이터가 유효하지 않습니다.", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "씬 업데이트 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// DELETE /api/scenes/[id] - 씬 삭제
async function deleteScene(req: AuthenticatedRequest, sceneId: string) {
  try {
    // 씬과 프로젝트 정보 조회
    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
      include: {
        project: {
          include: {
            participants: {
              where: { userId: req.user.userId },
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

    if (!scene) {
      return NextResponse.json(
        { success: false, error: "씬을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 권한 확인 - owner, admin 또는 시스템 관리자만 삭제 가능
    const participation = scene.project.participants[0];
    const isOwner = scene.project.creatorId === req.user.userId;
    const isProjectAdmin = participation?.role === "admin";

    if (!isOwner && !isProjectAdmin && !req.user.isAdmin) {
      return NextResponse.json(
        { success: false, error: "씬 삭제 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 씬에 이미지나 댓글이 있는 경우 확인
    if (scene._count.images > 0 || scene._count.comments > 0) {
      return NextResponse.json(
        { success: false, error: "이미지나 댓글이 있는 씬은 삭제할 수 없습니다. 먼저 관련 데이터를 삭제해주세요." },
        { status: 400 }
      );
    }

    // 씬 삭제
    await prisma.scene.delete({
      where: { id: sceneId },
    });

    // 협업 로그 기록
    await prisma.collaborationLog.create({
      data: {
        projectId: scene.projectId,
        userId: req.user.userId,
        action: "delete_scene",
        details: `씬 ${scene.sceneNumber}을(를) 삭제했습니다.`,
      },
    });

    return NextResponse.json({
      success: true,
      message: "씬이 삭제되었습니다.",
    });

  } catch (error) {
    console.error("Scene deletion error:", error);
    return NextResponse.json(
      { success: false, error: "씬 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const GET = withSceneAccess(getScene);
export const PUT = withSceneAccess(updateScene);
export const DELETE = withSceneAccess(deleteScene);