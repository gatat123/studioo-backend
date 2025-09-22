import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// GET /api/admin/projects/[id] - Get project details (Admin only, stealth mode)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser(request);
    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        studio: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                nickname: true,
                email: true,
                profileImageUrl: true
              }
            }
          }
        },
        creator: {
          select: {
            id: true,
            username: true,
            nickname: true
          }
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                nickname: true,
                profileImageUrl: true
              }
            }
          }
        },
        scenes: {
          include: {
            images: {
              include: {
                uploader: {
                  select: {
                    id: true,
                    nickname: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Note: Admin can view any project without being added as participant
    // This is "stealth mode" - admin won't appear in participant list

    return NextResponse.json({ project });
  } catch (error) {
    // Log error appropriately in production
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/projects/[id] - Delete a project (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser(request);
    if (!currentUser || !currentUser.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Delete project and all related data (cascade)
    await prisma.project.delete({
      where: { id: id }
    });

    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}