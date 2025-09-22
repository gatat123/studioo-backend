import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";

// GET /api/scenes/[id]/script - Get scene script
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const params = await context.params;
      const sceneId = params.id;

      const scene = await prisma.scene.findUnique({
        where: { id: sceneId },
        include: {
          project: {
            include: {
              participants: {
                where: { userId: authReq.user.userId },
              },
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
      if (scene.project.participants.length === 0 && !authReq.user.isAdmin) {
        return NextResponse.json(
          { error: "No access to this scene" },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        script: {
          location: "indoor", // indoor/outdoor
          place: "",
          time: "",
          content: "",
          highlights: [], // Array of {text, color} for highlighted text
        },
      });
    } catch (error) {
      console.error("Error getting scene script:", error);
      return NextResponse.json(
        { error: "Failed to get scene script" },
        { status: 500 }
      );
    }
  })(req, context);
}

// PUT /api/scenes/[id]/script - Update scene script
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const params = await context.params;
      const sceneId = params.id;
      const body = await req.json();

      // Verify scene exists and user has access
      const scene = await prisma.scene.findUnique({
        where: { id: sceneId },
        include: {
          project: {
            include: {
              participants: {
                where: { userId: authReq.user.userId },
              },
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
      if (scene.project.participants.length === 0 && !authReq.user.isAdmin) {
        return NextResponse.json(
          { error: "No access to this scene" },
          { status: 403 }
        );
      }

      // Note: Scene model doesn't have script field
      // This is a placeholder implementation
      // In the future, create a separate SceneScript model if needed

      // Add collaboration log
      await prisma.collaborationLog.create({
        data: {
          projectId: scene.projectId,
          userId: authReq.user.userId,
          action: "scene_script_updated",
          details: `Updated script for scene ${scene.sceneNumber}`,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Script functionality not implemented yet",
        script: body, // Return the submitted script as-is
      });
    } catch (error) {
      console.error("Error updating scene script:", error);
      return NextResponse.json(
        { error: "Failed to update scene script" },
        { status: 500 }
      );
    }
  })(req, context);
}