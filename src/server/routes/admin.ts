import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  adminUsers,
  announcements,
  auditLogs,
  examinationResults,
  examinations,
  examinationSessions,
  examinationSubjects,
  mockExaminations,
  notifications,
  platformSettings,
  questionOptions,
  questions,
  studyMaterials,
  subjectCombinations,
  subjects,
  topics,
  users,
} from '../../db/schema.ts';
import { AuthRequest, requireAdminAuth, requireSuperAdminAuth } from '../middleware/auth.ts';
import { logAuditEvent } from '../utils/audit.ts';
import { deleteLocalUpload, saveLocalUpload } from '../utils/storage.ts';

const router = Router();
router.use('/admin', requireAdminAuth);

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// 1. Overview
router.get('/admin/overview', async (_req, res) => {
  try {
    const [{ count: totalStudents }] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const [{ count: activeStudents }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.accountStatus, 'active'));
    const [{ count: totalQuestions }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questions)
      .where(eq(questions.isActive, true));
    const [{ count: totalAttempts }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(examinationSessions);
    const [{ count: totalCompleted }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(examinationResults);
    const [{ count: activeSubjects }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(subjects)
      .where(eq(subjects.isActive, true));

    const recentResults = await db
      .select()
      .from(examinationResults)
      .orderBy(desc(examinationResults.createdAt))
      .limit(8);

    const avgScore =
      recentResults.length > 0
        ? Number((recentResults.reduce((acc, r) => acc + Number(r.percentage), 0) / recentResults.length).toFixed(1))
        : 0;

    res.json({
      metrics: {
        totalStudents,
        activeStudents,
        totalQuestions,
        totalAttempts,
        totalCompleted,
        activeSubjects,
        recentAveragePercentage: avgScore,
      },
      recentResults,
    });
  } catch (err) {
    console.error('[admin/overview] Error:', err);
    res.status(500).json({ error: 'Failed to load admin overview.' });
  }
});

// 2. Student Management
router.get('/admin/students', async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const allStudents = await db.select().from(users).orderBy(desc(users.createdAt));

    const filtered = search
      ? allStudents.filter(
          (s) =>
            s.fullName.toLowerCase().includes(search) ||
            s.email.toLowerCase().includes(search) ||
            s.username.toLowerCase().includes(search) ||
            s.registrationNumber.toLowerCase().includes(search)
        )
      : allStudents;

    const results = await db.select().from(examinationResults);
    const attemptCountMap = new Map<string, number>();
    for (const r of results) {
      attemptCountMap.set(r.userId, (attemptCountMap.get(r.userId) || 0) + 1);
    }

    res.json({
      students: filtered.map((s) => ({
        id: s.id,
        fullName: s.fullName,
        email: s.email,
        username: s.username,
        registrationNumber: s.registrationNumber,
        phoneNumber: s.phoneNumber,
        jambYear: s.jambYear,
        intendedCourse: s.intendedCourse,
        preferredInstitution: s.preferredInstitution,
        emailVerified: s.emailVerified,
        accountStatus: s.accountStatus,
        suspendedReason: s.suspendedReason,
        attemptsCount: attemptCountMap.get(s.id) || 0,
        createdAt: s.createdAt,
      })),
    });
  } catch (err) {
    console.error('[admin/students] Error:', err);
    res.status(500).json({ error: 'Failed to load students.' });
  }
});

router.get('/admin/students/:id', async (req, res) => {
  try {
    const [student] = await db.select().from(users).where(eq(users.id, String(req.params.id)));
    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    const history = await db
      .select()
      .from(examinationResults)
      .where(eq(examinationResults.userId, student.id))
      .orderBy(desc(examinationResults.createdAt));

    res.json({
      student: {
        id: student.id,
        fullName: student.fullName,
        email: student.email,
        username: student.username,
        registrationNumber: student.registrationNumber,
        phoneNumber: student.phoneNumber,
        jambYear: student.jambYear,
        intendedCourse: student.intendedCourse,
        preferredInstitution: student.preferredInstitution,
        emailVerified: student.emailVerified,
        accountStatus: student.accountStatus,
        suspendedReason: student.suspendedReason,
        createdAt: student.createdAt,
      },
      history,
    });
  } catch (err) {
    console.error('[admin/students/:id] Error:', err);
    res.status(500).json({ error: 'Failed to load student profile.' });
  }
});

