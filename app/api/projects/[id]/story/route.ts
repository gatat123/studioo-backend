import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, type AuthenticatedRequest } from "@/middleware/auth";

// GET /api/projects/[id]/story - Get project story
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const params = await context.params;
      const projectId = params.id;

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
          id: true,
          name: true,
          tag: true,
          overallStory: true,
          setList: true,
          characterList: true,
          participants: {
            where: { userId: authReq.user.userId },
          },
        },
      });

      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }

      // Check if user is a participant
      if (project.participants.length === 0 && !authReq.user.isAdmin) {
        return NextResponse.json(
          { error: "No access to this project" },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        story: {
          overallStory: project.overallStory,
          setList: project.setList,
          characterList: project.characterList,
          projectType: project.tag,
        },
      });
    } catch (error) {
      console.error("Error getting project story:", error);
      return NextResponse.json(
        { error: "Failed to get project story" },
        { status: 500 }
      );
    }
  })(req, context);
}

// PUT /api/projects/[id]/story - Update project story
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withAuth(async (authReq: AuthenticatedRequest) => {
    try {
      const params = await context.params;
      const projectId = params.id;
      const body = await req.json();
      const { overallStory, setList, characterList } = body;

      // Verify project exists and user has access
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
          participants: {
            where: { userId: authReq.user.userId },
          },
        },
      });

      if (!project) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }

      // Check if user is a participant
      if (project.participants.length === 0 && !authReq.user.isAdmin) {
        return NextResponse.json(
          { error: "No access to this project" },
          { status: 403 }
        );
      }

      // Update project story fields
      const updatedProject = await prisma.project.update({
        where: { id: projectId },
        data: {
          overallStory: overallStory !== undefined ? overallStory : project.overallStory,
          setList: setList !== undefined ? setList : project.setList,
          characterList: characterList !== undefined ? characterList : project.characterList,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          overallStory: true,
          setList: true,
          characterList: true,
        },
      });

      return NextResponse.json({
        success: true,
        project: updatedProject,
      });
    } catch (error) {
      console.error("Error updating project story:", error);
      return NextResponse.json(
        { error: "Failed to update project story" },
        { status: 500 }
      );
    }
  })(req, context);
}