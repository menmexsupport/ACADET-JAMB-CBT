import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Clock,
  Grid,
  HelpCircle,
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
    void loadSession();
  }, [loadSession]);

  const handleSubmitExam = useCallback(async () => {
    if (submitting) return;
    try {
      setSubmitting(true);
      await apiFetch(`/api/exams/sessions/${sessionId}/submit`, { method: 'POST' });
      onCompleted(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
      setSubmitting(false);
    }
  }, [sessionId, submitting, onCompleted]);

  // Countdown timer synced with server remaining seconds
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
        setError(err instanceof Error ? err.message : 'Unable to save your answer.');
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

  // Standard 8-key CBT keyboard shortcuts
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
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6F8] dark:bg-slate-950">
        <div className="rounded-lg border border-slate-300 bg-white px-8 py-6 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Loading Examination...
          </p>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6F8] p-4 dark:bg-slate-950">
        <div className="max-w-md rounded-lg border border-rose-300 bg-white p-6 text-center dark:border-rose-900 dark:bg-slate-900">
          <AlertTriangle className="mx-auto mb-3 h-9 w-9 text-rose-700" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Examination Unavailable</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{error}</p>
          <button
            type="button"
            onClick={onExitToDashboard}
            className="mt-4 min-h-[44px] rounded-md bg-[#0F2447] px-4 py-2 text-sm font-semibold text-white"
          >
            Back to Home
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
    <div className="flex min-h-screen flex-col bg-[#F4F6F8] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Top Examination Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-300 bg-[#0F2447] text-white dark:border-slate-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2 sm:px-5">
          {/* Exam Identity & Status */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="hidden text-xs font-bold tracking-wide text-blue-200 sm:inline">
                Acadet CBT JAMB
              </span>
              <span className="hidden text-blue-500 sm:inline">|</span>
              <p className="truncate font-display text-sm font-bold text-white">
                {session.examTitle}
              </p>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-blue-200">
              {candidate && (
                <>
                  <span className="hidden font-medium text-white sm:inline">{candidate.fullName}</span>
                  <span className="hidden sm:inline" aria-hidden="true">·</span>
                </>
              )}
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
                  ? 'Save failed'
                  : 'Auto-save ready'}
              </span>
            </div>
          </div>

          {/* Countdown Timer & Exam Tools */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {session.examMode === 'timed' ? (
              <div
                aria-label="Countdown timer"
                className={`flex h-9 items-center gap-1.5 rounded-md border px-2.5 font-mono text-sm font-bold tabular-nums sm:px-3 ${
                  timerUrgent
                    ? 'border-rose-400 bg-rose-700 text-white'
                    : timerWarning
                    ? 'border-amber-400 bg-amber-500 text-slate-950'
                    : 'border-blue-700 bg-[#0A1D3D] text-white'
                }`}
              >
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>{formatDuration(remainingSeconds)}</span>
              </div>
            ) : (
              <div className="hidden h-9 items-center rounded-md border border-emerald-700 bg-emerald-950 px-2.5 text-xs font-semibold text-emerald-300 sm:flex">
                Study Mode
              </div>
            )}

            <button
              type="button"
              onClick={() => setLargeFont((v) => !v)}
              title="Change text size"
              className="hidden h-9 items-center justify-center rounded-md border border-blue-700 bg-[#0A1D3D] px-2.5 font-mono text-xs font-bold text-white hover:bg-blue-900 sm:inline-flex"
            >
              {largeFont ? 'A-' : 'A+'}
            </button>

            <button
              type="button"
              onClick={() => setShowInstructions(true)}
              title="Exam Help"
              className="hidden h-9 items-center gap-1 rounded-md border border-blue-700 bg-[#0A1D3D] px-2.5 text-xs font-semibold text-white hover:bg-blue-900 md:inline-flex"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Help</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCalculator(true)}
              aria-label="Open Calculator"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-blue-700 bg-[#0A1D3D] px-2.5 text-xs font-semibold text-white hover:bg-blue-900 sm:px-3"
            >
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">Calculator</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConfirmSubmit(true)}
              className="inline-flex h-9 items-center justify-center rounded-md bg-rose-700 px-3 text-xs font-bold text-white hover:bg-rose-800 sm:px-3.5"
            >
              Submit
            </button>
          </div>
        </div>

        {/* 4-Subject Navigation Tabs */}
        <div className="border-t border-blue-900 bg-[#15315E]">
          <div className="mx-auto flex max-w-7xl items-center gap-1.5 overflow-x-auto px-3 py-1.5 sm:px-5">
            {subjectSummaries.map((sub) => {
              const isCurrentSub = currentQuestion.subjectId === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => jumpToSubject(sub.id)}
                  className={`flex min-h-[36px] shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold ${
                    isCurrentSub
                      ? 'bg-white text-[#0F2447]'
                      : 'bg-[#0F2447]/60 text-blue-100 hover:bg-[#0F2447] hover:text-white'
                  }`}
                >
                  <span>{sub.name}</span>
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      isCurrentSub ? 'text-[#1D4ED8]' : 'text-blue-300'
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
          <div className="flex items-center justify-between rounded-md border border-rose-300 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="font-semibold underline">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main CBT Question Stage + Navigation Grid */}
      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-4 px-3 py-4 pb-20 sm:px-5 lg:grid-cols-12 lg:py-5 lg:pb-6">
        {/* Question Reading & Options Panel */}
        <section className={showPaletteDefault ? 'lg:col-span-8' : 'lg:col-span-12'}>
          <div className="flex h-full flex-col justify-between rounded-lg border border-slate-300 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <div>
              {/* Question Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="font-display text-base font-bold text-[#0F2447] sm:text-lg dark:text-white">
                      {currentQuestion.subjectName} — Question {subjectPosition.indexInSubject} of{' '}
                      {subjectPosition.totalInSubject}
                    </h1>
                    {currentQuestion.isMarkedForReview && (
                      <span className="inline-flex items-center gap-1 rounded-sm bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        <Bookmark className="h-3 w-3 fill-current" />
                        Marked
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Item {currentIndex + 1} of {questions.length} · {currentQuestion.topicName} ·{' '}
                    {currentQuestion.questionSource === 'verified_past_question'
                      ? `Past Question${currentQuestion.examYear ? ` (${currentQuestion.examYear})` : ''}`
                      : 'Practice Question'}
                  </p>
                </div>

                {currentQuestion.selectedOption && (
                  <button
                    type="button"
                    onClick={() => handleSelectOption(null)}
                    className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Clear Choice
                  </button>
                )}
              </div>

              {/* Question Stem */}
              <div
                className={`mt-5 mb-5 leading-relaxed font-medium text-slate-900 dark:text-slate-100 ${
                  largeFont ? 'text-lg sm:text-xl' : 'text-base sm:text-[17px]'
                }`}
              >
                {currentQuestion.questionText}
              </div>

              {currentQuestion.questionImageUrl && (
                <div className="mb-5 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
                  <img
                    src={currentQuestion.questionImageUrl}
                    alt={`Diagram for question ${currentIndex + 1}`}
                    referrerPolicy="no-referrer"
                    className="mx-auto max-h-64 object-contain"
                  />
                </div>
              )}

              {/* Answer Options A - D */}
              <div className="space-y-2.5" role="radiogroup" aria-label="Answer choices">
                {currentQuestion.options.map((opt) => {
                  const isSelected = currentQuestion.selectedOption === opt.label;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => handleSelectOption(opt.label as 'A' | 'B' | 'C' | 'D')}
                      className={`flex min-h-[48px] w-full items-center gap-3.5 rounded-md border px-3.5 py-3 text-left ${
                        isSelected
                          ? 'border-[#1D4ED8] bg-blue-50 text-slate-950 dark:border-blue-500 dark:bg-blue-950/60 dark:text-white'
                          : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border font-mono text-xs font-bold ${
                          isSelected
                            ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white'
                            : 'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </span>
                      <span className={largeFont ? 'text-base sm:text-lg' : 'text-sm sm:text-base'}>
                        {opt.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Desktop Examination Controls */}
            <div className="mt-6 hidden border-t border-slate-200 pt-4 lg:block dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Previous Question</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleMark}
                    className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-semibold ${
                      currentQuestion.isMarkedForReview
                        ? 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <Bookmark className="h-4 w-4" />
                    <span>{currentQuestion.isMarkedForReview ? 'Unmark' : 'Mark Question'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {currentIndex < questions.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                      className="inline-flex min-h-[42px] items-center gap-1.5 rounded-md bg-[#1D4ED8] px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                      <span>Next Question</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowConfirmSubmit(true)}
                      className="inline-flex min-h-[42px] items-center gap-1.5 rounded-md bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                    >
                      <span>Submit Examination</span>
                    </button>
                  )}
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Keyboard shortcuts: A–D select answer · N / → next · P / ← previous · M mark · C calculator · S submit
              </p>
            </div>
          </div>
        </section>

        {/* Desktop Question Navigation Panel */}
        {showPaletteDefault && (
          <aside className="hidden lg:col-span-4 lg:block">
            <div className="sticky top-28 rounded-lg border border-slate-300 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2.5 dark:border-slate-800">
                <h2 className="font-display text-sm font-bold text-[#0F2447] dark:text-white">
                  Question Navigation
                </h2>
                <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums dark:text-slate-400">
                  {counts.answered}/{counts.total} Answered
                </span>
              </div>

              {/* Filter Tabs */}
              <div className="mb-3 grid grid-cols-4 gap-1 rounded-md border border-slate-200 bg-slate-100 p-1 text-[11px] font-semibold dark:border-slate-700 dark:bg-slate-800">
                {(
                  [
                    ['subject', 'Subject'],
                    ['all', 'All'],
                    ['unanswered', 'Open'],
                    ['marked', 'Marked'],
                  ] as Array<[PaletteScope, string]>
                ).map(([scopeKey, label]) => (
                  <button
                    key={scopeKey}
                    type="button"
                    onClick={() => setPaletteScope(scopeKey)}
                    className={`rounded-sm py-1 ${
                      paletteScope === scopeKey
                        ? 'bg-white text-[#0F2447] dark:bg-slate-900 dark:text-white'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {visiblePaletteEntries.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  No questions in this view.
                </p>
              ) : (
                <div className="grid max-h-[260px] grid-cols-5 gap-1.5 overflow-y-auto pr-1">
                  {visiblePaletteEntries.map(({ q, globalIndex, displayNumber }) => {
                    const isCurrent = globalIndex === currentIndex;
                    let cls =
                      'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
                    if (isCurrent) {
                      cls = 'border-[#1D4ED8] bg-[#1D4ED8] text-white ring-2 ring-blue-300 dark:ring-blue-800';
                    } else if (q.isMarkedForReview) {
                      cls = 'border-amber-600 bg-amber-500 text-white';
                    } else if (q.selectedOption) {
                      cls = 'border-emerald-700 bg-emerald-700 text-white';
                    }
                    return (
                      <button
                        key={q.questionId}
                        type="button"
                        onClick={() => setCurrentIndex(globalIndex)}
                        className={`flex h-9 items-center justify-center rounded-sm border font-mono text-xs font-bold tabular-nums ${cls}`}
                      >
                        {displayNumber}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Clear Status Color Legend */}
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-xs bg-emerald-700" />
                  <span className="text-slate-700 dark:text-slate-300">Answered ({counts.answered})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-xs border border-slate-400 bg-white dark:bg-slate-800" />
                  <span className="text-slate-700 dark:text-slate-300">Not Answered ({counts.unanswered})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-xs bg-amber-500" />
                  <span className="text-slate-700 dark:text-slate-300">Marked ({counts.marked})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 rounded-xs bg-[#1D4ED8]" />
                  <span className="text-slate-700 dark:text-slate-300">Current</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowConfirmSubmit(true)}
                className="mt-4 min-h-[42px] w-full rounded-md bg-rose-700 py-2 text-sm font-bold text-white hover:bg-rose-800"
              >
                Submit Examination
              </button>
            </div>
          </aside>
        )}
      </main>

      {/* Mobile Fixed Exam Bottom Controls */}
      <nav className="fixed right-0 bottom-0 left-0 z-30 border-t border-slate-300 bg-white px-2 py-2 lg:hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1.5">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            className="flex min-h-[42px] items-center justify-center gap-1 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-800 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Prev</span>
          </button>

          <button
            type="button"
            onClick={handleToggleMark}
            className={`flex min-h-[42px] items-center justify-center gap-1 rounded-md border text-xs font-semibold ${
              currentQuestion.isMarkedForReview
                ? 'border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                : 'border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <Bookmark className="h-3.5 w-3.5" />
            <span>{currentQuestion.isMarkedForReview ? 'Marked' : 'Mark'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMobilePalette(true)}
            className="flex min-h-[42px] items-center justify-center gap-1 rounded-md border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Grid className="h-3.5 w-3.5" />
            <span>Grid</span>
          </button>

          {currentIndex < questions.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
              className="flex min-h-[42px] items-center justify-center gap-1 rounded-md bg-[#1D4ED8] text-xs font-semibold text-white"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowConfirmSubmit(true)}
              className="flex min-h-[42px] items-center justify-center rounded-md bg-emerald-700 text-xs font-semibold text-white"
            >
              Submit
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Question Navigation Sheet */}
      {showMobilePalette && (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 lg:hidden">
          <div className="w-full rounded-t-xl border-t border-slate-300 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2.5 dark:border-slate-800">
              <h3 className="font-display text-sm font-bold text-[#0F2447] dark:text-white">
                Question Grid ({counts.answered}/{counts.total} Answered)
              </h3>
              <button
                type="button"
                onClick={() => setShowMobilePalette(false)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid max-h-60 grid-cols-6 gap-1.5 overflow-y-auto">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                let cls =
                  'border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
                if (isCurrent) cls = 'border-[#1D4ED8] bg-[#1D4ED8] text-white';
                else if (q.isMarkedForReview) cls = 'border-amber-600 bg-amber-500 text-white';
                else if (q.selectedOption) cls = 'border-emerald-700 bg-emerald-700 text-white';
                return (
                  <button
                    key={q.questionId}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowMobilePalette(false);
                    }}
                    className={`flex h-10 items-center justify-center rounded-sm border font-mono text-xs font-bold ${cls}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-200 pt-2.5 text-[11px] dark:border-slate-800">
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-xs bg-emerald-700" /> Answered</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-xs border border-slate-400 bg-white" /> Not Answered</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-xs bg-amber-500" /> Marked</span>
              <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-xs bg-[#1D4ED8]" /> Current</span>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-300 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-display text-base font-bold text-[#0F2447] dark:text-white">
              Examination Guide
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <li>1. Click an option or press keys <strong>A, B, C, or D</strong> to select your answer.</li>
              <li>2. Use <strong>Previous Question</strong> and <strong>Next Question</strong> (or arrow keys) to move between questions.</li>
              <li>3. Click <strong>Mark Question</strong> (or press <strong>M</strong>) to highlight a question to check later.</li>
              <li>4. Click <strong>Calculator</strong> (or press <strong>C</strong>) when you need to calculate.</li>
              <li>5. Your answers save automatically each time you pick an option.</li>
            </ul>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                className="min-h-[42px] rounded-md bg-[#0F2447] px-4 py-2 text-sm font-semibold text-white"
              >
                Continue Examination
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submission Confirmation Modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-300 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-display text-lg font-bold text-[#0F2447] dark:text-white">
              Are you sure you want to submit your examination?
            </h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Check your progress below. Once submitted, your score will be calculated immediately.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-700 dark:bg-slate-950">
              <div>
                <p className="font-mono text-lg font-bold text-emerald-700 tabular-nums">{counts.answered}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Answered</p>
              </div>
              <div>
                <p className="font-mono text-lg font-bold text-slate-800 tabular-nums dark:text-slate-200">
                  {counts.unanswered}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Unanswered</p>
              </div>
              <div>
                <p className="font-mono text-lg font-bold text-amber-600 tabular-nums">{counts.marked}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Marked</p>
              </div>
            </div>

            {subjectSummaries.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Subject</th>
                      <th className="px-3 py-2 text-right font-semibold">Answered</th>
                      <th className="px-3 py-2 text-right font-semibold">Unanswered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {subjectSummaries.map((s) => (
                      <tr key={s.id}>
                        <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{s.name}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-700 tabular-nums">
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

            <div className="mt-5 flex flex-wrap justify-end gap-2.5">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowConfirmSubmit(false)}
                className="min-h-[44px] rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Continue Examination
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitExam}
                className="min-h-[44px] rounded-md bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : 'Submit Examination'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CalculatorModal isOpen={showCalculator} onClose={() => setShowCalculator(false)} />
    </div>
  );
}
