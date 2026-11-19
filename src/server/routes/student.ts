import { Router } from 'express';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  announcements,
  examinationResults,
  examinations,
  examinationSessions,
  examinationSubjects,
  mockExaminations,
  mockRegistrations,
  notificationReads,
  notifications,
  questionOptions,
  questions,
  studentAnswers,
  studyMaterials,
  subjectCombinations,
  subjects,
  topics,
} from '../../db/schema.ts';
import { AuthRequest, requireStudentAuth } from '../middleware/auth.ts';
import { resolveSafeLocalPath } from '../utils/storage.ts';

const router = Router();
router.use('/student', requireStudentAuth);

router.get('/student/dashboard', async (req: AuthRequest, res) => {
  try {
    const userId = req.actor!.id;

    const results = await db
      .select()
      .from(examinationResults)
      .where(eq(examinationResults.userId, userId))
      .orderBy(desc(examinationResults.createdAt));

    const totalAttempted = results.length;
    const avgPct =
      totalAttempted > 0
        ? Number((results.reduce((acc, r) => acc + Number(r.percentage), 0) / totalAttempted).toFixed(1))
        : 0;
    const highestPct =
      totalAttempted > 0 ? Math.max(...results.map((r) => Number(r.percentage))) : 0;
    const highest400 =
      totalAttempted > 0 ? Math.max(...results.map((r) => r.scoreOutOf400)) : 0;

    const activeSessions = await db
      .select()
      .from(examinationSessions)
      .where(and(eq(examinationSessions.userId, userId), eq(examinationSessions.status, 'in_progress')))
      .orderBy(desc(examinationSessions.startedAt));

    const pinnedAnnouncements = await db
      .select()
      .from(announcements)
      .where(eq(announcements.isActive, true))
      .orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
      .limit(4);

    const practiceList = await db
      .select()
      .from(examinations)
      .where(eq(examinations.isActive, true))
      .orderBy(desc(examinations.createdAt))
      .limit(4);

    const activeMocks = await db
      .select()
      .from(mockExaminations)
      .where(eq(mockExaminations.isActive, true))
      .orderBy(mockExaminations.startAt);

    const notifRows = await db
      .select()
      .from(notifications)
      .where(or(isNull(notifications.targetUserId), eq(notifications.targetUserId, userId)));
    const readRows = await db
      .select()
      .from(notificationReads)
      .where(eq(notificationReads.userId, userId));
    const readSet = new Set(readRows.map((r) => r.notificationId));
    const unreadNotificationsCount = notifRows.filter((n) => !readSet.has(n.id)).length;

    res.json({
      stats: {
        totalAttempted,
        averagePercentage: avgPct,
        highestPercentage: highestPct,
        highestScoreOutOf400: highest400,
        overallProgress: Math.min(100, Math.round(avgPct)),
        unreadNotificationsCount,
      },
      activeSession: activeSessions[0]
        ? {
            id: activeSessions[0].id,
            examTitle: activeSessions[0].examTitle,
            totalQuestions: activeSessions[0].totalQuestions,
            remainingSeconds: Math.max(
              0,
              Math.floor((new Date(activeSessions[0].expiresAt).getTime() - Date.now()) / 1000)
            ),
          }
        : null,
      recentResults: results.slice(0, 5),
      announcements: pinnedAnnouncements,
      practiceExams: practiceList,
      upcomingMocks: activeMocks.slice(0, 3),
    });
  } catch (err) {
    console.error('[student/dashboard] Error:', err);
    res.status(500).json({ error: 'Failed to load student dashboard.' });
  }
});

router.get('/student/subjects', async (_req, res) => {
  try {
    const activeSubjects = await db
      .select()
      .from(subjects)
      .where(eq(subjects.isActive, true))
      .orderBy(desc(subjects.isCompulsory), subjects.name);

    const allTopics = await db.select().from(topics).orderBy(topics.name);
    const combos = await db
      .select()
      .from(subjectCombinations)
      .where(eq(subjectCombinations.isActive, true));

    const counts = await db
      .select({
        subjectId: questions.subjectId,
        count: sql<number>`count(*)::int`,
      })
      .from(questions)
      .where(eq(questions.isActive, true))
      .groupBy(questions.subjectId);
    const countMap = new Map(counts.map((c) => [c.subjectId, c.count]));

    const hydratedSubjects = activeSubjects.map((s) => ({
      ...s,
      questionCount: countMap.get(s.id) || 0,
      topics: allTopics.filter((t) => t.subjectId === s.id),
    }));

    res.json({ subjects: hydratedSubjects, combinations: combos });
  } catch (err) {
    console.error('[student/subjects] Error:', err);
    res.status(500).json({ error: 'Failed to load subjects.' });
  }
});

