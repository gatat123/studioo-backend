import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';

export async function GET(req: NextRequest) {
  try {
    // Check database connection
    let dbStatus = 'unknown';
    let dbLatency = -1;

    try {
      const startTime = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - startTime;
      dbStatus = 'healthy';
    } catch (dbError) {
      dbStatus = 'unhealthy';
      console.error('[Health Check] Database error:', dbError);
    }

    // Check storage directory
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    let storageStatus = 'unknown';
    let storageWritable = false;

    try {
      const storageExists = fs.existsSync(uploadDir);
      if (storageExists) {
        fs.accessSync(uploadDir, fs.constants.W_OK);
        storageStatus = 'ready';
        storageWritable = true;
      } else {
        storageStatus = 'not_ready';
      }
    } catch (e) {
      storageStatus = 'error';
    }

    const health = {
      status: dbStatus === 'healthy' && storageStatus !== 'error' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'studioo-backend',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      checks: {
        database: {
          status: dbStatus,
          latency: dbLatency > 0 ? `${dbLatency}ms` : 'N/A'
        },
        storage: {
          status: storageStatus,
          writable: storageWritable,
          path: uploadDir
        },
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: 'MB'
        }
      }
    };

    return NextResponse.json(health, {
      status: health.status === 'ok' ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('[Health Check] Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}