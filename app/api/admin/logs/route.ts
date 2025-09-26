import { NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/auth/admin-auth';

export async function GET() {
  try {
    const authResult = await verifyAdminAuth();
    if (!authResult.success) {
      return authResult.error;
    }

    // Generate mock log data - replace with actual log retrieval
    const levels = ['info', 'warning', 'error', 'critical', 'debug'] as const;
    const categories = ['auth', 'api', 'database', 'system', 'security', 'performance'] as const;
    const messages = [
      'User login successful',
      'Failed authentication attempt',
      'Database connection established',
      'API rate limit exceeded',
      'System backup completed',
      'Security scan initiated',
      'Performance threshold exceeded',
      'Cache cleared successfully',
      'File upload completed',
      'Session expired',
      'New user registration',
      'Password reset requested',
      'Data export initiated',
      'Scheduled task executed',
      'Memory usage high'
    ];

    const logs = Array.from({ length: 100 }, (_, i) => ({
      id: `log-${i}`,
      timestamp: new Date(Date.now() - i * 60000 * Math.random() * 10).toISOString(),
      level: levels[Math.floor(Math.random() * levels.length)],
      category: categories[Math.floor(Math.random() * categories.length)],
      message: messages[Math.floor(Math.random() * messages.length)],
      details: Math.random() > 0.5 ? `Additional details for log entry ${i}` : undefined,
      userId: Math.random() > 0.5 ? `user-${Math.floor(Math.random() * 100)}` : undefined,
      username: Math.random() > 0.5 ? `user${Math.floor(Math.random() * 100)}` : undefined,
      ip: Math.random() > 0.5 ? `192.168.1.${Math.floor(Math.random() * 255)}` : undefined,
      endpoint: Math.random() > 0.5 ? `/api/${categories[Math.floor(Math.random() * categories.length)]}` : undefined,
      statusCode: Math.random() > 0.5 ? [200, 201, 400, 401, 403, 404, 500][Math.floor(Math.random() * 7)] : undefined,
      duration: Math.random() > 0.5 ? Math.floor(Math.random() * 1000) : undefined
    })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ logs });
  } catch (error) {
    console.error('Admin logs API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}