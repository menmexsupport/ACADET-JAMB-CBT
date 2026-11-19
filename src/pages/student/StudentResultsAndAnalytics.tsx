import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BarChart3,
  CheckCircle2,
  Download,
  Eye,
  TrendingUp,
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
    loadResults();
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
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedDetail(null)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Results</span>
          </button>

          <button
            type="button"
            onClick={() => downloadResultPdf(r, student)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Download className="h-4 w-4" />
            <span>Download PDF Report</span>
          </button>
        </div>

        {/* Score Summary Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Graded CBT Performance Report</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white">{r.examTitle}</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Submitted {new Date(r.createdAt).toLocaleString()} · Time Spent {formatDuration(r.timeSpentSeconds)}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/40">
              <p className="text-xs font-medium text-blue-800 dark:text-blue-300">UTME Score</p>
              <p className="mt-1 font-mono text-2xl font-extrabold text-blue-700 tabular-nums dark:text-blue-400">
                {r.scoreOutOf400}/400
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Percentage</p>
              <p className="mt-1 font-mono text-2xl font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
                {Number(r.percentage).toFixed(1)}%
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-medium text-slate-500">Correct</p>
              <p className="mt-1 font-mono text-2xl font-bold text-emerald-600 tabular-nums">{r.correctCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-medium text-slate-500">Wrong</p>
              <p className="mt-1 font-mono text-2xl font-bold text-rose-600 tabular-nums">{r.wrongCount}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-medium text-slate-500">Unanswered</p>
              <p className="mt-1 font-mono text-2xl font-bold text-slate-600 tabular-nums dark:text-slate-300">
                {r.unansweredCount}
              </p>
            </div>
          </div>

          {/* Subject Breakdown */}
          <h3 className="mt-7 font-display text-base font-bold text-slate-900 dark:text-white">
            Subject-by-Subject Breakdown
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(r.subjectBreakdown || []).map((b) => (
              <div key={b.subjectId} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {b.subjectName} ({b.subjectCode})
                  </span>
                  <span className="font-mono text-sm font-bold text-blue-700 tabular-nums dark:text-blue-400">
                    {b.correctCount}/{b.totalQuestions} ({Number(b.percentage).toFixed(0)}%)
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-600"
                    style={{ width: `${Math.min(100, b.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Question-by-Question Review */}
        {selectedDetail.session.allowReview ? (
          <div className="space-y-4">
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Answer Review & Explanations
            </h3>
            {selectedDetail.reviewItems.map((item) => (
              <div
                key={item.questionId}
                className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Q{item.questionOrder} · {item.subjectName} ·{' '}
                    {item.questionSource === 'verified_past_question'
                      ? `Verified Past Question${item.examYear ? ` (${item.examYear})` : ''}`
                      : 'Sample Practice Question'}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold ${
                      item.isCorrect ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {item.isCorrect ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" /> Correct
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4" /> {item.selectedOption ? 'Incorrect' : 'Unanswered'}
                      </>
                    )}
                  </span>
                </div>

                <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">{item.questionText}</p>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {item.options.map((opt) => {
                    const isRight = opt.isCorrect;
                    const isPicked = item.selectedOption === opt.label;
                    let cls = 'border-slate-200 bg-slate-50/70 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300';
                    if (isRight) {
                      cls = 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200';
                    } else if (isPicked && !isRight) {
                      cls = 'border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-200';
                    }
                    return (
                      <div key={opt.label} className={`rounded-lg border px-3 py-2 text-xs ${cls}`}>
                        <span className="font-bold">{opt.label}.</span> {opt.text}
                        {isRight && <span className="ml-1.5 font-bold">(Correct)</span>}
                        {isPicked && !isRight && <span className="ml-1.5 font-bold">(Your Choice)</span>}
                      </div>
                    );
                  })}
                </div>

                {item.explanation && (
                  <p className="mt-3 rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    <span className="font-bold text-slate-900 dark:text-white">Explanation: </span>
                    {item.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            Question-by-question answer review is disabled for this examination by the administrator.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">My Examination Results</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          View your graded CBT attempts, scaled UTME scores out of 400, explanations, and downloadable PDF scorecards.
        </p>
      </div>

      {loading || detailLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Loading results...
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <Award className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-3 font-display text-base font-bold text-slate-900 dark:text-white">No Examination Results Yet</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Complete a CBT practice exam or mock simulation to see your score breakdown here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Examination</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Correct</th>
                  <th className="px-4 py-3 text-right">UTME (/400)</th>
                  <th className="px-4 py-3 text-right">Score</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {results.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3.5 font-medium text-slate-900 dark:text-white">{r.examTitle}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-500 tabular-nums">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums">
                      {r.correctCount}/{r.totalQuestions}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-blue-700 tabular-nums dark:text-blue-400">
                      {r.scoreOutOf400}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-emerald-600 tabular-nums">
                      {Number(r.percentage).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openDetail(r.sessionId)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Review</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadResultPdf(r, student)}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
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
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        Loading performance analytics...
      </div>
    );
  }

  const trend = data?.trend || [];
  const mastery = data?.subjectMastery || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Performance Analytics</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Track score progression over time and subject-level mastery across your CBT attempts.
        </p>
      </div>

      {trend.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <BarChart3 className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-3 font-display text-base font-bold text-slate-900 dark:text-white">Not Enough Attempt Data</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Complete at least one CBT exam to populate score trend and subject mastery charts.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Score Trend SVG Chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">Score Progression Trend</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Percentage accuracy across {trend.length} attempt(s)</p>
              </div>
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>

            <div className="flex h-56 items-end gap-3 border-b border-l border-slate-200 px-3 pt-4 pb-1 dark:border-slate-700">
              {trend.slice(-8).map((pt) => (
                <div key={pt.attemptNumber} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-slate-700 tabular-nums dark:text-slate-300">
                    {pt.percentage.toFixed(0)}%
                  </span>
                  <div className="flex h-36 w-full items-end justify-center">
                    <div
                      className="w-full max-w-[36px] rounded-t-md bg-blue-600 transition-all"
                      style={{ height: `${Math.max(8, pt.percentage)}%` }}
                      title={`${pt.examTitle}: ${pt.percentage}% (${pt.scoreOutOf400}/400)`}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-slate-500">#{pt.attemptNumber}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Subject Mastery Breakdown */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">Subject Mastery Accuracy</h2>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Cumulative accuracy per UTME subject</p>

            <div className="space-y-4">
              {mastery.map((s) => (
                <div key={s.subjectCode}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {s.subjectName} ({s.subjectCode})
                    </span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums dark:text-white">
                      {s.correctCount}/{s.totalQuestions} · {s.accuracy}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full ${
                        s.accuracy >= 70 ? 'bg-emerald-600' : s.accuracy >= 50 ? 'bg-blue-600' : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, s.accuracy)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