router.post('/admin/students/:id/suspend', async (req: AuthRequest, res) => {
  const reason = typeof req.body?.reason === 'string' && req.body.reason.trim() ? req.body.reason.trim() : 'Policy violation';
  const id = String(req.params.id);
  const [updated] = await db
    .update(users)
    .set({
      accountStatus: 'suspended',
      suspendedReason: reason,
      suspendedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: 'Student not found.' });
    return;
  }

  await logAuditEvent({
    actorId: req.actor!.id,
    actorRole: req.actor!.role,
    actorEmail: req.actor!.email,
    action: 'admin.student_suspended',
    entityType: 'user',
    entityId: id,
    details: { reason },
    ipAddress: req.ip || null,
  });

  res.json({ message: 'Student account suspended.', accountStatus: updated.accountStatus });
});

router.post('/admin/students/:id/reactivate', async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  const [updated] = await db
    .update(users)
    .set({
      accountStatus: 'active',
      suspendedReason: null,
      suspendedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: 'Student not found.' });
    return;
  }

  await logAuditEvent({
    actorId: req.actor!.id,
    actorRole: req.actor!.role,
    actorEmail: req.actor!.email,
    action: 'admin.student_reactivated',
    entityType: 'user',
    entityId: id,
    ipAddress: req.ip || null,
  });

  res.json({ message: 'Student account reactivated.', accountStatus: updated.accountStatus });
});

// 3. Subjects, Topics & Combinations Management
router.get('/admin/subjects', async (_req, res) => {
  const allSubs = await db.select().from(subjects).orderBy(desc(subjects.isCompulsory), subjects.name);
  const allTopics = await db.select().from(topics).orderBy(topics.name);
  const combos = await db.select().from(subjectCombinations).orderBy(subjectCombinations.name);
  const qCounts = await db
    .select({ subjectId: questions.subjectId, count: sql<number>`count(*)::int` })
    .from(questions)
    .groupBy(questions.subjectId);
  const qCountMap = new Map(qCounts.map((q) => [q.subjectId, q.count]));

  res.json({
    subjects: allSubs.map((s) => ({
      ...s,
      questionCount: qCountMap.get(s.id) || 0,
      topics: allTopics.filter((t) => t.subjectId === s.id),
    })),
    combinations: combos,
  });
});

const subjectSchema = z.object({
  code: z.string().trim().min(2).max(10).toUpperCase(),
  name: z.string().trim().min(2).max(100),
  category: z.enum(['Compulsory', 'Science', 'Commercial', 'Arts']).default('Science'),
  description: z.string().trim().max(400).default(''),
  isCompulsory: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

router.post('/admin/subjects', async (req: AuthRequest, res) => {
  const parsed = subjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid subject data.' });
    return;
  }
  try {
    const [created] = await db.insert(subjects).values(parsed.data).returning();
    await logAuditEvent({
      actorId: req.actor!.id,
      actorRole: req.actor!.role,
      actorEmail: req.actor!.email,
      action: 'admin.subject_created',
      entityType: 'subject',
      entityId: created.id,
      details: { code: created.code, name: created.name },
      ipAddress: req.ip || null,
    });
    res.status(201).json({ subject: created });
  } catch {
    res.status(409).json({ error: 'A subject with that code already exists.' });
  }
});

router.patch('/admin/subjects/:id', async (req: AuthRequest, res) => {
  const parsed = subjectSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid subject update.' });
    return;
  }
  const [updated] = await db
    .update(subjects)
    .set(parsed.data)
    .where(eq(subjects.id, String(req.params.id)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: 'Subject not found.' });
    return;
  }
  res.json({ subject: updated });
});

router.post('/admin/topics', async (req, res) => {
  const schema = z.object({
    subjectId: z.string().uuid(),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(300).default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid topic.' });
    return;
  }
  try {
    const [created] = await db.insert(topics).values(parsed.data).returning();
    res.status(201).json({ topic: created });
  } catch {
    res.status(409).json({ error: 'Topic already exists for this subject.' });
  }
});

router.post('/admin/combinations', async (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(2).max(120),
    faculty: z.string().trim().min(2).max(120),
    subjectCodes: z.array(z.string().toUpperCase()).length(4),
    description: z.string().trim().max(400).default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Select exactly 4 subjects for a JAMB combination.' });
    return;
  }
  if (!parsed.data.subjectCodes.includes('ENG')) {
    res.status(400).json({ error: 'Every JAMB UTME combination must include ENG (Use of English).' });
    return;
  }
  const [created] = await db.insert(subjectCombinations).values(parsed.data).returning();
  res.status(201).json({ combination: created });
});

router.delete('/admin/combinations/:id', async (req, res) => {
  await db.delete(subjectCombinations).where(eq(subjectCombinations.id, String(req.params.id)));
  res.json({ deleted: true });
});

