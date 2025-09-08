import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";

const uploadImageSchema = z.object({
  sceneId: z.string().uuid("유효한 씬 ID가 필요합니다."),
  description: z.string().max(500, "설명은 500자를 초과할 수 없습니다.").optional(),
});

// POST /api/images/upload - 이미지 업로드
async function uploadImage(req: AuthenticatedRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const sceneId = formData.get("sceneId") as string;
    const description = formData.get("description") as string;
    const type = (formData.get("type") as string) || "art";

    if (!file) {
      return NextResponse.json(
        { success: false, error: "파일이 필요합니다." },
        { status: 400 }
      );
    }

    // 입력 데이터 검증
    const { sceneId: validSceneId } = uploadImageSchema.parse({
      sceneId,
      description: description || undefined,
    });

    // 씬 접근 권한 확인
    const scene = await prisma.scene.findUnique({
      where: { id: validSceneId },
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

    // 프로젝트 접근 권한 확인
    const hasAccess = scene.project.creatorId === req.user.userId ||
      scene.project.participants.length > 0 ||
      req.user.isAdmin;

    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "이미지 업로드 권한이 없습니다." },
        { status: 403 }
      );
    }

    if (scene.project.status !== "active") {
      return NextResponse.json(
        { success: false, error: "활성 상태인 프로젝트에만 이미지를 업로드할 수 있습니다." },
        { status: 400 }
      );
    }

    // 파일 타입 검증
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "지원하지 않는 파일 형식입니다. (JPEG, PNG, WebP, GIF만 지원)" },
        { status: 400 }
      );
    }

    // 파일 크기 검증 (최대 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: "파일 크기가 너무 큽니다. (최대 10MB)" },
        { status: 400 }
      );
    }

    // 파일 버퍼 읽기
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 파일명 생성
    const fileId = uuidv4();
    const extension = path.extname(file.name) || ".jpg";
    const filename = `${fileId}${extension}`;
    const thumbnailFilename = `${fileId}_thumb${extension}`;

    // 업로드 디렉토리 생성
    const uploadDir = path.join(process.cwd(), "uploads", "images");
    const thumbnailDir = path.join(process.cwd(), "uploads", "thumbnails");
    
    await mkdir(uploadDir, { recursive: true });
    await mkdir(thumbnailDir, { recursive: true });

    // 이미지 메타데이터 추출
    const imageMetadata = await sharp(buffer).metadata();
    
    // 원본 이미지 저장
    const originalPath = path.join(uploadDir, filename);
    await writeFile(originalPath, buffer);

    // 썸네일 생성 (최대 300x300)
    const thumbnailBuffer = await sharp(buffer)
      .resize(300, 300, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);
    await writeFile(thumbnailPath, thumbnailBuffer);

    // version 필드가 없으므로 버전 관리 로직은 생략

    // 데이터베이스에 이미지 정보 저장
    const image = await prisma.image.create({
      data: {
        sceneId: validSceneId,
        uploadedBy: req.user.userId,
        fileUrl: `/api/images/serve/${filename}`,
        fileSize: file.size,
        format: file.type.split('/')[1] || 'unknown',
        width: imageMetadata.width || undefined,
        height: imageMetadata.height || undefined,
        type,
      },
      include: {
        uploader: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true,
          },
        },
        scene: {
          select: {
            id: true,
            sceneNumber: true,
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // 협업 로그 기록
    await prisma.collaborationLog.create({
      data: {
        projectId: scene.projectId,
        userId: req.user.userId,
        actionType: "upload_image",
        targetType: "image",
        targetId: image.id,
        description: `씬 ${scene.sceneNumber}에 이미지를 업로드했습니다.`,
        metadata: { 
          filename: file.name,
          fileSize: file.size,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "이미지가 업로드되었습니다.",
      data: { image },
    });

  } catch (error) {
    console.error("Image upload error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "입력 데이터가 유효하지 않습니다.", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "이미지 업로드 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export const POST = withAuth(uploadImage);