import { MailService } from '@sendgrid/mail';
import { users } from '@shared/schema';
import { db } from '../db';
import { eq, and, isNull, lt } from 'drizzle-orm';
import crypto from 'crypto';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error('SENDGRID_API_KEY environment variable is required');
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

const VERIFICATION_EXPIRY_DAYS = 7;

export async function sendVerificationEmail(userId: number, email: string, username: string) {
  try {
    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + VERIFICATION_EXPIRY_DAYS);

    // Update user with verification token
    await db.update(users)
      .set({
        verificationToken: token,
        verificationTokenExpiry: expiry,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Send verification email
    const verificationUrl = `${process.env.APP_URL}/verify-email?token=${token}`;
    
    await mailService.send({
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@yourdomain.com',
      subject: 'Verify your email address',
      html: `
        <h1>Welcome to our platform!</h1>
        <p>Hi ${username},</p>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="${verificationUrl}">Verify Email Address</a></p>
        <p>This link will expire in ${VERIFICATION_EXPIRY_DAYS} days.</p>
        <p>If you did not create an account, no further action is required.</p>
      `,
    });

    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
}

// Function to clean up unverified users after 7 days
export async function cleanupUnverifiedUsers() {
  try {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() - VERIFICATION_EXPIRY_DAYS);

    const unverifiedUsers = await db.select()
      .from(users)
      .where(
        and(
          eq(users.emailVerified, false),
          lt(users.createdAt, expiryDate),
          isNull(users.deletedAt)
        )
      );

    // Soft delete unverified users
    for (const user of unverifiedUsers) {
      await db.update(users)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    }

    return unverifiedUsers.length;
  } catch (error) {
    console.error('Error cleaning up unverified users:', error);
    throw error;
  }
}

// Schedule cleanup to run daily
setInterval(cleanupUnverifiedUsers, 24 * 60 * 60 * 1000);