// 4. Question Bank & Bulk Upload
router.get('/admin/questions', async (req, res) => {
  const subjectId = typeof req.query.subjectId === 'string' ? req.query.subjectId : '';
  const difficulty = typeof req.query.difficulty === 'string' ? req.query.difficulty : '';
  const source = typeof req.query.source === 'string' ? req.query.source : '';
  const year = req.query.year ? Number(req.query.year) : null;

  const conditions = [];
  if (subjectId) conditions.push(eq(questions.subjectId, subjectId));
  if (difficulty && difficulty !== 'All') conditions.push(eq(questions.difficulty, difficulty));
  if (source && source !== 'All') conditions.push(eq(questions.questionSource, source));
  if (year && !Number.isNaN(year)) conditions.push(eq(questions.examYear, year));

  const qRows =
    conditions.length > 0
      ? await db.select().from(questions).where(and(...conditions)).orderBy(desc(questions.createdAt)).limit(200)
      : await db.select().from(questions).orderBy(desc(questions.createdAt)).limit(200);

  const qIds = qRows.map((q) => q.id);
  const opts =
    qIds.length > 0 ? await db.select().from(questionOptions).where(inArray(questionOptions.questionId, qIds)) : [];
  const subs = await db.select().from(subjects);
  const tops = await db.select().from(topics);
  const subMap = new Map(subs.map((s) => [s.id, s]));
  const topMap = new Map(tops.map((t) => [t.id, t]));
  const optMap = new Map<string, Array<{ label: string; text: string; isCorrect: boolean }>>();
  for (const o of opts) {
    const list = optMap.get(o.questionId) || [];
    list.push({ label: o.optionLabel, text: o.optionText, isCorrect: o.isCorrect });
    optMap.set(o.questionId, list);
  }
  for (const [, list] of optMap) list.sort((a, b) => a.label.localeCompare(b.label));

  res.json({
    questions: qRows.map((q) => ({
      ...q,
      subjectCode: subMap.get(q.subjectId)?.code || '',
      subjectName: subMap.get(q.subjectId)?.name || '',
      topicName: q.topicId ? topMap.get(q.topicId)?.name || '' : '',
      options: optMap.get(q.id) || [],
    })),
  });
});

const questionSchema = z.object({
  subjectId: z.string().uuid(),
  topicId: z.string().uuid().nullable().optional(),
  questionText: z.string().trim().min(5),
  questionImageUrl: z.string().trim().nullable().optional(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).default('Medium'),
  questionSource: z.enum(['sample_practice', 'verified_past_question']).default('sample_practice'),
  examYear: z.coerce.number().int().min(1978).max(2030).nullable().optional(),
  explanation: z.string().trim().default(''),
  optionA: z.string().trim().min(1),
  optionB: z.string().trim().min(1),
  optionC: z.string().trim().min(1),
  optionD: z.string().trim().min(1),
  correctOption: z.enum(['A', 'B', 'C', 'D']),
});

router.post('/admin/questions', async (req: AuthRequest, res) => {
  const parsed = questionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid question payload.' });
    return;
  }
  const d = parsed.data;
  const created = await db.transaction(async (tx) => {
    const [q] = await tx
      .insert(questions)
      .values({
        subjectId: d.subjectId,
        topicId: d.topicId || null,
        questionText: d.questionText,
        questionImageUrl: d.questionImageUrl || null,
        difficulty: d.difficulty,
        questionSource: d.questionSource,
        examYear: d.examYear || null,
        explanation: d.explanation,
        createdBy: req.actor!.id,
      })
      .returning();

    const optValues: Record<'A' | 'B' | 'C' | 'D', string> = {
      A: d.optionA,
      B: d.optionB,
      C: d.optionC,
      D: d.optionD,
    };
    for (const label of ['A', 'B', 'C', 'D'] as const) {
      await tx.insert(questionOptions).values({
        questionId: q.id,
        optionLabel: label,
        optionText: optValues[label],
        isCorrect: d.correctOption === label,
      });
    }
    return q;
  });

  res.status(201).json({ question: created });
});

router.patch('/admin/questions/:id', async (req, res) => {
  const parsed = questionSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid question update.' });
    return;
  }
  const id = String(req.params.id);
  const d = parsed.data;

  await db.transaction(async (tx) => {
    await tx
      .update(questions)
      .set({
        ...(d.subjectId !== undefined ? { subjectId: d.subjectId } : {}),
        ...(d.topicId !== undefined ? { topicId: d.topicId } : {}),
        ...(d.questionText !== undefined ? { questionText: d.questionText } : {}),
        ...(d.questionImageUrl !== undefined ? { questionImageUrl: d.questionImageUrl } : {}),
        ...(d.difficulty !== undefined ? { difficulty: d.difficulty } : {}),
        ...(d.questionSource !== undefined ? { questionSource: d.questionSource } : {}),
        ...(d.examYear !== undefined ? { examYear: d.examYear } : {}),
        ...(d.explanation !== undefined ? { explanation: d.explanation } : {}),
        updatedAt: new Date(),
      })
      .where(eq(questions.id, id));

    if (d.optionA && d.optionB && d.optionC && d.optionD && d.correctOption) {
      const optValues: Record<'A' | 'B' | 'C' | 'D', string> = {
        A: d.optionA,
        B: d.optionB,
        C: d.optionC,
        D: d.optionD,
      };
      for (const label of ['A', 'B', 'C', 'D'] as const) {
        await tx
          .update(questionOptions)
          .set({ optionText: optValues[label], isCorrect: d.correctOption === label })
          .where(and(eq(questionOptions.questionId, id), eq(questionOptions.optionLabel, label)));
      }
    }
  });

  res.json({ updated: true });
});

