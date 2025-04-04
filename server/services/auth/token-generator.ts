import crypto from 'crypto';

/**
 * Generate a random token string of specified length
 * @param length Length of the token to generate (default: 32)
 * @returns A random token string
 */
export function generateRandomToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}