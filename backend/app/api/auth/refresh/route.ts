import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateAccessToken, verifyRefreshToken } from "@/lib/jwt";

const refreshSchema = z.object({
  refreshToken: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { refreshToken } = refreshSchema.parse(body);

    // 리프레시 토큰 검증
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return NextResponse.json(
        { error: "유효하지 않은 리프레시 토큰입니다." },
        { status: 401 }
      );
    }

    // 사용자 확인
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "사용자를 찾을 수 없거나 비활성 계정입니다." },
        { status: 401 }
      );
    }

    // 새 액세스 토큰 생성
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      nickname: user.nickname,
      isAdmin: user.isAdmin,
    });

    return NextResponse.json({
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        nickname: user.nickname,
        profileImageUrl: user.profileImageUrl,
        isAdmin: user.isAdmin,
      },
    });

  } catch (error) {
    console.error("Token refresh error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "입력 데이터가 유효하지 않습니다." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "토큰 새로고침 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}