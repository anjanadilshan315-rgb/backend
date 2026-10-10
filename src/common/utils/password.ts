import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';

// Compared against when the account does not exist, so a failed login takes
// the same time whether or not the e-mail is registered.
const DUMMY_HASH = '$2b$12$z4ngr56h3FSpPHvA0L6RUeQ0FrEFim9LOenEy9By8tVAGwXC4roYC';

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  return bcrypt.compare(plain, hash ?? DUMMY_HASH).then((match) => match && Boolean(hash));
}
