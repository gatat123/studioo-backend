import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// PUT /api/notifications/read-all - Mark all notifications as read
export async function PUT(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update all unread notifications
    const result = await prisma.notification.updateMany({
      where: {
        userId: currentUser.id,
        isRead: false
      },
      data: {
        isRead: true
      }
    });

    return NextResponse.json({ 
      message: 'All notifications marked as read',
      count: result.count 
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to update notifications' },
      { status: 500 }
    );
  }
}