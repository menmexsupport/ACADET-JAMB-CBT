import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq, or, and, isNull, gt } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  adminUsers,
  emailVerificationTokens,
  passwordResetTokens,
  platformSettings,
  users,
} from '../../db/schema.ts';
import {
  AuthRequest,
  clearAuthCookie,
  requireStudentAuth,
  resolveActorFromRequest,
  setAuthCookie,
} from '../middleware/auth.ts';
import {
  generateOpaqueToken,
  generateRegistrationCode,
  hashOpaqueToken,
  signAuthToken,
} from '../utils/crypto.ts';
import { sendTransactionalEmail } from '../utils/email.ts';
import { logAuditEvent } from '../utils/audit.ts';

const router = Router();

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120),
  email: z.string().trim().email('Enter a valid email address').toLowerCase(),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(40)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain letters, numbers, dots, underscores, and hyphens')
    .toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  phoneNumber: z.string().trim().min(7, 'Enter a valid phone number').max(25),
  jambYear: z.coerce.number().int().min(2024).max(2030),
  intendedCourse: z.string().trim().min(2, 'Enter your intended course of study').max(120),
  preferredInstitution: z.string().trim().min(2, 'Enter your preferred institution').max(150),
});

router.post('/auth/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration data.' });
    return;
  }

  try {
    const [settings] = await db.select().from(platformSettings).where(eq(platformSettings.id, 'default'));
    if (settings && !settings.allowStudentRegistration) {
      res.status(403).json({ error: 'New student registration is currently closed by the administrator.' });
      return;
    }

    const data = parsed.data;
    const existing = await db
      .select({ id: users.id, email: users.email, username: users.username })
      .from(users)
      .where(or(eq(users.email, data.email), eq(users.username, data.username)));

    if (existing.length > 0) {
      const match = existing[0];
      res.status(409).json({
        error: match.email === data.email ? 'An account with this email already exists.' : 'This username is already taken.',
      });
      return;
    }

    // Generate unique registration number
    let registrationNumber = generateRegistrationCode(data.jambYear);
    for (let i = 0; i < 5; i++) {
      const regExists = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.registrationNumber, registrationNumber));
      if (regExists.length === 0) break;
      registrationNumber = generateRegistrationCode(data.jambYear);
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const [created] = await db
      .insert(users)
      .values({
        fullName: data.fullName,
        email: data.email,
        username: data.username,
        registrationNumber,
        passwordHash,
        role: 'student',
        phoneNumber: data.phoneNumber,
        jambYear: data.jambYear,
        intendedCourse: data.intendedCourse,
        preferredInstitution: data.preferredInstitution,
        emailVerified: false,
        accountStatus: 'active',
      })
      .returning();

    const { raw, hash } = generateOpaqueToken();
    await db.insert(emailVerificationTokens).values({
      userId: created.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const appBase = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`;
    const verifyUrl = `${appBase}/verify-email?token=${raw}`;
    await sendTransactionalEmail({
      to: created.email,
      subject: 'Verify your Acadet JAMB CBT student account',
      html: `<p>Welcome to Acadet JAMB CBT, ${created.fullName}!</p><p>Your Student Registration Number is <strong>${created.registrationNumber}</strong>.</p><p><a href="${verifyUrl}">Click here to verify your email address</a></p>`,
      text: `Welcome to Acadet JAMB CBT! Reg No: ${created.registrationNumber}. Verify your email: ${verifyUrl}`,
    });

    const token = signAuthToken({
      sub: created.id,
      role: 'student',
      sessionVersion: created.sessionVersion,
      actorType: 'student',
    });
    setAuthCookie(res, token, req);

    await logAuditEvent({
      actorId: created.id,
      actorRole: 'student',
      actorEmail: created.email,
      action: 'student.registered',
      entityType: 'user',
      entityId: created.id,
      details: { registrationNumber: created.registrationNumber, jambYear: created.jambYear },
      ipAddress: req.ip || null,
    });

    res.status(201).json({
      token,
      user: {
        id: created.id,
        fullName: created.fullName,
        email: created.email,
        username: created.username,
        registrationNumber: created.registrationNumber,
        role: 'student',
        actorType: 'student',
        phoneNumber: created.phoneNumber,
        jambYear: created.jambYear,
        intendedCourse: created.intendedCourse,
        preferredInstitution: created.preferredInstitution,
        emailVerified: created.emailVerified,
        preferences: created.preferences,
      },
      verificationDispatchNotice: process.env.RESEND_API_KEY ? 'Verification email sent.' : 'Account created. You can verify your email from your profile.',
    });
  } catch (err) {
    console.error('[auth/register] Error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

const loginSchema = z.object({
  identifier: z.string().trim().min(2, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid credentials.' });
    return;
  }

  try {
    const identifier = parsed.data.identifier.toLowerCase();
    const rows = await db
      .select()
      .from(users)
      .where(or(eq(users.email, identifier), eq(users.username, identifier), eq(users.registrationNumber, parsed.data.identifier.toUpperCase())));

    const student = rows[0];
    if (!student) {
      res.status(401).json({ error: 'Invalid email/username or password.' });
      return;
    }

    const valid = await bcrypt.compare(parsed.data.password, student.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email/username or password.' });
      return;
    }

    if (student.accountStatus === 'suspended') {
      res.status(403).json({
        error: student.suspendedReason
          ? `Account suspended: ${student.suspendedReason}`
          : 'Your account has been suspended. Please contact Acadet support.',
      });
      return;
    }

    const token = signAuthToken({
      sub: student.id,
      role: 'student',
      sessionVersion: student.sessionVersion,
      actorType: 'student',
    });
    setAuthCookie(res, token, req);

    res.json({
      token,
      user: {
        id: student.id,
        fullName: student.fullName,
        email: student.email,
        username: student.username,
        registrationNumber: student.registrationNumber,
        role: 'student',
        actorType: 'student',
        phoneNumber: student.phoneNumber,
        jambYear: student.jambYear,
        intendedCourse: student.intendedCourse,
        preferredInstitution: student.preferredInstitution,
        emailVerified: student.emailVerified,
        preferences: student.preferences,
      },
    });
  } catch (err) {
    console.error('[auth/login] Error:', err);
    res.status(500).json({ error: 'Login failed.' });
  }
});

router.post('/auth/admin/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid admin credentials.' });
    return;
  }

  try {
    const identifier = parsed.data.identifier.toLowerCase();
    const rows = await db
      .select()
      .from(adminUsers)
      .where(or(eq(adminUsers.email, identifier), eq(adminUsers.username, identifier)));

    const admin = rows[0];
    if (!admin) {
      res.status(401).json({ error: 'Invalid administrator credentials.' });
      return;
    }

    const valid = await bcrypt.compare(parsed.data.password, admin.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid administrator credentials.' });
      return;
    }

    if (!admin.isActive) {
      res.status(403).json({ error: 'This administrator account is deactivated.' });
      return;
    }

    await db
      .update(adminUsers)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(adminUsers.id, admin.id));

    const token = signAuthToken({
      sub: admin.id,
      role: admin.role as 'admin' | 'super_admin',
      sessionVersion: admin.sessionVersion,
      actorType: 'admin',
    });
    setAuthCookie(res, token, req);

    await logAuditEvent({
      actorId: admin.id,
      actorRole: admin.role,
      actorEmail: admin.email,
      action: 'admin.login',
      entityType: 'admin_user',
      entityId: admin.id,
      ipAddress: req.ip || null,
    });

    res.json({
      token,
      user: {
        id: admin.id,
        fullName: admin.fullName,
        email: admin.email,
        username: admin.username,
        role: admin.role,
        actorType: 'admin',
      },
    });
  } catch (err) {
    console.error('[auth/admin/login] Error:', err);
    res.status(500).json({ error: 'Administrator login failed.' });
  }
});

router.post('/auth/logout', (req, res) => {
  clearAuthCookie(res, req);
  res.json({ message: 'Logged out successfully.' });
});

router.get('/auth/me', async (req, res) => {
  const actor = await resolveActorFromRequest(req);
  if (!actor) {
    res.json({ user: null });
    return;
  }

  if (actor.actorType === 'admin') {
    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, actor.id));
    if (!admin) {
      res.json({ user: null });
      return;
    }
    res.json({
      user: {
        id: admin.id,
        fullName: admin.fullName,
        email: admin.email,
        username: admin.username,
        role: admin.role,
        actorType: 'admin',
      },
    });
    return;
  }

  const [student] = await db.select().from(users).where(eq(users.id, actor.id));
  if (!student) {
    res.json({ user: null });
    return;
  }
  res.json({
    user: {
      id: student.id,
      fullName: student.fullName,
      email: student.email,
      username: student.username,
      registrationNumber: student.registrationNumber,
      role: 'student',
      actorType: 'student',
      phoneNumber: student.phoneNumber,
      jambYear: student.jambYear,
      intendedCourse: student.intendedCourse,
      preferredInstitution: student.preferredInstitution,
      emailVerified: student.emailVerified,
      preferences: student.preferences,
      createdAt: student.createdAt,
    },
  });
});

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phoneNumber: z.string().trim().min(7).max(25),
  jambYear: z.coerce.number().int().min(2024).max(2030),
  intendedCourse: z.string().trim().min(2).max(120),
  preferredInstitution: z.string().trim().min(2).max(150),
});

router.patch('/auth/profile', requireStudentAuth, async (req: AuthRequest, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid profile fields.' });
    return;
  }

  const [updated] = await db
    .update(users)
    .set({
      fullName: parsed.data.fullName,
      phoneNumber: parsed.data.phoneNumber,
      jambYear: parsed.data.jambYear,
      intendedCourse: parsed.data.intendedCourse,
      preferredInstitution: parsed.data.preferredInstitution,
      updatedAt: new Date(),
    })
    .where(eq(users.id, req.actor!.id))
    .returning();

  res.json({
    user: {
      id: updated.id,
      fullName: updated.fullName,
      email: updated.email,
      username: updated.username,
      registrationNumber: updated.registrationNumber,
      role: 'student',
      actorType: 'student',
      phoneNumber: updated.phoneNumber,
      jambYear: updated.jambYear,
      intendedCourse: updated.intendedCourse,
      preferredInstitution: updated.preferredInstitution,
      emailVerified: updated.emailVerified,
      preferences: updated.preferences,
    },
  });
});

const preferencesSchema = z.object({
  theme: z.enum(['light', 'dark']).optional(),
  fontSize: z.enum(['normal', 'large']).optional(),
  showQuestionPalette: z.boolean().optional(),
  autoNextQuestion: z.boolean().optional(),
  soundNotifications: z.boolean().optional(),
  preferredSubjectCodes: z.array(z.string()).max(4).optional(),
});

router.patch('/auth/preferences', requireStudentAuth, async (req: AuthRequest, res) => {
  const parsed = preferencesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid preferences.' });
    return;
  }

  const [current] = await db.select().from(users).where(eq(users.id, req.actor!.id));
  const merged = { ...current.preferences, ...parsed.data };

  const [updated] = await db
    .update(users)
    .set({ preferences: merged, updatedAt: new Date() })
    .where(eq(users.id, req.actor!.id))
    .returning();

  res.json({ preferences: updated.preferences });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

router.post('/auth/change-password', requireStudentAuth, async (req: AuthRequest, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Password must be at least 8 characters.' });
    return;
  }

  const [student] = await db.select().from(users).where(eq(users.id, req.actor!.id));
  const ok = await bcrypt.compare(parsed.data.currentPassword, student.passwordHash);
  if (!ok) {
    res.status(400).json({ error: 'Current password is incorrect.' });
    return;
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  const nextVersion = student.sessionVersion + 1;
  await db
    .update(users)
    .set({ passwordHash: newHash, sessionVersion: nextVersion, updatedAt: new Date() })
    .where(eq(users.id, student.id));

  const freshToken = signAuthToken({
    sub: student.id,
    role: 'student',
    sessionVersion: nextVersion,
    actorType: 'student',
  });
  setAuthCookie(res, freshToken, req);

  await logAuditEvent({
    actorId: student.id,
    actorRole: 'student',
    actorEmail: student.email,
    action: 'student.password_changed',
    entityType: 'user',
    entityId: student.id,
    ipAddress: req.ip || null,
  });

  res.json({ message: 'Password updated successfully.', token: freshToken });
});

router.post('/auth/resend-verification', requireStudentAuth, async (req: AuthRequest, res) => {
  const [student] = await db.select().from(users).where(eq(users.id, req.actor!.id));
  if (student.emailVerified) {
    res.json({ message: 'Your email is already verified.' });
    return;
  }

  const { raw, hash } = generateOpaqueToken();
  await db.insert(emailVerificationTokens).values({
    userId: student.id,
    tokenHash: hash,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  const appBase = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`;
  const verifyUrl = `${appBase}/verify-email?token=${raw}`;
  const result = await sendTransactionalEmail({
    to: student.email,
    subject: 'Verify your Acadet JAMB CBT email address',
    html: `<p>Hello ${student.fullName},</p><p><a href="${verifyUrl}">Verify my email address</a></p>`,
    text: `Verify your Acadet JAMB CBT email: ${verifyUrl}`,
  });

  res.json({
    message: result.sent
      ? 'Verification email dispatched. Check your inbox.'
      : 'Verification token generated. Configure RESEND_API_KEY to send live emails, or use the verification link in server logs.',
    devVerifyToken: process.env.NODE_ENV !== 'production' && !result.sent ? raw : undefined,
  });
});

