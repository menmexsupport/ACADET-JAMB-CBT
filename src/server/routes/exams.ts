import { Router } from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import {
  examinationResults,
  examinations,
  examinationSubjects,
  examinationSessions,
  mockExaminations,
  mockRegistrations,
  questionOptions,
  questions,
  studentAnswers,
  subjects,
  topics,
  SubjectBreakdownItem,
} from '../../db/schema.ts';
import { AuthRequest, requireStudentAuth } from '../middleware/auth.ts';
import { logAuditEvent } from '../utils/audit.ts';

const router = Router();

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const startPracticeSchema = z.object({
  examType: z.enum(['practice', 'utme_4_subject', 'topic_practice', 'past_questions', 'revision']),
  examMode: z.enum(['timed', 'revision']).default('timed'),
  subjectIds: z.array(z.string().uuid()).min(1).max(4),
  topicId: z.string().uuid().optional(),
  questionCount: z.coerce.number().int().min(5).max(180).default(20),
  durationMinutes: z.coerce.number().int().min(5).max(180).default(30),
  difficulty: z.enum(['All', 'Easy', 'Medium', 'Hard']).default('All'),
  questionSource: z.enum(['All', 'sample_practice', 'verified_past_question']).default('All'),
  randomize: z.boolean().default(true),
  title: z.string().trim().max(160).optional(),
  examinationId: z.string().uuid().optional(),
});

// Grade and finalize a session inside a transaction (idempotent & duplicate-safe)
async function gradeAndFinalizeSession(sessionId: string, userId: string, forcedExpired = false) {
  return db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(examinationSessions)
      .where(and(eq(examinationSessions.id, sessionId), eq(examinationSessions.userId, userId)));

    if (!session) {
      return { notFound: true as const };
    }

    if (session.status !== 'in_progress') {
      const [existingResult] = await tx
        .select()
        .from(examinationResults)
        .where(eq(examinationResults.sessionId, sessionId));
      return { alreadySubmitted: true as const, session, result: existingResult };
    }

    const answerRows = await tx
      .select()
      .from(studentAnswers)
      .where(eq(studentAnswers.sessionId, sessionId))
      .orderBy(studentAnswers.questionOrder);

    const questionIds = answerRows.map((a) => a.questionId);
    const correctOptionsRows =
      questionIds.length > 0
        ? await tx
            .select()
            .from(questionOptions)
            .where(and(inArray(questionOptions.questionId, questionIds), eq(questionOptions.isCorrect, true)))
        : [];

    const correctMap = new Map<string, string>();
    for (const opt of correctOptionsRows) {
      correctMap.set(opt.questionId, opt.optionLabel);
    }

    const subjectIds = Array.from(new Set(answerRows.map((a) => a.subjectId)));
    const subjectRows =
      subjectIds.length > 0
        ? await tx.select().from(subjects).where(inArray(subjects.id, subjectIds))
        : [];
    const subjectLookup = new Map(subjectRows.map((s) => [s.id, s]));

    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    const perSubject = new Map<
      string,
      { total: number; correct: number; wrong: number; unanswered: number }
    >();

    for (const ans of answerRows) {
      const stats = perSubject.get(ans.subjectId) || { total: 0, correct: 0, wrong: 0, unanswered: 0 };
      stats.total += 1;

      const correctLabel = correctMap.get(ans.questionId);
      let isCorrectFlag: boolean | null = null;

      if (!ans.selectedOption) {
        unansweredCount += 1;
        stats.unanswered += 1;
        isCorrectFlag = false;
      } else if (correctLabel && ans.selectedOption === correctLabel) {
        correctCount += 1;
        stats.correct += 1;
        isCorrectFlag = true;
      } else {
        wrongCount += 1;
        stats.wrong += 1;
        isCorrectFlag = false;
      }

      perSubject.set(ans.subjectId, stats);

      await tx
        .update(studentAnswers)
        .set({ isCorrect: isCorrectFlag })
        .where(eq(studentAnswers.id, ans.id));
    }

    const totalQuestions = answerRows.length || session.totalQuestions;
    const percentageNum = totalQuestions > 0 ? Number(((correctCount / totalQuestions) * 100).toFixed(2)) : 0;
    const scoreOutOf400 = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 400) : 0;

    const now = new Date();
    const rawElapsed = Math.max(0, Math.floor((now.getTime() - new Date(session.startedAt).getTime()) / 1000));
    const timeSpentSeconds =
      session.examMode === 'timed' ? Math.min(session.durationSeconds, rawElapsed) : rawElapsed;

    const subjectBreakdown: SubjectBreakdownItem[] = Array.from(perSubject.entries()).map(([sId, st]) => {
      const sub = subjectLookup.get(sId);
      const pct = st.total > 0 ? Number(((st.correct / st.total) * 100).toFixed(2)) : 0;
      return {
        subjectId: sId,
        subjectCode: sub?.code || 'SUB',
        subjectName: sub?.name || 'Subject',
        totalQuestions: st.total,
        correctCount: st.correct,
        wrongCount: st.wrong,
        unansweredCount: st.unanswered,
        scoreOutOf100: Math.round(pct),
        percentage: pct,
      };
    });

    const finalStatus = forcedExpired ? 'expired' : 'submitted';

    const [updatedSession] = await tx
      .update(examinationSessions)
      .set({
        status: finalStatus,
        timeSpentSeconds,
        submittedAt: now,
        lastSyncedAt: now,
      })
      .where(and(eq(examinationSessions.id, sessionId), eq(examinationSessions.status, 'in_progress')))
      .returning();

    if (!updatedSession) {
      const [existingResult] = await tx
        .select()
        .from(examinationResults)
        .where(eq(examinationResults.sessionId, sessionId));
      return { alreadySubmitted: true as const, session, result: existingResult };
    }

    const [result] = await tx
      .insert(examinationResults)
      .values({
        sessionId,
        userId,
        examTitle: session.examTitle,
        totalQuestions,
        correctCount,
        wrongCount,
        unansweredCount,
        scoreOutOf400,
        percentage: percentageNum.toFixed(2),
        timeSpentSeconds,
        subjectBreakdown,
      })
      .returning();

    if (session.mockExaminationId) {
      await tx
        .update(mockRegistrations)
        .set({ status: 'completed' })
        .where(
          and(
            eq(mockRegistrations.mockExaminationId, session.mockExaminationId),
            eq(mockRegistrations.userId, userId)
          )
        );
    }

    return { alreadySubmitted: false as const, session: updatedSession, result };
  });
}

