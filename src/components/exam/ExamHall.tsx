import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  Calculator,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  Grid,
  Info,
  Send,
  X,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { formatDuration } from '../../lib/pdfReport.ts';
import { AuthUser, ExamQuestionItem, ExamSessionDetail, UserPreferences } from '../../types/index.ts';
import CalculatorModal from './CalculatorModal.tsx';

interface ExamHallProps {
  sessionId: string;
  candidate?: AuthUser;
  preferences?: UserPreferences;
  onExitToDashboard: () => void;
  onCompleted: (sessionId: string) => void;
}

type PaletteScope = 'subject' | 'all' | 'unanswered' | 'marked';

export default function ExamHall({
  sessionId,
  candidate,
  preferences,
  onExitToDashboard,
  onCompleted,
}: ExamHallProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<ExamSessionDetail | null>(null);
  const [questions, setQuestions] = useState<ExamQuestionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [paletteScope, setPaletteScope] = useState<PaletteScope>('subject');
  const [largeFont, setLargeFont] = useState<boolean>(preferences?.fontSize === 'large');
  const [showCalculator, setShowCalculator] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showMobilePalette, setShowMobilePalette] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const autoSubmittedRef = useRef(false);

  const loadSession = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch<{
        session: ExamSessionDetail;
        questions: ExamQuestionItem[];
        autoSubmitted?: boolean;
      }>(`/api/exams/sessions/${sessionId}`);

      if (res.autoSubmitted || res.session.status !== 'in_progress') {
        onCompleted(sessionId);
        return;
      }

      setSession(res.session);
      setQuestions(res.questions);
      setRemainingSeconds(res.session.remainingSeconds);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load examination session.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, onCompleted]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleSubmitExam = useCallback(async () => {
    if (submitting) return;
    try {
      setSubmitting(true);
      await apiFetch(`/api/exams/sessions/${sessionId}/submit`, { method: 'POST' });
      onCompleted(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please retry.');
      setSubmitting(false);
    }
  }, [sessionId, submitting, onCompleted]);

  // Server-authoritative countdown ticker
  useEffect(() => {
    if (!session || session.status !== 'in_progress') return;

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (session.examMode === 'revision') {
          return prev;
        }
        if (prev <= 1) {
          if (!autoSubmittedRef.current) {
            autoSubmittedRef.current = true;
            void handleSubmitExam();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [session, handleSubmitExam]);

  // Re-sync clock with backend when tab regains focus
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && session?.status === 'in_progress') {
        apiFetch<{ session: ExamSessionDetail }>(`/api/exams/sessions/${sessionId}`)
          .then((res) => {
            if (res.session.status !== 'in_progress') {
              onCompleted(sessionId);
            } else {
              setRemainingSeconds(res.session.remainingSeconds);
            }
          })
          .catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [sessionId, session?.status, onCompleted]);

  const currentQuestion = questions[currentIndex];

  const handleSelectOption = useCallback(
    async (optionLabel: 'A' | 'B' | 'C' | 'D' | null) => {
      if (!currentQuestion || !session || session.status !== 'in_progress') return;
      const qId = currentQuestion.questionId;

      setQuestions((prev) =>
        prev.map((q) => (q.questionId === qId ? { ...q, selectedOption: optionLabel } : q))
      );
      setSavingStatus('saving');

      try {
        await apiFetch(`/api/exams/sessions/${sessionId}/answer`, {
          method: 'PATCH',
          body: JSON.stringify({ questionId: qId, selectedOption: optionLabel }),
        });
        setSavingStatus('saved');

        if (optionLabel && preferences?.autoNextQuestion && currentIndex < questions.length - 1) {
          setTimeout(() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1)), 180);
        }
      } catch (err) {
        setSavingStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to save answer.');
      }
    },
    [currentQuestion, session, sessionId, preferences?.autoNextQuestion, currentIndex, questions.length]
  );

  const handleToggleMark = useCallback(async () => {
    if (!currentQuestion || !session || session.status !== 'in_progress') return;
    const nextMarked = !currentQuestion.isMarkedForReview;
    const qId = currentQuestion.questionId;

    setQuestions((prev) =>
      prev.map((q) => (q.questionId === qId ? { ...q, isMarkedForReview: nextMarked } : q))
    );
    setSavingStatus('saving');

    try {
      await apiFetch(`/api/exams/sessions/${sessionId}/answer`, {
        method: 'PATCH',
        body: JSON.stringify({ questionId: qId, isMarkedForReview: nextMarked }),
      });
      setSavingStatus('saved');
    } catch {
      setSavingStatus('error');
    }
  }, [currentQuestion, session, sessionId]);

  // Standard JAMB 8-key CBT keyboard shortcuts: A-D answer, N/Right next, P/Left previous, M mark, C calculator, S submit
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showCalculator || showConfirmSubmit || showInstructions) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toUpperCase();
      if (key === 'A' || key === 'B' || key === 'C' || key === 'D') {
        e.preventDefault();
        void handleSelectOption(key as 'A' | 'B' | 'C' | 'D');
      } else if (e.key === 'ArrowRight' || key === 'N') {
        e.preventDefault();
        setCurrentIndex((i) => Math.min(questions.length - 1, i + 1));
      } else if (e.key === 'ArrowLeft' || key === 'P') {
        e.preventDefault();
        setCurrentIndex((i) => Math.max(0, i - 1));
      } else if (key === 'M') {
        e.preventDefault();
        void handleToggleMark();
      } else if (key === 'C') {
        e.preventDefault();
        setShowCalculator(true);
      } else if (key === 'S') {
        e.preventDefault();
        setShowConfirmSubmit(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showCalculator, showConfirmSubmit, showInstructions, handleSelectOption, handleToggleMark, questions.length]);

  const counts = useMemo(() => {
    let answered = 0;
    let marked = 0;
    for (const q of questions) {
      if (q.selectedOption) answered++;
      if (q.isMarkedForReview) marked++;
    }
    return {
      total: questions.length,
      answered,
      unanswered: questions.length - answered,
      marked,
    };
  }, [questions]);

  const subjectSummaries = useMemo(() => {
    if (!session) return [];
    return session.subjects.map((sub) => {
      const items = questions
        .map((q, globalIndex) => ({ q, globalIndex }))
        .filter((entry) => entry.q.subjectId === sub.id);
      const answered = items.filter((e) => Boolean(e.q.selectedOption)).length;
      const marked = items.filter((e) => e.q.isMarkedForReview).length;
      return {
        ...sub,
        total: items.length,
        answered,
        marked,
        unanswered: items.length - answered,
        firstGlobalIndex: items[0]?.globalIndex ?? 0,
      };
    });
  }, [session, questions]);

  const subjectPosition = useMemo(() => {
    if (!currentQuestion) return { indexInSubject: 1, totalInSubject: questions.length };
    const sameSubject = questions.filter((q) => q.subjectId === currentQuestion.subjectId);
    const pos = sameSubject.findIndex((q) => q.questionId === currentQuestion.questionId);
    return {
      indexInSubject: pos >= 0 ? pos + 1 : 1,
      totalInSubject: sameSubject.length || questions.length,
    };
  }, [questions, currentQuestion]);

  const visiblePaletteEntries = useMemo(() => {
    const entries = questions.map((q, globalIndex) => ({ q, globalIndex }));
    if (paletteScope === 'subject' && currentQuestion) {
      return entries
        .filter((e) => e.q.subjectId === currentQuestion.subjectId)
        .map((e, subIdx) => ({ ...e, displayNumber: subIdx + 1 }));
    }
    if (paletteScope === 'unanswered') {
      return entries
        .filter((e) => !e.q.selectedOption)
        .map((e) => ({ ...e, displayNumber: e.globalIndex + 1 }));
    }
    if (paletteScope === 'marked') {
      return entries
        .filter((e) => e.q.isMarkedForReview)
        .map((e) => ({ ...e, displayNumber: e.globalIndex + 1 }));
    }
    return entries.map((e) => ({ ...e, displayNumber: e.globalIndex + 1 }));
  }, [questions, paletteScope, currentQuestion]);

  const jumpToSubject = (subjectId: string) => {
    const idx = questions.findIndex((q) => q.subjectId === subjectId);
    if (idx !== -1) setCurrentIndex(idx);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Initializing Standard JAMB CBT Workstation...
          </p>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
        <div className="max-w-md rounded-xl border border-rose-200 bg-white p-6 text-center dark:border-rose-900 dark:bg-slate-900">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-rose-600" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Session Unavailable</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{error}</p>
          <button
            type="button"
            onClick={onExitToDashboard}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Return to Candidate Portal
          </button>
        </div>
      </div>
    );
  }

  if (!session || !currentQuestion) return null;

  const timerUrgent = session.examMode === 'timed' && remainingSeconds <= 300;
  const timerWarning = session.examMode === 'timed' && remainingSeconds > 300 && remainingSeconds <= 600;
  const showPaletteDefault = preferences?.showQuestionPalette !== false;

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Top Standard CBT Workstation Header */}
      <header className="sticky top-0 z-30 border-b border-blue-950 bg-[#0F2447] text-white shadow-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2.5">
          {/* Candidate & Paper Identity */}
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white sm:flex">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-display text-sm font-bold text-white sm:text-base">
                  {session.examTitle}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-blue-200">
                {candidate && (
                  <>
                    <span className="font-semibold text-white">{candidate.fullName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-emerald-300">{candidate.registrationNumber}</span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span>{session.examMode === 'revision' ? 'Untimed Study Mode' : 'Timed UTME Mode'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {counts.answered}/{counts.total} Answered
                </span>
                <span aria-hidden="true">·</span>
                <span className={savingStatus === 'error' ? 'text-rose-300' : 'text-emerald-300'}>
                  {savingStatus === 'saving'
                    ? 'Saving...'
                    : savingStatus === 'saved'
                    ? 'Saved'
                    : savingStatus === 'error'
                    ? 'Retry Save'
                    : 'Synced'}
                </span>
              </div>
            </div>
          </div>

          {/* Workstation Controls & Timer */}
          <div className="flex items-center gap-2">
            {session.examMode === 'timed' ? (
              <div
                aria-label="Time remaining"
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-sm font-bold tabular-nums sm:text-base ${
                  timerUrgent
                    ? 'border-rose-400 bg-rose-600 text-white'
                    : timerWarning
                    ? 'border-amber-400 bg-amber-500 text-slate-950'
                    : 'border-blue-700 bg-[#0A1D3D] text-white'
                }`}
              >
                <Clock className="h-4 w-4 shrink-0" />
                <span>{formatDuration(remainingSeconds)}</span>
              </div>
            ) : (
              <div className="hidden items-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-950/60 px-3 py-1.5 text-xs font-semibold text-emerald-300 sm:flex">
                <span>Untimed Revision</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setLargeFont((v) => !v)}
              title="Toggle question text size"
              className="hidden rounded-lg border border-blue-700 bg-[#0A1D3D] px-2.5 py-1.5 font-mono text-xs font-bold text-blue-100 hover:bg-blue-900 sm:inline-flex"
            >
              {largeFont ? 'A-' : 'A+'}
            </button>

            <button
              type="button"
              onClick={() => setShowInstructions(true)}
              className="hidden items-center gap-1.5 rounded-lg border border-blue-700 bg-[#0A1D3D] px-3 py-1.5 text-xs font-semibold text-blue-100 hover:bg-blue-900 md:inline-flex"
            >
              <Info className="h-3.5 w-3.5" />
              <span>Help</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCalculator(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-700 bg-[#0A1D3D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-900 sm:text-sm"
            >
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">Calculator</span>
            </button>

            <button
              type="button"
              onClick={() => setShowMobilePalette(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-700 bg-[#0A1D3D] px-2.5 py-1.5 text-xs font-semibold text-white lg:hidden"
            >
              <Grid className="h-4 w-4" />
              <span>Grid</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConfirmSubmit(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700 sm:text-sm"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Submit</span>
            </button>
          </div>
        </div>

        {/* Standard 4-Subject UTME Navigation Tab Strip */}
        <div className="border-t border-blue-900/80 bg-[#0A1D3D]">
          <div className="mx-auto flex max-w-7xl items-center gap-1.5 overflow-x-auto px-4 py-2">
            {subjectSummaries.map((sub) => {
              const isCurrentSub = currentQuestion.subjectId === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => jumpToSubject(sub.id)}
                  className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    isCurrentSub
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-blue-950/60 text-blue-200 hover:bg-blue-900/80 hover:text-white'
                  }`}
                >
                  <span>{sub.name}</span>
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      isCurrentSub ? 'text-blue-100' : 'text-blue-300'
                    }`}
                  >
                    {sub.answered}/{sub.total}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-auto mt-3 w-full max-w-7xl px-4">
          <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="font-semibold underline">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Two-Column Standard CBT Workstation */}
      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-5 p-4 lg:grid-cols-12 lg:py-6">
        {/* Left/Center Examination Question Stage */}
        <section className={showPaletteDefault ? 'lg:col-span-8' : 'lg:col-span-12'}>
          <div className="flex h-full flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-7 dark:border-slate-800 dark:bg-slate-900">
            <div>
              {/* Question Header Metadata */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-base font-bold text-[#0F2447] sm:text-lg dark:text-white">
                      {currentQuestion.subjectName} — Question {subjectPosition.indexInSubject} of{' '}
                      {subjectPosition.totalInSubject}
                    </h2>
                    {currentQuestion.isMarkedForReview && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                        <Bookmark className="h-3.5 w-3.5 fill-current" />
                        Flagged
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Overall #{currentIndex + 1} of {questions.length} · {currentQuestion.topicName} ·{' '}
                    {currentQuestion.difficulty} ·{' '}
                    {currentQuestion.questionSource === 'verified_past_question'
                      ? `Verified Past Question${currentQuestion.examYear ? ` (${currentQuestion.examYear})` : ''}`
                      : 'Sample Practice Question'}
                  </p>
                </div>

                <span className="font-mono text-xs font-bold text-slate-500 tabular-nums dark:text-slate-400">
                  {Math.round((counts.answered / Math.max(1, counts.total)) * 100)}% Completed
                </span>
              </div>

              {/* Question Stem */}
              <div
                className={`mt-6 mb-6 leading-relaxed font-medium text-slate-900 dark:text-slate-100 ${
                  largeFont ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'
                }`}
              >
                {currentQuestion.questionText}
              </div>

              {currentQuestion.questionImageUrl && (
                <div className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
                  <img
                    src={currentQuestion.questionImageUrl}
                    alt={`Diagram for question ${currentIndex + 1}`}
                    referrerPolicy="no-referrer"
                    className="mx-auto max-h-72 object-contain"
                  />
                </div>
              )}

              {/* Radio-Style Options A - D */}
              <div className="space-y-3" role="radiogroup" aria-label="Answer options">
                {currentQuestion.options.map((opt) => {
                  const isSelected = currentQuestion.selectedOption === opt.label;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => handleSelectOption(opt.label as 'A' | 'B' | 'C' | 'D')}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/90 text-slate-950 dark:border-blue-500 dark:bg-blue-950/60 dark:text-white'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border font-mono text-xs font-bold ${
                            isSelected
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {opt.label}
                        </span>
                        <span
                          className={`pt-0.5 ${
                            largeFont ? 'text-base sm:text-lg' : 'text-sm sm:text-base'
                          }`}
                        >
                          {opt.text}
                        </span>
                      </div>
                      {isSelected && <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Standard 8-Key CBT Footer Controls */}
            <div className="mt-8 border-t border-slate-200 pt-5 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleMark}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${
                      currentQuestion.isMarkedForReview
                        ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <Bookmark className="h-4 w-4" />
                    <span>{currentQuestion.isMarkedForReview ? 'Unmark' : 'Mark'}</span>
                  </button>

                  {currentQuestion.selectedOption && (
                    <button
                      type="button"
                      onClick={() => handleSelectOption(null)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                      Clear Choice
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {currentIndex < questions.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      <span>Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowConfirmSubmit(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      <span>Finish &amp; Submit</span>
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                CBT Keys: <span className="font-mono font-semibold">A–D</span> Select ·{' '}
                <span className="font-mono font-semibold">N / →</span> Next ·{' '}
                <span className="font-mono font-semibold">P / ←</span> Previous ·{' '}
                <span className="font-mono font-semibold">M</span> Flag ·{' '}
                <span className="font-mono font-semibold">C</span> Calculator ·{' '}
                <span className="font-mono font-semibold">S</span> Submit
              </p>
            </div>
          </div>
        </section>

        {/* Right Question Number Grid & Candidate Progress Panel (Desktop) */}
        {showPaletteDefault && (
          <aside className="hidden lg:col-span-4 lg:block">
            <div className="sticky top-28 space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-[#0F2447] dark:text-white">
                    Question Navigation Grid
                  </h3>
                  <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums dark:text-slate-400">
                    {counts.answered}/{counts.total}
                  </span>
                </div>

                {/* Scope Filter Segmented Control */}
                <div className="mb-4 grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1 text-[11px] font-semibold dark:bg-slate-800">
                  {(
                    [
                      ['subject', 'Subject'],
                      ['all', 'All'],
                      ['unanswered', 'Open'],
                      ['marked', 'Flagged'],
                    ] as Array<[PaletteScope, string]>
                  ).map(([scopeKey, label]) => (
                    <button
                      key={scopeKey}
                      type="button"
                      onClick={() => setPaletteScope(scopeKey)}
                      className={`rounded-md py-1.5 transition-colors ${
                        paletteScope === scopeKey
                          ? 'bg-white text-[#0F2447] shadow-xs dark:bg-slate-900 dark:text-white'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {visiblePaletteEntries.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    No questions match this filter.
                  </p>
                ) : (
                  <div className="grid max-h-[290px] grid-cols-5 gap-2 overflow-y-auto pr-1">
                    {visiblePaletteEntries.map(({ q, globalIndex, displayNumber }) => {
                      const isCurrent = globalIndex === currentIndex;
                      let cls =
                        'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
                      if (isCurrent) {
                        cls = 'border-blue-700 bg-blue-600 text-white ring-2 ring-blue-300 dark:ring-blue-800';
                      } else if (q.isMarkedForReview) {
                        cls = 'border-amber-500 bg-amber-500 text-white';
                      } else if (q.selectedOption) {
                        cls = 'border-emerald-600 bg-emerald-600 text-white';
                      }
                      return (
                        <button
                          key={q.questionId}
                          type="button"
                          onClick={() => setCurrentIndex(globalIndex)}
                          title={`${q.subjectCode} #${displayNumber}${q.selectedOption ? ` (Answered ${q.selectedOption})` : ''}`}
                          className={`relative flex h-9 items-center justify-center rounded-lg border font-mono text-xs font-bold tabular-nums transition-colors ${cls}`}
                        >
                          {displayNumber}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Legend & Counts */}
                <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-200 pt-4 text-center dark:border-slate-800">
                  <div className="rounded-lg bg-emerald-50 p-2 dark:bg-emerald-950/40">
                    <p className="font-mono text-base font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
                      {counts.answered}
                    </p>
                    <p className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">Answered</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-2 dark:bg-amber-950/40">
                    <p className="font-mono text-base font-bold text-amber-700 tabular-nums dark:text-amber-400">
                      {counts.marked}
                    </p>
                    <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300">Flagged</p>
                  </div>
                  <div className="rounded-lg bg-slate-100 p-2 dark:bg-slate-800">
                    <p className="font-mono text-base font-bold text-slate-700 tabular-nums dark:text-slate-200">
                      {counts.unanswered}
                    </p>
                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Remaining</p>
                  </div>
                </div>

                {/* Subject Progress Summary */}
                {subjectSummaries.length > 1 && (
                  <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-4 text-xs dark:border-slate-800">
                    {subjectSummaries.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => jumpToSubject(s.id)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70"
                      >
                        <span className="truncate font-medium text-slate-700 dark:text-slate-300">{s.name}</span>
                        <span className="font-mono font-semibold text-slate-900 tabular-nums dark:text-white">
                          {s.answered}/{s.total}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowConfirmSubmit(true)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 py-2.5 text-sm font-bold text-white hover:bg-rose-700"
                >
                  <Send className="h-4 w-4" />
                  <span>Submit Examination</span>
                </button>
              </div>
            </div>
          </aside>
        )}
      </main>

      {/* Mobile Palette Drawer */}
      {showMobilePalette && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/55 lg:hidden">
          <div className="w-full rounded-t-2xl border-t border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Question Grid ({counts.answered}/{counts.total})
              </h3>
              <button
                type="button"
                onClick={() => setShowMobilePalette(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid max-h-64 grid-cols-6 gap-2 overflow-y-auto">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                let cls =
                  'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
                if (isCurrent) cls = 'border-blue-700 bg-blue-600 text-white';
                else if (q.isMarkedForReview) cls = 'border-amber-500 bg-amber-500 text-white';
                else if (q.selectedOption) cls = 'border-emerald-600 bg-emerald-600 text-white';
                return (
                  <button
                    key={q.questionId}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowMobilePalette(false);
                    }}
                    className={`flex h-10 items-center justify-center rounded-lg border font-mono text-xs font-bold ${cls}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Instructions Modal */}
      {showInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-display text-lg font-bold text-[#0F2447] dark:text-white">
              JAMB UTME CBT Instructions
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li>1. Select options using your mouse or keyboard keys <strong>A, B, C, D</strong>.</li>
              <li>2. Move between questions using <strong>N / Right Arrow</strong> (Next) and <strong>P / Left Arrow</strong> (Previous).</li>
              <li>3. Press <strong>M</strong> to flag uncertain questions for quick review in the Question Grid.</li>
              <li>4. Press <strong>C</strong> to open the built-in CBT Calculator at any time.</li>
              <li>5. Every selection is automatically saved to PostgreSQL. Refreshing restores your active timer and saved answers.</li>
            </ul>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Continue Examination
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Submit Modal with Subject-by-Subject Attempt Audit */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-display text-lg font-bold text-[#0F2447] dark:text-white">
              End &amp; Submit Examination?
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Review your subject completion below before final submission. Submitted scripts are graded immediately on the server.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-700 dark:bg-slate-950">
              <div>
                <p className="font-mono text-lg font-bold text-emerald-600 tabular-nums">{counts.answered}</p>
                <p className="text-xs text-slate-500">Answered</p>
              </div>
              <div>
                <p className="font-mono text-lg font-bold text-amber-600 tabular-nums">{counts.marked}</p>
                <p className="text-xs text-slate-500">Flagged</p>
              </div>
              <div>
                <p className="font-mono text-lg font-bold text-slate-700 tabular-nums dark:text-slate-300">
                  {counts.unanswered}
                </p>
                <p className="text-xs text-slate-500">Unanswered</p>
              </div>
            </div>

            {subjectSummaries.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Subject</th>
                      <th className="px-3 py-2 text-right font-semibold">Answered</th>
                      <th className="px-3 py-2 text-right font-semibold">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {subjectSummaries.map((s) => (
                      <tr key={s.id}>
                        <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{s.name}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-600 tabular-nums">
                          {s.answered}/{s.total}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600 tabular-nums dark:text-slate-400">
                          {s.unanswered}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmSubmit(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
              >
                Return to Exam
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitExam}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {submitting ? 'Grading...' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CalculatorModal isOpen={showCalculator} onClose={() => setShowCalculator(false)} />
    </div>
  );
}
