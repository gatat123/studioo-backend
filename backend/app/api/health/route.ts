import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // 데이터베이스 연결 확인
    await prisma.$queryRaw`SELECT 1`;
    
    // Storage 디렉토리 확인
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const storageExists = fs.existsSync(uploadDir);
    const storageWritable = storageExists ? fs.accessSync(uploadDir, fs.constants.W_OK) === undefined : false;
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'connected',
        storage: storageExists ? 'ready' : 'not_ready',
        writable: storageWritable
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
