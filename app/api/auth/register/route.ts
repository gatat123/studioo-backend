import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { hashPassword } from '@/lib/utils/password';
import { generateAccessToken } from '@/lib/jwt';
import { registerSchema } from '@/lib/utils/validation';
import { ApiResponse } from '@/types';
import { handleOptions, withCORS } from '@/lib/utils/cors';

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      return withCORS(NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Validation failed',
          message: validationResult.error.issues[0].message,
        },
        { status: 400 }
      ), request);
    }

    const { username, email, password, nickname } = validationResult.data;

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      return withCORS(NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'User already exists',
          message: existingUser.username === username 
            ? 'Username already taken' 
            : 'Email already registered',
        },
        { status: 409 }
      ), request);
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        nickname,
      },
    });

    await prisma.studio.create({
      data: {
        userId: user.id,
        name: `${nickname}'s Studio`,
        description: `Welcome to ${nickname}'s creative studio`,
      },
    });

    const { passwordHash: _, ...userWithoutPassword } = user;
    
    // Generate JWT token
    const token = generateAccessToken({ 
      userId: user.id,
      email: user.email,
      username: user.username,
      nickname: user.nickname || user.username,
      isAdmin: user.isAdmin
    });

    return withCORS(NextResponse.json<ApiResponse>(
      {
        success: true,
        data: {
          user: userWithoutPassword,
          token,
          accessToken: token
        },
        message: 'User registered successfully',
      },
      { status: 201 }
    ), request);
  } catch (error) {
    console.error('Registration error:', error);
    return withCORS(NextResponse.json<ApiResponse>(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to register user',
      },
      { status: 500 }
    ), request);
  }
}