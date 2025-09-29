import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// PATCH /api/admin/users/[id]/admin - Toggle user admin status (Admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser(request);
    const isAdmin = currentUser?.isAdmin || currentUser?.username === "gatat123";

    if (!currentUser || !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { isAdmin: newAdminStatus } = await request.json();

    // Prevent removing admin from own account
    if (id === currentUser.id && newAdminStatus === false) {
      return NextResponse.json(
        { error: 'Cannot remove admin privileges from your own account' },
        { status: 400 }
      );
    }

    // Update user admin status
    const updatedUser = await prisma.user.update({
      where: { id: id },
      data: { isAdmin: newAdminStatus },
      select: {
        id: true,
        username: true,
        email: true,
        nickname: true,
        isActive: true,
        isAdmin: true
      }
    });

    return NextResponse.json({
      message: 'User admin status updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user admin status:', error);
    return NextResponse.json(
      { error: 'Failed to update user admin status' },
      { status: 500 }
    );
  }
}