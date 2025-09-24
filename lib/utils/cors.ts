import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const allowedOrigins = [
  'https://studioo-production-eb03.up.railway.app',
  'https://studioo.up.railway.app',
  'https://courageous-spirit-production.up.railway.app',  // Backend self-reference
  'http://localhost:3000',
  'http://localhost:3001'
];

// Get allowed origins from environment variable if set
const getValidOrigins = () => {
  const envOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim());
  return envOrigins || allowedOrigins;
};

export function corsHeaders(request: NextRequest) {
  const origin = request.headers.get('origin');
  const headers = new Headers();
  const validOrigins = getValidOrigins();

  // Check if origin is allowed
  if (origin && validOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'production') {
    // In production, allow the main frontend URL
    headers.set('Access-Control-Allow-Origin', 'https://studioo-production-eb03.up.railway.app');
  } else {
    // In development, allow any origin
    headers.set('Access-Control-Allow-Origin', '*');
  }

  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  headers.set(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-auth-token'
  );
  headers.set('Access-Control-Max-Age', '86400');

  return headers;
}

export function withCORS(response: NextResponse, request: NextRequest): NextResponse {
  const headers = corsHeaders(request);
  
  // Apply all CORS headers to the response
  headers.forEach((value, key) => {
    response.headers.set(key, value);
  });

  return response;
}

// Handle OPTIONS preflight requests
export function handleOptions(request: NextRequest): NextResponse {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(request)
  });
}