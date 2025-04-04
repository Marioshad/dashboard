import { Router } from 'express';
import { sendTestEmail, isSendGridAvailable } from './email-service';
import { z } from 'zod';
import { log } from '../../vite';

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

export default emailRouter;