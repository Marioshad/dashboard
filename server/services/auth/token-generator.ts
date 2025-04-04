import { randomBytes } from 'crypto';

/**
 * Generate a random token of specified length
 * @param length Length of token in bytes (will produce a hex string of 2*length characters)
 * @returns Random hex string token
 */
export function generateRandomToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}