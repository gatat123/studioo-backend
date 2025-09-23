/**
 * Socket.io event emitter utility for API routes
 * This utility allows API routes to emit Socket.io events to connected clients
 */

interface SocketEvent {
  type: string;
  payload: any;
  room?: string;
  userId?: string;
}

// Store events to be emitted (will be processed by socket server)
const eventQueue: SocketEvent[] = [];

/**
 * Emit a Socket.io event to a specific room (project)
 */
export function emitToRoom(room: string, eventType: string, payload: any) {
  eventQueue.push({
    type: eventType,
    payload,
    room,
  });

  // In production, you might want to send this to a message queue
  // or directly to the Socket.io server if it's running separately
  processEventQueue();
}

/**
 * Emit a Socket.io event to a specific user
 */
export function emitToUser(userId: string, eventType: string, payload: any) {
  eventQueue.push({
    type: eventType,
    payload,
    userId,
  });

  processEventQueue();
}

/**
 * Process the event queue
 * In a real application, this would send events to the Socket.io server
 */
async function processEventQueue() {
  // TODO: Implement actual event processing
  // This could involve:
  // 1. Sending to a Redis pub/sub channel
  // 2. Making an HTTP request to the Socket.io server
  // 3. Using a message queue like RabbitMQ

  while (eventQueue.length > 0) {
    const event = eventQueue.shift();
    if (event) {
      console.log(`[Socket Event] ${event.type}:`, event.payload);
    }
  }
}

// Task-related event types
export const TASK_EVENTS = {
  CREATED: 'task:created',
  UPDATED: 'task:updated',
  DELETED: 'task:deleted',
  STATUS_CHANGED: 'task:statusChanged',
  ASSIGNED: 'task:assigned',
  UNASSIGNED: 'task:unassigned',
  POSITION_CHANGED: 'task:positionChanged',
} as const;

// Todo-related event types
export const TODO_EVENTS = {
  CREATED: 'todo:created',
  UPDATED: 'todo:updated',
  DELETED: 'todo:deleted',
  COMPLETED: 'todo:completed',
  UNCOMPLETED: 'todo:uncompleted',
  REORDERED: 'todo:reordered',
} as const;