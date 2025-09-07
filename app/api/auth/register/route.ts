import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/db';
import { hashPassword } from '@/lib/utils/password';
import { generateToken } from '@/lib/utils/jwt';
import { registerSchema } from '@/lib/utils/validation';
import { ApiResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Validation failed',
          message: validationResult.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const { username, email, password, nickname } = validationResult.data;

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'User already exists',
          message: existingUser.username === username 
            ? 'Username already taken' 
            : 'Email already registered',
        },
        { status: 409 }
      );
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
    const token = generateToken({ userId: user.id });

    const response = NextResponse.json<ApiResponse>(
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
    );
    
    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', process.env.NODE_ENV === 'production' 
      ? 'https://studioo-production-eb03.up.railway.app' 
      : '*');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    
    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to register user',
      },
      { status: 500 }
    );
  }
}