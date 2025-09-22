import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { handleOptions } from '@/lib/utils/cors';

export const POST = withAuth(async (
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const userId = req.user.userId;
    const projectId = params.id;

    // Check if user has permission to archive this project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: userId },
          {
            participants: {
              some: {
                userId: userId,
                role: 'admin'
              }
            }
          }
        ]
      }
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or no permission' },
        { status: 404 }
      );
    }

    // Archive the project
    const archivedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedBy: userId,
        status: 'archived',
        // Set deletion date to 30 days from now
        deletionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    return NextResponse.json({
      message: 'Project archived successfully',
      project: archivedProject
    });
  } catch (error) {
    console.error('Error archiving project:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}