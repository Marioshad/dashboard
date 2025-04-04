import { sendMessageToUser, isUserConnected } from './websocket-server';
import { notificationLogger } from '../services/logger';
import { Notification } from '@shared/schema';
import { db } from '../db';
import { notifications } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Send a notification to a user through WebSocket
 * @param userId The user ID to send notification to
 * @param notification The notification object
 * @returns true if notification was sent successfully, false otherwise
 */
export async function sendNotificationToUser(
  userId: number, 
  type: string, 
  message: string, 
  actorId?: number
): Promise<boolean> {
  try {
    // Create the notification in the database first
    const [notification] = await db.insert(notifications)
      .values({
        userId,
        type,
        message,
        actorId,
        read: false,
        createdAt: new Date()
      })
      .returning();
    
    // Check if the user is connected via WebSocket
    if (isUserConnected(userId)) {
      // Send the notification via WebSocket
      const sent = sendMessageToUser(userId, {
        type: 'notification',
        data: notification
      });
      
      if (sent) {
        notificationLogger.info(`Notification sent to user ${userId} via WebSocket: ${message}`);
      } else {
        notificationLogger.warn(`Failed to send notification to user ${userId} via WebSocket despite connection`);
      }
      
      return sent;
    } else {
      notificationLogger.info(`User ${userId} not connected, notification saved to database only: ${message}`);
      return false;
    }
  } catch (error) {
    notificationLogger.error(`Error sending notification to user ${userId}: ${error}`);
    return false;
  }
}

/**
 * Mark a notification as read
 * @param notificationId The notification ID to mark as read
 * @returns true if successful, false otherwise
 */
export async function markNotificationRead(notificationId: number): Promise<boolean> {
  try {
    await db.update(notifications)
      .set({
        read: true
      })
      .where(eq(notifications.id, notificationId));
    
    return true;
  } catch (error) {
    notificationLogger.error(`Error marking notification ${notificationId} as read: ${error}`);
    return false;
  }
}

/**
 * Mark all notifications for a user as read
 * @param userId The user ID
 * @returns true if successful, false otherwise
 */
export async function markAllNotificationsRead(userId: number): Promise<boolean> {
  try {
    await db.update(notifications)
      .set({
        read: true
      })
      .where(eq(notifications.userId, userId));
    
    // Send WebSocket update if user is connected
    if (isUserConnected(userId)) {
      sendMessageToUser(userId, {
        type: 'notification',
        data: {
          type: 'unread_count_update',
          unreadCount: 0
        }
      });
    }
    
    return true;
  } catch (error) {
    notificationLogger.error(`Error marking all notifications as read for user ${userId}: ${error}`);
    return false;
  }
}

/**
 * Get unread notifications count for a user
 * @param userId The user ID
 * @returns The count of unread notifications
 */
export async function getUnreadNotificationsCount(userId: number): Promise<number> {
  try {
    // Use a simplified query to avoid the chained where clauses
    const result = await db
      .select()
      .from(notifications)
      .where(
        sql`${notifications.userId} = ${userId} AND ${notifications.read} = false`
      );
      
    return result.length;
  } catch (error) {
    notificationLogger.error(`Error getting unread notifications count for user ${userId}: ${error}`);
    return 0;
  }
}

/**
 * Send notification about receipt scan usage
 * @param userId The user ID
 * @param scansUsed Current scans used count
 * @param scansLimit Total scan limit
 * @returns true if notification was sent successfully, false otherwise
 */
export function sendScanUsageUpdate(
  userId: number, 
  scansUsed: number, 
  scansLimit: number | null
): boolean {
  return sendMessageToUser(userId, {
    type: 'scan_usage_update',
    data: {
      scansUsed,
      scansLimit,
      scansRemaining: scansLimit !== null ? Math.max(0, scansLimit - scansUsed) : null,
      limitReached: scansLimit !== null ? scansUsed >= scansLimit : false
    }
  });
}