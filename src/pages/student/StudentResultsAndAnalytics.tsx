import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  XCircle,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { downloadResultPdf, formatDuration } from '../../lib/pdfReport.ts';
import { AuthUser, ExamResultItem } from '../../types/index.ts';

interface ReviewItem {
  questionOrder: number;
  questionId: string;
  subjectName: string;
  subjectCode: string;
  questionText: string;
  questionImageUrl: string | null;
  questionSource: string;
  examYear: number | null;
  selectedOption: string | null;
  correctOption: string | null;
  isCorrect: boolean | null;
  explanation: string;
  options: Array<{ label: string; text: string; isCorrect: boolean }>;
}

interface AnalyticsData {
  totalAttempts: number;
  subjectMastery: Array<{
    subjectCode: string;
    subjectName: string;
    attempts: number;
    totalQuestions: number;
    correctCount: number;
    accuracy: number;
  }>;
  trend: Array<{
    attemptNumber: number;
    examTitle: string;
    percentage: number;
    scoreOutOf400: number;
    date: string;
  }>;
}

export function ResultsView({
  student,
  initialSessionId,
  onClearInitialSession,
}: {
  student: AuthUser;
  initialSessionId?: string | null;
  onClearInitialSession?: () => void;
}) {
  const [results, setResults] = useState<ExamResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDetail, setSelectedDetail] = useState<{
    session: { id: string; examTitle: string; allowReview: boolean; submittedAt: string };
    result: ExamResultItem;
    reviewItems: ReviewItem[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadResults = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ results: ExamResultItem[] }>('/api/student/results');
      setResults(res.results);
    } finally {
      setLoading(false);
    }
  }, []);

  const openDetail = useCallback(async (sessionId: string) => {
    try {
      setDetailLoading(true);
      const data = await apiFetch<{
        session: { id: string; examTitle: string; allowReview: boolean; submittedAt: string };
        result: ExamResultItem;
        reviewItems: ReviewItem[];
      }>(`/api/student/results/${sessionId}`);
      setSelectedDetail(data);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  useEffect(() => {
    if (initialSessionId) {
      void openDetail(initialSessionId);
      onClearInitialSession?.();
    }
  }, [initialSessionId, openDetail, onClearInitialSession]);

  if (selectedDetail) {
    const r = selectedDetail.result;
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedDetail(null)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Results</span>
          </button>

          <button
            type="button"
            onClick={() => downloadResultPdf(r, student)}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-md bg-[#0B5E2E] px-4 text-sm font-semibold text-white hover:bg-[#084722]"
          >
            <Download className="h-4 w-4" />
            <span>Download Result Slip (PDF)</span>
          </button>
        </div>

        {/* Examination Result Slip */}
        <div className="rounded-lg border border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <p className="text-xs font-semibold tracking-wide text-[#0B5E2E] uppercase dark:text-emerald-400">
              Pre-JAMB Academy CBT — Examination Result
            </p>
            <h1 className="mt-1 font-display text-xl font-bold text-[#0B5E2E] dark:text-white">{r.examTitle}</h1>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
              <span>
                <strong className="text-slate-900 dark:text-white">Candidate Name:</strong> {student.fullName}
              </span>
              {student.registrationNumber && (
                <span>
                  <strong className="text-slate-900 dark:text-white">Registration No:</strong>{' '}
                  <span className="font-mono">{student.registrationNumber}</span>
                </span>
              )}
              <span>
                <strong className="text-slate-900 dark:text-white">Date:</strong>{' '}
                {new Date(r.createdAt).toLocaleString()}
              </span>
              <span>
                <strong className="text-slate-900 dark:text-white">Time Spent:</strong>{' '}
                {formatDuration(r.timeSpentSeconds)}
              </span>
            </div>
          </div>

          {/* Score Summary Row */}
          <div className="grid grid-cols-2 divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-5 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800">
            <div className="bg-emerald-50/50 p-4 dark:bg-emerald-950/30">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Total Score</p>
              <p className="mt-1 font-mono text-2xl font-bold text-[#0B5E2E] tabular-nums dark:text-emerald-300">
                {r.scoreOutOf400}/400
              </p>
            </div>
            <div className="p-4">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Percentage</p>
              <p className="mt-1 font-mono text-2xl font-bold text-[#0B5E2E] tabular-nums dark:text-emerald-400">
                {Number(r.percentage).toFixed(1)}%
              </p>
            </div>
            <div className="p-4">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Correct</p>
              <p className="mt-1 font-mono text-2xl font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
                {r.correctCount}
              </p>
            </div>
            <div className="p-4">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Wrong</p>
              <p className="mt-1 font-mono text-2xl font-bold text-rose-700 tabular-nums dark:text-rose-400">
                {r.wrongCount}
              </p>
            </div>
            <div className="p-4">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Unanswered</p>
              <p className="mt-1 font-mono text-2xl font-bold text-slate-700 tabular-nums dark:text-slate-300">
                {r.unansweredCount}
              </p>
            </div>
          </div>

          {/* Subject-by-Subject Performance Table */}
          <div className="p-5">
            <h2 className="font-display text-sm font-bold text-[#0B5E2E] dark:text-white">
              Subject Performance Table
            </h2>
            <div className="mt-3 overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5">Subject</th>
                    <th className="px-4 py-2.5 text-right">Questions</th>
                    <th className="px-4 py-2.5 text-right">Correct</th>
                    <th className="px-4 py-2.5 text-right">Score (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {(r.subjectBreakdown || []).map((b) => (
                    <tr key={b.subjectId}>
                      <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                        {b.subjectName} ({b.subjectCode})
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">
                        {b.totalQuestions}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
                        {b.correctCount}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-[#0B5E2E] tabular-nums dark:text-white">
                        {Number(b.percentage).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Question Review & Explanations */}
        {selectedDetail.session.allowReview ? (
          <div className="space-y-3.5">
            <h2 className="font-display text-base font-bold text-[#0B5E2E] dark:text-white">
              Answer Review
            </h2>
            {selectedDetail.reviewItems.map((item) => (
              <div
                key={item.questionId}
                className="rounded-lg border border-slate-300 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Question {item.questionOrder} · {item.subjectName} ·{' '}
                    {item.questionSource === 'verified_past_question'
                      ? `Past Question${item.examYear ? ` (${item.examYear})` : ''}`
                      : 'Practice Question'}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold ${
                      item.isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {item.isCorrect ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" /> Correct
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4" /> {item.selectedOption ? 'Wrong' : 'Unanswered'}
                      </>
                    )}
                  </span>
                </div>

                <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">{item.questionText}</p>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {item.options.map((opt) => {
                    const isRight = opt.isCorrect;
                    const isPicked = item.selectedOption === opt.label;
                    let cls =
                      'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300';
                    if (isRight) {
                      cls =
                        'border-emerald-600 bg-emerald-50 font-semibold text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200';
                    } else if (isPicked && !isRight) {
                      cls =
                        'border-rose-400 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200';
                    }
                    return (
                      <div key={opt.label} className={`rounded-md border px-3 py-2 text-xs ${cls}`}>
                        <span className="font-bold">{opt.label}.</span> {opt.text}
                        {isRight && <span className="ml-1.5 font-bold">(Correct Answer)</span>}
                        {isPicked && !isRight && <span className="ml-1.5 font-bold">(Your Answer)</span>}
                      </div>
                    );
                  })}
                </div>

                {item.explanation && (
                  <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                    <span className="font-bold text-slate-900 dark:text-white">Explanation: </span>
                    {item.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-300 bg-white p-5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            Answer review is turned off for this examination.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold text-[#0B5E2E] sm:text-2xl dark:text-white">My Results</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          View your completed examination scores, subject breakdowns, and explanations.
        </p>
      </div>

      {loading || detailLoading ? (
        <div className="rounded-lg border border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Loading results...
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-lg border border-slate-300 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="font-display text-base font-bold text-slate-900 dark:text-white">No Results Yet</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Complete a practice test or mock examination to view your score here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Examination</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Correct</th>
                  <th className="px-4 py-3 text-right">Score (/400)</th>
                  <th className="px-4 py-3 text-right">%</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {results.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{r.examTitle}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 tabular-nums">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                      {r.correctCount}/{r.totalQuestions}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-[#0B5E2E] tabular-nums dark:text-blue-400">
                      {r.scoreOutOf400}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
                      {Number(r.percentage).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openDetail(r.sessionId)}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadResultPdf(r, student)}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-md bg-[#0B5E2E] px-2.5 text-xs font-semibold text-white hover:bg-[#084722]"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function AnalyticsView() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<AnalyticsData>('/api/student/analytics')
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        Loading performance summary...
      </div>
    );
  }

  const trend = data?.trend || [];
  const mastery = data?.subjectMastery || [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold text-[#0B5E2E] sm:text-2xl dark:text-white">Performance Summary</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Review your scores across each subject and recent examination attempts.
        </p>
      </div>

      {trend.length === 0 ? (
        <div className="rounded-lg border border-slate-300 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="font-display text-base font-bold text-slate-900 dark:text-white">No Examination History Yet</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Finish at least one test to see your subject-by-subject scores here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Subject Accuracy Table */}
          <div className="rounded-lg border border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h2 className="font-display text-sm font-bold text-[#0B5E2E] dark:text-white">Performance by Subject</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5">Subject</th>
                    <th className="px-4 py-2.5 text-right">Correct</th>
                    <th className="px-4 py-2.5 text-right">Accuracy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {mastery.map((s) => (
                    <tr key={s.subjectCode}>
                      <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                        {s.subjectName} ({s.subjectCode})
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums">
                        {s.correctCount}/{s.totalQuestions}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono text-xs font-bold tabular-nums ${
                          s.accuracy >= 70
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : s.accuracy >= 50
                            ? 'text-[#0B5E2E] dark:text-emerald-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {s.accuracy}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Attempt History Table */}
          <div className="rounded-lg border border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h2 className="font-display text-sm font-bold text-[#0B5E2E] dark:text-white">Recent Attempts</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">Examination</th>
                    <th className="px-4 py-2.5 text-right">UTME (/400)</th>
                    <th className="px-4 py-2.5 text-right">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {trend.slice(-10).map((pt) => (
                    <tr key={pt.attemptNumber}>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">#{pt.attemptNumber}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">{pt.examTitle}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-[#0B5E2E] tabular-nums dark:text-blue-400">
                        {pt.scoreOutOf400}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
                        {pt.percentage.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
