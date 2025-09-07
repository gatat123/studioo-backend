import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withProjectAccess, type AuthenticatedRequest } from "@/middleware/auth";
import { v4 as uuidv4 } from "uuid";

const generateInviteCodeSchema = z.object({
  expiresInDays: z.number().min(1).max(30).default(7),
  maxUses: z.number().min(1).max(100).optional(),
});

// POST /api/projects/[id]/invite - 초대 코드 생성
async function generateInviteCode(req: AuthenticatedRequest, projectId: string) {
  try {
    const body = await req.json();
    const { expiresInDays, maxUses } = generateInviteCodeSchema.parse(body);

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

    // 기존 활성 초대 코드 확인
    const existingInvite = await prisma.projectInvite.findFirst({
      where: {
        projectId,
        isActive: true,
        expiresAt: {
          gt: new Date(),
        },
        OR: [
          { maxUses: null },
          { 
            AND: [
              { maxUses: { not: null } },
              { usedCount: { lt: prisma.$queryRaw`max_uses` } }
            ]
          }
        ]
      },
    });

    if (existingInvite) {
      return NextResponse.json({
        success: true,
        message: "기존 활성 초대 코드가 있습니다.",
        invite: {
          code: existingInvite.code,
          expiresAt: existingInvite.expiresAt,
          maxUses: existingInvite.maxUses,
          usedCount: existingInvite.usedCount,
        },
      });
    }

    // 새로운 초대 코드 생성
    const code = uuidv4().substring(0, 8).toUpperCase();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const invite = await prisma.projectInvite.create({
      data: {
        projectId,
        code,
        createdBy: req.user.userId,
        expiresAt,
        maxUses,
        usedCount: 0,
        isActive: true,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        creator: {
          select: {
            id: true,
            username: true,
            nickname: true,
          },
        },
      },
    });

    // 협업 로그 기록
    await prisma.collaborationLog.create({
      data: {
        projectId,
        userId: req.user.userId,
        actionType: "create_invite",
        targetType: "invite",
        targetId: invite.id,
        description: `초대 코드를 생성했습니다 (${expiresInDays}일 유효).`,
        metadata: { 
          inviteCode: code, 
          expiresInDays,
          maxUses 
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "초대 코드가 생성되었습니다.",
      invite: {
        code: invite.code,
        expiresAt: invite.expiresAt,
        maxUses: invite.maxUses,
        usedCount: invite.usedCount,
        project: invite.project,
      },
    });

  } catch (error) {
    console.error("Invite code generation error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "입력 데이터가 유효하지 않습니다.", details: error.errors },
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