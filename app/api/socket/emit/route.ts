import { NextRequest, NextResponse } from 'next/server';
import { getSocketInstance } from '@/lib/socket/server';

/**
 * Internal API endpoint to emit Socket.io events
 * This allows Next.js API routes to trigger Socket.io events
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { room, event, data } = body;

    if (!room || !event || !data) {
      return NextResponse.json(
        { error: 'Missing required fields: room, event, data' },
        { status: 400 }
      );
    }

    // Try to get Socket.io instance
    const io = getSocketInstance();

    if (!io) {
      // If Socket.io is not available directly, try HTTP fallback
      console.log(`[Socket Emit API] Socket.io not available, using HTTP fallback`);

      // Make an HTTP request to the Socket.io server
      // Railway 환경에서는 내부 서비스 통신 URL 사용
      // 로컬 개발 환경에서는 127.0.0.1 사용 (IPv4 명시)
      const socketServerUrl = process.env.NODE_ENV === 'production'
        ? (process.env.SOCKET_SERVER_URL || process.env.INTERNAL_API_URL || 'https://studioo-backend-production-eb03.up.railway.app')
        : 'http://127.0.0.1:3001';

      try {
        const response = await fetch(`${socketServerUrl}/api/socket/emit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-key': process.env.INTERNAL_API_KEY || 'internal-socket-emit'
          },
          body: JSON.stringify({ room, event, data })
        });

        if (!response.ok) {
          throw new Error(`Socket server responded with ${response.status}`);
        }

        const result = await response.json();
        return NextResponse.json(result);
      } catch (fetchError) {
        console.error('[Socket Emit API] Failed to forward to socket server:', fetchError);
        return NextResponse.json(
          { error: 'Failed to emit socket event', details: fetchError instanceof Error ? fetchError.message : String(fetchError) },
          { status: 500 }
        );
      }
    }

    // Direct emit if Socket.io is available
    io.to(room).emit(event, data);

    // Check how many clients are in the room
    const rooms = io.sockets.adapter.rooms;
    const roomClients = rooms.get(room);
    const clientCount = roomClients ? roomClients.size : 0;

    console.log(`[Socket Emit API] Emitted ${event} to room ${room} (${clientCount} clients)`);

    return NextResponse.json({
      success: true,
      event,
      room,
      clientCount,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('[Socket Emit API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to emit socket event' },
      { status: 500 }
    );
  }
}

// Handler for the Socket.io server to receive emit requests
export async function PUT(req: NextRequest) {
  try {
    // Verify internal API key
    const internalKey = req.headers.get('x-internal-key');
    if (internalKey !== (process.env.INTERNAL_API_KEY || 'internal-socket-emit')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { room, event, data } = body;

    const io = getSocketInstance();
    if (!io) {
      return NextResponse.json(
        { error: 'Socket.io server not initialized' },
        { status: 503 }
      );
    }

    io.to(room).emit(event, data);

    const rooms = io.sockets.adapter.rooms;
    const roomClients = rooms.get(room);
    const clientCount = roomClients ? roomClients.size : 0;

    console.log(`[Socket Emit Handler] Emitted ${event} to room ${room} (${clientCount} clients)`);

    return NextResponse.json({
      success: true,
      event,
      room,
      clientCount,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('[Socket Emit Handler] Error:', error);
    return NextResponse.json(
      { error: 'Failed to emit socket event' },
      { status: 500 }
    );
  }
}