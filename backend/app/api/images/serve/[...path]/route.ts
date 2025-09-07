import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { lookup } from "mime-types";

// GET /api/images/serve/[...path] - 이미지 파일 서빙
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = params.path.join("/");
    
    // 보안: 상위 디렉토리 접근 차단
    if (filePath.includes("..") || filePath.includes("\\")) {
      return NextResponse.json(
        { success: false, error: "Invalid file path" },
        { status: 400 }
      );
    }

    let fullPath: string;
    let baseDir: string;

    // 썸네일인지 원본 이미지인지 구분
    if (filePath.startsWith("thumb/")) {
      // 썸네일 경로
      baseDir = path.join(process.cwd(), "uploads", "thumbnails");
      const thumbnailPath = filePath.replace("thumb/", "");
      fullPath = path.join(baseDir, thumbnailPath);
    } else {
      // 원본 이미지 경로
      baseDir = path.join(process.cwd(), "uploads", "images");
      fullPath = path.join(baseDir, filePath);
    }

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
    });

    // 이미지 파일인 경우 추가 헤더
    if (mimeType.startsWith("image/")) {
      headers.set("X-Content-Type-Options", "nosniff");
    }

    return new NextResponse(fileBuffer, {
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