// Fetch active (in-progress) session for refresh recovery
router.get('/exams/sessions/active', requireStudentAuth, async (req: AuthRequest, res) => {
  try {
    const activeRows = await db
      .select()
      .from(examinationSessions)
      .where(and(eq(examinationSessions.userId, req.actor!.id), eq(examinationSessions.status, 'in_progress')))
      .orderBy(desc(examinationSessions.startedAt));

    if (activeRows.length === 0) {
      res.json({ activeSession: null });
      return;
    }

    const session = activeRows[0];
    if (session.examMode === 'timed' && Date.now() >= new Date(session.expiresAt).getTime()) {
      await gradeAndFinalizeSession(session.id, req.actor!.id, true);
      res.json({ activeSession: null, autoExpiredSessionId: session.id });
      return;
    }

    res.json({
      activeSession: {
        id: session.id,
        examTitle: session.examTitle,
        examMode: session.examMode,
        examType: session.examType,
        totalQuestions: session.totalQuestions,
        remainingSeconds: Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000)),
        startedAt: session.startedAt,
      },
    });
  } catch (err) {
    console.error('[exams/sessions/active] Error:', err);
    res.status(500).json({ error: 'Failed to check active exam sessions.' });
  }
});

// Start a Practice / 4-Subject UTME / Topic / Past Question / Blueprint Exam
router.post('/exams/start', requireStudentAuth, async (req: AuthRequest, res) => {
  const parsed = startPracticeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid exam configuration.' });
    return;
  }

  try {
    const cfg = parsed.data;
    let selectedSubjectIds = Array.from(new Set(cfg.subjectIds));

    // If launching from a blueprint examinationId
    let blueprint: typeof examinations.$inferSelect | undefined;
    if (cfg.examinationId) {
      const [bp] = await db.select().from(examinations).where(eq(examinations.id, cfg.examinationId));
      if (!bp || !bp.isActive) {
        res.status(404).json({ error: 'Selected practice examination is not available.' });
        return;
      }
      blueprint = bp;
      const bpSubjects = await db
        .select()
        .from(examinationSubjects)
        .where(eq(examinationSubjects.examinationId, bp.id));
      if (bpSubjects.length > 0) {
        selectedSubjectIds = bpSubjects.map((s) => s.subjectId);
      }
    }

    const activeSubjectRows = await db
      .select()
      .from(subjects)
      .where(and(inArray(subjects.id, selectedSubjectIds), eq(subjects.isActive, true)));

    if (activeSubjectRows.length !== selectedSubjectIds.length) {
      res.status(400).json({ error: 'One or more selected subjects are inactive or invalid.' });
      return;
    }

    // Official JAMB UTME 4-subject validation: Use of English MUST be included
    if (cfg.examType === 'utme_4_subject') {
      if (activeSubjectRows.length !== 4) {
        res.status(400).json({ error: 'JAMB UTME 4-subject examination requires exactly 4 distinct subjects.' });
        return;
      }
      const hasEnglish = activeSubjectRows.some((s) => s.isCompulsory || s.code === 'ENG');
      if (!hasEnglish) {
        res.status(400).json({ error: 'Use of English (ENG) is compulsory in every 4-subject UTME combination.' });
        return;
      }
    }

    // Build question pool from PostgreSQL
    const conditions = [inArray(questions.subjectId, selectedSubjectIds), eq(questions.isActive, true)];
    if (cfg.topicId) {
      conditions.push(eq(questions.topicId, cfg.topicId));
    }
    if (cfg.difficulty !== 'All') {
      conditions.push(eq(questions.difficulty, cfg.difficulty));
    }
    if (cfg.questionSource !== 'All') {
      conditions.push(eq(questions.questionSource, cfg.questionSource));
    }

    const poolRows = await db
      .select()
      .from(questions)
      .where(and(...conditions));

    if (poolRows.length === 0) {
      res.status(400).json({
        error: 'No questions matched your selected filters. Try broadening the difficulty or topic.',
      });
      return;
    }

    const targetCount = blueprint ? blueprint.questionCount : cfg.questionCount;
    let chosenQuestions: typeof poolRows = [];

    if (cfg.examType === 'utme_4_subject') {
      // Balance questions evenly across the 4 subjects, English first
      const engSub = activeSubjectRows.find((s) => s.code === 'ENG' || s.isCompulsory);
      const orderedSubjects = [
        ...(engSub ? [engSub] : []),
        ...activeSubjectRows.filter((s) => s.id !== engSub?.id),
      ];
      const perSubjectQuota = Math.max(1, Math.floor(targetCount / orderedSubjects.length));
      for (const sub of orderedSubjects) {
        const subPool = poolRows.filter((q) => q.subjectId === sub.id);
        const ordered = cfg.randomize ? shuffleArray(subPool) : subPool;
        chosenQuestions.push(...ordered.slice(0, perSubjectQuota));
      }
      // Top up if any subject had fewer questions
      if (chosenQuestions.length < targetCount) {
        const usedIds = new Set(chosenQuestions.map((q) => q.id));
        const remaining = (cfg.randomize ? shuffleArray(poolRows) : poolRows).filter((q) => !usedIds.has(q.id));
        chosenQuestions.push(...remaining.slice(0, targetCount - chosenQuestions.length));
      }
    } else {
      const ordered = cfg.randomize ? shuffleArray(poolRows) : poolRows;
      chosenQuestions = ordered.slice(0, Math.min(targetCount, ordered.length));
    }

    const durationMins = blueprint ? blueprint.durationMinutes : cfg.durationMinutes;
    const durationSeconds = durationMins * 60;
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + durationSeconds * 1000);

    const examTitle =
      cfg.title ||
      blueprint?.title ||
      (cfg.examType === 'utme_4_subject'
        ? `UTME 4-Subject CBT (${activeSubjectRows.map((s) => s.code).join(', ')})`
        : `${activeSubjectRows[0].name} ${cfg.examMode === 'revision' ? 'Revision' : 'Practice'} CBT`);

    const session = await db.transaction(async (tx) => {
      const [createdSession] = await tx
        .insert(examinationSessions)
        .values({
          userId: req.actor!.id,
          examinationId: blueprint?.id || null,
          examTitle,
          examMode: cfg.examMode,
          examType: cfg.examType,
          subjectIds: selectedSubjectIds,
          totalQuestions: chosenQuestions.length,
          durationSeconds,
          status: 'in_progress',
          allowReview: blueprint ? blueprint.allowReview : true,
          startedAt,
          expiresAt,
        })
        .returning();

      for (let i = 0; i < chosenQuestions.length; i++) {
        await tx.insert(studentAnswers).values({
          sessionId: createdSession.id,
          questionId: chosenQuestions[i].id,
          subjectId: chosenQuestions[i].subjectId,
          questionOrder: i + 1,
          selectedOption: null,
          isMarkedForReview: false,
          isCorrect: null,
        });
      }

      return createdSession;
    });

    res.status(201).json({ sessionId: session.id });
  } catch (err) {
    console.error('[exams/start] Error:', err);
    res.status(500).json({ error: 'Unable to start examination session.' });
  }
});

