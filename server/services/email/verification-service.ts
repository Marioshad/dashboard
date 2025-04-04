import { db } from '../../db';
import { users } from '@shared/schema';
import { storage } from '../../storage';
import { generateVerificationToken, calculateTokenExpiration, isTokenExpired } from '../../services/auth/token-generator';
import { sendEmail } from './email-service';
import { eq } from 'drizzle-orm';
import { emailLogger } from '../logger';

/**
 * Send verification email to user
 * @param userId User ID to send verification email to
 * @param email Email address to send to
 * @returns Boolean indicating if email was sent successfully
 */
export async function sendVerificationEmail(userId: number, email: string | null): Promise<boolean> {
  emailLogger.info(`Starting sendVerificationEmail for userId: ${userId}, email: ${email}`);
  
  if (!email) {
    emailLogger.error('Cannot send verification email: no email address');
    return false;
  }

  try {
    // Check if SendGrid is available
    if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
      emailLogger.error('SendGrid is not properly configured. Missing API key or from email.');
      emailLogger.info('SENDGRID_API_KEY present: ' + !!process.env.SENDGRID_API_KEY);
      emailLogger.info('SENDGRID_FROM_EMAIL present: ' + !!process.env.SENDGRID_FROM_EMAIL);
      return false;
    }
    
    // Generate verification token and set expiration
    const token = generateVerificationToken();
    emailLogger.debug(`Generated token for user ${userId}: ${token}`);
    const expiresAt = calculateTokenExpiration(24); // 24 hours expiration
    emailLogger.debug(`Token expires at: ${expiresAt}`);
    
    // Update user with verification token
    try {
      emailLogger.debug(`Updating user ${userId} with verification token`);
      await storage.updateUserVerification(userId, {
        verificationToken: token,
        verificationTokenExpiresAt: expiresAt,
      });
      emailLogger.debug(`Updated user ${userId} with verification token successfully`);
    } catch (dbError) {
      emailLogger.error(`Failed to update user with verification token:`, dbError);
      throw dbError;
    }

    // Create verification URL
    const appUrl = process.env.APP_URL || '';
    emailLogger.debug(`Using APP_URL: ${appUrl}`);
    const verifyUrl = `${appUrl}/verify-email?token=${token}`;
    emailLogger.debug(`Verification URL: ${verifyUrl}`);
    
    // Send email
    emailLogger.info(`Sending verification email to ${email}`);
    try {
      const emailSent = await sendEmail({
        to: email,
        subject: 'Verify your email address',
        text: `Please verify your email address by clicking the following link: ${verifyUrl}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Email Verification</h2>
            <p>Thanks for signing up! Please verify your email address by clicking the button below:</p>
            <a href="${verifyUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; margin: 20px 0;">
              Verify Email Address
            </a>
            <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">
              <a href="${verifyUrl}" style="color: #4F46E5;">${verifyUrl}</a>
            </p>
            <p>This verification link will expire in 24 hours.</p>
          </div>
        `,
      });
      
      emailLogger.info(`Email sent result: ${emailSent}`);
      return emailSent;
    } catch (emailError) {
      emailLogger.error(`Error sending email via SendGrid:`, emailError);
      throw emailError;
    }
  } catch (error) {
    emailLogger.error('Error in sendVerificationEmail:', error);
    return false;
  }
}

/**
 * Verify user email with token
 * @param token Verification token
 * @returns Object with success status and message
 */
export async function verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
  emailLogger.info(`Attempting to verify email with token: ${token}`);
  try {
    // Find user with this token
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.verificationToken, token));

    if (!user) {
      emailLogger.error(`Invalid token: ${token} - no matching user found`);
      return { success: false, message: 'Invalid verification token' };
    }
    
    emailLogger.info(`User found with ID: ${user.id}, email: ${user.email}`);

    // Check if token is expired
    if (user.verificationTokenExpiresAt && new Date() > user.verificationTokenExpiresAt) {
      emailLogger.error(`Token expired at: ${user.verificationTokenExpiresAt}`);
      return { success: false, message: 'Verification token has expired. Please request a new one.' };
    }

    // Update user verification status
    emailLogger.info(`Updating user verification status for user ID: ${user.id}`);
    try {
      await storage.updateUserVerification(user.id, {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiresAt: null,
      });
      emailLogger.info(`User ${user.id} verification status updated successfully`);
    } catch (updateError) {
      emailLogger.error(`Error updating user verification status:`, updateError);
      throw updateError;
    }

    return { success: true, message: 'Email verified successfully' };
  } catch (error) {
    emailLogger.error('Error verifying email:', error);
    return { success: false, message: 'Error verifying email. Please try again.' };
  }
}

/**
 * Resend verification email to user
 * @param userId User ID to resend verification email to
 * @returns Object with success status and message
 */
export async function resendVerificationEmail(userId: number): Promise<{ success: boolean; message: string }> {
  emailLogger.info(`Attempting to resend verification email to user ID: ${userId}`);
  try {
    // Get user
    const user = await storage.getUser(userId);
    
    if (!user) {
      emailLogger.error(`User not found with ID: ${userId}`);
      return { success: false, message: 'User not found' };
    }
    
    emailLogger.info(`User found: ${user.id}, email: ${user.email}, verified: ${user.emailVerified}`);
    
    if (user.emailVerified) {
      emailLogger.info(`Email already verified for user: ${user.id}`);
      return { success: false, message: 'Email already verified' };
    }
    
    if (!user.email) {
      emailLogger.error(`User ${user.id} has no email address`);
      return { success: false, message: 'User has no email address to verify' };
    }
    
    // Send verification email
    emailLogger.info(`Sending verification email to ${user.email}`);
    try {
      const emailSent = await sendVerificationEmail(userId, user.email);
      
      if (!emailSent) {
        emailLogger.error(`Failed to send verification email to ${user.email}`);
        return { success: false, message: 'Failed to send verification email' };
      }
      
      emailLogger.info(`Verification email sent successfully to ${user.email}`);
      return { success: true, message: 'Verification email sent successfully' };
    } catch (emailError) {
      emailLogger.error(`Error sending verification email:`, emailError);
      throw emailError;
    }
  } catch (error) {
    emailLogger.error('Error resending verification email:', error);
    return { success: false, message: 'Error sending verification email. Please try again.' };
  }
}