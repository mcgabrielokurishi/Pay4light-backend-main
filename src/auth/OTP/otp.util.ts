import * as crypto from "crypto";

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function hashOTP(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export function generateExpiry(minutes = 5): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}