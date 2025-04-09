// Script to generate a password hash for testing
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64));
  return `${buf.toString("hex")}.${salt}`;
}

async function main() {
  const password = 'password123';
  console.log(`Generating hash for password: '${password}'`);
  const hash = await hashPassword(password);
  console.log(`Generated hash: ${hash}`);
  
  // SQL update statement to set the password
  console.log(`\nSQL to update admin password:`);
  console.log(`UPDATE users SET password = '${hash}' WHERE username = 'admin';`);
}

main().catch(console.error);