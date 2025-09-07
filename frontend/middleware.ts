import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 인증이 필요한 경로들
const protectedPaths = [
  '/studio',
  '/projects',
  '/admin',
];

// 인증 없이 접근 가능한 경로들
const publicPaths = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 정적 파일과 API 라우트는 건너뛰기
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // 파일 확장자가 있는 경우
  ) {
    return NextResponse.next();
  }

  // 토큰 확인 (쿠키 또는 헤더에서)
  const token = request.cookies.get('token')?.value;
  
  // 보호된 경로 확인
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  const isPublicPath = publicPaths.some(path => pathname === path);

  // 인증이 필요한 페이지인데 토큰이 없으면 로그인 페이지로 리다이렉트
  if (isProtectedPath && !token) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 이미 로그인한 사용자가 로그인/회원가입 페이지 접근 시 스튜디오로 리다이렉트
  if (token && (pathname === '/auth/login' || pathname === '/auth/register')) {
    return NextResponse.redirect(new URL('/studio', request.url));
  }

  // 루트 경로 접근 시 처리
  if (pathname === '/') {
    if (token) {
      return NextResponse.redirect(new URL('/studio', request.url));
    } else {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};