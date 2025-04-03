import { sendMessageToUser, isUserConnected } from './websocket-server';
import { log } from '../vite';
import { Notification } from '@shared/schema';
import { db } from '../db';
import { notifications } from '@shared/schema';
import { eq } from 'drizzle-orm';

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
  actorId?: number,
  metadata?: any
): Promise<boolean> {
  try {
    // Create the notification in the database first
    const [notification] = await db.insert(notifications)
      .values({
        userId,
        type,
        message,
        actorId,
        metadata: metadata ? JSON.stringify(metadata) : null,
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
        log(`Notification sent to user ${userId} via WebSocket: ${message}`, 'notification');
      } else {
        log(`Failed to send notification to user ${userId} via WebSocket despite connection`, 'notification');
      }
      
      return sent;
    } else {
      log(`User ${userId} not connected, notification saved to database only: ${message}`, 'notification');
      return false;
    }
  } catch (error) {
    log(`Error sending notification to user ${userId}: ${error}`, 'notification');
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
        read: true,
        updatedAt: new Date()
      })
      .where(eq(notifications.id, notificationId));
    
    return true;
  } catch (error) {
    log(`Error marking notification ${notificationId} as read: ${error}`, 'notification');
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
        read: true,
        updatedAt: new Date()
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
    log(`Error marking all notifications as read for user ${userId}: ${error}`, 'notification');
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
    const result = await db.select({ count: notifications.id })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .where(eq(notifications.read, false));
      
    return result.length;
  } catch (error) {
    log(`Error getting unread notifications count for user ${userId}: ${error}`, 'notification');
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