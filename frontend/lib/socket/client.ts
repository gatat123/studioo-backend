import { io, Socket } from 'socket.io-client';
import { authAPI } from '../api/auth';

class SocketClient {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    const token = authAPI.getToken();
    const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    this.socket = io(socketUrl, {
      auth: {
        token
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventListeners();
    return this.socket;
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket.io connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket.io disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket.io connection error:', error.message);
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        this.disconnect();
      }
    });

    this.socket.on('error', (error) => {
      console.error('Socket.io error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Project room management
  joinProject(projectId: string) {
    this.socket?.emit('join_project', { projectId });
  }

  leaveProject(projectId: string) {
    this.socket?.emit('leave_room', { roomId: `project:${projectId}` });
  }

  // Scene room management
  joinScene(projectId: string, sceneId: string) {
    this.socket?.emit('join_scene', { projectId, sceneId });
  }

  leaveScene(sceneId: string) {
    this.socket?.emit('leave_room', { roomId: `scene:${sceneId}` });
  }

  // Cursor tracking
  sendCursorPosition(projectId: string, x: number, y: number) {
    this.socket?.emit('cursor:move', { projectId, x, y });
  }

  // Typing indicators
  startTyping(projectId: string, location: string) {
    this.socket?.emit('typing:start', { projectId, location });
  }

  stopTyping(projectId: string, location: string) {
    this.socket?.emit('typing:stop', { projectId, location });
  }

  // Comment real-time updates
  sendComment(projectId: string, comment: any) {
    this.socket?.emit('comment:create', { projectId, comment });
  }

  updateComment(projectId: string, commentId: string, content: string) {
    this.socket?.emit('comment:update', { projectId, commentId, content });
  }

  deleteComment(projectId: string, commentId: string) {
    this.socket?.emit('comment:delete', { projectId, commentId });
  }

  // Image upload notification
  notifyImageUpload(projectId: string, sceneId: string, image: any) {
    this.socket?.emit('image:upload', { projectId, sceneId, image });
  }

  // Annotation real-time updates
  createAnnotation(imageId: string, annotation: any) {
    this.socket?.emit('annotation:create', { imageId, annotation });
  }

  updateAnnotation(imageId: string, annotationId: string, updates: any) {
    this.socket?.emit('annotation:update', { imageId, annotationId, updates });
  }

  deleteAnnotation(imageId: string, annotationId: string) {
    this.socket?.emit('annotation:delete', { imageId, annotationId });
  }

  // Custom event listener registration
  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void) {
    this.socket?.off(event, callback);
  }

  // Get socket instance
  getSocket(): Socket | null {
    return this.socket;
  }

  // Check connection status
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// Export singleton instance
export const socketClient = new SocketClient();

// Export convenience methods
export const connectSocket = () => socketClient.connect();
export const disconnectSocket = () => socketClient.disconnect();
export const getSocket = () => socketClient.getSocket();