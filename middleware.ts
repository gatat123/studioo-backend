import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // API 라우트에만 CORS 헤더 적용
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    const allowedOrigins = [
      'https://studioo-production-eb03.up.railway.app',
      'https://studioo.up.railway.app',
      'http://localhost:3000',
      'http://localhost:3001'
    ];

    // Preflight requests
    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 200 });

      // Check if origin is allowed, otherwise allow in development
      if (origin && (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development')) {
        response.headers.set('Access-Control-Allow-Origin', origin);
      } else if (process.env.NODE_ENV === 'production') {
        // In production, use the main frontend URL as fallback
        response.headers.set('Access-Control-Allow-Origin', 'https://studioo-production-eb03.up.railway.app');
      } else {
        // In development, allow any origin
        response.headers.set('Access-Control-Allow-Origin', '*');
      }

      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-auth-token');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Access-Control-Max-Age', '86400');
      return response;
    }

    // Normal requests
    const response = NextResponse.next();

    // Check if origin is allowed, otherwise allow in development
    if (origin && (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development')) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    } else if (process.env.NODE_ENV === 'production' && !origin) {
      // In production with no origin (same-origin request), use the main frontend URL
      response.headers.set('Access-Control-Allow-Origin', 'https://studioo-production-eb03.up.railway.app');
    } else if (process.env.NODE_ENV === 'development') {
      // In development, allow any origin
      response.headers.set('Access-Control-Allow-Origin', '*');
    }

    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-auth-token');
    response.headers.set('Access-Control-Allow-Credentials', 'true');

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*']
};