import { generateRandomToken } from "../auth/token-generator";
import { storage } from "../../storage";
import { getVerifiedSenderEmail } from "./email-service";
import { User } from "@shared/schema";
import sgMail from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  console.warn("SENDGRID_API_KEY environment variable is not set. Email verification will not work.");
}

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Verification token expiration time (24 hours)
const TOKEN_EXPIRATION_HOURS = 24;

/**
 * Generate a verification token for a user
 */
export async function generateVerificationToken(userId: number): Promise<string> {
  // Generate a random token
  const token = generateRandomToken(48);
  
  // Set expiration time to 24 hours from now
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRATION_HOURS);
  
  // Update user with verification token
  await storage.updateUserVerification(userId, {
    verificationToken: token,
    verificationTokenExpiresAt: expiresAt
  });
  
  return token;
}

/**
 * Send verification email to user
 */
export async function sendVerificationEmail(user: User, baseUrl: string): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY || !process.env.SENDGRID_FROM_EMAIL) {
    console.error("SendGrid configuration missing. Cannot send verification email.");
    return false;
  }
  
  try {
    // Generate a new verification token
    const token = await generateVerificationToken(user.id);
    
    // Create verification URL
    const verificationUrl = `${baseUrl}/verify-email?token=${token}&userId=${user.id}`;
    
    // Get the verified sender email
    const fromEmail = getVerifiedSenderEmail();
    
    // Create email message
    const msg = {
      to: user.email!,
      from: fromEmail,
      subject: 'Verify Your Email - FoodVault',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Verify Your Email Address</h2>
          <p>Hello ${user.fullName || user.username},</p>
          <p>Thank you for creating a FoodVault account. To complete your registration and access all features, please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify My Email</a>
          </div>
          <p>This verification link will expire in ${TOKEN_EXPIRATION_HOURS} hours.</p>
          <p>If you did not create this account, please ignore this email.</p>
          <hr style="border: 1px solid #eee; margin: 30px 0;" />
          <p style="font-size: 12px; color: #666;">FoodVault - Track your food inventory, reduce waste, and save money.</p>
        </div>
      `,
      text: `
        Verify Your Email Address
        
        Hello ${user.fullName || user.username},
        
        Thank you for creating a FoodVault account. To complete your registration and access all features, please verify your email address by visiting the link below:
        
        ${verificationUrl}
        
        This verification link will expire in ${TOKEN_EXPIRATION_HOURS} hours.
        
        If you did not create this account, please ignore this email.
        
        FoodVault - Track your food inventory, reduce waste, and save money.
      `
    };
    
    // Send email
    await sgMail.send(msg);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
}

/**
 * Verify a user's email using a token
 */
export async function verifyEmail(userId: number, token: string): Promise<boolean> {
  try {
    // Get user
    const user = await storage.getUser(userId);
    if (!user) {
      return false;
    }
    
    // Check if user is already verified
    if (user.emailVerified) {
      return true;
    }
    
    // Check if token matches and is not expired
    if (user.verificationToken !== token) {
      return false;
    }
    
    // Check if token is expired
    if (user.verificationTokenExpiresAt && new Date(user.verificationTokenExpiresAt) < new Date()) {
      return false;
    }
    
    // Update user as verified and clear token
    await storage.updateUserVerification(userId, {
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpiresAt: null
    });
    
    // Also update user role to regular user (from unverified)
    const regularUserRole = await storage.getRoleByName('user');
    if (regularUserRole) {
      await storage.updateUserRole(userId, regularUserRole.id);
    }
    
    return true;
  } catch (error) {
    console.error('Error verifying email:', error);
    return false;
  }
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(userId: number, baseUrl: string): Promise<boolean> {
  try {
    const user = await storage.getUser(userId);
    if (!user || !user.email) {
      return false;
    }
    
    // Send new verification email
    return await sendVerificationEmail(user, baseUrl);
  } catch (error) {
    console.error('Error resending verification email:', error);
    return false;
  }
}