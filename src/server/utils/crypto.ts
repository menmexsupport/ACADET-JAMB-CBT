import crypto from 'crypto';
import jwt from 'jsonwebtoken';

export interface AuthTokenPayload {
  sub: string;
  role: 'student' | 'admin' | 'super_admin';
  sessionVersion: number;
  actorType: 'student' | 'admin';
}

const DEV_EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');

export function getJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be configured in production.');
  }
  return DEV_EPHEMERAL_SECRET;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'];
  return jwt.sign(payload, getJwtSecret(), { expiresIn });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
}

export function hashOpaqueToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateOpaqueToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  return { raw, hash: hashOpaqueToken(raw) };
}

export function generateRegistrationCode(jambYear: number): string {
  const num = crypto.randomInt(10000, 99999);
  return `ACD-JAMB-${jambYear}-${num}`;
}
