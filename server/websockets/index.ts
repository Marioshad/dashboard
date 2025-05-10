import { WebSocketServer } from 'ws';
import type { WebSocket as WsWebSocket } from 'ws';
import { Server, IncomingMessage } from 'http';
import { Socket } from 'net';
import { parse } from 'cookie';
import cookieSignature from 'cookie-signature';
import { Express } from 'express';
import { log } from '../vite';
import { WS_READY_STATES, WebSocketMessage, logWebSocketError } from './utils';
import { IStorage } from '../storage';

// Map to track connected clients
const connectedClients = new Map<number, WsWebSocket[]>();

/**
 * Initialize the WebSocket server
 * @param httpServer HTTP server to attach the WebSocket server to
 * @param app Express application
 * @param storage Storage interface
 * @param sessionSecret Session secret for cookie validation
 * @returns The initialized WebSocket server
 */
export function initializeWebSocketServer(
  httpServer: Server, 
  app: Express, 
  storage: IStorage,
  sessionSecret: string
): WebSocketServer {
  // Initialize WebSocket server with enhanced stability options
  const wss = new WebSocketServer({
    noServer: true,
    clientTracking: true,
    perMessageDeflate: {
      zlibDeflateOptions: { chunkSize: 1024, memLevel: 7, level: 3 },
      zlibInflateOptions: { chunkSize: 10 * 1024 },
      concurrencyLimit: 10,
      threshold: 1024
    }
  });

  // Handle WebSocket connections
  wss.on('connection', (ws: WsWebSocket, request: IncomingMessage & { session?: any }) => {
    if (request.session?.passport?.user) {
      const userId = parseInt(request.session.passport.user, 10);
      log(`WebSocket connected for user: ${userId}`, 'websocket');
      
      // Store connection in our tracking map
      if (!connectedClients.has(userId)) {
        connectedClients.set(userId, []);
      }
      
      // Add this connection to the user's list
      connectedClients.get(userId)?.push(ws);
      
      log(`User ${userId} added to active WebSocket connections. Total connections for user: ${connectedClients.get(userId)?.length}`, 'websocket');
      
      // Send welcome message
      const welcomeMessage: WebSocketMessage = {
        type: 'connected',
        data: { message: 'WebSocket connection established successfully' }
      };
      
      ws.send(JSON.stringify(welcomeMessage));
      
      // Add a ping/pong mechanism to keep connections alive
      const pingInterval = setInterval(() => {
        // ws.OPEN is 1 in the ws library (not WebSocket.OPEN as in browser)
        if (ws.readyState === WS_READY_STATES.OPEN) {
          ws.ping();
        }
      }, 30000); // Send a ping every 30 seconds
      
      ws.on('pong', () => {
        // Ping-pong successful
      });
      
      ws.on('close', () => {
        log(`WebSocket closed for user: ${userId}`, 'websocket');
        
        // Clean up on connection close
        clearInterval(pingInterval);
        
        const userConnections = connectedClients.get(userId);
        if (userConnections) {
          // Remove this specific connection
          const index = userConnections.indexOf(ws);
          if (index !== -1) {
            userConnections.splice(index, 1);
          }
          
          // If no more connections for this user, remove the entry
          if (userConnections.length === 0) {
            connectedClients.delete(userId);
            log(`User ${userId} removed from active WebSocket connections`, 'websocket');
          } else {
            log(`User ${userId} now has ${userConnections.length} active WebSocket connections`, 'websocket');
          }
        }
      });
      
      ws.on('error', (error) => {
        logWebSocketError(error, request);
      });
    } else {
      log('WebSocket connection rejected: No authenticated user', 'websocket');
      ws.close(1008, 'Not authenticated');
    }
  });

  // Function to send a WebSocket notification to a specific user
  const sendWebSocketNotification = (userId: number, type: string, data: any): boolean => {
    const userConnections = connectedClients.get(userId);
    
    if (userConnections && userConnections.length > 0) {
      const message = JSON.stringify({ type, data });
      
      let sentCount = 0;
      
      userConnections.forEach((ws: WsWebSocket) => {
        if (ws.readyState === WS_READY_STATES.OPEN) {
          ws.send(message);
          sentCount++;
        }
      });
      
      log(`WebSocket notification sent to ${sentCount}/${userConnections.length} connections for user ${userId}`, 'websocket');
      return true;
    }
    
    return false;
  };
  
  // Store the function in the app for use in other routes
  app.locals.sendWebSocketNotification = sendWebSocketNotification;

  // Handle upgrade of WebSocket connections
  httpServer.on('upgrade', (request: IncomingMessage, socket: Socket, head: Buffer) => {
    // Only process WebSocket upgrade requests for our specific path
    if (request.url === '/api/ws') {
      log(`WebSocket upgrade request received for URL: ${request.url}`, 'websocket');
      
      // Parse the cookies from the request
      const cookies = parse(request.headers.cookie || '');
      
      // Get the Express session ID from the cookie
      const sid = cookies['connect.sid'];
      
      if (!sid) {
        log('WebSocket upgrade rejected: No connect.sid cookie found', 'websocket');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Decode the session ID
      const sessionId = cookieSignature.unsign(sid.slice(2), sessionSecret);
      
      if (!sessionId) {
        log('WebSocket upgrade rejected: Invalid session signature', 'websocket');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Get the session from the session store
      storage.sessionStore.get(sessionId, (err, session) => {
        if (err) {
          log(`WebSocket upgrade rejected: Session store error: ${err.message}`, 'websocket');
          socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
          socket.destroy();
          return;
        }
        
        if (!session) {
          log('WebSocket upgrade rejected: Session not found', 'websocket');
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        // Attach the session to the request
        (request as any).session = session;

        try {
          // Use the WebSocketServer to handle the upgrade
          wss.handleUpgrade(request, socket, head, (ws: WsWebSocket) => {
            wss.emit('connection', ws, request);
          });
        } catch (error: any) {
          console.error('Error during WebSocket upgrade:', error);
          socket.destroy();
        }
      });
    }
  });

  // Export the map of connected clients to make it available to handlers
  return wss;
}

// Export the connected clients map to be used by handlers
export function getConnectedClients(): Map<number, WsWebSocket[]> {
  return connectedClients;
}