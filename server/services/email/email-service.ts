import sgMail from '@sendgrid/mail';
import { emailLogger } from '../logger';

// Check if SendGrid API key is available and initialize if it is
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  emailLogger.info('SendGrid API initialized successfully');
} else {
  emailLogger.warn('SENDGRID_API_KEY is not set. Email functionality will be unavailable.');
}

/**
 * Check if SendGrid is available and properly configured
 * @returns Boolean indicating if SendGrid is available
 */
export function isSendGridAvailable(): boolean {
  return Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL);
}

// Define email options interface
export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

/**
 * Send an email using SendGrid
 * @param options Email options (to, subject, text, html, from)
 * @returns Boolean indicating if email was sent successfully
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  // Early return if SendGrid is not configured
  if (!process.env.SENDGRID_API_KEY) {
    emailLogger.error('Cannot send email: SENDGRID_API_KEY is not set');
    return false;
  }

  // Early return if from email is not configured
  if (!process.env.SENDGRID_FROM_EMAIL && !options.from) {
    emailLogger.error('Cannot send email: SENDGRID_FROM_EMAIL is not set and no from address was provided');
    return false;
  }

  try {
    // Prepare email
    const msg = {
      to: options.to,
      from: options.from || process.env.SENDGRID_FROM_EMAIL as string,
      subject: options.subject,
      text: options.text || '',
      html: options.html || '',
    };

    emailLogger.debug(`Attempting to send email to ${options.to} with subject: ${options.subject}`);
    
    // Send email
    await sgMail.send(msg);
    emailLogger.info(`Email sent successfully to ${options.to}`);
    return true;
  } catch (error: any) {
    emailLogger.error('Error sending email:', error);
    if (error.response) {
      emailLogger.error('SendGrid Error Details:', error.response.body);
    }
    return false;
  }
}

/**
 * Send a subscription confirmation or update email
 * @param email Email address to send to
 * @param subject Subject line for the email
 * @param tierName Subscription tier name
 * @param amount Payment amount
 * @param currency Payment currency
 * @param nextBillingDate Next billing date or null if canceled
 * @returns Boolean indicating if email was sent successfully
 */
export async function sendSubscriptionEmail(
  email: string,
  subject: string,
  tierName: string,
  amount: number,
  currency: string,
  nextBillingDate: Date | null
): Promise<boolean> {
  const formattedAmount = amount.toFixed(2);
  const formattedCurrency = currency.toUpperCase();
  const billingInfo = nextBillingDate 
    ? `Your next billing date is ${nextBillingDate.toLocaleDateString()}.` 
    : 'Your subscription has been canceled.';
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Subscription ${nextBillingDate ? 'Confirmation' : 'Canceled'}</h2>
      <p>Thank you for your ${nextBillingDate ? 'subscription' : 'previous subscription'} to our service!</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Plan:</strong> ${tierName}</p>
        <p style="margin: 5px 0;"><strong>Amount:</strong> ${formattedCurrency} ${formattedAmount}</p>
        <p style="margin: 5px 0;">${billingInfo}</p>
      </div>
      <p>If you have any questions about your subscription, please contact our support team.</p>
    </div>
  `;
  
  return sendEmail({
    to: email,
    subject,
    html,
    text: `Subscription ${nextBillingDate ? 'Confirmation' : 'Canceled'}\n\nThank you for your ${nextBillingDate ? 'subscription' : 'previous subscription'} to our service!\n\nPlan: ${tierName}\nAmount: ${formattedCurrency} ${formattedAmount}\n${billingInfo}\n\nIf you have any questions about your subscription, please contact our support team.`,
  });
}

/**
 * Send an invoice email
 * @param email Email address to send to
 * @param subject Subject line for the email
 * @param invoiceUrl URL to view the invoice
 * @param amount Invoice amount
 * @param currency Invoice currency
 * @param invoiceNumber Invoice number/ID
 * @param invoiceDate Invoice date
 * @returns Boolean indicating if email was sent successfully
 */
export async function sendInvoiceEmail(
  email: string,
  subject: string,
  invoiceUrl: string,
  amount: number,
  currency: string,
  invoiceNumber: string,
  invoiceDate: Date
): Promise<boolean> {
  const formattedAmount = amount.toFixed(2);
  const formattedCurrency = currency.toUpperCase();
  const formattedDate = invoiceDate.toLocaleDateString();
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Invoice Available</h2>
      <p>Your invoice is now available.</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${invoiceNumber}</p>
        <p style="margin: 5px 0;"><strong>Date:</strong> ${formattedDate}</p>
        <p style="margin: 5px 0;"><strong>Amount:</strong> ${formattedCurrency} ${formattedAmount}</p>
      </div>
      <p>
        <a href="${invoiceUrl}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; margin: 20px 0;">
          View Invoice
        </a>
      </p>
      <p>If you have any questions about your invoice, please contact our support team.</p>
    </div>
  `;
  
  return sendEmail({
    to: email,
    subject,
    html,
    text: `Invoice Available\n\nYour invoice is now available.\n\nInvoice Number: ${invoiceNumber}\nDate: ${formattedDate}\nAmount: ${formattedCurrency} ${formattedAmount}\n\nView your invoice at: ${invoiceUrl}\n\nIf you have any questions about your invoice, please contact our support team.`,
  });
}

/**
 * Send a test email to verify configuration
 * @param userEmail Email address to send test to
 * @param adminEmail Optional admin email to CC
 * @param username Username for personalization
 * @returns Boolean indicating if test email was sent successfully
 */
export async function sendTestEmail(
  userEmail: string, 
  adminEmail: string | null = null, 
  username: string = "User"
): Promise<boolean> {
  const emailOptions: EmailOptions = {
    to: userEmail,
    subject: 'Test Email from Your Application',
    text: `Hello ${username}, this is a test email from your application. If you received this, email sending is working correctly!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Email Test Successful</h2>
        <p>Hello ${username},</p>
        <p>This is a test email from your application.</p>
        <p>If you received this, email sending is working correctly!</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Configuration:</strong></p>
          <p style="margin: 5px 0;">Service: SendGrid</p>
          <p style="margin: 5px 0;">From: ${process.env.SENDGRID_FROM_EMAIL || 'Default sender'}</p>
          ${adminEmail ? `<p style="margin: 5px 0;">CC: Admin (${adminEmail})</p>` : ''}
        </div>
      </div>
    `,
  };
  
  // If admin email is provided, send a copy to them as well
  if (adminEmail) {
    // Send to admin separately
    await sendEmail({
      to: adminEmail,
      subject: `[ADMIN COPY] Test Email from Your Application (${userEmail})`,
      text: `This is an admin copy of a test email sent to ${userEmail}. If you received this, email sending is working correctly!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Email Test Successful (Admin Copy)</h2>
          <p>This is an admin copy of a test email sent to ${userEmail}.</p>
          <p>If you received this, email sending is working correctly!</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Configuration:</strong></p>
            <p style="margin: 5px 0;">Service: SendGrid</p>
            <p style="margin: 5px 0;">From: ${process.env.SENDGRID_FROM_EMAIL || 'Default sender'}</p>
            <p style="margin: 5px 0;">User: ${userEmail}</p>
          </div>
        </div>
      `,
    });
  }
  
  return sendEmail(emailOptions);
}