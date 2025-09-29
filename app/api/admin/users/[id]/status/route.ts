import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// PATCH /api/admin/users/[id]/status - Toggle user active status (Admin only)
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

    const { is_active } = await request.json();

    // Prevent deactivating own account
    if (id === currentUser.id && is_active === false) {
      return NextResponse.json(
        { error: 'Cannot deactivate your own account' },
        { status: 400 }
      );
    }

    // Update user status
    const updatedUser = await prisma.user.update({
      where: { id: id },
      data: { isActive: is_active },
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
      message: 'User status updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    return NextResponse.json(
      { error: 'Failed to update user status' },
      { status: 500 }
    );
  }
}