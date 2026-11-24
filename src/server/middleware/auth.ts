import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { adminUsers, users } from '../../db/schema.ts';
import { verifyAuthToken } from '../utils/crypto.ts';

export const AUTH_COOKIE_NAME = 'acadet_jamb_token';

export interface AuthenticatedActor {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: 'student' | 'admin' | 'super_admin';
  actorType: 'student' | 'admin';
  registrationNumber?: string;
  jambYear?: number;
  emailVerified?: boolean;
}

export interface AuthRequest extends Request {
  actor?: AuthenticatedActor;
}

export function extractTokenFromRequest(req: Request): string | null {
  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (cookieToken && typeof cookieToken === 'string') {
    return cookieToken;
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

function isSecureContext(req?: Request): boolean {
  if (req) {
    const proto = req.headers['x-forwarded-proto'];
    if (proto === 'https' || req.secure) return true;
    const host = req.headers.host || '';
    if (host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('0.0.0.0')) {
      return false;
    }
  }
  return process.env.NODE_ENV === 'production';
}

export function setAuthCookie(res: Response, token: string, req?: Request): void {
  const secure = isSecureContext(req);
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: secure ? 'none' : 'lax',
    secure,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res: Response, req?: Request): void {
  const secure = isSecureContext(req);
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: secure ? 'none' : 'lax',
    secure,
    path: '/',
  });
}

export async function resolveActorFromRequest(req: Request): Promise<AuthenticatedActor | null> {
  const token = extractTokenFromRequest(req);
  if (!token) return null;

  try {
    const payload = verifyAuthToken(token);

    if (payload.actorType === 'admin') {
      const rows = await db.select().from(adminUsers).where(eq(adminUsers.id, payload.sub));
      const admin = rows[0];
      if (!admin || !admin.isActive || admin.sessionVersion !== payload.sessionVersion) {
        return null;
      }
      return {
        id: admin.id,
        email: admin.email,
        username: admin.username,
        fullName: admin.fullName,
        role: admin.role as 'admin' | 'super_admin',
        actorType: 'admin',
      };
    }

    const rows = await db.select().from(users).where(eq(users.id, payload.sub));
    const student = rows[0];
    if (!student || student.sessionVersion !== payload.sessionVersion || student.accountStatus === 'suspended') {
      return null;
    }

    return {
      id: student.id,
      email: student.email,
      username: student.username,
      fullName: student.fullName,
      role: 'student',
      actorType: 'student',
      registrationNumber: student.registrationNumber,
      jambYear: student.jambYear,
      emailVerified: student.emailVerified,
    };
  } catch {
    return null;
  }
}

export async function requireAnyAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = extractTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: 'Please log in to continue.' });
    return;
  }

  try {
    const payload = verifyAuthToken(token);

    if (payload.actorType === 'admin') {
      const rows = await db.select().from(adminUsers).where(eq(adminUsers.id, payload.sub));
      const admin = rows[0];
      if (!admin || !admin.isActive || admin.sessionVersion !== payload.sessionVersion) {
        res.status(401).json({ error: 'Admin session expired or inactive.' });
        return;
      }
      req.actor = {
        id: admin.id,
        email: admin.email,
        username: admin.username,
        fullName: admin.fullName,
        role: admin.role as 'admin' | 'super_admin',
        actorType: 'admin',
      };
      next();
      return;
    }

    const rows = await db.select().from(users).where(eq(users.id, payload.sub));
    const student = rows[0];
    if (!student || student.sessionVersion !== payload.sessionVersion) {
      res.status(401).json({ error: 'Session expired. Please log in again.' });
      return;
    }
    if (student.accountStatus === 'suspended') {
      res.status(403).json({
        error: student.suspendedReason
          ? `Account suspended: ${student.suspendedReason}`
          : 'Your account has been suspended. Contact support.',
      });
      return;
    }

    req.actor = {
      id: student.id,
      email: student.email,
      username: student.username,
      fullName: student.fullName,
      role: 'student',
      actorType: 'student',
      registrationNumber: student.registrationNumber,
      jambYear: student.jambYear,
      emailVerified: student.emailVerified,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export async function requireStudentAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  await requireAnyAuth(req, res, () => {
    if (!req.actor || req.actor.actorType !== 'student') {
      res.status(403).json({ error: 'Student account access required.' });
      return;
    }
    next();
  });
}

export async function requireAdminAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  await requireAnyAuth(req, res, () => {
    if (!req.actor || req.actor.actorType !== 'admin') {
      res.status(403).json({ error: 'Administrator privileges required.' });
      return;
    }
    next();
  });
}

export async function requireSuperAdminAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  await requireAdminAuth(req, res, () => {
    if (!req.actor || req.actor.role !== 'super_admin') {
      res.status(403).json({ error: 'Super Administrator privileges required.' });
      return;
    }
    next();
  });
}