router.delete('/admin/questions/:id', async (req: AuthRequest, res) => {
  const id = String(req.params.id);
  await db.delete(questions).where(eq(questions.id, id));
  await logAuditEvent({
    actorId: req.actor!.id,
    actorRole: req.actor!.role,
    actorEmail: req.actor!.email,
    action: 'admin.question_deleted',
    entityType: 'question',
    entityId: id,
    ipAddress: req.ip || null,
  });
  res.json({ deleted: true });
});

// 5. Bulk Question Upload (CSV or JSON array)
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

router.post('/admin/questions/bulk', async (req: AuthRequest, res) => {
  try {
    const { format, payload, defaultSubjectId, defaultSource } = req.body as {
      format?: 'csv' | 'json';
      payload?: string | Array<Record<string, unknown>>;
      defaultSubjectId?: string;
      defaultSource?: 'sample_practice' | 'verified_past_question';
    };

    const allSubs = await db.select().from(subjects);
    const codeToId = new Map(allSubs.map((s) => [s.code.toUpperCase(), s.id]));
    const allTopics = await db.select().from(topics);

    const rows: Array<Record<string, unknown>> = [];
    if (format === 'csv' && typeof payload === 'string') {
      const lines = payload
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) {
        res.status(400).json({ error: 'CSV must include a header row and at least one question row.' });
        return;
      }
      const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const obj: Record<string, unknown> = {};
        headers.forEach((h, idx) => {
          obj[h] = cols[idx] ?? '';
        });
        rows.push(obj);
      }
    } else if (Array.isArray(payload)) {
      rows.push(...payload);
    } else if (typeof payload === 'string') {
      const parsedJson = JSON.parse(payload);
      if (!Array.isArray(parsedJson)) throw new Error('JSON must be an array');
      rows.push(...parsedJson);
    } else {
      res.status(400).json({ error: 'Invalid bulk upload payload.' });
      return;
    }

    let inserted = 0;
    const errors: string[] = [];

    await db.transaction(async (tx) => {
      for (let idx = 0; idx < rows.length; idx++) {
        const r = rows[idx];
        const subjectCode = String(r.subjectcode || r.subjectCode || r.subject || '').toUpperCase();
        const subjectId = (r.subjectId as string) || codeToId.get(subjectCode) || defaultSubjectId;
        const questionText = String(r.questiontext || r.questionText || r.question || '').trim();
        const optionA = String(r.optiona || r.optionA || r.a || '').trim();
        const optionB = String(r.optionb || r.optionB || r.b || '').trim();
        const optionC = String(r.optionc || r.optionC || r.c || '').trim();
        const optionD = String(r.optiond || r.optionD || r.d || '').trim();
        const correctOption = String(r.correctoption || r.correctOption || r.correct || '')
          .trim()
          .toUpperCase() as 'A' | 'B' | 'C' | 'D';

        if (!subjectId || !questionText || !optionA || !optionB || !optionC || !optionD || !['A', 'B', 'C', 'D'].includes(correctOption)) {
          errors.push(`Row ${idx + 1}: missing required subject, options, or valid correctOption (A-D).`);
          continue;
        }

        const difficultyRaw = String(r.difficulty || 'Medium');
        const difficulty = ['Easy', 'Medium', 'Hard'].includes(difficultyRaw) ? difficultyRaw : 'Medium';
        const sourceRaw = String(r.questionsource || r.questionSource || defaultSource || 'sample_practice');
        const questionSource = sourceRaw === 'verified_past_question' ? 'verified_past_question' : 'sample_practice';
        const examYearVal = r.examyear || r.examYear ? Number(r.examyear || r.examYear) : null;
        const explanation = String(r.explanation || '').trim();
        const topicName = String(r.topic || r.topicName || '').trim().toLowerCase();
        const matchedTopic = topicName
          ? allTopics.find((t) => t.subjectId === subjectId && t.name.toLowerCase() === topicName)
          : undefined;

        const [q] = await tx
          .insert(questions)
          .values({
            subjectId,
            topicId: matchedTopic?.id || null,
            questionText,
            difficulty,
            questionSource,
            examYear: examYearVal && !Number.isNaN(examYearVal) ? examYearVal : null,
            explanation,
            createdBy: req.actor!.id,
          })
          .returning();

        const map = { A: optionA, B: optionB, C: optionC, D: optionD };
        for (const label of ['A', 'B', 'C', 'D'] as const) {
          await tx.insert(questionOptions).values({
            questionId: q.id,
            optionLabel: label,
            optionText: map[label],
            isCorrect: correctOption === label,
          });
        }
        inserted++;
      }
    });

    await logAuditEvent({
      actorId: req.actor!.id,
      actorRole: req.actor!.role,
      actorEmail: req.actor!.email,
      action: 'admin.questions_bulk_uploaded',
      entityType: 'question',
      details: { inserted, errorCount: errors.length },
      ipAddress: req.ip || null,
    });

    res.status(201).json({ inserted, errors });
  } catch (err) {
    console.error('[admin/questions/bulk] Error:', err);
    res.status(400).json({ error: 'Failed to parse bulk question upload.' });
  }
});

