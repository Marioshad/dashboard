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