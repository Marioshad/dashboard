import { WebSocket as WsWebSocket } from 'ws';
import { db } from '../../db';
import { notifications } from '../../../shared/schema';
import { log } from '../../vite';
import { broadcastMessage, WebSocketMessage } from '../utils';

/**
 * Interface for a notification
 */
export interface Notification {
  id: number;
  userId: number;
  type: string;
  message: string;
  read: boolean;
  createdAt: Date;
  actorId?: number | null;
  actor?: any | null;
}

/**
 * Send a notification to a specific user
 * @param userId User ID to send the notification to
 * @param type Notification type
 * @param message Notification message
 * @param actorId Optional user ID who triggered the notification
 * @param metadata Optional additional data for the notification
 * @param connectedClients Map of connected WebSocket clients by user ID
 * @returns The created notification
 */
export async function sendNotification(
  userId: number, 
  type: string, 
  message: string, 
  actorId?: number, 
  metadata?: any,
  connectedClients?: Map<number, WsWebSocket[]>
): Promise<Notification> {
  try {
    // Save notification to database
    const [notification] = await db.insert(notifications)
      .values({
        userId,
        type,
        message: metadata ? `${message}|${JSON.stringify(metadata)}` : message,
        actorId,
        read: false
      })
      .returning();
    
    // Only send WebSocket notification if there are connected clients
    if (connectedClients && connectedClients.has(userId)) {
      const userConnections = connectedClients.get(userId)!;
      
      // Prepare WebSocket message
      const webSocketMessage: WebSocketMessage = {
        type: 'notification',
        data: notification
      };
      
      // Broadcast to all connections for this user
      const sentCount = broadcastMessage(userConnections, webSocketMessage);
      log(`Real-time notification sent to ${sentCount}/${userConnections.length} connections for user ${userId}`, 'websocket');
      
      // Special handling for receipt scan usage notifications
      if (type === 'receipt_scan_usage' && metadata && metadata.scansUsed !== undefined && metadata.scansLimit !== undefined) {
        // Send a specialized scan usage update message
        const usageMessage: WebSocketMessage = {
          type: 'scan_usage_update',
          data: {
            scansUsed: metadata.scansUsed,
            scansLimit: metadata.scansLimit,
            scansRemaining: metadata.scansLimit - metadata.scansUsed
          }
        };
        
        // Broadcast to all connections
        broadcastMessage(userConnections, usageMessage);
        log(`Scan usage update sent to user ${userId}: ${metadata.scansUsed}/${metadata.scansLimit}`, 'websocket');
      }
    } else {
      log(`No active WebSocket connections for user ${userId}`, 'websocket');
    }

    return notification;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}