import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// PATCH /api/channels/[id]/members/[userId]/role - Update member role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id, userId } = await params;
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { role } = body;

    if (!role || !['admin', 'moderator', 'member'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Check if current user is channel admin
    const currentMembership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: id,
          userId: currentUser.id
        }
      }
    });

    if (!currentMembership || currentMembership.role !== 'admin') {
      return NextResponse.json({ error: 'Only channel admin can change roles' }, { status: 403 });
    }

    // Check if target member exists
    const targetMembership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: id,
          userId: userId
        }
      }
    });

    if (!targetMembership) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Don't allow removing the last admin
    if (targetMembership.role === 'admin' && role !== 'admin') {
      const adminCount = await prisma.channelMember.count({
        where: {
          channelId: id,
          role: 'admin'
        }
      });

      if (adminCount <= 1) {
        return NextResponse.json({ error: 'Cannot remove the last admin' }, { status: 400 });
      }
    }

    // Update role
    const updatedMembership = await prisma.channelMember.update({
      where: {
        channelId_userId: {
          channelId: id,
          userId: userId
        }
      },
      data: { role }
    });

    return NextResponse.json({ membership: updatedMembership });
  } catch (error) {
    console.error('Error updating member role:', error);
    return NextResponse.json(
      { error: 'Failed to update member role' },
      { status: 500 }
    );
  }
}