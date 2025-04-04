import crypto from 'crypto';

/**
 * Generate a secure random token for email verification
 * Uses cryptographically secure random bytes to ensure security
 * 
 * @returns A random verification token
 */
export function generateVerificationToken(): string {
  // Generate 32 bytes of random data
  const randomBytes = crypto.randomBytes(32);
  
  // Convert to hexadecimal string to make it URL-safe
  return randomBytes.toString('hex');
}

/**
 * Calculate token expiration date
 * Tokens expire after a certain period to limit security risks
 * 
 * @param hours Number of hours before the token expires (default: 24)
 * @returns Date object representing the expiration date
 */
export function calculateTokenExpiration(hours: number = 24): Date {
  const expirationDate = new Date();
  expirationDate.setHours(expirationDate.getHours() + hours);
  return expirationDate;
}

/**
 * Check if a token has expired
 * 
 * @param expirationDate The token expiration date
 * @returns Boolean indicating if the token has expired
 */
export function isTokenExpired(expirationDate: Date | null): boolean {
  if (!expirationDate) return true;
  
  const now = new Date();
  return now > expirationDate;
}