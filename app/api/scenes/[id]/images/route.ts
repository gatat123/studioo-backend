import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";
import { z } from "zod";
import sharp from "sharp";
import { getGlobalSocketInstance } from "@/lib/socket/global-socket";

const uploadImageSchema = z.object({
  type: z.enum(["lineart", "art", "storyboard", "reference", "concept"]),
  changeDescription: z.string().optional(),
});

// POST /api/scenes/[id]/images - Upload image to scene
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const params = await context.params;
      const sceneId = params.id;
      const formData = await req.formData();
      
      const file = formData.get("image") as File;
      const type = formData.get("type") as string;
      const changeDescription = formData.get("changeDescription") as string | null;

      if (!file) {
        return NextResponse.json(
          { error: "이미지 파일이 필요합니다." },
          { status: 400 }
        );
      }

      // Validate input
      const validationResult = uploadImageSchema.safeParse({
        type,
        changeDescription: changeDescription || undefined,
      });

      if (!validationResult.success) {
        return NextResponse.json(
          { error: "잘못된 요청 데이터", details: validationResult.error.flatten() },
          { status: 400 }
        );
      }

      // Verify scene exists
      const scene = await prisma.scene.findUnique({
        where: { id: sceneId },
        include: {
          project: {
            include: {
              participants: true,
            },
          },
        },
      });

      if (!scene) {
        return NextResponse.json(
          { error: "씬을 찾을 수 없습니다." },
          { status: 404 }
        );
      }

      // Check if user is a participant
      const isParticipant = scene.project.participants.some(
        (p) => p.userId === authReq.user.userId
      );

      if (!isParticipant && !authReq.user.isAdmin) {
        return NextResponse.json(
          { error: "이 씬에 대한 접근 권한이 없습니다." },
          { status: 403 }
        );
      }

      // Process file upload to file system
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Create upload directory structure
      const uploadDir = process.env.UPLOAD_DIR || "./uploads";
      const projectId = scene.projectId;
      const projectDir = path.join(uploadDir, projectId);
      const sceneDir = path.join(projectDir, sceneId);

      console.log('Upload directories:', {
        uploadDir,
        projectDir,
        sceneDir,
        exists: {
          uploadDir: existsSync(uploadDir),
          projectDir: existsSync(projectDir),
          sceneDir: existsSync(sceneDir)
        }
      });

      // Ensure directories exist
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true });
        console.log('Created uploadDir:', uploadDir);
      }
      if (!existsSync(projectDir)) {
        await mkdir(projectDir, { recursive: true });
        console.log('Created projectDir:', projectDir);
      }
      if (!existsSync(sceneDir)) {
        await mkdir(sceneDir, { recursive: true });
        console.log('Created sceneDir:', sceneDir);
      }

      // Generate unique filename
      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${timestamp}_${safeFileName}`;
      const filePath = path.join(sceneDir, fileName);
      
      // Use full backend URL for production
      const backendUrl = process.env.NODE_ENV === 'production' 
        ? 'https://courageous-spirit-production.up.railway.app'
        : (process.env.BACKEND_URL || 'http://localhost:3001');
      const fileUrl = `${backendUrl}/api/images/serve/${projectId}/${sceneId}/${fileName}`;

      // Save file to disk
      console.log('Saving file to:', filePath);
      await writeFile(filePath, buffer);
      console.log('File saved successfully, size:', buffer.length);
      
      // Verify file exists after writing
      const fileExists = existsSync(filePath);
      console.log('File exists after write:', fileExists);

      // Extract image metadata using sharp
      let width: number | undefined;
      let height: number | undefined;
      let format: string | undefined;
      
      try {
        const metadata = await sharp(buffer).metadata();
        width = metadata.width;
        height = metadata.height;
        format = metadata.format;
      } catch (err) {
        console.log("Could not extract image metadata:", err);
      }

      // Get file extension
      const fileExtension = file.name.split(".").pop() || format || "jpg";

      console.log('Creating image record with data:', {
        sceneId,
        type,
        fileUrl,
        fileSize: file.size,
        isCurrent: true,
        uploadedBy: authReq.user.userId,
      });

      // Create the image record
      const image = await prisma.image.create({
        data: {
          sceneId,
          type,
          fileUrl,
          fileSize: BigInt(file.size),
          width,
          height,
          format: fileExtension,
          isCurrent: true,
          uploadedBy: authReq.user.userId,
          metadata: {
            originalName: file.name,
            mimeType: file.type,
            changeDescription: changeDescription || undefined,
            filePath: filePath,
          },
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

      // Set other images of the same type as not current
      await prisma.image.updateMany({
        where: {
          sceneId,
          type,
          id: { not: image.id },
        },
        data: {
          isCurrent: false,
        },
      });

      // Create image history entry for the new upload
      await prisma.imageHistory.create({
        data: {
          imageId: image.id,
          sceneId: sceneId,
          versionNumber: 1,
          fileUrl: fileUrl,
          uploadedBy: authReq.user.userId,
          changeDescription: changeDescription || "Initial upload",
        },
      });

      // Verify the image was saved
      const savedImage = await prisma.image.findUnique({
        where: { id: image.id },
        select: {
          id: true,
          fileUrl: true,
          isCurrent: true,
          type: true,
        }
      });
      
      console.log('Image saved to database:', {
        id: savedImage?.id,
        fileUrl: savedImage?.fileUrl,
        isCurrent: savedImage?.isCurrent,
        type: savedImage?.type,
      });
      
      // Check all images for this scene
      const allSceneImages = await prisma.image.findMany({
        where: { sceneId },
        select: {
          id: true,
          type: true,
          isCurrent: true,
          fileUrl: true,
        }
      });
      console.log('All images for scene after save:', allSceneImages);

      // Emit Socket.io event for real-time update
      try {
        const io = getGlobalSocketInstance();
        if (io) {
          const projectRoomId = `project:${scene.projectId}`;
          const sceneRoomId = `scene:${sceneId}`;

          const eventData = {
            image: {
              id: image.id,
              type: image.type,
              fileUrl: image.fileUrl,
              originalName: file.name,
              uploadedBy: authReq.user.userId,
              uploadedAt: image.uploadedAt,
              uploader: image.uploader,
            },
            sceneId,
            projectId: scene.projectId,
          };

          // Broadcast to project and scene rooms
          io.to(projectRoomId).emit('scene:image-uploaded', eventData);
          io.to(sceneRoomId).emit('scene:image-uploaded', eventData);

          console.log('[Socket.io] Emitted scene:image-uploaded event', {
            projectRoomId,
            sceneRoomId,
            imageId: image.id,
            type: image.type,
          });
        } else {
          console.warn('[Socket.io] Socket instance not available for broadcasting');
        }
      } catch (socketError) {
        console.error('[Socket.io] Error broadcasting image upload:', socketError);
        // Don't fail the request if socket broadcast fails
      }

      // Convert BigInt to string for JSON serialization
      const responseData = {
        ...image,
        fileSize: image.fileSize ? image.fileSize.toString() : null,
      };

      return NextResponse.json(responseData);
    } catch (error) {
      console.error("Image upload error:", error);
      return NextResponse.json(
        { 
          error: "이미지 업로드 실패",
          details: error instanceof Error ? error.message : "Unknown error"
        },
        { status: 500 }
      );
    }
  })(req, context);
}

// GET /api/scenes/[id]/images - Get images for scene
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const params = await context.params;
      const sceneId = params.id;
      const url = new URL(req.url);
      const type = url.searchParams.get("type");

      // Verify scene exists
      const scene = await prisma.scene.findUnique({
        where: { id: sceneId },
        include: {
          project: {
            include: {
              participants: true,
            },
          },
        },
      });

      if (!scene) {
        return NextResponse.json(
          { error: "씬을 찾을 수 없습니다." },
          { status: 404 }
        );
      }

      // Check if user is a participant
      const isParticipant = scene.project.participants.some(
        (p) => p.userId === authReq.user.userId
      );

      if (!isParticipant && !authReq.user.isAdmin) {
        return NextResponse.json(
          { error: "이 씬에 대한 접근 권한이 없습니다." },
          { status: 403 }
        );
      }

      // Build query
      const whereClause: any = { sceneId };
      if (type) {
        whereClause.type = type;
      }

      // Get images
      const images = await prisma.image.findMany({
        where: whereClause,
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
        orderBy: {
          uploadedAt: "desc",
        },
      });

      console.log('GET /api/scenes/[id]/images - Found images:', {
        sceneId,
        count: images.length,
        images: images.map(img => ({
          id: img.id,
          type: img.type,
          fileUrl: img.fileUrl,
          isCurrent: img.isCurrent
        }))
      });

      // Convert BigInt to string for JSON serialization
      const responseData = images.map((image) => {
        // The fileUrl should already be a complete URL from the image upload
        return {
          ...image,
          fileSize: image.fileSize ? image.fileSize.toString() : null,
        };
      });

      return NextResponse.json(responseData);
    } catch (error) {
      console.error("Get images error:", error);
      return NextResponse.json(
        { error: "이미지 목록 조회 실패" },
        { status: 500 }
      );
    }
  })(req, context);
}