import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { channelEvents } from '@/lib/socket/emit-helper';

// PATCH /api/channels/[id] - Update channel info
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, workTaskId } = body;

    // Check if user is channel admin
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: id,
          userId: currentUser.id
        }
      }
    });

    // Check if user is channel creator or admin
    const channel = await prisma.channel.findUnique({
      where: { id: id }
    });

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    const isCreator = channel.creatorId === currentUser.id;
    const isAdmin = membership?.role === 'admin';

    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Only channel creator or admin can update settings' }, { status: 403 });
    }

    // If workTaskId is provided, verify it exists and user has access
    if (workTaskId !== undefined) {
      if (workTaskId) {
        const workTask = await prisma.workTask.findUnique({
          where: { id: workTaskId },
          include: {
            createdBy: true,
            participants: {
              where: {
                userId: currentUser.id
              }
            }
          }
        });

        if (!workTask) {
          return NextResponse.json({ error: 'Work task not found' }, { status: 404 });
        }

        // Check if user has access to the work task (creator or participant)
        const hasAccess = workTask.createdById === currentUser.id ||
                         workTask.participants.length > 0;

        if (!hasAccess) {
          return NextResponse.json({ error: 'No access to work task' }, { status: 403 });
        }
      }
    }

    // Update channel
    const updatedChannel = await prisma.channel.update({
      where: { id: id },
      data: {
        name: name || undefined,
        description: description || undefined,
        workTaskId: workTaskId !== undefined ? workTaskId : undefined
      },
      include: {
        workTask: true
      }
    });

    // Socket.io 이벤트 발송
    await channelEvents.updated(id, updatedChannel);

    return NextResponse.json({ channel: updatedChannel });
  } catch (error) {
    console.error('Error updating channel:', error);
    return NextResponse.json(
      { error: 'Failed to update channel' },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/[id] - Delete channel (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is channel admin
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: id,
          userId: currentUser.id
        }
      }
    });

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Only channel admin can delete channel' }, { status: 403 });
    }

    // Archive channel instead of hard delete
    await prisma.channel.update({
      where: { id: id },
      data: { isArchived: true }
    });

    // Socket.io 이벤트 발송
    await channelEvents.deleted(id);

    return NextResponse.json({ message: 'Channel deleted successfully' });
  } catch (error) {
    console.error('Error deleting channel:', error);
    return NextResponse.json(
      { error: 'Failed to delete channel' },
      { status: 500 }
    );
  }
}