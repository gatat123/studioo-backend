import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

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
    const { name, description } = body;

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
      return NextResponse.json({ error: 'Only channel admin can update settings' }, { status: 403 });
    }

    // Update channel
    const updatedChannel = await prisma.channel.update({
      where: { id: id },
      data: {
        name: name || undefined,
        description: description || undefined
      }
    });

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

    // Delete channel
    await prisma.channel.delete({
      where: { id: id }
    });

    return NextResponse.json({ message: 'Channel deleted successfully' });
  } catch (error) {
    console.error('Error deleting channel:', error);
    return NextResponse.json(
      { error: 'Failed to delete channel' },
      { status: 500 }
    );
  }
}