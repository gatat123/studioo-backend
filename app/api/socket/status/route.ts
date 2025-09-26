import { NextRequest, NextResponse } from 'next/server';
import { getSocketInstance } from '@/lib/socket/server';
import { getGlobalSocketInstance, getGlobalSocketServer } from '@/lib/socket/global-socket';
import { getSocketServer } from '@/lib/socket/server';

/**
 * Socket.io status endpoint for debugging connection issues
 */
export async function GET(req: NextRequest) {
  try {
    // Check various Socket.io instances
    const localInstance = getSocketInstance();
    const globalInstance = getGlobalSocketInstance();
    const socketServer = getSocketServer();
    const globalServer = getGlobalSocketServer();

    // Gather status information
    const status = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      server: {
        port: process.env.PORT || 3001,
        hostname: process.env.HOSTNAME || '0.0.0.0',
      },
      socketIO: {
        localInstance: !!localInstance,
        globalInstance: !!globalInstance,
        socketServer: !!socketServer,
        globalServer: !!globalServer,
        isConnected: !!(localInstance || globalInstance),
      },
      urls: {
        internal: process.env.INTERNAL_API_URL || 'not set',
        socket: process.env.SOCKET_SERVER_URL || 'not set',
        nextPublicApi: process.env.NEXT_PUBLIC_API_URL || 'not set',
      },
      stats: null as any,
    };

    // Try to get server stats if Socket.io is available
    const io = localInstance || globalInstance;
    if (io) {
      try {
        const rooms = io.sockets.adapter.rooms;
        const connectedSockets = io.sockets.sockets;

        status.stats = {
          connectedClients: connectedSockets.size,
          totalRooms: rooms.size,
          rooms: Array.from(rooms.entries()).slice(0, 10).map(([roomId, sockets]) => ({
            roomId,
            clientCount: sockets.size
          }))
        };
      } catch (e) {
        status.stats = { error: 'Failed to get stats', message: e instanceof Error ? e.message : String(e) };
      }
    }

    // If Socket.io is not available, try HTTP check
    if (!status.socketIO.isConnected) {
      try {
        const testUrl = process.env.NODE_ENV === 'production'
          ? (process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://studioo-backend-production-eb03.up.railway.app')
          : 'http://127.0.0.1:3001';

        const response = await fetch(`${testUrl}/api/health`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000) // 5 second timeout
        }).catch(err => null);

        status.socketIO.httpFallback = {
          available: response ? response.ok : false,
          url: testUrl,
          statusCode: response ? response.status : null
        };
      } catch (e) {
        status.socketIO.httpFallback = {
          available: false,
          error: e instanceof Error ? e.message : String(e)
        };
      }
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error('[Socket Status API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get socket status',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * Test Socket.io emission
 */
export async function POST(req: NextRequest) {
  try {
    const { testRoom = 'test:room', testEvent = 'test:ping', testData = { message: 'Socket test', timestamp: new Date() } } = await req.json().catch(() => ({}));

    // Try to get Socket.io instance
    const io = getSocketInstance() || getGlobalSocketInstance();

    if (!io) {
      // Try HTTP fallback
      const testUrl = process.env.NODE_ENV === 'production'
        ? (process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://studioo-backend-production-eb03.up.railway.app')
        : 'http://127.0.0.1:3001';

      const response = await fetch(`${testUrl}/api/socket/emit`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': process.env.INTERNAL_API_KEY || 'internal-socket-emit'
        },
        body: JSON.stringify({ room: testRoom, event: testEvent, data: testData })
      });

      const result = await response.json();
      return NextResponse.json({
        method: 'http_fallback',
        url: testUrl,
        ...result
      });
    }

    // Direct emit
    io.to(testRoom).emit(testEvent, testData);

    const rooms = io.sockets.adapter.rooms;
    const roomClients = rooms.get(testRoom);
    const clientCount = roomClients ? roomClients.size : 0;

    return NextResponse.json({
      method: 'direct',
      success: true,
      room: testRoom,
      event: testEvent,
      clientCount,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('[Socket Test API] Error:', error);
    return NextResponse.json(
      {
        error: 'Test failed',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}