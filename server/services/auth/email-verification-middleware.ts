import { Request, Response, NextFunction } from 'express';
import { sendNotificationToUser } from '../../websockets/notification-service';

/**
 * Middleware to check if user's email is verified
 * This middleware should be applied to routes that require email verification
 */
export function requireEmailVerification(req: Request, res: Response, next: NextFunction) {
  // Skip checks in development mode or if explicitly disabled
  // We'll add a NODE_ENV check as a fallback for development environments
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (process.env.DISABLE_EMAIL_VERIFICATION === 'true' || isDevelopment) {
    console.log('Email verification bypassed in development mode');
    return next();
  }
  
  // Check if the user is authenticated
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'You must be logged in to perform this action' });
  }
  
  // Check if the user's email is verified - always true if using a superadmin account
  if (!req.user.emailVerified && req.user.username !== 'admin') {
    // If the role is superadmin, bypass email verification
    // This is an additional check to allow admins to test features
    const isSuperAdmin = req.user.roleId === 1; // Assuming roleId 1 is superadmin
    if (isSuperAdmin) {
      console.log('Email verification bypassed for superadmin user');
      return next();
    }
    
    // Send notification to user
    sendNotificationToUser(
      req.user.id, 
      'email_verification_required', 
      'Email verification required to perform this action. Please verify your email to continue.',
      req.user.id
    );
    
    console.log(`Email verification required for user ${req.user.id} - access denied`);
    
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