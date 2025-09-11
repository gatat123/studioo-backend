import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// POST /api/admin/projects/[id]/view - Admin views a project (invisible join)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser(request);
    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id: id }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Add admin as invisible participant (if not already)
    const existingParticipant = await prisma.projectParticipant.findUnique({
      where: {
        projectId_userId: {
          projectId: id,
          userId: currentUser.id
        }
      }
    });

    if (!existingParticipant) {
      await prisma.projectParticipant.create({
        data: {
          projectId: id,
          userId: currentUser.id,
          role: 'admin_viewer' // Special role for admin viewing
        }
      });
    }

    return NextResponse.json({ 
      message: 'Admin viewing mode enabled',
      projectId: id 
    });
  } catch (error) {
    console.error('Error viewing project:', error);
    return NextResponse.json(
      { error: 'Failed to view project' },
      { status: 500 }
    );
  }
}