// Start a scheduled Mock Examination (Backend enforces schedule & eligibility!)
router.post('/exams/mock/:mockId/start', requireStudentAuth, async (req: AuthRequest, res) => {
  try {
    const [mock] = await db
      .select()
      .from(mockExaminations)
      .where(eq(mockExaminations.id, String(req.params.mockId)));

    if (!mock || !mock.isActive) {
      res.status(404).json({ error: 'Mock examination not found or inactive.' });
      return;
    }

    const now = new Date();
    if (now < new Date(mock.startAt)) {
      res.status(403).json({ error: 'This mock examination has not started yet.' });
      return;
    }
    if (now > new Date(mock.endAt)) {
      res.status(403).json({ error: 'This mock examination window has closed.' });
      return;
    }

    if (mock.eligibilityYear && req.actor!.jambYear && req.actor!.jambYear !== mock.eligibilityYear) {
      res.status(403).json({
        error: `This mock examination is restricted to ${mock.eligibilityYear} JAMB UTME candidates.`,
      });
      return;
    }

    // Resume existing in-progress mock session if already started
    const existingActive = await db
      .select()
      .from(examinationSessions)
      .where(
        and(
          eq(examinationSessions.userId, req.actor!.id),
          eq(examinationSessions.mockExaminationId, mock.id),
          eq(examinationSessions.status, 'in_progress')
        )
      );

    if (existingActive.length > 0) {
      res.json({ sessionId: existingActive[0].id });
      return;
    }

    const pool = await db
      .select()
      .from(questions)
      .where(and(inArray(questions.subjectId, mock.subjectIds), eq(questions.isActive, true)));

    if (pool.length === 0) {
      res.status(400).json({ error: 'No questions available for this mock examination.' });
      return;
    }

    const chosen = shuffleArray(pool).slice(0, Math.min(mock.questionCount, pool.length));
    const durationSeconds = mock.durationMinutes * 60;
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + durationSeconds * 1000);

    const session = await db.transaction(async (tx) => {
      // Ensure mock registration exists
      await tx
        .insert(mockRegistrations)
        .values({
          mockExaminationId: mock.id,
          userId: req.actor!.id,
          status: 'started',
        })
        .onConflictDoUpdate({
          target: [mockRegistrations.mockExaminationId, mockRegistrations.userId],
          set: { status: 'started' },
        });

      const [createdSession] = await tx
        .insert(examinationSessions)
        .values({
          userId: req.actor!.id,
          mockExaminationId: mock.id,
          examTitle: mock.title,
          examMode: 'timed',
          examType: 'mock',
          subjectIds: mock.subjectIds,
          totalQuestions: chosen.length,
          durationSeconds,
          status: 'in_progress',
          allowReview: mock.allowReview,
          startedAt,
          expiresAt,
        })
        .returning();

      for (let i = 0; i < chosen.length; i++) {
        await tx.insert(studentAnswers).values({
          sessionId: createdSession.id,
          questionId: chosen[i].id,
          subjectId: chosen[i].subjectId,
          questionOrder: i + 1,
          selectedOption: null,
          isMarkedForReview: false,
          isCorrect: null,
        });
      }

      return createdSession;
    });

    res.status(201).json({ sessionId: session.id });
  } catch (err) {
    console.error('[exams/mock/start] Error:', err);
    res.status(500).json({ error: 'Failed to start mock examination.' });
  }
});