router.post('/admin/questions/upload-image', uploadMiddleware.single('image'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Image file is required.' });
    return;
  }
  const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  if (!allowed.includes(req.file.mimetype)) {
    res.status(400).json({ error: 'Only PNG, JPG, WEBP, or GIF images are allowed.' });
    return;
  }
  const saved = saveLocalUpload('question-images', req.file.originalname, req.file.buffer);
  res.status(201).json({ url: `/uploads/${saved.storageKey}` });
});

// 6. Practice Examinations CRUD
router.get('/admin/examinations', async (_req, res) => {
  const list = await db.select().from(examinations).orderBy(desc(examinations.createdAt));
  const examSubs = await db.select().from(examinationSubjects);
  const allSubs = await db.select().from(subjects);
  const subMap = new Map(allSubs.map((s) => [s.id, s]));

  res.json({
    examinations: list.map((ex) => ({
      ...ex,
      subjects: examSubs
        .filter((es) => es.examinationId === ex.id)
        .map((es) => subMap.get(es.subjectId))
        .filter(Boolean),
    })),
  });
});

router.post('/admin/examinations', async (req: AuthRequest, res) => {
  const schema = z.object({
    title: z.string().trim().min(3).max(140),
    examType: z.enum(['practice', 'utme_4_subject', 'topic_practice', 'revision']),
    description: z.string().trim().max(400).default(''),
    instructions: z.string().trim().max(600).default('Read each question carefully and select the best option.'),
    durationMinutes: z.coerce.number().int().min(5).max(180),
    questionCount: z.coerce.number().int().min(5).max(180),
    difficultyFilter: z.enum(['All', 'Easy', 'Medium', 'Hard']).default('All'),
    allowReview: z.boolean().default(true),
    subjectIds: z.array(z.string().uuid()).min(1).max(4),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid practice exam.' });
    return;
  }

  const d = parsed.data;
  const created = await db.transaction(async (tx) => {
    const [ex] = await tx
      .insert(examinations)
      .values({
        title: d.title,
        examType: d.examType,
        description: d.description,
        instructions: d.instructions,
        durationMinutes: d.durationMinutes,
        questionCount: d.questionCount,
        difficultyFilter: d.difficultyFilter,
        allowReview: d.allowReview,
        createdBy: req.actor!.id,
      })
      .returning();

    const perSub = Math.max(1, Math.floor(d.questionCount / d.subjectIds.length));
    for (const sId of d.subjectIds) {
      await tx.insert(examinationSubjects).values({
        examinationId: ex.id,
        subjectId: sId,
        questionCount: perSub,
      });
    }
    return ex;
  });

  res.status(201).json({ examination: created });
});

router.patch('/admin/examinations/:id', async (req, res) => {
  const isActive = typeof req.body?.isActive === 'boolean' ? req.body.isActive : undefined;
  const allowReview = typeof req.body?.allowReview === 'boolean' ? req.body.allowReview : undefined;
  const [updated] = await db
    .update(examinations)
    .set({
      ...(isActive !== undefined ? { isActive } : {}),
      ...(allowReview !== undefined ? { allowReview } : {}),
    })
    .where(eq(examinations.id, String(req.params.id)))
    .returning();
  res.json({ examination: updated });
});

router.delete('/admin/examinations/:id', async (req, res) => {
  await db.delete(examinations).where(eq(examinations.id, String(req.params.id)));
  res.json({ deleted: true });
});

// 7. Mock Examinations CRUD
router.get('/admin/mocks', async (_req, res) => {
  const mocks = await db.select().from(mockExaminations).orderBy(desc(mockExaminations.startAt));
  const subs = await db.select().from(subjects);
  const subMap = new Map(subs.map((s) => [s.id, s]));

  res.json({
    mocks: mocks.map((m) => ({
      ...m,
      subjects: m.subjectIds.map((id) => subMap.get(id)).filter(Boolean),
    })),
  });
});

router.post('/admin/mocks', async (req: AuthRequest, res) => {
  const schema = z.object({
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().max(500).default(''),
    instructions: z.string().trim().max(800).default('Timed JAMB UTME Mock Simulation.'),
    subjectIds: z.array(z.string().uuid()).min(1).max(4),
    startAt: z.string().min(10),
    endAt: z.string().min(10),
    durationMinutes: z.coerce.number().int().min(10).max(180),
    questionCount: z.coerce.number().int().min(5).max(180),
    eligibilityYear: z.coerce.number().int().nullable().optional(),
    allowReview: z.boolean().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid mock examination.' });
    return;
  }

  const d = parsed.data;
  const [created] = await db
    .insert(mockExaminations)
    .values({
      title: d.title,
      description: d.description,
      instructions: d.instructions,
      subjectIds: d.subjectIds,
      startAt: new Date(d.startAt),
      endAt: new Date(d.endAt),
      durationMinutes: d.durationMinutes,
      questionCount: d.questionCount,
      eligibilityYear: d.eligibilityYear || null,
      allowReview: d.allowReview,
      createdBy: req.actor!.id,
    })
    .returning();

  res.status(201).json({ mock: created });
});

router.patch('/admin/mocks/:id', async (req, res) => {
  const isActive = typeof req.body?.isActive === 'boolean' ? req.body.isActive : undefined;
  const [updated] = await db
    .update(mockExaminations)
    .set({ ...(isActive !== undefined ? { isActive } : {}) })
    .where(eq(mockExaminations.id, String(req.params.id)))
    .returning();
  res.json({ mock: updated });
});

router.delete('/admin/mocks/:id', async (req, res) => {
  await db.delete(mockExaminations).where(eq(mockExaminations.id, String(req.params.id)));
  res.json({ deleted: true });
});

// 8. Examination Attempts & Results + CSV Export
router.get('/admin/attempts', async (_req, res) => {
  const sessions = await db
    .select()
    .from(examinationSessions)
    .orderBy(desc(examinationSessions.startedAt))
    .limit(150);
  const allUsers = await db.select().from(users);
  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const results = await db.select().from(examinationResults);
  const resMap = new Map(results.map((r) => [r.sessionId, r]));

  res.json({
    attempts: sessions.map((s) => {
      const student = userMap.get(s.userId);
      const r = resMap.get(s.id);
      return {
        ...s,
        studentName: student?.fullName || 'Student',
        studentEmail: student?.email || '',
        registrationNumber: student?.registrationNumber || '',
        scoreOutOf400: r?.scoreOutOf400 ?? null,
        percentage: r?.percentage ?? null,
        correctCount: r?.correctCount ?? null,
      };
    }),
  });
});

router.get('/admin/results', async (_req, res) => {
  const results = await db
    .select()
    .from(examinationResults)
    .orderBy(desc(examinationResults.createdAt))
    .limit(200);
  const allUsers = await db.select().from(users);
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  res.json({
    results: results.map((r) => ({
      ...r,
      studentName: userMap.get(r.userId)?.fullName || 'Student',
      registrationNumber: userMap.get(r.userId)?.registrationNumber || '',
      studentEmail: userMap.get(r.userId)?.email || '',
    })),
  });
});

router.get('/admin/results/export', async (_req, res) => {
  const results = await db.select().from(examinationResults).orderBy(desc(examinationResults.createdAt));
  const allUsers = await db.select().from(users);
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    ['Registration Number', 'Student Name', 'Email', 'Exam Title', 'Total Qs', 'Correct', 'Wrong', 'Unanswered', 'UTME Score (/400)', 'Percentage (%)', 'Date'].join(','),
  ];
  for (const r of results) {
    const u = userMap.get(r.userId);
    lines.push(
      [
        esc(u?.registrationNumber || ''),
        esc(u?.fullName || ''),
        esc(u?.email || ''),
        esc(r.examTitle),
        r.totalQuestions,
        r.correctCount,
        r.wrongCount,
        r.unansweredCount,
        r.scoreOutOf400,
        r.percentage,
        esc(new Date(r.createdAt).toISOString()),
      ].join(',')
    );
  }
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="acadet-jamb-results.csv"');
  res.send(lines.join('\n'));
});

// 9. Study Materials Upload & Management
router.get('/admin/materials', async (_req, res) => {
  const rows = await db.select().from(studyMaterials).orderBy(desc(studyMaterials.createdAt));
  const subs = await db.select().from(subjects);
  const subMap = new Map(subs.map((s) => [s.id, s]));
  res.json({
    materials: rows.map((m) => ({
      ...m,
      subjectName: subMap.get(m.subjectId)?.name || '',
      subjectCode: subMap.get(m.subjectId)?.code || '',
    })),
  });
});

router.post('/admin/materials', uploadMiddleware.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Study material file (PDF/DOCX/TXT) is required.' });
    return;
  }
  const { subjectId, title, description, category, examYear } = req.body;
  if (!subjectId || !title) {
    res.status(400).json({ error: 'Subject and material title are required.' });
    return;
  }

  const allowedTypes = [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (!allowedTypes.includes(req.file.mimetype)) {
    res.status(400).json({ error: 'Only PDF, TXT, DOC, or DOCX files are permitted.' });
    return;
  }

  const saved = saveLocalUpload('materials', req.file.originalname, req.file.buffer);
  const [created] = await db
    .insert(studyMaterials)
    .values({
      subjectId: String(subjectId),
      title: String(title).trim(),
      description: String(description || '').trim(),
      category: String(category || 'Study Notes'),
      examYear: examYear ? Number(examYear) : null,
      fileName: saved.fileName,
      fileType: req.file.mimetype,
      fileSizeBytes: req.file.size,
      storageKey: saved.storageKey,
      storageProvider: saved.storageProvider,
      uploadedBy: req.actor!.id,
    })
    .returning();

  res.status(201).json({ material: created });
});