router.get('/student/practice-exams', async (_req, res) => {
  try {
    const exams = await db
      .select()
      .from(examinations)
      .where(eq(examinations.isActive, true))
      .orderBy(desc(examinations.createdAt));

    const examSubs = await db.select().from(examinationSubjects);
    const allSubjects = await db.select().from(subjects);
    const subMap = new Map(allSubjects.map((s) => [s.id, s]));

    const hydrated = exams.map((ex) => ({
      ...ex,
      subjects: examSubs
        .filter((es) => es.examinationId === ex.id)
        .map((es) => subMap.get(es.subjectId))
        .filter(Boolean),
    }));

    res.json({ examinations: hydrated });
  } catch (err) {
    console.error('[student/practice-exams] Error:', err);
    res.status(500).json({ error: 'Failed to load practice examinations.' });
  }
});

// Past & Sample Questions explorer (study browser — clearly labeled sample_practice vs verified_past_question)
router.get('/student/past-questions', async (req, res) => {
  try {
    const subjectId = typeof req.query.subjectId === 'string' ? req.query.subjectId : '';
    const difficulty = typeof req.query.difficulty === 'string' ? req.query.difficulty : '';
    const source = typeof req.query.source === 'string' ? req.query.source : '';
    const year = req.query.year ? Number(req.query.year) : null;

    const conditions = [eq(questions.isActive, true)];
    if (subjectId) conditions.push(eq(questions.subjectId, subjectId));
    if (difficulty && difficulty !== 'All') conditions.push(eq(questions.difficulty, difficulty));
    if (source && source !== 'All') conditions.push(eq(questions.questionSource, source));
    if (year && !Number.isNaN(year)) conditions.push(eq(questions.examYear, year));

    const qRows = await db
      .select()
      .from(questions)
      .where(and(...conditions))
      .orderBy(desc(questions.createdAt))
      .limit(80);

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
        id: q.id,
        subjectId: q.subjectId,
        subjectCode: subMap.get(q.subjectId)?.code || '',
        subjectName: subMap.get(q.subjectId)?.name || '',
        topicName: q.topicId ? topMap.get(q.topicId)?.name || 'General' : 'General',
        questionText: q.questionText,
        questionImageUrl: q.questionImageUrl,
        difficulty: q.difficulty,
        questionSource: q.questionSource,
        examYear: q.examYear,
        explanation: q.explanation,
        options: optMap.get(q.id) || [],
      })),
    });
  } catch (err) {
    console.error('[student/past-questions] Error:', err);
    res.status(500).json({ error: 'Failed to load question bank.' });
  }
});

// Mock Examinations list & registration
router.get('/student/mocks', async (req: AuthRequest, res) => {
  try {
    const mocks = await db
      .select()
      .from(mockExaminations)
      .where(eq(mockExaminations.isActive, true))
      .orderBy(mockExaminations.startAt);

    const regs = await db
      .select()
      .from(mockRegistrations)
      .where(eq(mockRegistrations.userId, req.actor!.id));
    const regMap = new Map(regs.map((r) => [r.mockExaminationId, r]));

    const sessions = await db
      .select()
      .from(examinationSessions)
      .where(eq(examinationSessions.userId, req.actor!.id));

    const allSubjects = await db.select().from(subjects);
    const subMap = new Map(allSubjects.map((s) => [s.id, s]));

    const now = new Date();
    const hydrated = mocks.map((m) => {
      const start = new Date(m.startAt);
      const end = new Date(m.endAt);
      const reg = regMap.get(m.id);
      const mockSession = sessions.find((s) => s.mockExaminationId === m.id);

      let windowStatus: 'upcoming' | 'active' | 'ended' = 'upcoming';
      if (now >= start && now <= end) windowStatus = 'active';
      else if (now > end) windowStatus = 'ended';

      return {
        ...m,
        windowStatus,
        isRegistered: Boolean(reg),
        registrationStatus: reg?.status || null,
        sessionId: mockSession?.id || null,
        sessionStatus: mockSession?.status || null,
        subjects: m.subjectIds.map((id) => subMap.get(id)).filter(Boolean),
      };
    });

    res.json({ mocks: hydrated });
  } catch (err) {
    console.error('[student/mocks] Error:', err);
    res.status(500).json({ error: 'Failed to load mock examinations.' });
  }
});