// Get exam session state (STRICTLY hides isCorrect and explanation during active exam!)
router.get('/exams/sessions/:sessionId', requireStudentAuth, async (req: AuthRequest, res) => {
  try {
    const sessionId = String(req.params.sessionId);
    const [session] = await db
      .select()
      .from(examinationSessions)
      .where(and(eq(examinationSessions.id, sessionId), eq(examinationSessions.userId, req.actor!.id)));

    if (!session) {
      res.status(404).json({ error: 'Examination session not found.' });
      return;
    }

    // Auto-expire timed exam if server clock passed expiresAt
    if (session.status === 'in_progress' && session.examMode === 'timed' && Date.now() >= new Date(session.expiresAt).getTime()) {
      const finalized = await gradeAndFinalizeSession(session.id, req.actor!.id, true);
      if ('result' in finalized && finalized.result) {
        res.json({
          session: finalized.session,
          autoSubmitted: true,
          resultId: finalized.result.id,
          questions: [],
        });
        return;
      }
    }

    const answerRows = await db
      .select()
      .from(studentAnswers)
      .where(eq(studentAnswers.sessionId, sessionId))
      .orderBy(studentAnswers.questionOrder);

    const qIds = answerRows.map((a) => a.questionId);
    const questionRows =
      qIds.length > 0 ? await db.select().from(questions).where(inArray(questions.id, qIds)) : [];
    const optionRows =
      qIds.length > 0 ? await db.select().from(questionOptions).where(inArray(questionOptions.questionId, qIds)) : [];
    const subjectRows = await db.select().from(subjects).where(inArray(subjects.id, session.subjectIds));
    const topicIds = Array.from(new Set(questionRows.map((q) => q.topicId).filter(Boolean) as string[]));
    const topicRows =
      topicIds.length > 0 ? await db.select().from(topics).where(inArray(topics.id, topicIds)) : [];

    const qMap = new Map(questionRows.map((q) => [q.id, q]));
    const subMap = new Map(subjectRows.map((s) => [s.id, s]));
    const topicMap = new Map(topicRows.map((t) => [t.id, t]));
    const optMap = new Map<string, Array<{ label: string; text: string }>>();
    for (const o of optionRows) {
      const list = optMap.get(o.questionId) || [];
      // CRITICAL SECURITY RULE: NEVER send o.isCorrect while session is in_progress!
      list.push({ label: o.optionLabel, text: o.optionText });
      optMap.set(o.questionId, list);
    }
    for (const [, list] of optMap) {
      list.sort((a, b) => a.label.localeCompare(b.label));
    }

    const hydratedQuestions = answerRows.map((ans) => {
      const q = qMap.get(ans.questionId);
      const sub = subMap.get(ans.subjectId);
      const top = q?.topicId ? topicMap.get(q.topicId) : undefined;
      return {
        questionOrder: ans.questionOrder,
        questionId: ans.questionId,
        subjectId: ans.subjectId,
        subjectCode: sub?.code || 'SUB',
        subjectName: sub?.name || 'Subject',
        topicName: top?.name || 'General',
        questionText: q?.questionText || '',
        questionImageUrl: q?.questionImageUrl || null,
        difficulty: q?.difficulty || 'Medium',
        questionSource: q?.questionSource || 'sample_practice',
        examYear: q?.examYear || null,
        options: optMap.get(ans.questionId) || [],
        selectedOption: ans.selectedOption,
        isMarkedForReview: ans.isMarkedForReview,
      };
    });

    const remainingSeconds =
      session.status === 'in_progress'
        ? Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000))
        : 0;

    res.json({
      session: {
        id: session.id,
        examTitle: session.examTitle,
        examMode: session.examMode,
        examType: session.examType,
        status: session.status,
        totalQuestions: session.totalQuestions,
        durationSeconds: session.durationSeconds,
        remainingSeconds,
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
        submittedAt: session.submittedAt,
        subjects: subjectRows.map((s) => ({ id: s.id, code: s.code, name: s.name })),
      },
      questions: hydratedQuestions,
    });
  } catch (err) {
    console.error('[exams/sessions/:id] Error:', err);
    res.status(500).json({ error: 'Failed to load examination session.' });
  }
});

