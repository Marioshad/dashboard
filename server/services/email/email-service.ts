import { MailService, MailDataRequired } from '@sendgrid/mail';
import { log } from '../../vite';
import { formatCurrency } from '../../../client/src/lib/utils';

// Initialize SendGrid client
let mailService: MailService | null = null;
let sendgridAvailable = false;

try {
  if (process.env.SENDGRID_API_KEY) {
    mailService = new MailService();
    mailService.setApiKey(process.env.SENDGRID_API_KEY);
    sendgridAvailable = true;
    log('SendGrid initialized successfully', 'email');
  } else {
    log('SENDGRID_API_KEY is not set, email features will be disabled', 'email');
  }
} catch (error) {
  log(`Error initializing SendGrid: ${error}`, 'email');
}

// Interface for email parameters
interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Check if SendGrid service is available
 * @returns True if SendGrid service is available, false otherwise
 */
export function isSendGridAvailable(): boolean {
  return sendgridAvailable && !!mailService;
}

/**
 * Send an email using SendGrid
 * @param params Email parameters
 * @returns True if email was sent successfully, false otherwise
 */
export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!sendgridAvailable || !mailService) {
    log('SendGrid is not available, skipping email', 'email');
    return false;
  }

  try {
    const msg: MailDataRequired = {
      to: params.to,
      from: params.from || process.env.SENDGRID_FROM_EMAIL || 'noreply@foodvault.com',
      subject: params.subject,
      text: params.text || '',
      html: params.html || '',
      content: [
        {
          type: 'text/html',
          value: params.html || params.text || '',
        },
      ],
    };
    
    await mailService.send(msg);
    log(`Email sent successfully to ${params.to}`, 'email');
    return true;
  } catch (error: any) {
    log(`Error sending email: ${error.message}`, 'email');
    return false;
  }
}

/**
 * Send a subscription confirmation or update email
 * @param to Recipient email
 * @param subject Email subject
 * @param tierName Subscription tier name
 * @param amount Subscription amount
 * @param currency Subscription currency
 * @param expiryDate Subscription expiry date
 * @returns True if email was sent successfully, false otherwise
 */
