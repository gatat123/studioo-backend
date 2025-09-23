import { randomBytes } from 'crypto';

export function generateInviteCode(): string {
  return randomBytes(8).toString('hex').toUpperCase();
}

export function generateUniqueId(): string {
  return randomBytes(16).toString('hex');
}