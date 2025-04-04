import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { wsLogger } from '../services/logger';
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

  wsLogger.info(`WebSocket server initialized on path: /api/ws`);

  // Connection handling
  wss.on('connection', (ws: WebSocketWithUser, req) => {
    // Get user info from session, which should be attached by Express middleware
    const user = (req as any).user as User | undefined;
    
    if (!user) {
      wsLogger.warn(`WebSocket connection rejected - no user in session`);
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
    wsLogger.info(`WebSocket connected for user: ${userId}`);
    wsLogger.info(`User ${userId} added to active WebSocket connections. Total connections for user: ${userConnections.length}`);

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
        wsLogger.debug(`Received message from user ${userId}: ${JSON.stringify(data)}`);
        
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
        wsLogger.error(`Error parsing WebSocket message: ${error}`);
      }
    });

    // Handle connection closing
    ws.on('close', () => {
      if (userId) {
        wsLogger.info(`WebSocket closed for user: ${userId}`);
        
        const connections = activeConnections.get(userId) || [];
        const index = connections.findIndex(conn => conn === ws);
        
        if (index !== -1) {
          connections.splice(index, 1);
          
          if (connections.length === 0) {
            activeConnections.delete(userId);
            wsLogger.info(`User ${userId} removed from active WebSocket connections`);
          } else {
            activeConnections.set(userId, connections);
            wsLogger.info(`User ${userId} now has ${connections.length} active WebSocket connections`);
          }
        }
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      wsLogger.error(`WebSocket error for user ${userId}: ${error.message}`);
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