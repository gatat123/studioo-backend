// app/api/annotations/[id]/route.ts 파일의 수정된 export 부분
import { NextRequest, NextResponse } from "next/server";

// GET handler 타입 수정
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  return withAuth(getAnnotation)(request, { params });
}

// PUT handler 타입 수정  
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  return withAuth(updateAnnotation)(request, { params });
}

// DELETE handler 타입 수정
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  return withAuth(deleteAnnotation)(request, { params });
}
