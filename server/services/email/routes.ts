import { Router } from 'express';
import { sendTestEmail, isSendGridAvailable } from './email-service';
import { verifyEmail, resendVerificationEmail } from './verification-service';
import { z } from 'zod';
import { log } from '../../vite';
import { storage } from '../../storage';

const emailRouter = Router();

// Schema for email test request
const testEmailSchema = z.object({
  adminEmail: z.string().email().nullable().optional(),
});

/**
 * Test email endpoint
 * This endpoint allows users to test email functionality
 * by sending a test email to their account and optionally an admin address
 */
emailRouter.post('/test', async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        success: false,
        message: 'You must be logged in to test email notifications' 
      });
    }

    // Validate request body
    const validationResult = testEmailSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid request data', 
        errors: validationResult.error.format() 
      });
    }

    // Check if SendGrid service is available
    if (!isSendGridAvailable()) {
      log('SendGrid service is not available - missing API key or configuration', 'email');
      return res.status(503).json({
        success: false,
        message: 'Email service is not properly configured. Please set up the SendGrid API key.',
        error: 'SENDGRID_NOT_CONFIGURED'
      });
    }

    const { adminEmail } = validationResult.data;
    const user = req.user;

    if (!user.email) {
      return res.status(400).json({ 
        success: false,
        message: 'Your account does not have an email address. Please update your profile first.',
        error: 'USER_EMAIL_MISSING'
      });
    }

    log(`Attempting to send test email to user: ${user.email}${adminEmail ? ' and admin: ' + adminEmail : ''}`, 'email');

    // Send test email
    const result = await sendTestEmail(
      user.email,
      adminEmail || null,
      user.username || user.email.split('@')[0]
    );

    if (result) {
      return res.status(200).json({ 
        success: true,
        message: 'Test email sent successfully' + (adminEmail ? ' to both addresses' : '') 
      });
    } else {
      // This error happens when SendGrid rejects the email (e.g., unverified sender)
      log('SendGrid rejected the email - likely due to unverified sender address', 'email');
      return res.status(500).json({
        success: false,
        message: 'Failed to send test email. The sender email address may not be verified in SendGrid.',
        error: 'SENDGRID_SENDER_VERIFICATION'
      });
    }
  } catch (error: any) {
    log(`Error sending test email: ${error.message}`, 'email');
    res.status(500).json({ 
      success: false,
      message: 'Failed to send test email. Please check the logs for more details.',
      error: error.message || 'UNKNOWN_ERROR'
    });
  }
});

/**
 * Verify a user's email address using a token
 */
emailRouter.get('/verify', async (req, res) => {
  try {
    const { token, userId } = req.query;
    
    if (!token || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing token or user ID'
      });
    }
    
    const userIdNum = parseInt(userId as string, 10);
    if (isNaN(userIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }
    
    const verified = await verifyEmail(userIdNum, token as string);
    
    if (verified) {
      // If the current user is the one being verified, update their session
      if (req.isAuthenticated() && req.user?.id === userIdNum) {
        // Force refresh of user data
        const user = await storage.getUser(userIdNum);
        if (user) {
          // Update the session
          Object.assign(req.user, user);
        }
      }
      
      return res.status(200).json({
        success: true,
        message: 'Email verified successfully'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }
  } catch (error: any) {
    log(`Error verifying email: ${error.message}`, 'email');
    return res.status(500).json({
      success: false,
      message: 'An error occurred while verifying your email',
      error: error.message
    });
  }
});

/**
 * Resend verification email to user
 */
emailRouter.post('/resend-verification', async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        message: 'You must be logged in to request a verification email'
      });
    }
    
    const user = req.user;
    
    // Check if already verified
    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Your email is already verified'
      });
    }
    
    if (!user.email) {
      return res.status(400).json({
        success: false,
        message: 'Your account does not have an email address. Please update your profile first.'
      });
    }
    
    // Get the base URL from the request
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const baseUrl = `${protocol}://${host}`;
    
    log(`Attempting to resend verification email to ${user.email}`, 'email');
    
    // Resend verification email
    const emailSent = await resendVerificationEmail(user.id, baseUrl);
    
    if (emailSent) {
      return res.status(200).json({
        success: true,
        message: 'Verification email sent successfully'
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to send verification email'
      });
    }
  } catch (error: any) {
    log(`Error resending verification email: ${error.message}`, 'email');
    return res.status(500).json({
      success: false,
      message: 'An error occurred while resending verification email',
      error: error.message
    });
  }
});

export default emailRouter;