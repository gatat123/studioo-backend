import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Use only JWT_SECRET for consistency
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key";
const JWT_EXPIRES_IN = "24h";

// Debug logging
if (process.env.NODE_ENV !== 'production') {
  console.log('JWT_SECRET configured:', !!process.env.JWT_SECRET);
  console.log('NEXTAUTH_SECRET configured:', !!process.env.NEXTAUTH_SECRET);
}

export interface JWTPayload {
  userId: string;
  email: string;
  username: string;
  nickname: string;
  isAdmin: boolean;
  iat?: number;
  exp?: number;
}

export function generateAccessToken(payload: Omit<JWTPayload, "iat" | "exp">): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: "HS256",
  });
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: "refresh" }, JWT_SECRET, {
    expiresIn: "7d",
    algorithm: "HS256",
  });
}

export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    // Remove any whitespace
    const cleanToken = token.trim();
    
    // Check if token is valid format
    if (!cleanToken || cleanToken === 'undefined' || cleanToken === 'null') {
      console.error("Invalid token format:", cleanToken);
      return null;
    }
    
    // Log token structure for debugging (first 20 chars only for security)
    console.log("Verifying token (first 20 chars):", cleanToken.substring(0, 20));
    console.log("Token parts:", cleanToken.split('.').length);
    
    const decoded = jwt.verify(cleanToken, JWT_SECRET, {
      algorithms: ['HS256']
    }) as JWTPayload;
    
    console.log("Token verified successfully for userId:", decoded.userId);
    return decoded;
  } catch (error: any) {
    console.error("JWT verification failed:", error.message);
    console.error("Token structure:", token.split('.').length, "parts");
    console.error("JWT_SECRET configured:", !!process.env.JWT_SECRET);
    return null;
  }
}

export function verifyRefreshToken(token: string): { userId: string; type: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; type: string };
    if (decoded.type !== "refresh") {
      return null;
    }
    return decoded;
  } catch (error) {
    console.error("Refresh token verification failed:", error);
    return null;
  }
}

export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

export async function getCurrentUser(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      return null;
    }
    
    const payload = verifyAccessToken(token);
    if (!payload) {
      return null;
    }
    
    return await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        username: true,
        email: true,
        nickname: true,
        profileImageUrl: true,
        isAdmin: true,
      }
    });
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}