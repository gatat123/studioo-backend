import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      nickname: string;
      email: string;
      profileImageUrl: string | null;
      isAdmin: boolean;
    };
  }

  interface User {
    id: string;
    username: string;
    nickname: string;
    email: string;
    profileImageUrl: string | null;
    isAdmin: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    nickname: string;
    isAdmin: boolean;
    profileImageUrl: string | null;
  }
}