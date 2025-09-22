import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { z } from "zod";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";

const uploadImageSchema = z.object({
  changeDescription: z.string().optional(),
});


// GET /api/projects/[id]/scenes/[sceneId]/images - 씬의 이미지 목록 조회
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; sceneId: string }> }
) {
  return withAuth(async (authReq: AuthenticatedRequest, ctx: { params: any }) => {
    try {
      const params = ctx.params;
      const { id: projectId, sceneId } = params;
      const url = new URL(req.url);
      const type = url.searchParams.get("type");
      const includeHistory = url.searchParams.get("include_history") === "true";

      // 프로젝트 접근 권한 확인
      const participation = await prisma.projectParticipant.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: authReq.user.userId,
          },
        },
      });

      if (!participation && !authReq.user.isAdmin) {
        return NextResponse.json(
          { error: "프로젝트에 대한 접근 권한이 없습니다." },
          { status: 403 }
        );
      }

      // 씬 확인
      const scene = await prisma.scene.findUnique({
        where: { id: sceneId },
      });

      if (!scene || scene.projectId !== projectId) {
        return NextResponse.json(
          { error: "씬을 찾을 수 없습니다." },
          { status: 404 }
        );
      }

      const whereCondition: any = { sceneId };

      const images = await prisma.image.findMany({
        where: whereCondition,
        include: {
          uploader: {
            select: {
              id: true,
              username: true,
              nickname: true,
              profileImageUrl: true,
            },
          },
          annotations: {
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
          },
          history: includeHistory,
        },
        orderBy: { uploadedAt: "desc" },
      });

      console.log('GET /api/projects/[id]/scenes/[sceneId]/images - Found images:', {
        projectId,
        sceneId,
        count: images.length
      });

      // Convert BigInt to string for JSON serialization
      const serializedImages = images.map(image => ({
        ...image,
        fileSize: image.fileSize ? image.fileSize.toString() : null,
        history: image.history ? image.history.map((h: any) => ({
          ...h,
          fileSize: h.fileSize ? h.fileSize.toString() : null,
        })) : undefined,
      }));

      return NextResponse.json({ images: serializedImages });

    } catch (error) {
      console.error("Images fetch error:", error);
      return NextResponse.json(
        { error: "이미지 목록 조회 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }
  })(req, context);
}

// POST /api/projects/[id]/scenes/[sceneId]/images - 새 이미지 업로드
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; sceneId: string }> }
) {
  return withAuth(async (authReq: AuthenticatedRequest, ctx: { params: any }) => {
    try {
      const params = ctx.params;
      const { id: projectId, sceneId } = params;

      // 프로젝트 접근 권한 확인
      const participation = await prisma.projectParticipant.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: authReq.user.userId,
          },
        },
      });

      if (!participation && !authReq.user.isAdmin) {
        return NextResponse.json(
          { error: "프로젝트에 대한 접근 권한이 없습니다." },
          { status: 403 }
        );
      }

      // 씬 확인
      const scene = await prisma.scene.findUnique({
        where: { id: sceneId },
      });

      if (!scene || scene.projectId !== projectId) {
        return NextResponse.json(
          { error: "씬을 찾을 수 없습니다." },
          { status: 404 }
        );
      }

      const formData = await authReq.formData();
      const file = formData.get("file") as File;
      const changeDescription = formData.get("changeDescription") as string;

      if (!file) {
        return NextResponse.json(
          { error: "파일이 필요합니다." },
          { status: 400 }
        );
      }

      // 파일 유효성 검사
      const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!validTypes.includes(file.type)) {
        return NextResponse.json(
          { error: "지원하지 않는 파일 형식입니다. JPG, PNG, WebP, GIF만 업로드 가능합니다." },
          { status: 400 }
        );
      }

      // 파일 크기 검사 (10MB 제한)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: "파일 크기는 10MB 이하여야 합니다." },
          { status: 400 }
        );
      }

      const validatedData = uploadImageSchema.parse({
        changeDescription,
      });

      // 업로드 디렉토리 확인/생성
      const uploadDir = process.env.UPLOAD_DIR || "./uploads";
      const projectDir = path.join(uploadDir, projectId);
      const sceneDir = path.join(projectDir, sceneId);

      if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });
      if (!existsSync(projectDir)) await mkdir(projectDir, { recursive: true });
      if (!existsSync(sceneDir)) await mkdir(sceneDir, { recursive: true });

      // 파일명 생성
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = path.join(sceneDir, fileName);
      
      // Use full backend URL for production
      const backendUrl = process.env.NODE_ENV === 'production' 
        ? 'https://studioo-backend-production.up.railway.app'
        : (process.env.BACKEND_URL || 'http://localhost:3001');
      const fileUrl = `${backendUrl}/api/images/serve/${projectId}/${sceneId}/${fileName}`;

      // 파일 저장
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filePath, buffer);

      // Sharp를 사용하여 이미지 메타데이터 추출
      let width: number | undefined, height: number | undefined, format: string | undefined;
      try {
        const metadata = await sharp(buffer).metadata();
        width = metadata.width;
        height = metadata.height;
        format = metadata.format;
      } catch (error) {
        console.warn("Failed to extract image metadata:", error);
      }

      const result = await prisma.$transaction(async (tx) => {
        // 새 이미지 생성
        const newImage = await tx.image.create({
          data: {
            sceneId,
            filename: fileName,
            originalName: file.name,
            mimeType: file.type,
            fileSize: file.size,
            width,
            height,
            uploaderId: authReq.user.userId,
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
          },
        });

        // 이미지 히스토리 생성
        await tx.imageHistory.create({
          data: {
            imageId: newImage.id,
            userId: authReq.user.userId,
            action: "uploaded",
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
            userId: authReq.user.userId,
            action: "upload_image",
            details: `씬 ${scene.sceneNumber}에 이미지 ${file.name}를 업로드했습니다.`,
          },
        });

        return newImage;
      });

      // Convert BigInt to string for JSON serialization
      const serializedResult = {
        ...result,
        fileSize: result.fileSize ? result.fileSize.toString() : null,
      };

      return NextResponse.json({
        message: "이미지가 업로드되었습니다.",
        image: serializedResult,
      });

    } catch (error) {
      console.error("Image upload error:", error);

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "입력 데이터가 유효하지 않습니다.", details: error.issues },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: "이미지 업로드 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }
  })(req, context);
}