import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // 파일 경로 구성
    const filePath = path.join(UPLOAD_DIR, ...params.path);
    
    // 보안 체크: UPLOAD_DIR 밖의 파일 접근 방지
    const normalizedPath = path.normalize(filePath);
    const normalizedUploadDir = path.normalize(UPLOAD_DIR);
    
    if (!normalizedPath.startsWith(normalizedUploadDir)) {
      return NextResponse.json(
        { error: 'Invalid path' },
        { status: 403 }
      );
    }
    
    // 파일 존재 확인
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    // 파일 읽기
    const file = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    // Content-Type 설정
    const contentType = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
    }[ext] || 'application/octet-stream';
    
    // 파일 반환
    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': file.length.toString(),
      },
    });
  } catch (error) {
    console.error('File serving error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
