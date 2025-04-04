import { Router } from 'express';
import { sendTestEmail } from './email-service';
import { z } from 'zod';

const emailRouter = Router();

// Schema for email test request
const testEmailSchema = z.object({
  adminEmail: z.string().email().nullable().optional(),
});

// Test email endpoint
emailRouter.post('/test', async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'You must be logged in to test email notifications' });
    }

    // Validate request body
    const validationResult = testEmailSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        message: 'Invalid request data', 
        errors: validationResult.error.format() 
      });
    }

    const { adminEmail } = validationResult.data;
    const user = req.user;

    if (!user.email) {
      return res.status(400).json({ 
        message: 'Your account does not have an email address. Please update your profile first.' 
      });
    }

    // Send test email
    const result = await sendTestEmail(
      user.email,
      adminEmail || null,
      user.username || user.email.split('@')[0]
    );

    if (result) {
      return res.status(200).json({ 
        message: 'Test email sent successfully' + (adminEmail ? ' to both addresses' : '') 
      });
    } else {
      throw new Error('Failed to send test email');
    }
  } catch (error: any) {
    console.error('Error sending test email:', error);
    res.status(500).json({ 
      message: error.message || 'An error occurred while sending the test email' 
    });
  }
});

export default emailRouter;