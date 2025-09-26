/**
 * Global Socket.io instance management
 * This module ensures Socket.io instance is available across Next.js API routes
 */

import { Server as SocketIOServer } from 'socket.io';

declare global {
  var __socketIO: SocketIOServer | undefined;
  var __socketServer: any | undefined;
}

/**
 * Get the global Socket.io instance
 * This ensures the instance persists across hot reloads in development
 */
export function getGlobalSocketInstance(): SocketIOServer | null {
  return global.__socketIO || null;
}

/**
 * Set the global Socket.io instance
 */
export function setGlobalSocketInstance(io: SocketIOServer): void {
  global.__socketIO = io;
  console.log('[Global Socket] Socket.io instance registered globally');
}

/**
 * Get the global Socket server instance
 */
export function getGlobalSocketServer(): any | null {
  return global.__socketServer || null;
}

/**
 * Set the global Socket server instance
 */
export function setGlobalSocketServer(server: any): void {
  global.__socketServer = server;
  console.log('[Global Socket] Socket server registered globally');
}

/**
 * Clear global instances (for cleanup)
 */
export function clearGlobalSocketInstances(): void {
  global.__socketIO = undefined;
  global.__socketServer = undefined;
  console.log('[Global Socket] Global instances cleared');
}