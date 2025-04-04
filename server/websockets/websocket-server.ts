import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { log } from '../vite';
import { User } from '@shared/schema';

interface WebSocketWithUser extends WebSocket {
  userId?: number;
  timestamp?: number;
}

// Store active connections with user info
const activeConnections: Map<number, WebSocketWithUser[]> = new Map();

// Initialize WebSocket server
export function initializeWebSocketServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/api/ws',
  });

  log(`WebSocket server initialized on path: /api/ws`, 'websocket');

  // Connection handling
  wss.on('connection', (ws: WebSocketWithUser, req) => {
    // Get user info from session, which should be attached by Express middleware
    const user = (req as any).user as User | undefined;
    
    if (!user) {
      log(`WebSocket connection rejected - no user in session`, 'websocket');
      ws.close(1008, 'Authentication required');
      return;
    }

    const userId = user.id;
    ws.userId = userId;
    ws.timestamp = Date.now();

    // Store the connection based on user
    if (!activeConnections.has(userId)) {
      activeConnections.set(userId, []);
    }
    
    activeConnections.get(userId)?.push(ws);
    
    const userConnections = activeConnections.get(userId) || [];
    log(`WebSocket connected for user: ${userId}`, 'websocket');
    log(`User ${userId} added to active WebSocket connections. Total connections for user: ${userConnections.length}`, 'websocket');

    // Send initial connection message
    ws.send(JSON.stringify({
      type: 'connection_established',
      data: {
        userId: userId,
        timestamp: ws.timestamp,
        message: 'Connected to FoodVault real-time server',
      }
    }));

    // Handle messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        log(`Received message from user ${userId}: ${JSON.stringify(data)}`, 'websocket');
        
        // Process different message types
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ 
            type: 'pong',
            data: {
              timestamp: Date.now(),
              echo: data.data
            }
          }));
        }
      } catch (error) {
        log(`Error parsing WebSocket message: ${error}`, 'websocket');
      }
    });

    // Handle connection closing
    ws.on('close', () => {
      if (userId) {
        log(`WebSocket closed for user: ${userId}`, 'websocket');
        
        const connections = activeConnections.get(userId) || [];
        const index = connections.findIndex(conn => conn === ws);
        
        if (index !== -1) {
          connections.splice(index, 1);
          
          if (connections.length === 0) {
            activeConnections.delete(userId);
            log(`User ${userId} removed from active WebSocket connections`, 'websocket');
          } else {
            activeConnections.set(userId, connections);
            log(`User ${userId} now has ${connections.length} active WebSocket connections`, 'websocket');
          }
        }
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      log(`WebSocket error for user ${userId}: ${error.message}`, 'websocket');
    });
  });

  return wss;
}

// Utility function to send a message to a specific user
export function sendMessageToUser(userId: number, message: any): boolean {
  const userConnections = activeConnections.get(userId);
  
  if (!userConnections || userConnections.length === 0) {
    return false;
  }
  
  const messageString = JSON.stringify(message);
  
  // Send to all connections for this user (multiple tabs/devices)
  let atLeastOneSent = false;
  userConnections.forEach(connection => {
    if (connection.readyState === WebSocket.OPEN) {
      connection.send(messageString);
      atLeastOneSent = true;
    }
  });
  
  return atLeastOneSent;
}

// Utility function to broadcast a message to all connected users
export function broadcastMessage(message: any): number {
  let count = 0;
  
  activeConnections.forEach((connections, userId) => {
    connections.forEach(connection => {
      if (connection.readyState === WebSocket.OPEN) {
        connection.send(JSON.stringify(message));
        count++;
      }
    });
  });
  
  return count;
}

// Get active users count
export function getActiveUsersCount(): number {
  return activeConnections.size;
}

// Get total connections count
export function getTotalConnectionsCount(): number {
  let count = 0;
  activeConnections.forEach(connections => {
    count += connections.length;
  });
  return count;
}

// Check if a user has an active connection
export function isUserConnected(userId: number): boolean {
  const connections = activeConnections.get(userId);
  if (!connections || connections.length === 0) {
    return false;
  }
  
  return connections.some(connection => connection.readyState === WebSocket.OPEN);
}

// Get active connections for a user
export function getUserConnections(userId: number): WebSocketWithUser[] {
  return activeConnections.get(userId) || [];
}