export async function sendSubscriptionEmail(
  to: string,
  subject: string,
  tierName: string,
  amount: number,
  currency: string,
  expiryDate: Date | null
): Promise<boolean> {
  if (!sendgridAvailable) {
    return false;
  }

  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@foodvault.com';
  const formattedAmount = formatCurrency(amount, currency);
  const dateStr = expiryDate 
    ? new Date(expiryDate).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    : 'N/A';

  // Basic but functional email template
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
      <h2 style="color: #333;">${subject}</h2>
      <p>Thank you for your subscription to FoodVault!</p>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h3 style="margin-top: 0; color: #333;">Subscription Details</h3>
        <p><strong>Plan:</strong> ${tierName}</p>
        <p><strong>Price:</strong> ${formattedAmount}${expiryDate ? ' per billing period' : ''}</p>
        ${expiryDate ? `<p><strong>Next billing date:</strong> ${dateStr}</p>` : ''}
      </div>
      
      <p>Here's what you can do with your ${tierName} plan:</p>
      <ul>
        ${tierName === 'Free' 
          ? `<li>Track up to 3 receipts</li>
             <li>Store up to 50 food items</li>`
          : tierName === 'Smart Pantry'
            ? `<li>Track up to 20 receipts</li>
               <li>Store up to 200 food items</li>
               <li>Share with up to 2 users</li>`
            : `<li>Track up to 100 receipts</li>
               <li>Store up to 1000 food items</li>
               <li>Share with up to 10 users</li>
               <li>Priority support</li>`
        }
      </ul>
      
      <p>If you have any questions or need assistance, please contact our support team.</p>
      
      <p style="margin-top: 30px; font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 15px;">
        This email was sent from FoodVault, a food inventory management system.
      </p>
    </div>
  `;

  return sendEmail({
    to,
    from: fromEmail,
    subject,
    html,
  });
}

/**
 * Send an invoice notification email
 * @param to Recipient email
 * @param invoiceDetails Invoice details
 * @returns True if email was sent successfully, false otherwise
 */
export async function sendInvoiceEmail(
  to: string,
  invoiceDetails: {
    invoiceNumber: string;
    invoiceDate: Date;
    amount: number;
    currency: string;
    status: string;
    tierName: string;
    invoiceUrl?: string;
    pdfUrl?: string;
  }
): Promise<boolean> {
  if (!sendgridAvailable) {
    return false;
  }

  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@foodvault.com';
  const subject = invoiceDetails.status === 'paid' 
    ? 'Payment Receipt - FoodVault' 
    : 'Invoice from FoodVault';
  
  const formattedAmount = formatCurrency(invoiceDetails.amount, invoiceDetails.currency);
  const dateStr = new Date(invoiceDetails.invoiceDate).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Status specific content
  const statusSpecificContent = invoiceDetails.status === 'paid'
    ? `
      <div style="background-color: #e6f7e6; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #4CAF50;">
        <h3 style="margin-top: 0; color: #2e7d32;">Payment Successful</h3>
        <p>Your payment has been processed successfully. Thank you for your continued subscription.</p>
      </div>
    `
    : `
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #3f51b5;">
        <h3 style="margin-top: 0; color: #3f51b5;">Invoice Created</h3>
        <p>Your invoice has been created and is ready for payment.</p>
      </div>
    `;

  // Button link text and URL
  const buttonText = invoiceDetails.status === 'paid' ? 'View Receipt' : 'View Invoice';
  const buttonUrl = invoiceDetails.status === 'paid' 
    ? (invoiceDetails.pdfUrl || invoiceDetails.invoiceUrl || '#') 
    : (invoiceDetails.invoiceUrl || '#');

  // Email template
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #333; margin-bottom: 5px;">${subject}</h1>
        <p style="color: #666; margin-top: 0;">Invoice #${invoiceDetails.invoiceNumber}</p>
      </div>

      ${statusSpecificContent}
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h3 style="margin-top: 0; color: #333;">Invoice Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Invoice Number:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${invoiceDetails.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Date:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${dateStr}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Plan:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${invoiceDetails.tierName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Status:</strong></td>
            <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right; ${invoiceDetails.status === 'paid' ? 'color: #4CAF50;' : ''}">${invoiceDetails.status === 'paid' ? 'Paid' : 'Open'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Amount:</strong></td>
            <td style="padding: 8px 0; text-align: right; font-size: 18px; font-weight: bold;">${formattedAmount}</td>
          </tr>
        </table>
      </div>
      
      <div style="margin: 25px 0; text-align: center;">
        <a href="${buttonUrl}" 
           style="background-color: #4361ee; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
          ${buttonText}
        </a>
      </div>
      
      <p>If you have any questions about this invoice, please contact our support team.</p>
      
      <p style="margin-top: 30px; font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 15px;">
        This email was sent from FoodVault, a food inventory management system.
      </p>
    </div>
  `;

  return sendEmail({
    to,
    from: fromEmail,
    subject,
    html,
  });
}

/**
 * Send a receipt scan notification email
 * @param to Recipient email
 * @param receiptDetails Receipt details
 * @returns True if email was sent successfully, false otherwise
 */