// Auto-save student answer or mark-for-review
const saveAnswerSchema = z.object({
  questionId: z.string().uuid(),
  selectedOption: z.enum(['A', 'B', 'C', 'D']).nullable().optional(),
  isMarkedForReview: z.boolean().optional(),
});

router.patch('/exams/sessions/:sessionId/answer', requireStudentAuth, async (req: AuthRequest, res) => {
  const parsed = saveAnswerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid answer payload.' });
    return;
  }

  try {
    const sessionId = String(req.params.sessionId);
    const [session] = await db
      .select()
      .from(examinationSessions)
      .where(and(eq(examinationSessions.id, sessionId), eq(examinationSessions.userId, req.actor!.id)));

    if (!session) {
      res.status(404).json({ error: 'Examination session not found.' });
      return;
    }

    if (session.status !== 'in_progress') {
      res.status(409).json({ error: 'Examination has already been submitted. Answers are locked.' });
      return;
    }

    if (session.examMode === 'timed' && Date.now() >= new Date(session.expiresAt).getTime()) {
      await gradeAndFinalizeSession(session.id, req.actor!.id, true);
      res.status(409).json({ error: 'Examination time has expired and your session was submitted.' });
      return;
    }

    const updateValues: Partial<typeof studentAnswers.$inferInsert> = {
      answeredAt: new Date(),
    };
    if (parsed.data.selectedOption !== undefined) {
      updateValues.selectedOption = parsed.data.selectedOption;
    }
    if (parsed.data.isMarkedForReview !== undefined) {
      updateValues.isMarkedForReview = parsed.data.isMarkedForReview;
    }

    const [updated] = await db
      .update(studentAnswers)
      .set(updateValues)
      .where(and(eq(studentAnswers.sessionId, sessionId), eq(studentAnswers.questionId, parsed.data.questionId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Question does not belong to this examination session.' });
      return;
    }

    await db
      .update(examinationSessions)
      .set({ lastSyncedAt: new Date() })
      .where(eq(examinationSessions.id, sessionId));

    res.json({
      saved: true,
      questionId: updated.questionId,
      selectedOption: updated.selectedOption,
      isMarkedForReview: updated.isMarkedForReview,
      syncedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[exams/answer] Error:', err);
    res.status(500).json({ error: 'Failed to save answer.' });
  }
});

// Submit & Grade examination automatically on the server
router.post('/exams/sessions/:sessionId/submit', requireStudentAuth, async (req: AuthRequest, res) => {
  try {
    const sessionId = String(req.params.sessionId);
    const outcome = await gradeAndFinalizeSession(sessionId, req.actor!.id, false);

    if ('notFound' in outcome) {
      res.status(404).json({ error: 'Examination session not found.' });
      return;
    }

    if (outcome.alreadySubmitted) {
      res.status(200).json({
        alreadySubmitted: true,
        session: outcome.session,
        result: outcome.result,
      });
      return;
    }

    await logAuditEvent({
      actorId: req.actor!.id,
      actorRole: 'student',
      actorEmail: req.actor!.email,
      action: 'exam.submitted',
      entityType: 'examination_session',
      entityId: sessionId,
      details: {
        scoreOutOf400: outcome.result.scoreOutOf400,
        percentage: outcome.result.percentage,
      },
      ipAddress: req.ip || null,
    });

    res.json({
      alreadySubmitted: false,
      session: outcome.session,
      result: outcome.result,
    });
  } catch (err) {
    console.error('[exams/submit] Error:', err);
    res.status(500).json({ error: 'Failed to submit examination.' });
  }
});

export default router;