router.post('/auth/verify-email', async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  if (!token) {
    res.status(400).json({ error: 'Verification token is required.' });
    return;
  }

  const hash = hashOpaqueToken(token);
  const rows = await db
    .select()
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.tokenHash, hash),
        isNull(emailVerificationTokens.usedAt),
        gt(emailVerificationTokens.expiresAt, new Date())
      )
    );

  const record = rows[0];
  if (!record) {
    res.status(400).json({ error: 'Invalid or expired verification token.' });
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(emailVerificationTokens.id, record.id));
    await tx
      .update(users)
      .set({ emailVerified: true, emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, record.userId));
  });

  res.json({ message: 'Email verified successfully!' });
});

router.post('/auth/forgot-password', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email) {
    res.status(400).json({ error: 'Email address is required.' });
    return;
  }

  const rows = await db.select().from(users).where(eq(users.email, email));
  if (rows.length > 0) {
    const student = rows[0];
    const { raw, hash } = generateOpaqueToken();
    await db.insert(passwordResetTokens).values({
      userId: student.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 20 * 60 * 1000),
      requestIp: req.ip || null,
    });

    const appBase = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`;
    const resetUrl = `${appBase}/reset-password?token=${raw}`;
    await sendTransactionalEmail({
      to: student.email,
      subject: 'Acadet JAMB CBT Password Reset (Expires in 20 minutes)',
      html: `<p>Hello ${student.fullName},</p><p><a href="${resetUrl}">Reset your password</a> (valid for 20 minutes).</p>`,
      text: `Reset your Acadet JAMB CBT password: ${resetUrl}`,
    });
  }

  // Always return generic message to avoid user enumeration
  res.json({
    message: 'If an account matches that email, a password recovery link has been sent.',
  });
});

router.post('/auth/reset-password', async (req, res) => {
  const schema = z.object({
    token: z.string().min(10),
    newPassword: z.string().min(8).max(128),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid reset token and password (min 8 chars) are required.' });
    return;
  }

  const hash = hashOpaqueToken(parsed.data.token);
  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, hash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date())
      )
    );

  const record = rows[0];
  if (!record) {
    res.status(400).json({ error: 'Reset link is invalid or has expired.' });
    return;
  }

  const [student] = await db.select().from(users).where(eq(users.id, record.userId));
  if (!student) {
    res.status(404).json({ error: 'Account not found.' });
    return;
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.transaction(async (tx) => {
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, record.id));
    await tx
      .update(users)
      .set({
        passwordHash: newHash,
        sessionVersion: student.sessionVersion + 1,
        updatedAt: new Date(),
      })
      .where(eq(users.id, student.id));
  });

  res.json({ message: 'Password reset successfully. You can now sign in.' });
});

export default router;
