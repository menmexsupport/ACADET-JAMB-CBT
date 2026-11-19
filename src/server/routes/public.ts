import { Router } from 'express';
import { eq, sql, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db, getDatabaseMode } from '../../db/index.ts';
import {
  examinationResults,
  platformSettings,
  questions,
  studyMaterials,
  subjectCombinations,
  subjects,
  users,
} from '../../db/schema.ts';
import { logAuditEvent } from '../utils/audit.ts';

const router = Router();

router.get('/health', async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({
      status: 'ok',
      database: getDatabaseMode(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[health] DB check failed:', err);
    res.status(503).json({ status: 'error', error: 'Database unavailable' });
  }
});

router.get('/public/overview', async (_req, res) => {
  try {
    const [settingsRow] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.id, 'default'));

    const activeSubjects = await db
      .select()
      .from(subjects)
      .where(eq(subjects.isActive, true))
      .orderBy(desc(subjects.isCompulsory), subjects.name);

    const combos = await db
      .select()
      .from(subjectCombinations)
      .where(eq(subjectCombinations.isActive, true));

    const [{ count: studentCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);
    const [{ count: questionCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questions)
      .where(eq(questions.isActive, true));
    const [{ count: attemptCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(examinationResults);
    const [{ count: materialCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(studyMaterials)
      .where(eq(studyMaterials.isActive, true));

    res.json({
      settings: settingsRow || {
        siteName: 'Acadet JAMB CBT',
        tagline: 'Prepare, Practice and Pass JAMB UTME with Confidence',
        supportEmail: 'support@acadetjamb.com',
        supportPhone: '+234 800 222 3380',
        jambDefaultYear: 2026,
        defaultExamDurationMinutes: 120,
        allowStudentRegistration: true,
        defaultAllowReview: true,
      },
      subjects: activeSubjects,
      combinations: combos,
      stats: {
        subjectsCount: activeSubjects.length,
        questionsCount: questionCount,
        studentsCount: studentCount,
        completedExamsCount: attemptCount,
        materialsCount: materialCount,
      },
    });
  } catch (err) {
    console.error('[public/overview] Error:', err);
    res.status(500).json({ error: 'Failed to load public overview.' });
  }
});

const contactSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(180),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(2000),
});

router.post('/public/contact', async (req, res) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid contact inquiry.' });
    return;
  }

  await logAuditEvent({
    actorRole: 'visitor',
    actorEmail: parsed.data.email,
    action: 'public.contact_inquiry',
    entityType: 'contact',
    details: {
      fullName: parsed.data.fullName,
      subject: parsed.data.subject,
      messagePreview: parsed.data.message.slice(0, 200),
    },
    ipAddress: req.ip || null,
  });

  res.status(201).json({
    message: 'Your inquiry has been received by the Acadet JAMB CBT support team.',
  });
});

export default router;
