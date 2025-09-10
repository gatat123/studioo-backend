import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || "fallback-secret-key";
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
    // Remove any whitespace
    const cleanToken = token.trim();
    
    // Check if token is valid format
    if (!cleanToken || cleanToken === 'undefined' || cleanToken === 'null') {
      console.error("Invalid token format:", cleanToken);
      return null;
    }
    
    const decoded = jwt.verify(cleanToken, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error("JWT verification failed:", error);
    console.error("Token was:", token);
    console.error("JWT_SECRET exists:", !!JWT_SECRET);
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