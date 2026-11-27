import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  Calculator,
  Grid,
  HelpCircle,
  LogOut,
  X,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { formatDuration } from '../../lib/pdfReport.ts';
import { AuthUser, ExamQuestionItem, ExamSessionDetail, UserPreferences } from '../../types/index.ts';
import BrandEmblem from '../common/BrandEmblem.tsx';
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

  // Standard CBT keyboard shortcuts
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
      <div className="flex min-h-screen items-center justify-center bg-[#F2F4F7] dark:bg-slate-950">
        <div className="rounded-md border border-[#CBD5E1] bg-white px-8 py-6 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold text-[#111827] dark:text-slate-200">
            Loading Examination Session...
          </p>
        </div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F2F4F7] p-4 dark:bg-slate-950">
        <div className="max-w-md rounded-md border border-rose-300 bg-white p-6 text-center dark:border-rose-900 dark:bg-slate-900">
          <AlertTriangle className="mx-auto mb-3 h-9 w-9 text-rose-700" />
          <h2 className="text-base font-bold text-[#111827] dark:text-white">Examination Unavailable</h2>
          <p className="mt-1 text-sm text-[#4B5563] dark:text-slate-400">{error}</p>
          <button
            type="button"
            onClick={onExitToDashboard}
            className="mt-4 min-h-[44px] rounded-md bg-[#0B5E2E] px-4 py-2 text-sm font-bold text-white hover:bg-[#084722]"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!session || !currentQuestion) return null;

  const showPaletteDefault = preferences?.showQuestionPalette !== false;

  return (
    <div className="flex min-h-screen flex-col bg-[#F2F4F7] text-[#111827] dark:bg-slate-950 dark:text-slate-100">
      {/* Official Deep Green CBT Header */}
      <header className="sticky top-0 z-30 border-b border-[#CBD5E1] bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="bg-[#0B5E2E] text-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <BrandEmblem sizeClass="h-9 w-9" />
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-bold text-white sm:text-base">
                  Pre-JAMB Academy CBT
                </p>
                <p className="truncate text-[11px] font-medium text-emerald-100">
                  {session.examTitle}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3 sm:gap-4">
              {candidate && (
                <div className="hidden text-right sm:block">
                  <p className="text-xs font-bold text-white uppercase">
                    Candidate: {candidate.fullName}
                  </p>
                  <p className="font-mono text-[11px] text-emerald-100 tabular-nums">
                    Reg. No: {candidate.registrationNumber}
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={onExitToDashboard}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-md border border-white/40 bg-[#094D25] px-3 text-xs font-bold text-white hover:bg-[#084722]"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Exit</span>
              </button>
            </div>
          </div>
        </div>

        {/* Light Grey Sub-Header: Active Subject, Countdown Clock, Tools */}
        <div className="border-b border-[#CBD5E1] bg-[#F3F4F6] dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="font-display text-sm font-bold text-[#111827] sm:text-base dark:text-white">
                {currentQuestion.subjectName}
              </span>
              <span className="text-xs text-[#4B5563] dark:text-slate-400">
                ({counts.answered}/{counts.total} Answered ·{' '}
                {savingStatus === 'saving'
                  ? 'Saving...'
                  : savingStatus === 'error'
                  ? 'Save failed'
                  : 'Saved'}
                )
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {session.examMode === 'timed' ? (
                <div
                  aria-label="Time Remaining"
                  className="flex h-9 items-center gap-2 rounded-md border border-[#CBD5E1] bg-white px-3 dark:border-slate-700 dark:bg-slate-800"
                >
                  <span className="hidden text-xs font-semibold text-[#374151] sm:inline dark:text-slate-300">
                    Time Remaining:
                  </span>
                  <span className="font-mono text-sm font-bold text-[#DC2626] tabular-nums sm:text-base dark:text-rose-400">
                    {formatDuration(remainingSeconds)}
                  </span>
                </div>
              ) : (
                <div className="flex h-9 items-center rounded-md border border-emerald-300 bg-emerald-50 px-3 text-xs font-bold text-[#0B5E2E] dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Study Mode
                </div>
              )}

              <button
                type="button"
                onClick={() => setLargeFont((v) => !v)}
                title="Change text size"
                className="hidden h-9 items-center justify-center rounded-md border border-[#CBD5E1] bg-white px-2.5 font-mono text-xs font-bold text-[#111827] hover:bg-slate-50 sm:inline-flex dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {largeFont ? 'A-' : 'A+'}
              </button>

              <button
                type="button"
                onClick={() => setShowInstructions(true)}
                title="Exam Help"
                className="hidden h-9 items-center gap-1 rounded-md border border-[#CBD5E1] bg-white px-2.5 text-xs font-semibold text-[#111827] hover:bg-slate-50 md:inline-flex dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <HelpCircle className="h-3.5 w-3.5 text-[#0B5E2E]" />
                <span>Help</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCalculator(true)}
                aria-label="Open Calculator"
                className="inline-flex h-9 items-center gap-1 rounded-md border border-[#CBD5E1] bg-white px-2.5 text-xs font-semibold text-[#111827] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <Calculator className="h-3.5 w-3.5 text-[#0B5E2E]" />
                <span className="hidden sm:inline">Calculator</span>
              </button>

              <button
                type="button"
                onClick={() => setShowConfirmSubmit(true)}
                className="inline-flex h-9 items-center justify-center rounded-md bg-[#0B5E2E] px-3 text-xs font-bold text-white hover:bg-[#084722]"
              >
                Submit
              </button>
            </div>
          </div>
        </div>

        {/* 4-Subject Navigation Tabs */}
        {subjectSummaries.length > 1 && (
          <div className="bg-white dark:bg-slate-950">
            <div className="mx-auto flex max-w-7xl items-center gap-1.5 overflow-x-auto px-4 py-1.5 sm:px-5">
              {subjectSummaries.map((sub) => {
                const isCurrentSub = currentQuestion.subjectId === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => jumpToSubject(sub.id)}
                    className={`flex min-h-[34px] shrink-0 items-center gap-2 rounded-md border px-3 py-1 text-xs font-bold whitespace-nowrap ${
                      isCurrentSub
                        ? 'border-[#0B5E2E] bg-[#0B5E2E] text-white'
                        : 'border-[#CBD5E1] bg-[#F8FAFC] text-[#111827] hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
                    }`}
                  >
                    <span>{sub.name}</span>
                    <span
                      className={`font-mono text-[11px] tabular-nums ${
                        isCurrentSub ? 'text-emerald-100' : 'text-[#4B5563] dark:text-slate-400'
                      }`}
                    >
                      {sub.answered}/{sub.total}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
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

      {/* Main Two-Column CBT Workspace */}
      <main className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 gap-4 px-4 py-4 pb-24 sm:px-5 lg:grid-cols-12 lg:py-5 lg:pb-6">
        {/* Left: Question Area */}
        <section className={showPaletteDefault ? 'lg:col-span-8' : 'lg:col-span-12'}>
          <div className="flex h-full flex-col justify-between overflow-hidden rounded-md border border-[#CBD5E1] bg-white dark:border-slate-800 dark:bg-slate-900">
            <div>
              {/* Light Blue Question Number Banner (Authentic JAMB CBT Style) */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#CBD5E1] bg-[#DCEAFB] px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="font-display text-sm font-bold text-[#111827] sm:text-base dark:text-white">
                    Question {subjectPosition.indexInSubject} of {subjectPosition.totalInSubject}
                  </h1>
                  <span className="text-xs font-medium text-[#374151] dark:text-slate-300">
                    ({currentQuestion.topicName} ·{' '}
                    {currentQuestion.questionSource === 'verified_past_question'
                      ? `UTME ${currentQuestion.examYear || 'Past Question'}`
                      : 'Practice Question'}
                    )
                  </span>
                  {currentQuestion.isMarkedForReview && (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                      <Bookmark className="h-3 w-3 fill-current" />
                      Marked
                    </span>
                  )}
                </div>

                {currentQuestion.selectedOption && (
                  <button
                    type="button"
                    onClick={() => handleSelectOption(null)}
                    className="min-h-[30px] rounded-md border border-[#94A3B8] bg-white px-2.5 text-xs font-semibold text-[#111827] hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                  >
                    Clear Answer
                  </button>
                )}
              </div>

              <div className="p-4 sm:p-6">
                {/* Question Stem */}
                <div
                  className={`mb-5 leading-[1.65] font-medium whitespace-pre-line text-[#111827] dark:text-slate-100 ${
                    largeFont ? 'text-lg sm:text-xl' : 'text-base sm:text-[17px]'
                  }`}
                >
                  {currentQuestion.questionText}
                </div>

                {currentQuestion.questionImageUrl && (
                  <div className="mb-5 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] p-3 dark:border-slate-700 dark:bg-slate-950">
                    <img
                      src={currentQuestion.questionImageUrl}
                      alt={`Diagram for question ${currentIndex + 1}`}
                      referrerPolicy="no-referrer"
                      className="mx-auto max-h-64 object-contain"
                    />
                  </div>
                )}

                {/* Radio Answer Options A - D */}
                <div className="space-y-2.5" role="radiogroup" aria-label="Answer choices">
                  {currentQuestion.options.map((opt) => {
                    const isSelected = currentQuestion.selectedOption === opt.label;
                    return (
                      <label
                        key={opt.label}
                        className={`flex min-h-[48px] w-full cursor-pointer items-center gap-3 rounded-md border px-3.5 py-2.5 ${
                          isSelected
                            ? 'border-[#0B5E2E] bg-emerald-50 text-[#111827] dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-white'
                            : 'border-[#E5E7EB] bg-white text-[#111827] hover:bg-[#F9FAFB] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`question-${currentQuestion.questionId}`}
                          checked={isSelected}
                          onChange={() => handleSelectOption(opt.label as 'A' | 'B' | 'C' | 'D')}
                          className="h-4 w-4 shrink-0 accent-[#0B5E2E]"
                        />
                        <span className="font-mono text-sm font-bold text-[#111827] dark:text-white">
                          {opt.label}.
                        </span>
                        <span className={`whitespace-pre-line ${largeFont ? 'text-base sm:text-lg' : 'text-sm sm:text-base'}`}>
                          {opt.text}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Desktop Examination Controls */}
            <div className="hidden border-t border-[#E5E7EB] bg-[#F9FAFB] px-6 py-4 lg:block dark:border-slate-800 dark:bg-slate-950">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    disabled={currentIndex === 0}
                    onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                    className="inline-flex min-h-[42px] items-center justify-center rounded-md bg-[#0B5E2E] px-5 py-2 text-sm font-bold text-white hover:bg-[#084722] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    &lt;&lt; Previous
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleMark}
                    className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-semibold ${
                      currentQuestion.isMarkedForReview
                        ? 'border-amber-600 bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'border-[#CBD5E1] bg-white text-[#111827] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <Bookmark className="h-4 w-4" />
                    <span>{currentQuestion.isMarkedForReview ? 'Marked' : 'Mark'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2.5">
                  {currentIndex < questions.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                      className="inline-flex min-h-[42px] items-center justify-center rounded-md bg-[#0B5E2E] px-6 py-2 text-sm font-bold text-white hover:bg-[#084722]"
                    >
                      Next &gt;&gt;
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowConfirmSubmit(true)}
                      className="inline-flex min-h-[42px] items-center justify-center rounded-md bg-[#0B5E2E] px-6 py-2 text-sm font-bold text-white hover:bg-[#084722]"
                    >
                      Submit Examination
                    </button>
                  )}
                </div>
              </div>

              <p className="mt-2.5 text-[11px] text-[#4B5563] dark:text-slate-400">
                Shortcuts: A–D select answer · N / → next · P / ← previous · M mark · C calculator · S submit
              </p>
            </div>
          </div>
        </section>

        {/* Right: Question Palette Panel (Desktop right rail + Mobile/Tablet inline below question) */}
        {showPaletteDefault && (
          <aside className="lg:col-span-4">
            <div className="overflow-hidden rounded-md border border-[#CBD5E1] bg-white lg:sticky lg:top-28 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between bg-[#0B5E2E] px-4 py-2.5 text-white">
                <h2 className="font-display text-sm font-bold">Question Palette</h2>
                <span className="font-mono text-xs font-semibold text-emerald-100 tabular-nums">
                  {counts.answered}/{counts.total}
                </span>
              </div>

              <div className="p-4">
                <div className="mb-3 grid grid-cols-4 gap-1 rounded-md border border-[#CBD5E1] bg-[#F2F4F7] p-1 text-[11px] font-bold dark:border-slate-700 dark:bg-slate-800">
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
                          ? 'bg-white text-[#0B5E2E] dark:bg-slate-900 dark:text-emerald-400'
                          : 'text-[#4B5563] hover:text-[#111827] dark:text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {visiblePaletteEntries.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[#4B5563] dark:text-slate-400">
                    No questions in this view.
                  </p>
                ) : (
                  <div className="grid max-h-[260px] grid-cols-5 gap-1.5 overflow-y-auto pr-1">
                    {visiblePaletteEntries.map(({ q, globalIndex, displayNumber }) => {
                      const isCurrent = globalIndex === currentIndex;
                      let cls =
                        'border-[#CBD5E1] bg-white text-[#111827] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
                      if (isCurrent) {
                        cls = 'border-[#2563EB] bg-[#2563EB] text-white';
                      } else if (q.isMarkedForReview) {
                        cls = 'border-[#D97706] bg-[#D97706] text-white';
                      } else if (q.selectedOption) {
                        cls = 'border-[#16A34A] bg-[#16A34A] text-white';
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

                {/* Legend */}
                <div className="mt-4 space-y-1.5 border-t border-[#E5E7EB] pt-3 text-xs dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-xs bg-[#2563EB]" />
                    <span className="text-[#374151] dark:text-slate-300">Current</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-xs bg-[#16A34A]" />
                    <span className="text-[#374151] dark:text-slate-300">Answered ({counts.answered})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-xs border border-[#94A3B8] bg-white dark:bg-slate-800" />
                    <span className="text-[#374151] dark:text-slate-300">Not Answered ({counts.unanswered})</span>
                  </div>
                  {counts.marked > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 rounded-xs bg-[#D97706]" />
                      <span className="text-[#374151] dark:text-slate-300">Marked ({counts.marked})</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowConfirmSubmit(true)}
                  className="mt-4 min-h-[42px] w-full rounded-md bg-[#0B5E2E] py-2 text-sm font-bold text-white hover:bg-[#084722]"
                >
                  Submit Examination
                </button>
              </div>
            </div>
          </aside>
        )}
      </main>

      {/* Clean Institutional Desktop CBT Footer */}
      <footer className="hidden border-t border-[#CBD5E1] bg-[#E5E7EB] px-5 py-2.5 text-xs text-[#374151] lg:block dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <span className="font-semibold">JAMB UTME CBT Examination</span>
          <span className="font-semibold text-[#0B5E2E] dark:text-emerald-400">Pre-JAMB Academy CBT</span>
        </div>
      </footer>

      {/* Mobile Fixed Exam Bottom Controls */}
      <nav className="fixed right-0 bottom-0 left-0 z-30 border-t border-[#CBD5E1] bg-white px-4 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] lg:hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-2">
          <button
            type="button"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            className="flex min-h-[44px] items-center justify-center rounded-md border border-[#CBD5E1] bg-white text-xs font-bold text-[#111827] disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            &lt;&lt; Prev
          </button>

          <button
            type="button"
            onClick={handleToggleMark}
            className={`flex min-h-[44px] items-center justify-center gap-1 rounded-md border text-xs font-bold ${
              currentQuestion.isMarkedForReview
                ? 'border-[#D97706] bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-300'
                : 'border-[#CBD5E1] bg-white text-[#111827] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            <Bookmark className="h-3.5 w-3.5" />
            <span>{currentQuestion.isMarkedForReview ? 'Marked' : 'Mark'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMobilePalette(true)}
            className="flex min-h-[44px] items-center justify-center gap-1 rounded-md border border-[#CBD5E1] bg-[#F2F4F7] text-xs font-bold text-[#111827] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Grid className="h-3.5 w-3.5 text-[#0B5E2E]" />
            <span>Palette</span>
          </button>

          {currentIndex < questions.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
              className="flex min-h-[44px] items-center justify-center rounded-md bg-[#0B5E2E] text-xs font-bold text-white hover:bg-[#084722]"
            >
              Next &gt;&gt;
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowConfirmSubmit(true)}
              className="flex min-h-[44px] items-center justify-center rounded-md bg-[#0B5E2E] text-xs font-bold text-white hover:bg-[#084722]"
            >
              Submit
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Question Palette Sheet */}
      {showMobilePalette && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-slate-950/50 lg:hidden"
          onClick={() => setShowMobilePalette(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-lg border-t border-[#CBD5E1] bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="mb-3 flex items-center justify-between border-b border-[#E5E7EB] pb-2.5 dark:border-slate-800">
              <h3 className="font-display text-sm font-bold text-[#0B5E2E] dark:text-emerald-400">
                Question Palette ({counts.answered}/{counts.total} Answered)
              </h3>
              <button
                type="button"
                onClick={() => setShowMobilePalette(false)}
                aria-label="Close question palette"
                className="flex h-10 w-10 items-center justify-center rounded-md text-[#4B5563] hover:bg-slate-100 dark:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid max-h-60 grid-cols-5 gap-2 overflow-y-auto">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                let cls =
                  'border-[#CBD5E1] bg-white text-[#111827] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
                if (isCurrent) cls = 'border-[#2563EB] bg-[#2563EB] text-white';
                else if (q.isMarkedForReview) cls = 'border-[#D97706] bg-[#D97706] text-white';
                else if (q.selectedOption) cls = 'border-[#16A34A] bg-[#16A34A] text-white';
                return (
                  <button
                    key={q.questionId}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowMobilePalette(false);
                    }}
                    className={`flex h-11 items-center justify-center rounded-sm border font-mono text-xs font-bold tabular-nums ${cls}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 border-t border-[#E5E7EB] pt-2.5 text-xs text-[#374151] dark:border-slate-800 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-xs bg-[#2563EB]" /> Current</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-xs bg-[#16A34A]" /> Answered</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-xs border border-[#94A3B8] bg-white dark:bg-slate-800" /> Not Answered</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-xs bg-[#D97706]" /> Marked</span>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-md border border-[#CBD5E1] bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-display text-base font-bold text-[#0B5E2E] dark:text-emerald-400">
              CBT Examination Guide
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-[#374151] dark:text-slate-300">
              <li>1. Select an option or press keys <strong>A, B, C, or D</strong> to choose your answer.</li>
              <li>2. Use <strong>&lt;&lt; Previous</strong> and <strong>Next &gt;&gt;</strong> (or arrow keys) to move between questions.</li>
              <li>3. Click <strong>Mark</strong> (or press <strong>M</strong>) to flag a question to review later.</li>
              <li>4. Click <strong>Calculator</strong> (or press <strong>C</strong>) when needed.</li>
              <li>5. Every selection is saved automatically to the server.</li>
            </ul>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                className="min-h-[42px] rounded-md bg-[#0B5E2E] px-4 py-2 text-sm font-bold text-white hover:bg-[#084722]"
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
          <div className="w-full max-w-lg rounded-md border border-[#CBD5E1] bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-display text-lg font-bold text-[#111827] dark:text-white">
              Submit Examination?
            </h3>
            <p className="mt-1 text-sm text-[#4B5563] dark:text-slate-400">
              Review your progress below. Once submitted, your UTME score out of 400 will be calculated immediately.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-md border border-[#CBD5E1] bg-[#F2F4F7] p-3 text-center dark:border-slate-700 dark:bg-slate-950">
              <div>
                <p className="font-mono text-lg font-bold text-[#16A34A] tabular-nums">{counts.answered}</p>
                <p className="text-xs text-[#4B5563] dark:text-slate-400">Answered</p>
              </div>
              <div>
                <p className="font-mono text-lg font-bold text-[#111827] tabular-nums dark:text-slate-200">
                  {counts.unanswered}
                </p>
                <p className="text-xs text-[#4B5563] dark:text-slate-400">Not Answered</p>
              </div>
              <div>
                <p className="font-mono text-lg font-bold text-[#D97706] tabular-nums">{counts.marked}</p>
                <p className="text-xs text-[#4B5563] dark:text-slate-400">Marked</p>
              </div>
            </div>

            {subjectSummaries.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-md border border-[#CBD5E1] dark:border-slate-700">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#CBD5E1] bg-[#F2F4F7] text-[#374151] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Subject</th>
                      <th className="px-3 py-2 text-right font-semibold">Answered</th>
                      <th className="px-3 py-2 text-right font-semibold">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] dark:divide-slate-800">
                    {subjectSummaries.map((s) => (
                      <tr key={s.id}>
                        <td className="px-3 py-2 font-medium text-[#111827] dark:text-slate-200">{s.name}</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-[#16A34A] tabular-nums">
                          {s.answered}/{s.total}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[#4B5563] tabular-nums dark:text-slate-400">
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
                className="min-h-[44px] rounded-md border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Continue Examination
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmitExam}
                className="min-h-[44px] rounded-md bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-60"
              >
                {submitting ? 'Submitting...' : 'Confirm Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <CalculatorModal isOpen={showCalculator} onClose={() => setShowCalculator(false)} />
    </div>
  );
}
