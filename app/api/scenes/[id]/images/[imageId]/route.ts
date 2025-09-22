import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";

// PATCH /api/scenes/[id]/images/[imageId] - Update image (set as current)
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; imageId: string }> }
) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const params = await context.params;
      const sceneId = params.id;
      const imageId = params.imageId;
      const body = await req.json();
      const { isCurrent } = body;

      // Verify scene exists and user has access
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
          { error: "Scene not found" },
          { status: 404 }
        );
      }

      // Check if user is a participant
      const isParticipant = scene.project.participants.some(
        (p) => p.userId === authReq.user.userId
      );

      if (!isParticipant && !authReq.user.isAdmin) {
        return NextResponse.json(
          { error: "No access to this scene" },
          { status: 403 }
        );
      }

      // Verify image exists and belongs to the scene
      const image = await prisma.image.findFirst({
        where: {
          id: imageId,
          sceneId: sceneId,
        },
      });

      if (!image) {
        return NextResponse.json(
          { error: "Image not found in this scene" },
          { status: 404 }
        );
      }

      // Note: isCurrent functionality removed as Image model no longer has these fields
      if (isCurrent) {
        // Add to image history for logging purposes
        await prisma.imageHistory.create({
          data: {
            imageId: imageId,
            userId: authReq.user.userId,
            action: "set_as_current",
          },
        });

        // Log the action
        await prisma.collaborationLog.create({
          data: {
            projectId: scene.projectId,
            userId: authReq.user.userId,
            action: "set_current_image",
            details: `이미지를 현재 버전으로 설정했습니다`,
          },
        });
      }

      // Return updated image
      const updatedImage = await prisma.image.findUnique({
        where: { id: imageId },
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

      // Convert BigInt to string for JSON serialization
      const serializedImage = updatedImage ? {
        ...updatedImage,
        fileSize: updatedImage.fileSize ? updatedImage.fileSize.toString() : null,
      } : null;

      // Note: Socket.io event will be emitted through collaboration log
      // The socket server will listen to database changes and emit events accordingly

      return NextResponse.json({
        success: true,
        image: serializedImage,
      });
    } catch (error) {
      console.error("Error updating image:", error);
      return NextResponse.json(
        { error: "Failed to update image" },
        { status: 500 }
      );
    }
  })(req, context);
}

// GET /api/scenes/[id]/images/[imageId] - Get specific image details
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string; imageId: string }> }
) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const params = await context.params;
      const sceneId = params.id;
      const imageId = params.imageId;

      // Verify scene exists and user has access
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
          { error: "Scene not found" },
          { status: 404 }
        );
      }

      // Check if user is a participant
      const isParticipant = scene.project.participants.some(
        (p) => p.userId === authReq.user.userId
      );

      if (!isParticipant && !authReq.user.isAdmin) {
        return NextResponse.json(
          { error: "No access to this scene" },
          { status: 403 }
        );
      }

      // Get image with history
      const image = await prisma.image.findFirst({
        where: {
          id: imageId,
          sceneId: sceneId,
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
          history: {
            orderBy: { createdAt: "desc" },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  nickname: true,
                },
              },
            },
          },
        },
      });

      if (!image) {
        return NextResponse.json(
          { error: "Image not found" },
          { status: 404 }
        );
      }

      // Convert BigInt to string for JSON serialization
      const serializedImage = {
        ...image,
        fileSize: image.fileSize ? image.fileSize.toString() : null,
        history: image.history ? image.history.map((h: any) => ({
          ...h,
          // If history has any BigInt fields, convert them here
        })) : [],
      };

      return NextResponse.json({
        success: true,
        image: serializedImage,
      });
    } catch (error) {
      console.error("Error getting image:", error);
      return NextResponse.json(
        { error: "Failed to get image" },
        { status: 500 }
      );
    }
  })(req, context);
}