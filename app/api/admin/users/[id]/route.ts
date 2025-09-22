import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';

// DELETE /api/admin/users/[id] - Delete a user (Admin only)
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

    // Prevent self-deletion
    if (id === currentUser.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Delete user and all related data (cascade)
    await prisma.user.delete({
      where: { id: id }
    });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    // Log error appropriately in production
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}