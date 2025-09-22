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

    // Check if user has permission to restore this project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        isArchived: true,
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
        { error: 'Archived project not found or no permission' },
        { status: 404 }
      );
    }

    // Restore the project
    const restoredProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        isArchived: false,
        archivedAt: null,
        archivedBy: null,
        deletionDate: null,
        status: 'active'
      }
    });

    return NextResponse.json({
      message: 'Project restored successfully',
      project: restoredProject
    });
  } catch (error) {
    console.error('Error restoring project:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}