import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// DELETE /api/channels/[id]/members/[userId] - Remove member from channel
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id, userId } = await params;
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ error: 'Only channel admin can remove members' }, { status: 403 });
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
    if (targetMembership.role === 'admin') {
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

    // Remove member
    await prisma.channelMember.delete({
      where: {
        channelId_userId: {
          channelId: id,
          userId: userId
        }
      }
    });

    return NextResponse.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing member:', error);
    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    );
  }
}