router.post('/student/mocks/:mockId/register', async (req: AuthRequest, res) => {
  try {
    const mockId = String(req.params.mockId);
    const [mock] = await db.select().from(mockExaminations).where(eq(mockExaminations.id, mockId));
    if (!mock || !mock.isActive) {
      res.status(404).json({ error: 'Mock examination not found.' });
      return;
    }
    if (new Date() > new Date(mock.endAt)) {
      res.status(400).json({ error: 'Registration window for this mock examination has closed.' });
      return;
    }
    if (mock.eligibilityYear && req.actor!.jambYear && req.actor!.jambYear !== mock.eligibilityYear) {
      res.status(403).json({
        error: `Eligibility restricted to ${mock.eligibilityYear} UTME candidates.`,
      });
      return;
    }

    const [reg] = await db
      .insert(mockRegistrations)
      .values({
        mockExaminationId: mockId,
        userId: req.actor!.id,
        status: 'registered',
      })
      .onConflictDoNothing()
      .returning();

    res.status(201).json({ registered: true, registration: reg || null });
  } catch (err) {
    console.error('[student/mocks/register] Error:', err);
    res.status(500).json({ error: 'Failed to register for mock examination.' });
  }
});

// Student Results & Detailed Review
router.get('/student/results', async (req: AuthRequest, res) => {
  try {
    const results = await db
      .select()
      .from(examinationResults)
      .where(eq(examinationResults.userId, req.actor!.id))
      .orderBy(desc(examinationResults.createdAt));

    res.json({ results });
  } catch (err) {
    console.error('[student/results] Error:', err);
    res.status(500).json({ error: 'Failed to load results.' });
  }
});

router.get('/student/results/:sessionId', async (req: AuthRequest, res) => {
  try {
    const sessionId = String(req.params.sessionId);
    const [session] = await db
      .select()
      .from(examinationSessions)
      .where(and(eq(examinationSessions.id, sessionId), eq(examinationSessions.userId, req.actor!.id)));

    if (!session) {
      res.status(404).json({ error: 'Result session not found.' });
      return;
    }
    if (session.status === 'in_progress') {
      res.status(403).json({ error: 'Answers and results are locked until the examination is submitted.' });
      return;
    }

    const [result] = await db
      .select()
      .from(examinationResults)
      .where(eq(examinationResults.sessionId, sessionId));

    if (!result) {
      res.status(404).json({ error: 'Result record not found.' });
      return;
    }

    let reviewItems: Array<Record<string, unknown>> = [];
    if (session.allowReview) {
      const ansRows = await db
        .select()
        .from(studentAnswers)
        .where(eq(studentAnswers.sessionId, sessionId))
        .orderBy(studentAnswers.questionOrder);

      const qIds = ansRows.map((a) => a.questionId);
      const qRows = qIds.length > 0 ? await db.select().from(questions).where(inArray(questions.id, qIds)) : [];
      const optRows =
        qIds.length > 0 ? await db.select().from(questionOptions).where(inArray(questionOptions.questionId, qIds)) : [];
      const subRows = await db.select().from(subjects);

      const qMap = new Map(qRows.map((q) => [q.id, q]));
      const subMap = new Map(subRows.map((s) => [s.id, s]));
      const optMap = new Map<string, Array<{ label: string; text: string; isCorrect: boolean }>>();
      for (const o of optRows) {
        const list = optMap.get(o.questionId) || [];
        list.push({ label: o.optionLabel, text: o.optionText, isCorrect: o.isCorrect });
        optMap.set(o.questionId, list);
      }
      for (const [, list] of optMap) list.sort((a, b) => a.label.localeCompare(b.label));

      reviewItems = ansRows.map((ans) => {
        const q = qMap.get(ans.questionId);
        const opts = optMap.get(ans.questionId) || [];
        const correctOpt = opts.find((o) => o.isCorrect)?.label || null;
        return {
          questionOrder: ans.questionOrder,
          questionId: ans.questionId,
          subjectName: subMap.get(ans.subjectId)?.name || 'Subject',
          subjectCode: subMap.get(ans.subjectId)?.code || '',
          questionText: q?.questionText || '',
          questionImageUrl: q?.questionImageUrl || null,
          questionSource: q?.questionSource || 'sample_practice',
          examYear: q?.examYear || null,
          selectedOption: ans.selectedOption,
          correctOption: correctOpt,
          isCorrect: ans.isCorrect,
          explanation: q?.explanation || '',
          options: opts,
        };
      });
    }

    res.json({
      session: {
        id: session.id,
        examTitle: session.examTitle,
        examType: session.examType,
        examMode: session.examMode,
        status: session.status,
        allowReview: session.allowReview,
        startedAt: session.startedAt,
        submittedAt: session.submittedAt,
      },
      result,
      reviewItems,
    });
  } catch (err) {
    console.error('[student/results/:id] Error:', err);
    res.status(500).json({ error: 'Failed to load detailed result.' });
  }
});

