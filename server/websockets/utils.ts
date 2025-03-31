import { WebSocket as WsWebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { log } from '../vite';

/**
 * Constants for WebSocket readyState values
 */
export const WS_READY_STATES = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
};

/**
 * Interface for a WebSocket message
 */
export interface WebSocketMessage {
  type: string;
  data: any;
}

/**
 * Send a message to a WebSocket client
 * @param ws WebSocket client
 * @param message Message to send
 * @returns boolean indicating if the message was sent
 */
export function sendMessage(ws: WsWebSocket, message: WebSocketMessage): boolean {
  if (ws.readyState === WS_READY_STATES.OPEN) {
    ws.send(JSON.stringify(message));
    return true;
  }
  return false;
}

/**
 * Broadcast a message to all clients in a list
 * @param clients List of WebSocket clients
 * @param message Message to broadcast
 * @returns Number of clients the message was sent to
 */
export function broadcastMessage(clients: WsWebSocket[], message: WebSocketMessage): number {
  let sentCount = 0;
  
  clients.forEach((ws: WsWebSocket) => {
    if (sendMessage(ws, message)) {
      sentCount++;
    }
  });
  
  return sentCount;
}

/**
 * Log WebSocket error with user information if available
 * @param error Error object
 * @param request WebSocket request
 */
export function logWebSocketError(error: Error, request: IncomingMessage & { session?: any }): void {
  const userId = request.session?.passport?.user;
  
  if (userId) {
    log(`WebSocket error for user ${userId}: ${error.message}`, 'websocket');
  } else {
    log(`WebSocket error: ${error.message}`, 'websocket');
  }
}