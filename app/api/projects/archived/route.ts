import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { withAuth, AuthenticatedRequest } from '@/middleware/auth';
import { ApiResponse } from '@/types';
import { handleOptions } from '@/lib/utils/cors';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const userId = req.user.userId;
    const isAdmin = req.user.isAdmin;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const sortBy = searchParams.get('sortBy') || 'archivedAt';
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc';

    const skip = (page - 1) * limit;

    // Get archived projects with participant count and creator info
    const archivedProjects = await prisma.project.findMany({
      where: {
        isArchived: true,
        OR: [
          { creatorId: userId },
          {
            participants: {
              some: {
                userId: userId
              }
            }
          }
        ]
      },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            nickname: true,
            profileImageUrl: true
          }
        },
        participants: {
          select: {
            userId: true
          }
        },
        scenes: {
          select: {
            id: true
          }
        },
        _count: {
          select: {
            participants: true,
            scenes: true
          }
        }
      },
      orderBy: {
        [sortBy]: sortOrder
      },
      skip,
      take: limit
    });

    const total = await prisma.project.count({
      where: {
        isArchived: true,
        OR: [
          { creatorId: userId },
          {
            participants: {
              some: {
                userId: userId
              }
            }
          }
        ]
      }
    });

    // Transform the data to match frontend expectations
    const transformedProjects = archivedProjects.map(project => ({
      id: project.id,
      name: project.name,
      description: project.description,
      thumbnail: null, // Add thumbnail logic if needed
      ownerId: project.creatorId,
      ownerName: project.creator.nickname || project.creator.username,
      ownerAvatar: project.creator.profileImageUrl,
      archivedAt: project.archivedAt || project.updatedAt,
      archivedBy: project.archivedBy || project.creatorId,
      archivedByName: project.creator.nickname || project.creator.username,
      deletionDate: project.deletionDate,
      collaborators: project._count.participants,
      files: project._count.scenes,
      lastActivity: project.updatedAt,
      canRestore: project.creatorId === userId || isAdmin,
      canDelete: project.creatorId === userId || isAdmin,
      tags: project.tag ? [project.tag] : []
    }));

    return NextResponse.json({
      projects: transformedProjects,
      total
    });
  } catch (error) {
    console.error('Error fetching archived projects:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

export async function OPTIONS(req: NextRequest) {
  return handleOptions(req);
}