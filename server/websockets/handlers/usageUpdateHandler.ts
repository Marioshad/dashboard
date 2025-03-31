import { WebSocket as WsWebSocket } from 'ws';
import { db } from '../../db';
import { users } from '../../../shared/schema';
import { log } from '../../vite';
import { broadcastMessage, WebSocketMessage } from '../utils';
import { eq, sql } from 'drizzle-orm';

/**
 * Update the receipt scan usage for a user and broadcast the update via WebSocket
 * @param userId User ID to update
 * @param scansUsed Number of scans used
 * @param scansLimit Scan limit for the user
 * @param connectedClients Map of connected WebSocket clients by user ID
 * @param skipDatabaseUpdate Optional flag to skip database update (if already done elsewhere)
 */
export async function updateReceiptScanUsage(
  userId: number, 
  scansUsed: number, 
  scansLimit: number,
  connectedClients?: Map<number, WsWebSocket[]>,
  skipDatabaseUpdate: boolean = false
): Promise<void> {
  try {
    // Update database with new usage count (unless skipDatabaseUpdate is true)
    if (!skipDatabaseUpdate) {
      await db.update(users)
        .set({
          receiptScansUsed: scansUsed,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(eq(users.id, userId));
      
      log(`Updated receipt scan usage in database for user ${userId}: ${scansUsed}/${scansLimit}`, 'websocket');
    }
    
    // Only send WebSocket notification if there are connected clients
    if (connectedClients && connectedClients.has(userId)) {
      const userConnections = connectedClients.get(userId)!;
      
      // Create a specialized message for receipt scan count updates
      const message: WebSocketMessage = {
        type: 'receipt_scan_count_update',
        data: {
          userId: userId,
          scansUsed: scansUsed,
          scansLimit: scansLimit,
          scansRemaining: scansLimit - scansUsed,
          timestamp: new Date().toISOString()
        }
      };
      
      // Broadcast to all connections
      const sentCount = broadcastMessage(userConnections, message);
      log(`Sent receipt scan count update to ${sentCount}/${userConnections.length} connections for user ${userId}`, 'websocket');
    }
  } catch (error) {
    console.error('Error updating receipt scan usage:', error);
  }
}