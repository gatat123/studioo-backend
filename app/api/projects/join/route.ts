import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";

const joinProjectSchema = z.object({
  inviteCode: z.string().length(8, "초대 코드는 8자리여야 합니다."),
});

// POST /api/projects/join - 초대 코드로 프로젝트 참여
async function joinProject(req: AuthenticatedRequest) {
  try {
    const body = await req.json();
    const { inviteCode } = joinProjectSchema.parse(body);

    // 초대 코드 유효성 확인
    const invite = await prisma.projectInvite.findUnique({
      where: { code: inviteCode },
      include: {
        project: {
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
        },
      },
    });

    if (!invite) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 초대 코드입니다." },
        { status: 404 }
      );
    }

    if (!invite.isActive) {
      return NextResponse.json(
        { success: false, error: "비활성화된 초대 코드입니다." },
        { status: 400 }
      );
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: "만료된 초대 코드입니다." },
        { status: 400 }
      );
    }

    if (invite.maxUses && invite.usedCount >= invite.maxUses) {
      return NextResponse.json(
        { success: false, error: "사용 제한에 도달한 초대 코드입니다." },
        { status: 400 }
      );
    }

    // 이미 참여 중인지 확인
    const existingParticipation = await prisma.projectParticipant.findUnique({
      where: {
        projectId_userId: {
          projectId: invite.projectId,
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
    if (invite.project.status !== "active") {
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
          projectId: invite.projectId,
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

      // 초대 코드 사용 횟수 증가
      await tx.projectInvite.update({
        where: { id: invite.id },
        data: { usedCount: { increment: 1 } },
      });

      // 협업 로그 기록
      await tx.collaborationLog.create({
        data: {
          projectId: invite.projectId,
          userId: req.user.userId,
          actionType: "join_project",
          targetType: "project",
          targetId: invite.projectId,
          description: `초대 코드를 통해 프로젝트에 참여했습니다.`,
          metadata: { inviteCode },
        },
      });

      return { participation, project: invite.project };
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
        { success: false, error: "입력 데이터가 유효하지 않습니다.", details: error.errors },
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