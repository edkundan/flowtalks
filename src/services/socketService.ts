import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private userCountCallback: ((count: number) => void) | null = null;

  connect() {
    if (this.socket) return;

    // Use environment-aware socket connection
    const socketUrl = process.env.NODE_ENV === 'production'
      ? process.env.VITE_SOCKET_SERVER_URL || 'https://your-app-name.onrender.com' 
      : 'http://localhost:9000';

    console.log('Attempting to connect to socket server at:', socketUrl);
    
    this.socket = io(socketUrl);

    this.socket.on('connect', () => {
      console.log('Connected to socket server');
    });

    this.socket.on('userCount', (count: number) => {
      console.log('User count updated:', count);
      if (this.userCountCallback) {
        this.userCountCallback(count);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from socket server');
    });

    this.socket.on('error', (error: Error) => {
      console.error('Socket error:', error);
    });
  }

  findPartner() {
    console.log('Looking for chat partner...');
    this.socket?.emit('findPartner');
  }

  onPartnerFound(callback: (partnerId: string) => void) {
    this.socket?.on('partnerFound', callback);
  }

  onPartnerDisconnected(callback: () => void) {
    this.socket?.on('partnerDisconnected', callback);
  }

  onChatMessage(callback: (message: { text: string; from: string }) => void) {
    this.socket?.on('chatMessage', callback);
  }

  sendMessage(message: string): boolean {
    if (!this.socket?.connected) {
      console.warn('Cannot send message: not connected');
      return false;
    }

    try {
      this.socket.emit('chatMessage', message);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  setUserCountCallback(callback: ((count: number) => void) | null) {
    this.userCountCallback = callback;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();