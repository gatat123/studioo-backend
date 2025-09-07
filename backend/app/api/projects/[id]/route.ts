import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withProjectAccess, type AuthenticatedRequest } from "@/middleware/auth";

const updateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  deadline: z.string().datetime().nullable().optional(),
  tag: z.string().max(50).nullable().optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
});

// GET /api/projects/[id] - 프로젝트 상세 정보 조회
async function getProject(req: AuthenticatedRequest, projectId: string) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
          },
        },
        studio: {
          select: {
            id: true,
            name: true,
            description: true,
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
          orderBy: [
            { role: "asc" },
            { joinedAt: "asc" },
          ],
        },
        scenes: {
          select: {
            id: true,
            sceneNumber: true,
            description: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                images: true,
                comments: true,
              },
            },
          },
          orderBy: { sceneNumber: "asc" },
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
            _count: {
              select: {
                replies: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        _count: {
          select: {
            scenes: true,
            comments: true,
            participants: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "프로젝트를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 현재 사용자의 역할 확인
    const currentUserParticipation = project.participants.find(
      (p) => p.userId === req.user.userId
    );

    return NextResponse.json({
      project: {
        ...project,
        currentUserRole: currentUserParticipation?.role || null,
      },
    });

  } catch (error) {
    console.error("Project fetch error:", error);
    return NextResponse.json(
      { error: "프로젝트 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PUT /api/projects/[id] - 프로젝트 정보 수정
async function updateProject(req: AuthenticatedRequest, projectId: string) {
  try {
    const body = await req.json();
    const validatedData = updateProjectSchema.parse(body);

    // 권한 확인 - owner 또는 admin만 수정 가능
    const participation = await prisma.projectParticipant.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: req.user.userId,
        },
      },
    });

    if (!participation || !["owner", "admin"].includes(participation.role)) {
      if (!req.user.isAdmin) {
        return NextResponse.json(
          { error: "프로젝트 수정 권한이 없습니다." },
          { status: 403 }
        );
      }
    }

    const updateData: any = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.deadline !== undefined) {
      updateData.deadline = validatedData.deadline ? new Date(validatedData.deadline) : null;
    }
    if (validatedData.tag !== undefined) updateData.tag = validatedData.tag;
    if (validatedData.status !== undefined) updateData.status = validatedData.status;

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
          },
        },
        studio: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            scenes: true,
            comments: true,
            participants: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: "프로젝트가 업데이트되었습니다.",
      project: updatedProject,
    });

  } catch (error) {
    console.error("Project update error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "입력 데이터가 유효하지 않습니다.", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "프로젝트 업데이트 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - 프로젝트 삭제
async function deleteProject(req: AuthenticatedRequest, projectId: string) {
  try {
    // 권한 확인 - owner 또는 시스템 관리자만 삭제 가능
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        participants: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "프로젝트를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const isOwner = project.creatorId === req.user.userId;
    const isOwnerParticipant = project.participants.some(
      (p) => p.userId === req.user.userId && p.role === "owner"
    );

    if (!isOwner && !isOwnerParticipant && !req.user.isAdmin) {
      return NextResponse.json(
        { error: "프로젝트 삭제 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 프로젝트 삭제 (CASCADE 설정으로 관련 데이터도 함께 삭제됨)
    await prisma.project.delete({
      where: { id: projectId },
    });

    return NextResponse.json({
      message: "프로젝트가 삭제되었습니다.",
    });

  } catch (error) {
    console.error("Project deletion error:", error);
    return NextResponse.json(
      { error: "프로젝트 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const GET = withProjectAccess(getProject);
export const PUT = withProjectAccess(updateProject);
export const DELETE = withProjectAccess(deleteProject);