// Performance Analytics
router.get('/student/analytics', async (req: AuthRequest, res) => {
  try {
    const results = await db
      .select()
      .from(examinationResults)
      .where(eq(examinationResults.userId, req.actor!.id))
      .orderBy(examinationResults.createdAt);

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

    const subjectMastery = Array.from(subjectStats.values()).map((s) => ({
      ...s,
      accuracy: s.totalQuestions > 0 ? Number(((s.correctCount / s.totalQuestions) * 100).toFixed(1)) : 0,
    }));

    const trend = results.map((r, idx) => ({
      attemptNumber: idx + 1,
      examTitle: r.examTitle,
      percentage: Number(r.percentage),
      scoreOutOf400: r.scoreOutOf400,
      date: r.createdAt,
    }));

    res.json({
      totalAttempts: results.length,
      subjectMastery,
      trend,
    });
  } catch (err) {
    console.error('[student/analytics] Error:', err);
    res.status(500).json({ error: 'Failed to load analytics.' });
  }
});

// Study Materials
router.get('/student/materials', async (req, res) => {
  try {
    const subjectId = typeof req.query.subjectId === 'string' ? req.query.subjectId : '';
    const category = typeof req.query.category === 'string' ? req.query.category : '';

    const conditions = [eq(studyMaterials.isActive, true)];
    if (subjectId) conditions.push(eq(studyMaterials.subjectId, subjectId));
    if (category && category !== 'All') conditions.push(eq(studyMaterials.category, category));

    const rows = await db
      .select()
      .from(studyMaterials)
      .where(and(...conditions))
      .orderBy(desc(studyMaterials.createdAt));

    const subs = await db.select().from(subjects);
    const subMap = new Map(subs.map((s) => [s.id, s]));

    res.json({
      materials: rows.map((m) => ({
        ...m,
        subjectName: subMap.get(m.subjectId)?.name || 'General',
        subjectCode: subMap.get(m.subjectId)?.code || '',
      })),
    });
  } catch (err) {
    console.error('[student/materials] Error:', err);
    res.status(500).json({ error: 'Failed to load study materials.' });
  }
});

router.get('/student/materials/:id/download', async (req, res) => {
  try {
    const [material] = await db
      .select()
      .from(studyMaterials)
      .where(and(eq(studyMaterials.id, String(req.params.id)), eq(studyMaterials.isActive, true)));

    if (!material) {
      res.status(404).json({ error: 'Study material not found.' });
      return;
    }

    const filePath = resolveSafeLocalPath(material.storageKey);
    if (!filePath) {
      res.status(404).json({ error: 'File asset unavailable on storage.' });
      return;
    }

    await db
      .update(studyMaterials)
      .set({ downloadCount: sql`${studyMaterials.downloadCount} + 1` })
      .where(eq(studyMaterials.id, material.id));

    res.download(filePath, material.fileName);
  } catch (err) {
    console.error('[student/materials/download] Error:', err);
    res.status(500).json({ error: 'Failed to download study material.' });
  }
});

// Notifications
router.get('/student/notifications', async (req: AuthRequest, res) => {
  try {
    const userId = req.actor!.id;
    const rows = await db
      .select()
      .from(notifications)
      .where(or(isNull(notifications.targetUserId), eq(notifications.targetUserId, userId)))
      .orderBy(desc(notifications.createdAt));

    const reads = await db.select().from(notificationReads).where(eq(notificationReads.userId, userId));
    const readMap = new Map(reads.map((r) => [r.notificationId, r.readAt]));

    res.json({
      notifications: rows.map((n) => ({
        ...n,
        isRead: readMap.has(n.id),
        readAt: readMap.get(n.id) || null,
      })),
    });
  } catch (err) {
    console.error('[student/notifications] Error:', err);
    res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

router.post('/student/notifications/:id/read', async (req: AuthRequest, res) => {
  try {
    await db
      .insert(notificationReads)
      .values({
        notificationId: String(req.params.id),
        userId: req.actor!.id,
      })
      .onConflictDoNothing();
    res.json({ read: true });
  } catch {
    res.status(500).json({ error: 'Failed to mark notification read.' });
  }
});

router.post('/student/notifications/read-all', async (req: AuthRequest, res) => {
  try {
    const userId = req.actor!.id;
    const rows = await db
      .select()
      .from(notifications)
      .where(or(isNull(notifications.targetUserId), eq(notifications.targetUserId, userId)));
    for (const n of rows) {
      await db
        .insert(notificationReads)
        .values({ notificationId: n.id, userId })
        .onConflictDoNothing();
    }
    res.json({ readAll: true });
  } catch {
    res.status(500).json({ error: 'Failed to mark notifications read.' });
  }
});

export default router;
