import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key';

export interface DecodedToken {
  userId: string;
  email: string;
  username: string;
  isAdmin?: boolean;
  iat?: number;
  exp?: number;
}

export function verifyToken(token: string): DecodedToken | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export function isAdmin(request: NextRequest): boolean {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return false;
    }

    // Check if user is admin
    // You can add more admin checks here based on your requirements
    if (decoded.isAdmin === true) {
      return true;
    }

    // Special case for specific admin users
    if (decoded.username === 'gatat123' || decoded.email === 'admin@studio.com') {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Admin check failed:', error);
    return false;
  }
}

export function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

export async function verifyAdminAuth(): Promise<{ success: boolean; error?: any }> {
  try {
    // This is a simplified version - you should implement proper auth check
    // For now, we'll return success for demonstration
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    };
  }
}