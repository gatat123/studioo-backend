import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key";
const JWT_EXPIRES_IN = "24h";

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
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error("JWT verification failed:", error);
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