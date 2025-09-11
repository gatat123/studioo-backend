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

      // If setting as current, unset other images of the same type
      if (isCurrent) {
        await prisma.$transaction(async (tx) => {
          // First, set all images of the same type to not current
          await tx.image.updateMany({
            where: {
              sceneId: sceneId,
              type: image.type,
              isCurrent: true,
            },
            data: {
              isCurrent: false,
            },
          });

          // Then set this image as current
          await tx.image.update({
            where: { id: imageId },
            data: {
              isCurrent: true,
            },
          });

          // Add to image history
          const historyCount = await tx.imageHistory.count({
            where: { imageId: imageId },
          });

          await tx.imageHistory.create({
            data: {
              imageId: imageId,
              sceneId: sceneId,
              versionNumber: historyCount + 1,
              fileUrl: image.fileUrl,
              uploadedBy: authReq.user.userId,
              changeDescription: "Set as current version",
            },
          });

          // Log the action
          await tx.collaborationLog.create({
            data: {
              projectId: scene.projectId,
              userId: authReq.user.userId,
              actionType: "image_version_changed",
              targetType: "image",
              targetId: imageId,
              description: `Set ${image.type} image as current version`,
              metadata: {
                sceneId: sceneId,
                imageType: image.type,
                action: "set_as_current",
              },
            },
          });
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

      return NextResponse.json({
        success: true,
        image: updatedImage,
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

      return NextResponse.json({
        success: true,
        image: image,
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