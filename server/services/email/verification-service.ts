import { db } from '../../db';
import { users } from '@shared/schema';
import { storage } from '../../storage';
import { generateVerificationToken, calculateTokenExpiration, isTokenExpired } from '../../services/auth/token-generator';
import { sendEmail } from './email-service';
import { eq } from 'drizzle-orm';

/**
 * Send verification email to user
 * @param userId User ID to send verification email to
 * @param email Email address to send to
 * @returns Boolean indicating if email was sent successfully
 */
export async function sendVerificationEmail(userId: number, email: string | null): Promise<boolean> {
  if (!email) {
    console.error('Cannot send verification email: no email address');
    return false;
  }

  try {
    // Generate verification token and set expiration
    const token = generateVerificationToken();
    const expiresAt = calculateTokenExpiration(24); // 24 hours expiration
    
    // Update user with verification token
    await storage.updateUserVerification(userId, {
      verificationToken: token,
      verificationTokenExpiresAt: expiresAt,
    });

    // Create verification URL
    const verifyUrl = `${process.env.APP_URL || ''}/verify-email?token=${token}`;
    
    // Send email
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

    return emailSent;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
}

/**
 * Verify user email with token
 * @param token Verification token
 * @returns Object with success status and message
 */
export async function verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
  try {
    // Find user with this token
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.verificationToken, token));

    if (!user) {
      return { success: false, message: 'Invalid verification token' };
    }

    // Check if token is expired
    if (user.verificationTokenExpiresAt && new Date() > user.verificationTokenExpiresAt) {
      return { success: false, message: 'Verification token has expired. Please request a new one.' };
    }

    // Update user verification status
    await storage.updateUserVerification(user.id, {
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpiresAt: null,
    });

    return { success: true, message: 'Email verified successfully' };
  } catch (error) {
    console.error('Error verifying email:', error);
    return { success: false, message: 'Error verifying email. Please try again.' };
  }
}

/**
 * Resend verification email to user
 * @param userId User ID to resend verification email to
 * @returns Object with success status and message
 */
export async function resendVerificationEmail(userId: number): Promise<{ success: boolean; message: string }> {
  try {
    // Get user
    const user = await storage.getUser(userId);
    
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    
    if (user.emailVerified) {
      return { success: false, message: 'Email already verified' };
    }
    
    // Send verification email
    const emailSent = await sendVerificationEmail(userId, user.email);
    
    if (!emailSent) {
      return { success: false, message: 'Failed to send verification email' };
    }
    
    return { success: true, message: 'Verification email sent successfully' };
  } catch (error) {
    console.error('Error resending verification email:', error);
    return { success: false, message: 'Error sending verification email. Please try again.' };
  }
}