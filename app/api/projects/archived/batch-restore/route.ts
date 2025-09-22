import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { handleOptions } from '@/lib/utils/cors';

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const userId = req.user.userId;
    const { projectIds } = await req.json();

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      return NextResponse.json(
        { error: 'Invalid project IDs' },
        { status: 400 }
      );
    }

    // Check permissions for all projects
    const projects = await prisma.project.findMany({
      where: {
        id: { in: projectIds },
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

    if (projects.length !== projectIds.length) {
      return NextResponse.json(
        { error: 'Some projects not found or no permission' },
        { status: 403 }
      );
    }

    // Batch restore projects
    await prisma.project.updateMany({
      where: {
        id: { in: projectIds }
      },
      data: {
        isArchived: false,
        archivedAt: null,
        archivedBy: null,
        deletionDate: null,
        status: 'active'
      }
    });

    return NextResponse.json({
      message: `${projectIds.length} projects restored successfully`,
      restoredCount: projectIds.length
    });
  } catch (error) {
    console.error('Error batch restoring projects:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}