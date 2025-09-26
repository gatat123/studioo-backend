import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth/admin-auth';

// Mock system logs data
const getMockSystemLogs = () => {
  const logTypes = ['info', 'warn', 'error', 'debug'];
  const components = ['auth', 'api', 'database', 'websocket', 'upload'];
  const messages = [
    'User authentication successful',
    'Database connection established',
    'API endpoint accessed',
    'WebSocket connection opened',
    'File upload completed',
    'Cache invalidated',
    'Session expired',
    'Rate limit exceeded',
    'Database query slow',
    'Memory usage high'
  ];

  const logs = [];
  for (let i = 0; i < 50; i++) {
    const randomType = logTypes[Math.floor(Math.random() * logTypes.length)];
    const randomComponent = components[Math.floor(Math.random() * components.length)];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);

    logs.push({
      id: `log-${i + 1}`,
      timestamp: timestamp.toISOString(),
      level: randomType,
      component: randomComponent,
      message: randomMessage,
      details: randomType === 'error' ? 'Stack trace would be here' : null
    });
  }

  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export async function GET() {
  try {
    // Verify admin authentication
    const authResult = await verifyAdminAuth();
    if (!authResult.success) {
      return authResult.error;
    }

    // Get system logs - in production, query actual logs
    const logs = getMockSystemLogs();

    return NextResponse.json({
      logs,
      total: logs.length,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('System logs error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve system logs' },
      { status: 500 }
    );
  }
}