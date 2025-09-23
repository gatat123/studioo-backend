import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Configure allowed origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'https://studio.yourdomain.com', // Replace with your production domain
  process.env.FRONTEND_URL,
].filter(Boolean);

export function corsHeaders(origin: string | null) {
  const headers = new Headers();

  // Check if the origin is allowed
  if (origin && (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development')) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else if (!origin && process.env.NODE_ENV === 'development') {
    // Allow requests without origin in development (e.g., Postman)
    headers.set('Access-Control-Allow-Origin', '*');
  }

  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  headers.set('Access-Control-Max-Age', '86400'); // 24 hours

  return headers;
}

export function handleCORS(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin');

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(origin)
    });
  }

  return null;
}

/**
 * Apply CORS headers to a NextResponse
 */
export function withCORS(response: NextResponse, request: NextRequest): NextResponse {
  const origin = request.headers.get('origin');
  const corsHeadersObj = corsHeaders(origin);

  // Apply CORS headers to the response
  corsHeadersObj.forEach((value, key) => {
    response.headers.set(key, value);
  });

  return response;
}