import crypto from 'crypto';

/**
 * Generate a random token of specified length (in bytes)
 * 
 * @param length Length of token in bytes (actual string will be twice as long)
 * @returns Random token string
 */
export function generateRandomToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}