export async function sendReceiptScanEmail(
  to: string,
  receiptDetails: {
    id: number;
    store: string;
    date: Date;
    amount: number;
    currency: string;
    itemCount: number;
  }
): Promise<boolean> {
  if (!sendgridAvailable) {
    return false;
  }

  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@foodvault.com';
  const subject = 'Your Receipt Has Been Processed';
  const formattedAmount = formatCurrency(receiptDetails.amount, receiptDetails.currency);
  const dateStr = new Date(receiptDetails.date).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Basic but functional email template
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
      <h2 style="color: #333;">Your Receipt Has Been Processed</h2>
      <p>We've successfully processed your receipt and added the items to your inventory.</p>
      
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h3 style="margin-top: 0; color: #333;">Receipt Details</h3>
        <p><strong>Store:</strong> ${receiptDetails.store}</p>
        <p><strong>Date:</strong> ${dateStr}</p>
        <p><strong>Total Amount:</strong> ${formattedAmount}</p>
        <p><strong>Items Added:</strong> ${receiptDetails.itemCount}</p>
      </div>
      
      <p>You can view the full details by logging into your FoodVault account and checking your receipts section.</p>
      
      <div style="margin: 25px 0; text-align: center;">
        <a href="${process.env.PUBLIC_URL || 'https://foodvault.app'}/receipts/${receiptDetails.id}" 
           style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
          View Receipt Details
        </a>
      </div>
      
      <p style="margin-top: 30px; font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 15px;">
        This email was sent from FoodVault, a food inventory management system.
      </p>
    </div>
  `;

  return sendEmail({
    to,
    from: fromEmail,
    subject,
    html,
  });
}

/**
 * Send a test email to users and administrators
 * @param userEmail User's email address 
 * @param adminEmail Admin's email address (optional)
 * @param userName User's name or username
 * @returns True if at least one email was sent successfully, false otherwise
 */
export async function sendTestEmail(
  userEmail: string,
  adminEmail: string | null = null,
  userName: string = 'User'
): Promise<boolean> {
  if (!sendgridAvailable) {
    log('SendGrid is not available, skipping test email', 'email');
    return false;
  }

  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@foodvault.com';
  const currentDate = new Date();
  const dateStr = currentDate.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Create a beautiful HTML email template
  const userHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0;">
      <!-- Header with logo and gradient background -->
      <div style="background: linear-gradient(to right, #4361ee, #3f37c9); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">FoodVault</h1>
        <p style="margin: 10px 0 0; opacity: 0.9;">Your Smart Food Inventory Manager</p>
      </div>
      
      <!-- Main content -->
      <div style="background-color: #ffffff; padding: 30px 20px; border-left: 1px solid #e0e0e0; border-right: 1px solid #e0e0e0;">
        <h2 style="color: #333; margin-top: 0;">Hello, ${userName}!</h2>
        <p>This is a test email to confirm that your email notifications are working correctly with FoodVault.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4361ee;">
          <h3 style="margin-top: 0; color: #333; font-size: 18px;">Email Test Details</h3>
          <p><strong>Status:</strong> <span style="color: #4CAF50;">Successful ✓</span></p>
          <p><strong>Sent:</strong> ${dateStr}</p>
          <p><strong>Email:</strong> ${userEmail}</p>
        </div>
        
        <p>With FoodVault email notifications, you'll receive:</p>
        <ul style="padding-left: 20px; line-height: 1.6;">
          <li>Receipt processing confirmations</li>
          <li>Expiry date alerts for your food items</li>
          <li>Subscription updates and invoices</li>
          <li>Important account notifications</li>
        </ul>
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${process.env.PUBLIC_URL || 'https://foodvault.app'}/settings" 
             style="background-color: #4361ee; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Manage Email Preferences
          </a>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0; border-top: none;">
        <p>This is an automated message from FoodVault. Please do not reply to this email.</p>
        <p style="margin-bottom: 0;">© ${currentDate.getFullYear()} FoodVault. All rights reserved.</p>
      </div>
    </div>
  `;

  // Create a different template for admin
  const adminHtml = adminEmail ? `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0;">
      <!-- Header with logo and gradient background -->
      <div style="background: linear-gradient(to right, #3a0ca3, #4361ee); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">FoodVault Admin</h1>
        <p style="margin: 10px 0 0; opacity: 0.9;">Email System Test Notification</p>
      </div>
      
      <!-- Main content -->
      <div style="background-color: #ffffff; padding: 30px 20px; border-left: 1px solid #e0e0e0; border-right: 1px solid #e0e0e0;">
        <h2 style="color: #333; margin-top: 0;">Email Test Triggered</h2>
        <p>A user has triggered an email test from the FoodVault application.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3a0ca3;">
          <h3 style="margin-top: 0; color: #333; font-size: 18px;">Test Details</h3>
          <p><strong>Timestamp:</strong> ${dateStr}</p>
          <p><strong>User Email:</strong> ${userEmail}</p>
          <p><strong>User Name:</strong> ${userName}</p>
          <p><strong>Status:</strong> <span style="color: #4CAF50;">Email Sent ✓</span></p>
        </div>
        
        <p>This is a system test to verify that the email functionality is working correctly.</p>
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${process.env.PUBLIC_URL || 'https://foodvault.app'}/admin/emails" 
             style="background-color: #3a0ca3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Email System Dashboard
          </a>
        </div>
      </div>
      
      <!-- Footer -->
      <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0; border-top: none;">
        <p>This is an automated admin notification from FoodVault.</p>
        <p style="margin-bottom: 0;">© ${currentDate.getFullYear()} FoodVault. All rights reserved.</p>
      </div>
    </div>
  ` : '';

  // Send email to user
  const userEmailSuccess = await sendEmail({
    to: userEmail,
    from: fromEmail,
    subject: 'FoodVault Email Test',
    html: userHtml,
  });
  
  log(`Test email to user (${userEmail}) ${userEmailSuccess ? 'sent successfully' : 'failed'}`, 'email');

  // If admin email is provided, send an email to admin as well
  let adminEmailSuccess = false;
  if (adminEmail) {
    adminEmailSuccess = await sendEmail({
      to: adminEmail,
      from: fromEmail,
      subject: 'FoodVault Admin: Email Test Notification',
      html: adminHtml,
    });
    
    log(`Test email to admin (${adminEmail}) ${adminEmailSuccess ? 'sent successfully' : 'failed'}`, 'email');
  }

  // Return true if at least one email was sent successfully
  return userEmailSuccess || adminEmailSuccess;
}