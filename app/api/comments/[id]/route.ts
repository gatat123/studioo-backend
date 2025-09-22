import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";

const updateCommentSchema = z.object({
  content: z.string().min(1, "댓글 내용이 필요합니다.").max(2000, "댓글은 2000자를 초과할 수 없습니다."),
});

// PUT /api/comments/[id] - 댓글 수정
async function updateComment(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const commentId = params.id;
  try {
    const body = await req.json();
    const { content } = updateCommentSchema.parse(body);

    // 댓글 정보 조회
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        scene: true,
        image: true,
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

    if (!comment) {
      return NextResponse.json(
        { success: false, error: "댓글을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 권한 확인 - 댓글 작성자만 수정 가능
    if (comment.userId !== req.user.userId && !req.user.isAdmin) {
      return NextResponse.json(
        { success: false, error: "댓글 수정 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 댓글이 씬이나 이미지와 연결되어 있는지 확인
    if (!comment.sceneId && !comment.imageId) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 댓글입니다." },
        { status: 400 }
      );
    }

    // 댓글 생성 후 24시간이 지났는지 확인 (편집 제한)
    const now = new Date();
    const commentAge = now.getTime() - comment.createdAt.getTime();
    const maxEditTime = 24 * 60 * 60 * 1000; // 24시간

    if (commentAge > maxEditTime && !req.user.isAdmin) {
      return NextResponse.json(
        { success: false, error: "댓글은 작성 후 24시간 이내에만 수정할 수 있습니다." },
        { status: 400 }
      );
    }

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        content,
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
        scene: true,
        image: true,
      },
    });

    // 협업 로그 기록 (간소화)
    const targetType = comment.sceneId ? "scene" : "image";
    const targetId = comment.sceneId || comment.imageId || "";

    // CollaborationLog가 존재하는 경우에만 생성
    try {
      // Scene에서 프로젝트 ID를 찾아서 로그 생성
      if (comment.scene) {
        await prisma.collaborationLog.create({
          data: {
            userId: req.user.userId,
            projectId: comment.scene.projectId,
            action: "update_comment",
            details: "댓글을 수정했습니다.",
          },
        });
      }
    } catch (error) {
      // CollaborationLog 실패해도 댓글 수정은 성공으로 처리
      console.warn('CollaborationLog creation failed:', error);
    }

    return NextResponse.json({
      success: true,
      message: "댓글이 수정되었습니다.",
      data: { comment: updatedComment },
    });

  } catch (error) {
    console.error("Comment update error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "입력 데이터가 유효하지 않습니다.", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "댓글 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// DELETE /api/comments/[id] - 댓글 삭제
async function deleteComment(req: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const commentId = params.id;
  try {
    // 댓글 정보 조회
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        scene: true,
        image: true,
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

    if (!comment) {
      return NextResponse.json(
        { success: false, error: "댓글을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 권한 확인 - 댓글 작성자 또는 시스템 관리자만 삭제 가능
    const isAuthor = comment.userId === req.user.userId;

    if (!isAuthor && !req.user.isAdmin) {
      return NextResponse.json(
        { success: false, error: "댓글 삭제 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 댓글 삭제
    await prisma.comment.delete({
      where: { id: commentId },
    });

    // 협업 로그 기록 (간소화)
    try {
      // Scene에서 프로젝트 ID를 찾아서 로그 생성
      if (comment.scene) {
        await prisma.collaborationLog.create({
          data: {
            userId: req.user.userId,
            projectId: comment.scene.projectId,
            action: "delete_comment",
            details: "댓글을 삭제했습니다.",
          },
        });
      }
    } catch (error) {
      // CollaborationLog 실패해도 댓글 삭제는 성공으로 처리
      console.warn('CollaborationLog creation failed:', error);
    }

    return NextResponse.json({
      success: true,
      message: "댓글이 삭제되었습니다.",
    });

  } catch (error) {
    console.error("Comment deletion error:", error);
    return NextResponse.json(
      { success: false, error: "댓글 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const PUT = withAuth(updateComment);
export const DELETE = withAuth(deleteComment);