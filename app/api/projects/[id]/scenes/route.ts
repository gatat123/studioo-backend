import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withProjectAccess, type AuthenticatedRequest } from "@/middleware/auth";

const createSceneSchema = z.object({
  description: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/projects/[id]/scenes - 프로젝트의 씬 목록 조회
async function getScenes(req: AuthenticatedRequest, context: { params: { id: string } }) {
  const projectId = context.params.id;
  try {
    const url = new URL(req.url);
    const includeImages = url.searchParams.get("include_images") === "true";

    const scenes = await prisma.scene.findMany({
      where: { projectId },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
          },
        },
        images: includeImages ? {
          where: { isCurrent: true },
          select: {
            id: true,
            type: true,
            fileUrl: true,
            width: true,
            height: true,
            format: true,
            uploadedAt: true,
            uploader: {
              select: {
                id: true,
                username: true,
                nickname: true,
              },
            },
          },
          orderBy: { uploadedAt: "desc" },
        } : false,
        _count: {
          select: {
            images: true,
            comments: true,
          },
        },
      },
      orderBy: { sceneNumber: "asc" },
    });

    // Convert BigInt to string for images
    const processedScenes = scenes.map(scene => ({
      ...scene,
      images: scene.images ? scene.images.map((img: any) => ({
        ...img,
        fileSize: img.fileSize ? img.fileSize.toString() : null
      })) : undefined
    }));

    return NextResponse.json({ scenes: processedScenes });

  } catch (error) {
    console.error("Scenes fetch error:", error);
    return NextResponse.json(
      { error: "씬 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/scenes - 새 씬 생성
async function createScene(req: AuthenticatedRequest, context: { params: { id: string } }) {
  const projectId = context.params.id;
  try {
    const body = await req.json();
    const { description, notes } = createSceneSchema.parse(body);

    // 다음 씬 번호 계산
    const lastScene = await prisma.scene.findFirst({
      where: { projectId },
      orderBy: { sceneNumber: "desc" },
      select: { sceneNumber: true },
    });

    const nextSceneNumber = (lastScene?.sceneNumber || 0) + 1;

    const scene = await prisma.$transaction(async (tx) => {
      // 씬 생성
      const newScene = await tx.scene.create({
        data: {
          projectId,
          sceneNumber: nextSceneNumber,
          description,
          notes,
          createdBy: req.user.userId,
        },
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
          userId: req.user.userId,
          actionType: "create_scene",
          targetType: "scene",
          targetId: newScene.id,
          description: `씬 ${nextSceneNumber}를 생성했습니다.`,
          metadata: { sceneNumber: nextSceneNumber, description },
        },
      });

      return newScene;
    });

    return NextResponse.json({
      message: "씬이 생성되었습니다.",
      scene,
    });

  } catch (error) {
    console.error("Scene creation error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "입력 데이터가 유효하지 않습니다.", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "씬 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const GET = withProjectAccess(getScenes);
export const POST = withProjectAccess(createScene);