import { Request, Response, NextFunction } from 'express';
import { sendNotificationToUser } from '../../websockets/notification-service';

/**
 * Middleware to check if user's email is verified
 * This middleware should be applied to routes that require email verification
 */
export function requireEmailVerification(req: Request, res: Response, next: NextFunction) {
  // Skip checks if email verification is disabled
  if (process.env.DISABLE_EMAIL_VERIFICATION === 'true') {
    return next();
  }
  
  // Check if the user is authenticated
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'You must be logged in to perform this action' });
  }
  
  // Check if the user's email is verified
  if (!req.user.emailVerified) {
    // Send notification to user
    sendNotificationToUser(
      req.user.id, 
      'email_verification_required', 
      'Email verification required to perform this action. Please verify your email to continue.',
      req.user.id
    );
    
    // Return 403 with details about verification requirement
    return res.status(403).json({
      error: 'EMAIL_VERIFICATION_REQUIRED',
      message: 'Email verification required',
      details: {
        title: 'Email Verification Required',
        description: 'You need to verify your email address before you can perform this action. Please check your inbox for a verification email or request a new one.',
        actionText: 'Go to Profile',
        actionPath: '/profile',
      }
    });
  }
  
  // If email is verified, proceed to the next middleware
  next();
}