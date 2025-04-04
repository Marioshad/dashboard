import { Request, Response, NextFunction } from 'express';
import { sendNotificationToUser } from '../../websockets/notification-service';
import { log } from '../../vite';

/**
 * Middleware to check if user's email is verified
 * This middleware should be applied to routes that require email verification
 */
export function requireEmailVerification(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      message: 'You must be logged in to access this resource',
      error: 'AUTHENTICATION_REQUIRED'
    });
  }

  // Check if user's email is verified
  if (!req.user.emailVerified) {
    // Create a notification about email verification requirement
    sendNotificationToUser(
      req.user.id,
      'email_verification_required',
      'Email verification required to perform this action. Please verify your email to continue.',
      req.user.id, // Actor is the user themselves
      { action: req.path }
    ).catch(err => log(`Failed to send verification notification: ${err}`, 'auth'));

    return res.status(403).json({
      success: false,
      message: 'You need to verify your email address before you can perform this action',
      error: 'EMAIL_VERIFICATION_REQUIRED'
    });
  }

  next();
}