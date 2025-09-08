import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";

const updateParticipantSchema = z.object({
  role: z.enum(["member", "admin"]),
});

interface ParticipantRouteParams {
  params: {
    id: string;
    userId: string;
  };
}

// PUT /api/projects/[id]/participants/[userId] - 참여자 역할 수정
export async function PUT(
  req: NextRequest,
  { params }: ParticipantRouteParams
) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const { id: projectId, userId: targetUserId } = params;
      const body = await authReq.json();
      const { role } = updateParticipantSchema.parse(body);

      // 현재 사용자의 권한 확인
      const currentParticipation = await prisma.projectParticipant.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: authReq.user.userId,
          },
        },
      });

      // 프로젝트 접근 권한 확인
      if (!currentParticipation && !authReq.user.isAdmin) {
        return NextResponse.json(
          { error: "프로젝트에 대한 접근 권한이 없습니다." },
          { status: 403 }
        );
      }

      // 역할 변경 권한 확인 - owner 또는 admin만 가능
      if (!["owner", "admin"].includes(currentParticipation?.role || "") && !authReq.user.isAdmin) {
        return NextResponse.json(
          { error: "참여자 역할 변경 권한이 없습니다." },
          { status: 403 }
        );
      }

      // 대상 참여자 확인
      const targetParticipation = await prisma.projectParticipant.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: targetUserId,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
              email: true,
            },
          },
        },
      });

      if (!targetParticipation) {
        return NextResponse.json(
          { error: "해당 참여자를 찾을 수 없습니다." },
          { status: 404 }
        );
      }

      // owner 역할은 변경할 수 없음
      if (targetParticipation.role === "owner") {
        return NextResponse.json(
          { error: "프로젝트 소유자의 역할은 변경할 수 없습니다." },
          { status: 400 }
        );
      }

      // 역할 업데이트
      const updatedParticipation = await prisma.projectParticipant.update({
        where: {
          projectId_userId: {
            projectId,
            userId: targetUserId,
          },
        },
        data: { role },
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
          userId: authReq.user.userId,
          actionType: "update_user_role",
          targetType: "user",
          targetId: targetUserId,
          description: `${targetParticipation.user.nickname}의 역할을 ${role}로 변경했습니다.`,
          metadata: { 
            previousRole: targetParticipation.role, 
            newRole: role 
          },
        },
      });

      return NextResponse.json({
        message: "참여자 역할이 업데이트되었습니다.",
        participation: updatedParticipation,
      });

    } catch (error) {
      console.error("Participant update error:", error);

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "입력 데이터가 유효하지 않습니다.", details: error.errors },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "참여자 역할 업데이트 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }
  })(req);
}

// DELETE /api/projects/[id]/participants/[userId] - 참여자 제거
export async function DELETE(
  req: NextRequest,
  { params }: ParticipantRouteParams
) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const { id: projectId, userId: targetUserId } = params;

      // 현재 사용자의 권한 확인
      const currentParticipation = await prisma.projectParticipant.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: authReq.user.userId,
          },
        },
      });

      // 프로젝트 접근 권한 확인
      if (!currentParticipation && !authReq.user.isAdmin) {
        return NextResponse.json(
          { error: "프로젝트에 대한 접근 권한이 없습니다." },
          { status: 403 }
        );
      }

      // 대상 참여자 확인
      const targetParticipation = await prisma.projectParticipant.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: targetUserId,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
              email: true,
            },
          },
        },
      });

      if (!targetParticipation) {
        return NextResponse.json(
          { error: "해당 참여자를 찾을 수 없습니다." },
          { status: 404 }
        );
      }

      // 권한 확인 - 자기 자신을 제거하거나, owner/admin이 다른 사용자를 제거하는 경우
      const isSelfRemoval = authReq.user.userId === targetUserId;
      const hasRemovalAuth = ["owner", "admin"].includes(currentParticipation?.role || "") || authReq.user.isAdmin;

      if (!isSelfRemoval && !hasRemovalAuth) {
        return NextResponse.json(
          { error: "참여자 제거 권한이 없습니다." },
          { status: 403 }
        );
      }

      // owner는 제거할 수 없음 (프로젝트 삭제만 가능)
      if (targetParticipation.role === "owner") {
        return NextResponse.json(
          { error: "프로젝트 소유자는 제거할 수 없습니다. 프로젝트를 삭제하거나 소유권을 이전하세요." },
          { status: 400 }
        );
      }

      // 참여자 제거
      await prisma.projectParticipant.delete({
        where: {
          projectId_userId: {
            projectId,
            userId: targetUserId,
          },
        },
      });

      // 협업 로그 기록
      await prisma.collaborationLog.create({
        data: {
          projectId,
          userId: authReq.user.userId,
          actionType: isSelfRemoval ? "leave_project" : "remove_user",
          targetType: "user",
          targetId: targetUserId,
          description: isSelfRemoval 
            ? "프로젝트에서 나갔습니다."
            : `${targetParticipation.user.nickname}을(를) 프로젝트에서 제거했습니다.`,
          metadata: { removedUserRole: targetParticipation.role },
        },
      });

      return NextResponse.json({
        message: isSelfRemoval 
          ? "프로젝트에서 나왔습니다." 
          : "참여자가 제거되었습니다.",
      });

    } catch (error) {
      console.error("Participant removal error:", error);
      return NextResponse.json(
        { error: "참여자 제거 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }
  })(req);
}