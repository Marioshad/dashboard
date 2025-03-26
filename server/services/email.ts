import nodemailer from 'nodemailer';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq, and, isNull, lt } from 'drizzle-orm';
import crypto from 'crypto';

const VERIFICATION_EXPIRY_DAYS = 7;

// Create reusable transporter
let transporter: nodemailer.Transporter;

// Initialize email transporter
export async function initializeEmailService() {
  try {
    // Generate test SMTP service account from ethereal.email
    // Only needed if you don't have a real mail account for testing
    const testAccount = await nodemailer.createTestAccount();

    // Create reusable transporter object using the default SMTP transport
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    console.log('Email service initialized with test account:', testAccount.user);
    console.log('View emails at: https://ethereal.email');
    return testAccount;
  } catch (error) {
    console.error('Failed to initialize email service:', error);
    throw error;
  }
}

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
    const verificationUrl = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

    const info = await transporter.sendMail({
      from: '"Your App" <noreply@yourdomain.com>',
      to: email,
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

    console.log('Verification email sent:', info.messageId);
    // Preview URL for Ethereal emails
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));

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