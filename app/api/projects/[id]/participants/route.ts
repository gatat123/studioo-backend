import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withProjectAccess, type AuthenticatedRequest } from "@/middleware/auth";

const inviteParticipantSchema = z.object({
  email: z.string().email(),
  role: z.enum(["member", "admin"]).default("member"),
});


// GET /api/projects/[id]/participants - 프로젝트 참여자 목록 조회
async function getParticipants(_req: AuthenticatedRequest, context: { params: { id: string } }) {
  const projectId = context.params.id;
  try {
    const participants = await prisma.projectParticipant.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            email: true,
            profileImageUrl: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: [
        { role: "asc" },
        { joinedAt: "asc" },
      ],
    });

    return NextResponse.json({ participants });

  } catch (error) {
    console.error("Participants fetch error:", error);
    return NextResponse.json(
      { error: "참여자 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST /api/projects/[id]/participants - 새 참여자 초대
async function inviteParticipant(req: AuthenticatedRequest, context: { params: { id: string } }) {
  const projectId = context.params.id;
  try {
    const body = await req.json();
    const { email, role } = inviteParticipantSchema.parse(body);

    // 권한 확인 - owner 또는 admin만 참여자 초대 가능
    const currentParticipation = await prisma.projectParticipant.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: req.user.userId,
        },
      },
    });

    if (!currentParticipation || !["owner", "admin"].includes(currentParticipation.role)) {
      if (!req.user.isAdmin) {
        return NextResponse.json(
          { error: "참여자 초대 권한이 없습니다." },
          { status: 403 }
        );
      }
    }

    // 초대할 사용자 확인
    const invitedUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!invitedUser) {
      return NextResponse.json(
        { error: "해당 이메일의 사용자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (!invitedUser.isActive) {
      return NextResponse.json(
        { error: "비활성화된 사용자입니다." },
        { status: 400 }
      );
    }

    // 이미 참여 중인지 확인
    const existingParticipation = await prisma.projectParticipant.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: invitedUser.id,
        },
      },
    });

    if (existingParticipation) {
      return NextResponse.json(
        { error: "이미 프로젝트에 참여 중인 사용자입니다." },
        { status: 400 }
      );
    }

    // 참여자 추가
    const participation = await prisma.projectParticipant.create({
      data: {
        projectId,
        userId: invitedUser.id,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            email: true,
            profileImageUrl: true,
            lastLoginAt: true,
          },
        },
      },
    });

    // 협업 로그 기록
    await prisma.collaborationLog.create({
      data: {
        projectId,
        userId: req.user.userId,
        actionType: "invite_user",
        targetType: "user",
        targetId: invitedUser.id,
        description: `${invitedUser.nickname}을(를) ${role} 권한으로 초대했습니다.`,
        metadata: { invitedUserEmail: email, role },
      },
    });

    return NextResponse.json({
      message: "참여자가 성공적으로 초대되었습니다.",
      participation,
    });

  } catch (error) {
    console.error("Participant invitation error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "입력 데이터가 유효하지 않습니다.", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "참여자 초대 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const GET = withProjectAccess(getParticipants);
export const POST = withProjectAccess(inviteParticipant);