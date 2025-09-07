import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateAccessToken, generateRefreshToken } from "@/lib/jwt";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = loginSchema.parse(body);

    // 사용자 찾기
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        studio: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "비활성화된 계정입니다. 관리자에게 문의하세요." },
        { status: 401 }
      );
    }

    // 비밀번호 확인
    const isPasswordValid = await compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
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

    return NextResponse.json({
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
    });

  } catch (error) {
    console.error("Login error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "입력 데이터가 유효하지 않습니다.", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "로그인 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}