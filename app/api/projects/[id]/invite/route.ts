import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withProjectAccess, type AuthenticatedRequest } from "@/middleware/auth";
import { v4 as uuidv4 } from "uuid";

const generateInviteCodeSchema = z.object({
  regenerate: z.boolean().optional().default(false),
});

// POST /api/projects/[id]/invite - 초대 코드 생성
async function generateInviteCode(req: AuthenticatedRequest, context: { params: { id: string } }) {
  const projectId = context.params.id;
  try {
    const body = await req.json();
    const { regenerate } = generateInviteCodeSchema.parse(body);

    // 권한 확인 - owner 또는 admin만 초대 코드 생성 가능
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
          { success: false, error: "초대 코드 생성 권한이 없습니다." },
          { status: 403 }
        );
      }
    }

    // 기존 초대 코드 확인
    const existingProject = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        description: true,
        inviteCode: true,
      },
    });

    if (!existingProject) {
      return NextResponse.json(
        { success: false, error: "프로젝트를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 기존 초대 코드가 있고 regenerate가 false인 경우
    if (existingProject.inviteCode && !regenerate) {
      return NextResponse.json({
        success: true,
        message: "기존 초대 코드가 있습니다.",
        invite: {
          code: existingProject.inviteCode,
          project: {
            id: existingProject.id,
            name: existingProject.name,
            description: existingProject.description,
          },
        },
      });
    }

    // 새로운 초대 코드 생성
    const code = uuidv4().substring(0, 8).toUpperCase();

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: { inviteCode: code },
      select: {
        id: true,
        name: true,
        description: true,
        inviteCode: true,
      },
    });

    // 협업 로그 기록
    await prisma.collaborationLog.create({
      data: {
        projectId,
        userId: req.user.userId,
        actionType: regenerate ? "regenerate_invite" : "create_invite",
        targetType: "project",
        targetId: projectId,
        description: regenerate 
          ? "초대 코드를 재생성했습니다."
          : "초대 코드를 생성했습니다.",
        metadata: { 
          inviteCode: code,
          regenerate,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: regenerate ? "초대 코드가 재생성되었습니다." : "초대 코드가 생성되었습니다.",
      invite: {
        code: updatedProject.inviteCode,
        project: {
          id: updatedProject.id,
          name: updatedProject.name,
          description: updatedProject.description,
        },
      },
    });

  } catch (error) {
    console.error("Invite code generation error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "입력 데이터가 유효하지 않습니다.", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "초대 코드 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const POST = withProjectAccess(generateInviteCode);