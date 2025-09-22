import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";

const joinProjectSchema = z.object({
  inviteCode: z.string().min(1, "초대 코드는 필수입니다."),
});

// POST /api/projects/join - 초대 코드로 프로젝트 참여
async function joinProject(req: AuthenticatedRequest) {
  try {
    const body = await req.json();
    const { inviteCode } = joinProjectSchema.parse(body);

    // 초대 코드로 프로젝트 찾기
    const project = await prisma.project.findUnique({
      where: { inviteCode: inviteCode.toUpperCase() },
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
        participants: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 초대 코드입니다." },
        { status: 404 }
      );
    }

    // 이미 참여 중인지 확인
    const existingParticipation = await prisma.projectParticipant.findUnique({
      where: {
        projectId_userId: {
          projectId: project.id,
          userId: req.user.userId,
        },
      },
    });

    if (existingParticipation) {
      return NextResponse.json(
        { success: false, error: "이미 참여 중인 프로젝트입니다." },
        { status: 400 }
      );
    }

    // 프로젝트가 활성 상태인지 확인
    if (project.status !== "active") {
      return NextResponse.json(
        { success: false, error: "비활성 상태인 프로젝트에는 참여할 수 없습니다." },
        { status: 400 }
      );
    }

    // 트랜잭션으로 참여 처리
    const result = await prisma.$transaction(async (tx) => {
      // 참여자 추가
      const participation = await tx.projectParticipant.create({
        data: {
          projectId: project.id,
          userId: req.user.userId,
          role: "member", // 기본적으로 member 역할
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
          projectId: project.id,
          userId: req.user.userId,
          action: "join_project",
          details: `초대 코드를 통해 프로젝트에 참여했습니다.`,
        },
      });

      return { participation, project };
    });

    return NextResponse.json({
      success: true,
      message: "프로젝트에 성공적으로 참여했습니다.",
      project: {
        id: result.project.id,
        name: result.project.name,
        description: result.project.description,
        status: result.project.status,
        creator: result.project.creator,
        studio: result.project.studio,
        participantCount: result.project.participants.length + 1, // 새 참여자 포함
        currentUserRole: result.participation.role,
      },
    });

  } catch (error) {
    console.error("Project join error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "입력 데이터가 유효하지 않습니다.", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "프로젝트 참여 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const POST = withAuth(joinProject);