router.delete('/admin/materials/:id', async (req, res) => {
  const id = String(req.params.id);
  const [mat] = await db.select().from(studyMaterials).where(eq(studyMaterials.id, id));
  if (mat) {
    deleteLocalUpload(mat.storageKey);
    await db.delete(studyMaterials).where(eq(studyMaterials.id, id));
  }
  res.json({ deleted: true });
});

// 10. Announcements & Notifications
router.get('/admin/announcements', async (_req, res) => {
  const rows = await db.select().from(announcements).orderBy(desc(announcements.isPinned), desc(announcements.createdAt));
  res.json({ announcements: rows });
});

router.post('/admin/announcements', async (req: AuthRequest, res) => {
  const schema = z.object({
    title: z.string().trim().min(3).max(160),
    body: z.string().trim().min(5).max(2000),
    isPinned: z.boolean().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid announcement.' });
    return;
  }
  const [created] = await db
    .insert(announcements)
    .values({ ...parsed.data, createdBy: req.actor!.id })
    .returning();
  res.status(201).json({ announcement: created });
});

router.patch('/admin/announcements/:id', async (req, res) => {
  const isPinned = typeof req.body?.isPinned === 'boolean' ? req.body.isPinned : undefined;
  const isActive = typeof req.body?.isActive === 'boolean' ? req.body.isActive : undefined;
  const [updated] = await db
    .update(announcements)
    .set({
      ...(isPinned !== undefined ? { isPinned } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    })
    .where(eq(announcements.id, String(req.params.id)))
    .returning();
  res.json({ announcement: updated });
});

router.delete('/admin/announcements/:id', async (req, res) => {
  await db.delete(announcements).where(eq(announcements.id, String(req.params.id)));
  res.json({ deleted: true });
});

router.get('/admin/notifications', async (_req, res) => {
  const rows = await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(100);
  res.json({ notifications: rows });
});

router.post('/admin/notifications', async (req: AuthRequest, res) => {
  const schema = z.object({
    targetUserId: z.string().uuid().nullable().optional(),
    title: z.string().trim().min(3).max(160),
    message: z.string().trim().min(5).max(2000),
    type: z.enum(['system', 'announcement', 'mock_exam', 'admin_direct']).default('admin_direct'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid notification.' });
    return;
  }
  const [created] = await db
    .insert(notifications)
    .values({
      targetUserId: parsed.data.targetUserId || null,
      title: parsed.data.title,
      message: parsed.data.message,
      type: parsed.data.type,
    })
    .returning();

  await logAuditEvent({
    actorId: req.actor!.id,
    actorRole: req.actor!.role,
    actorEmail: req.actor!.email,
    action: 'admin.notification_dispatched',
    entityType: 'notification',
    entityId: created.id,
    details: { targetUserId: created.targetUserId || 'broadcast' },
    ipAddress: req.ip || null,
  });
  res.status(201).json({ notification: created });
});

// 11. Reports & Analytics
router.get('/admin/reports', async (_req, res) => {
  const results = await db.select().from(examinationResults);
  const subjectStats = new Map<
    string,
    { subjectCode: string; subjectName: string; attempts: number; totalQuestions: number; correctCount: number }
  >();
  for (const r of results) {
    for (const b of r.subjectBreakdown || []) {
      const curr = subjectStats.get(b.subjectCode) || {
        subjectCode: b.subjectCode,
        subjectName: b.subjectName,
        attempts: 0,
        totalQuestions: 0,
        correctCount: 0,
      };
      curr.attempts += 1;
      curr.totalQuestions += b.totalQuestions;
      curr.correctCount += b.correctCount;
      subjectStats.set(b.subjectCode, curr);
    }
  }
  const subjectPerformance = Array.from(subjectStats.values()).map((s) => ({
    ...s,
    averageAccuracy: s.totalQuestions > 0 ? Number(((s.correctCount / s.totalQuestions) * 100).toFixed(1)) : 0,
  }));

  res.json({
    totalCompletedResults: results.length,
    averageScoreOutOf400:
      results.length > 0
        ? Math.round(results.reduce((acc, r) => acc + r.scoreOutOf400, 0) / results.length)
        : 0,
    subjectPerformance,
  });
});

// 12. Admin Accounts (Super Admin only)
router.get('/admin/accounts', requireSuperAdminAuth, async (_req, res) => {
  const admins = await db.select().from(adminUsers).orderBy(desc(adminUsers.createdAt));
  res.json({
    admins: admins.map((a) => ({
      id: a.id,
      fullName: a.fullName,
      email: a.email,
      username: a.username,
      role: a.role,
      isActive: a.isActive,
      lastLoginAt: a.lastLoginAt,
      createdAt: a.createdAt,
    })),
  });
});

router.post('/admin/accounts', requireSuperAdminAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().toLowerCase(),
    username: z.string().trim().min(3).max(40).toLowerCase(),
    password: z.string().min(8).max(128),
    role: z.enum(['admin', 'super_admin']).default('admin'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid admin payload.' });
    return;
  }

  try {
    const hash = await bcrypt.hash(parsed.data.password, 12);
    const [created] = await db
      .insert(adminUsers)
      .values({
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        username: parsed.data.username,
        passwordHash: hash,
        role: parsed.data.role,
        isActive: true,
      })
      .returning();

    await logAuditEvent({
      actorId: req.actor!.id,
      actorRole: req.actor!.role,
      actorEmail: req.actor!.email,
      action: 'super_admin.created_admin',
      entityType: 'admin_user',
      entityId: created.id,
      details: { email: created.email, role: created.role },
      ipAddress: req.ip || null,
    });

    res.status(201).json({
      admin: {
        id: created.id,
        fullName: created.fullName,
        email: created.email,
        username: created.username,
        role: created.role,
        isActive: created.isActive,
      },
    });
  } catch {
    res.status(409).json({ error: 'An administrator with that email or username already exists.' });
  }
});

router.patch('/admin/accounts/:id', requireSuperAdminAuth, async (req: AuthRequest, res) => {
  const isActive = typeof req.body?.isActive === 'boolean' ? req.body.isActive : undefined;
  const id = String(req.params.id);
  if (id === req.actor!.id && isActive === false) {
    res.status(400).json({ error: 'You cannot deactivate your own active session.' });
    return;
  }
  const [updated] = await db
    .update(adminUsers)
    .set({ ...(isActive !== undefined ? { isActive } : {}), updatedAt: new Date() })
    .where(eq(adminUsers.id, id))
    .returning();
  res.json({ admin: updated });
});

// 13. Audit Logs & Platform Settings
router.get('/admin/audit-logs', async (_req, res) => {
  const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(150);
  res.json({ logs });
});

router.get('/admin/settings', async (_req, res) => {
  const [settings] = await db.select().from(platformSettings).where(eq(platformSettings.id, 'default'));
  res.json({ settings });
});

router.patch('/admin/settings', async (req: AuthRequest, res) => {
  const schema = z.object({
    siteName: z.string().trim().min(2).max(100).optional(),
    tagline: z.string().trim().min(3).max(200).optional(),
    supportEmail: z.string().trim().email().optional(),
    supportPhone: z.string().trim().min(5).max(30).optional(),
    jambDefaultYear: z.coerce.number().int().min(2024).max(2030).optional(),
    defaultExamDurationMinutes: z.coerce.number().int().min(15).max(180).optional(),
    allowStudentRegistration: z.boolean().optional(),
    defaultAllowReview: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid settings update.' });
    return;
  }
  const [updated] = await db
    .update(platformSettings)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(platformSettings.id, 'default'))
    .returning();

  await logAuditEvent({
    actorId: req.actor!.id,
    actorRole: req.actor!.role,
    actorEmail: req.actor!.email,
    action: 'admin.settings_updated',
    entityType: 'platform_settings',
    entityId: 'default',
    details: parsed.data,
    ipAddress: req.ip || null,
  });
  res.json({ settings: updated });
});

export default router;
