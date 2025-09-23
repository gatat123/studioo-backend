import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateAccessToken, generateRefreshToken } from "@/lib/jwt";
import { handleOptions, withCORS } from "@/lib/utils/cors";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function OPTIONS(request: NextRequest) {
  return handleOptions(request);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = loginSchema.parse(body);

    // 사용자 찾기
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        studio: true,
      },
    });

    if (!user) {
      return withCORS(NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      ), req);
    }

    if (!user.isActive) {
      return withCORS(NextResponse.json(
        { error: "Account is deactivated" },
        { status: 401 }
      ), req);
    }

    // 비밀번호 확인
    const isPasswordValid = await compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return withCORS(NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      ), req);
    }

    // 마지막 로그인 시간 업데이트
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // JWT 토큰 생성
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      nickname: user.nickname,
      isAdmin: user.isAdmin,
    });

    const refreshToken = generateRefreshToken(user.id);
    
    // Debug logging
    console.log("Login - Generated token (first 20 chars):", accessToken.substring(0, 20));
    console.log("Login - Token parts:", accessToken.split('.').length);
    console.log("Login - User ID:", user.id);

    return withCORS(NextResponse.json({
      message: "로그인이 완료되었습니다.",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        nickname: user.nickname,
        profileImageUrl: user.profileImageUrl,
        isAdmin: user.isAdmin,
      },
      studio: user.studio ? {
        id: user.studio.id,
        name: user.studio.name,
        description: user.studio.description,
      } : null,
      accessToken,
      refreshToken,
      token: accessToken
    }), req);

  } catch (error) {
    console.error("Login error:", error);

    if (error instanceof z.ZodError) {
      return withCORS(NextResponse.json(
        { error: "입력 데이터가 유효하지 않습니다.", details: error.issues },
        { status: 400 }
      ), req);
    }

    return withCORS(NextResponse.json(
      { error: "로그인 중 오류가 발생했습니다." },
      { status: 500 }
    ), req);
  }
}