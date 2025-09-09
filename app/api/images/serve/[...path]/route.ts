import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { lookup } from "mime-types";

// OPTIONS /api/images/serve/[...path] - CORS preflight
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
}

// GET /api/images/serve/[...path] - 이미지 파일 서빙
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const filePath = resolvedParams.path.join("/");
    
    // 보안: 상위 디렉토리 접근 차단
    if (filePath.includes("..") || filePath.includes("\\")) {
      return NextResponse.json(
        { success: false, error: "Invalid file path" },
        { status: 400 }
      );
    }

    // uploads 기본 디렉토리 설정
    const uploadDir = process.env.UPLOAD_DIR || "./uploads";
    const baseDir = path.resolve(uploadDir);
    
    // 전체 경로 구성
    // 경로 형식: /api/images/serve/[projectId]/[sceneId]/[fileName]
    const fullPath = path.join(baseDir, filePath);
    
    console.log('Serve API - Attempting to serve:', {
      uploadDir,
      baseDir,
      filePath,
      fullPath,
      exists: existsSync(fullPath)
    });

    // 파일 존재 확인
    try {
      await stat(fullPath);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: "File not found" },
        { status: 404 }
      );
    }

    // 보안: 기본 디렉토리 밖의 파일 접근 차단
    if (!fullPath.startsWith(baseDir)) {
      return NextResponse.json(
        { success: false, error: "Access denied" },
        { status: 403 }
      );
    }

    // 파일 읽기
    const fileBuffer = await readFile(fullPath);
    const extension = path.extname(fullPath).toLowerCase();
    const mimeType = lookup(extension) || "application/octet-stream";

    // 응답 헤더 설정
    const headers = new Headers({
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=31536000, immutable", // 1년 캐시
      "Content-Length": fileBuffer.length.toString(),
      // CORS 헤더 추가 - Canvas에서 사용할 수 있도록
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
      "Cross-Origin-Resource-Policy": "cross-origin",
    });

    // 이미지 파일인 경우 추가 헤더
    if (mimeType.startsWith("image/")) {
      headers.set("X-Content-Type-Options", "nosniff");
    }

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers,
      status: 200,
    });

  } catch (error) {
    console.error("File serving error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}