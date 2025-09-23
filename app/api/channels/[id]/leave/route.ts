import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// POST /api/channels/[id]/leave - Leave a channel
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a member
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: id,
          userId: currentUser.id
        }
      }
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this channel' }, { status: 400 });
    }

    // Check if user is admin and there are other members
    if (membership.role === 'admin') {
      const otherMembers = await prisma.channelMember.count({
        where: {
          channelId: id,
          userId: { not: currentUser.id }
        }
      });

      if (otherMembers > 0) {
        // Need to assign new admin first
        return NextResponse.json(
          { error: 'Please assign a new admin before leaving' },
          { status: 400 }
        );
      }
    }

    // Remove member from channel
    await prisma.channelMember.delete({
      where: {
        channelId_userId: {
          channelId: id,
          userId: currentUser.id
        }
      }
    });

    // Check if channel is now empty
    const remainingMembers = await prisma.channelMember.count({
      where: { channelId: id }
    });

    if (remainingMembers === 0) {
      // Delete empty channel
      await prisma.channel.update({
        where: { id: id },
        data: { isArchived: true }
      });
    }

    return NextResponse.json({ 
      message: 'Successfully left the channel',
      channelId: id 
    });
  } catch (error) {
    console.error('Error leaving channel:', error);
    return NextResponse.json(
      { error: 'Failed to leave channel' },
      { status: 500 }
    );
  }
}