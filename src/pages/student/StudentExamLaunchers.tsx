import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  FileQuestion,
  Play,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { SubjectCombinationItem, SubjectItem } from '../../types/index.ts';

interface PracticeBlueprint {
  id: string;
  title: string;
  examType: string;
  description: string;
  durationMinutes: number;
  questionCount: number;
  subjects: SubjectItem[];
}

interface MockExamItem {
  id: string;
  title: string;
  description: string;
  instructions: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  questionCount: number;
  eligibilityYear: number | null;
  windowStatus: 'upcoming' | 'active' | 'ended';
  isRegistered: boolean;
  sessionId: string | null;
  sessionStatus: string | null;
  subjects: SubjectItem[];
}

interface PastQuestionRow {
  id: string;
  subjectCode: string;
  subjectName: string;
  topicName: string;
  questionText: string;
  difficulty: string;
  questionSource: 'sample_practice' | 'verified_past_question';
  examYear: number | null;
  explanation: string;
  options: Array<{ label: string; text: string; isCorrect: boolean }>;
}

export function StartCbtView({
  student,
  onSubjectsChanged,
  onSessionStarted,
}: {
  student?: { fullName: string; registrationNumber?: string; jambYear?: number };
  onSubjectsChanged?: (subjects: Array<{ code: string; name: string }>) => void;
  onSessionStarted: (sessionId: string) => void;
}) {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [combinations, setCombinations] = useState<SubjectCombinationItem[]>([]);
  const [selectedElectiveIds, setSelectedElectiveIds] = useState<string[]>([]);
  const [examMode, setExamMode] = useState<'timed' | 'revision'>('timed');
  const [questionCount, setQuestionCount] = useState(40);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subjectsLoading, setSubjectsLoading] = useState(true);

  const loadSubjects = useCallback(() => {
    setSubjectsLoading(true);
    setError(null);
    apiFetch<{ subjects: SubjectItem[]; combinations: SubjectCombinationItem[] }>('/api/student/subjects')
      .then((res) => {
        setSubjects(res.subjects);
        setCombinations(res.combinations);
        let restoredIds: string[] = [];
        try {
          const savedRaw = localStorage.getItem('acadet_selected_utme_subjects');
          if (savedRaw) {
            const parsed = JSON.parse(savedRaw) as Array<{ code: string }>;
            restoredIds = parsed
              .filter((item) => item.code !== 'ENG')
              .map((item) => res.subjects.find((s) => s.code === item.code)?.id)
              .filter(Boolean) as string[];
          }
        } catch {
          // ignore storage errors
        }
        const defaults = res.subjects
          .filter((s) => ['MTH', 'PHY', 'CHM'].includes(s.code))
          .map((s) => s.id);
        const initialElectives = restoredIds.length === 3 ? restoredIds : defaults;
        setSelectedElectiveIds((prev) => (prev.length === 3 ? prev : initialElectives));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load subjects.');
      })
      .finally(() => setSubjectsLoading(false));
  }, []);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  const englishSubject = useMemo(
    () => subjects.find((s) => s.isCompulsory || s.code === 'ENG'),
    [subjects]
  );
  const electives = useMemo(
    () => subjects.filter((s) => !s.isCompulsory && s.code !== 'ENG'),
    [subjects]
  );
  const selectedSubjectsList = useMemo(() => {
    const picked = selectedElectiveIds
      .map((id) => subjects.find((s) => s.id === id))
      .filter(Boolean) as SubjectItem[];
    return englishSubject ? [englishSubject, ...picked] : picked;
  }, [englishSubject, selectedElectiveIds, subjects]);

  useEffect(() => {
    if (selectedSubjectsList.length === 4) {
      const compact = selectedSubjectsList.map((s) => ({ code: s.code, name: s.name }));
      try {
        localStorage.setItem('acadet_selected_utme_subjects', JSON.stringify(compact));
      } catch {
        // ignore storage errors
      }
      onSubjectsChanged?.(compact);
    }
  }, [selectedSubjectsList, onSubjectsChanged]);

  const toggleElective = (id: string) => {
    setError(null);
    setSelectedElectiveIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return [...prev.slice(1), id];
      return [...prev, id];
    });
  };

  const applyCombination = (combo: SubjectCombinationItem) => {
    const ids = combo.subjectCodes
      .filter((code) => code !== 'ENG')
      .map((code) => subjects.find((s) => s.code === code)?.id)
      .filter(Boolean) as string[];
    setSelectedElectiveIds(ids.slice(0, 3));
    setError(null);
  };

  const launchUtme = async () => {
    if (!englishSubject || selectedElectiveIds.length !== 3) {
      setError('Please select 3 subjects in addition to Use of English.');
      return;
    }
    try {
      setLaunching(true);
      setError(null);
      const res = await apiFetch<{ sessionId: string }>('/api/exams/start', {
        method: 'POST',
        body: JSON.stringify({
          examType: 'utme_4_subject',
          examMode,
          subjectIds: [englishSubject.id, ...selectedElectiveIds],
          questionCount,
          durationMinutes,
          randomize: true,
        }),
      });
      onSessionStarted(res.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start examination.');
      setLaunching(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold text-[#0B5E2E] sm:text-2xl dark:text-white">
          Select your four subjects
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Use of English is compulsory. Choose three other subjects or select a course combination below.
        </p>
      </div>

      {/* Course Combination Shortcuts */}
      <div className="rounded-lg border border-slate-300 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xs font-bold tracking-wide text-slate-700 uppercase dark:text-slate-300">
          Course Combinations
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {combinations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => applyCombination(c)}
              className="min-h-[44px] rounded-md border border-slate-200 p-2.5 text-left hover:border-[#0B5E2E] hover:bg-emerald-50/40 dark:border-slate-700 dark:hover:bg-emerald-950/30"
            >
              <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{c.name}</p>
              <p className="mt-0.5 font-mono text-[11px] text-[#0B5E2E] dark:text-emerald-400">
                {c.subjectCodes.join(' · ')}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Subject Selection & Start Summary */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="rounded-lg border border-slate-300 bg-white p-4 sm:p-5 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5 dark:border-slate-800">
            <h2 className="text-sm font-bold text-[#0B5E2E] dark:text-white">
              Choose 3 Subjects ({selectedElectiveIds.length}/3 selected)
            </h2>
            {englishSubject && (
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                + {englishSubject.name} (Compulsory)
              </span>
            )}
          </div>

          {subjectsLoading ? (
            <div className="rounded-md border border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-slate-800">
              Loading subjects...
            </div>
          ) : electives.length === 0 ? (
            <div className="rounded-md border border-slate-200 p-6 text-center dark:border-slate-800">
              <p className="text-xs text-slate-500">No subjects loaded.</p>
              <button
                type="button"
                onClick={loadSubjects}
                className="mt-2 rounded-md bg-[#0B5E2E] px-3 py-1.5 text-xs font-semibold text-white"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {electives.map((sub) => {
                const selected = selectedElectiveIds.includes(sub.id);
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => toggleElective(sub.id)}
                    className={`flex min-h-[48px] items-center justify-between rounded-md border px-3 py-2.5 text-left ${
                      selected
                        ? 'border-[#0B5E2E] bg-emerald-50 text-slate-950 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-white'
                        : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold">{sub.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {sub.code} · {sub.questionCount || 0} questions
                      </p>
                    </div>
                    {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0B5E2E]" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-300 bg-white p-4 sm:p-5 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 pb-3 dark:border-slate-800">
            <h2 className="font-display text-base font-bold text-[#0B5E2E] dark:text-white">
              Examination Summary
            </h2>
            {student && (
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {student.fullName} ·{' '}
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  {student.registrationNumber}
                </span>
              </p>
            )}
          </div>

          <div className="mt-4 space-y-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Your Four Subjects</p>
              <p className="mt-1 text-xs font-bold text-slate-900 dark:text-white">
                {selectedSubjectsList.map((s) => s.name).join(' · ')}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-400">
                Test Mode
              </label>
              <div className="grid grid-cols-2 gap-1 rounded-md border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setExamMode('timed')}
                  className={`min-h-[38px] rounded-sm text-xs font-semibold ${
                    examMode === 'timed'
                      ? 'bg-white text-[#0B5E2E] dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Timed Test
                </button>
                <button
                  type="button"
                  onClick={() => setExamMode('revision')}
                  className={`min-h-[38px] rounded-sm text-xs font-semibold ${
                    examMode === 'revision'
                      ? 'bg-white text-[#0B5E2E] dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Study Mode (Untimed)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-400">
                  Total Questions
                </label>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value={20}>20 Questions</option>
                  <option value={40}>40 Questions</option>
                  <option value={80}>80 Questions</option>
                  <option value={120}>120 Questions</option>
                  <option value={180}>180 Questions</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-400">
                  Duration
                </label>
                <select
                  disabled={examMode === 'revision'}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value={20}>20 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes</option>
                  <option value={90}>90 Minutes</option>
                  <option value={120}>120 Mins (Full UTME)</option>
                </select>
              </div>
            </div>

            {error && (
              <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>
            )}

            <button
              type="button"
              disabled={launching || selectedElectiveIds.length !== 3}
              onClick={launchUtme}
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-md bg-emerald-700 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              <span>{launching ? 'Starting Examination...' : 'Start Examination'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PracticeExamsView({ onSessionStarted }: { onSessionStarted: (sessionId: string) => void }) {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [blueprints, setBlueprints] = useState<PracticeBlueprint[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [examMode, setExamMode] = useState<'timed' | 'revision'>('timed');
  const [difficulty, setDifficulty] = useState<'All' | 'Easy' | 'Medium' | 'Hard'>('All');
  const [questionCount, setQuestionCount] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [randomize, setRandomize] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<{ subjects: SubjectItem[] }>('/api/student/subjects'),
      apiFetch<{ examinations: PracticeBlueprint[] }>('/api/student/practice-exams'),
    ])
      .then(([sRes, pRes]) => {
        setSubjects(sRes.subjects);
        if (sRes.subjects[0]) setSubjectId(sRes.subjects[0].id);
        setBlueprints(pRes.examinations);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to load practice subjects.');
      });
  }, []);

  const currentSubject = subjects.find((s) => s.id === subjectId);

  const startCustomPractice = async () => {
    if (!subjectId) return;
    try {
      setLaunching(true);
      setError(null);
      const res = await apiFetch<{ sessionId: string }>('/api/exams/start', {
        method: 'POST',
        body: JSON.stringify({
          examType: topicId ? 'topic_practice' : 'practice',
          examMode,
          subjectIds: [subjectId],
          topicId: topicId || undefined,
          questionCount,
          durationMinutes,
          difficulty,
          randomize,
        }),
      });
      onSessionStarted(res.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start practice test.');
      setLaunching(false);
    }
  };

  const launchBlueprint = async (bp: PracticeBlueprint) => {
    try {
      setLaunching(true);
      setError(null);
      const res = await apiFetch<{ sessionId: string }>('/api/exams/start', {
        method: 'POST',
        body: JSON.stringify({
          examType: bp.examType === 'utme_4_subject' ? 'utme_4_subject' : 'practice',
          examMode: 'timed',
          subjectIds: bp.subjects.map((s) => s.id),
          questionCount: bp.questionCount,
          durationMinutes: bp.durationMinutes,
          examinationId: bp.id,
        }),
      });
      onSessionStarted(res.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start examination.');
      setLaunching(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold text-[#0B5E2E] sm:text-2xl dark:text-white">Practice Tests</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Practise one subject or topic at a time, or pick a ready-made test paper below.
        </p>
      </div>

      <div className="rounded-lg border border-slate-300 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-display text-sm font-bold text-[#0B5E2E] dark:text-white">Set Up Single-Subject Practice</h2>

        <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-400">Subject</label>
            <select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setTopicId('');
              }}
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.questionCount || 0} Qs)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-400">Topic</label>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">All Topics</option>
              {(currentSubject?.topics || []).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-400">Mode</label>
            <select
              value={examMode}
              onChange={(e) => setExamMode(e.target.value as 'timed' | 'revision')}
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="timed">Timed Test</option>
              <option value="revision">Study Mode (Untimed)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-400">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as 'All' | 'Easy' | 'Medium' | 'Hard')}
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="All">All Levels</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-400">Number of Questions</label>
            <input
              type="number"
              min={5}
              max={60}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-400">Time (Minutes)</label>
            <input
              type="number"
              min={5}
              max={120}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4 dark:border-slate-800">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={randomize}
              onChange={(e) => setRandomize(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#0B5E2E]"
            />
            Mix question order
          </label>

          <button
            type="button"
            disabled={launching}
            onClick={startCustomPractice}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-[#0B5E2E] px-5 text-sm font-semibold text-white hover:bg-[#084722] disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            <span>{launching ? 'Starting...' : 'Start Practice Test'}</span>
          </button>
        </div>

        {error && <p className="mt-3 text-xs font-medium text-rose-700">{error}</p>}
      </div>

      <div>
        <h2 className="font-display text-base font-bold text-[#0B5E2E] dark:text-white">Ready-Made Practice Papers</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {blueprints.map((bp) => (
            <div key={bp.id} className="flex flex-col justify-between rounded-lg border border-slate-300 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="text-xs font-semibold text-[#0B5E2E] dark:text-emerald-400">
                  {bp.questionCount} Questions · {bp.durationMinutes} Minutes
                </p>
                <h3 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-white">{bp.title}</h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{bp.description}</p>
              </div>
              <button
                type="button"
                disabled={launching}
                onClick={() => launchBlueprint(bp)}
                className="mt-4 inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-md bg-[#0B5E2E] px-4 text-xs font-semibold text-white hover:bg-[#084722]"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Start Examination</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MockExamsView({
  onSessionStarted,
  onViewResult,
}: {
  onSessionStarted: (sessionId: string) => void;
  onViewResult: (sessionId: string) => void;
}) {
  const [mocks, setMocks] = useState<MockExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMocks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ mocks: MockExamItem[] }>('/api/student/mocks');
      setMocks(res.mocks);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMocks();
  }, [loadMocks]);

  const registerMock = async (mockId: string) => {
    try {
      setError(null);
      await apiFetch(`/api/student/mocks/${mockId}/register`, { method: 'POST' });
      await loadMocks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register.');
    }
  };

  const startMock = async (mockId: string) => {
    try {
      setError(null);
      const res = await apiFetch<{ sessionId: string }>(`/api/exams/mock/${mockId}/start`, { method: 'POST' });
      onSessionStarted(res.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cannot start mock examination.');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold text-[#0B5E2E] sm:text-2xl dark:text-white">Mock Examinations</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Scheduled timed tests that match official UTME rules.
        </p>
      </div>

      {error && <p className="rounded-md border border-rose-300 bg-rose-50 px-4 py-2.5 text-xs text-rose-800">{error}</p>}

      {loading ? (
        <div className="rounded-lg border border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Loading mock examinations...
        </div>
      ) : mocks.length === 0 ? (
        <div className="rounded-lg border border-slate-300 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No mock examinations scheduled right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {mocks.map((m) => (
            <div key={m.id} className="rounded-lg border border-slate-300 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-xs font-bold ${
                    m.windowStatus === 'active'
                      ? 'text-emerald-700'
                      : m.windowStatus === 'upcoming'
                      ? 'text-[#0B5E2E]'
                      : 'text-slate-500'
                  }`}
                >
                  {m.windowStatus === 'active' ? 'Open Now' : m.windowStatus === 'upcoming' ? 'Upcoming' : 'Closed'}
                </span>
                <span className="font-mono text-xs text-slate-600">
                  {m.durationMinutes} mins · {m.questionCount} Qs
                </span>
              </div>

              <h2 className="mt-2 font-display text-base font-bold text-slate-900 dark:text-white">{m.title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{m.description}</p>

              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Opens: {new Date(m.startAt).toLocaleDateString()} · Closes: {new Date(m.endAt).toLocaleDateString()}
              </p>

              <p className="mt-1.5 text-xs font-medium text-[#0B5E2E] dark:text-emerald-400">
                Subjects: {m.subjects.map((s) => s.name).join(', ')}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {m.sessionId && m.sessionStatus !== 'in_progress' ? (
                  <button
                    type="button"
                    onClick={() => onViewResult(m.sessionId!)}
                    className="min-h-[40px] rounded-md border border-[#0B5E2E] px-4 text-xs font-semibold text-[#0B5E2E] hover:bg-emerald-50 dark:text-emerald-400"
                  >
                    View Result
                  </button>
                ) : m.windowStatus === 'active' ? (
                  <button
                    type="button"
                    onClick={() => startMock(m.id)}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md bg-emerald-700 px-4 text-xs font-semibold text-white hover:bg-emerald-800"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>{m.sessionStatus === 'in_progress' ? 'Continue Mock' : 'Start Examination'}</span>
                  </button>
                ) : m.windowStatus === 'upcoming' && !m.isRegistered ? (
                  <button
                    type="button"
                    onClick={() => registerMock(m.id)}
                    className="min-h-[40px] rounded-md bg-[#0B5E2E] px-4 text-xs font-semibold text-white hover:bg-[#084722]"
                  >
                    Register for Mock
                  </button>
                ) : m.isRegistered ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" /> Registered
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PastQuestionsView({ onSessionStarted }: { onSessionStarted: (sessionId: string) => void }) {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [questions, setQuestions] = useState<PastQuestionRow[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [source, setSource] = useState('All');
  const [difficulty, setDifficulty] = useState('All');
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ subjects: SubjectItem[] }>('/api/student/subjects')
      .then((res) => setSubjects(res.subjects))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (subjectId) params.set('subjectId', subjectId);
    if (source !== 'All') params.set('source', source);
    if (difficulty !== 'All') params.set('difficulty', difficulty);

    apiFetch<{ questions: PastQuestionRow[] }>(`/api/student/past-questions?${params.toString()}`)
      .then((res) => setQuestions(res.questions))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [subjectId, source, difficulty]);

  const startFilteredCbt = async () => {
    const targetSub = subjectId || subjects[0]?.id;
    if (!targetSub) return;
    try {
      const res = await apiFetch<{ sessionId: string }>('/api/exams/start', {
        method: 'POST',
        body: JSON.stringify({
          examType: 'past_questions',
          examMode: 'timed',
          subjectIds: [targetSub],
          difficulty,
          questionSource: source,
          questionCount: 15,
          durationMinutes: 20,
        }),
      });
      onSessionStarted(res.sessionId);
    } catch {
      // handled gracefully
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-[#0B5E2E] sm:text-2xl dark:text-white">Past Questions</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Browse questions by subject and reveal answers with explanations.
          </p>
        </div>
        <button
          type="button"
          onClick={startFilteredCbt}
          className="inline-flex min-h-[42px] items-center gap-1.5 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          <Play className="h-4 w-4" />
          <span>Practise as Timed Test</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-300 bg-white p-4 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900">
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="All">All Question Types</option>
          <option value="sample_practice">Practice Questions</option>
          <option value="verified_past_question">Verified Past Questions</option>
        </select>

        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="All">All Levels</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Loading questions...
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-lg border border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <FileQuestion className="mx-auto mb-2 h-8 w-8 text-slate-400" />
          No questions found for these filters.
        </div>
      ) : (
        <div className="space-y-3.5">
          {questions.map((q, idx) => {
            const revealed = Boolean(revealedIds[q.id]);
            return (
              <div key={q.id} className="rounded-lg border border-slate-300 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5 dark:border-slate-800">
                  <span className="text-xs font-semibold text-[#0B5E2E] dark:text-emerald-400">
                    Question {idx + 1} · {q.subjectName} · {q.topicName} ·{' '}
                    {q.questionSource === 'verified_past_question'
                      ? `Past Question${q.examYear ? ` (${q.examYear})` : ''}`
                      : 'Practice Question'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRevealedIds((p) => ({ ...p, [q.id]: !p[q.id] }))}
                    className="inline-flex min-h-[34px] items-center gap-1 rounded-md border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                  >
                    {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    <span>{revealed ? 'Hide Answer' : 'Show Answer'}</span>
                  </button>
                </div>

                <p className="mt-3 text-sm leading-relaxed font-medium text-slate-900 dark:text-slate-100">{q.questionText}</p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {q.options.map((opt) => (
                    <div
                      key={opt.label}
                      className={`rounded-md border px-3 py-2 text-xs ${
                        revealed && opt.isCorrect
                          ? 'border-emerald-600 bg-emerald-50 font-semibold text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200'
                          : 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                      }`}
                    >
                      <span className="font-bold">{opt.label}.</span> {opt.text}
                    </div>
                  ))}
                </div>
                {revealed && q.explanation && (
                  <p className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                    <span className="font-bold">Explanation:</span> {q.explanation}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SubjectsView({ onLaunchSubject }: { onLaunchSubject: (subjectId: string) => void }) {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [combinations, setCombinations] = useState<SubjectCombinationItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Compulsory' | 'Science' | 'Commercial' | 'Arts'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadSubjects = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    apiFetch<{ subjects: SubjectItem[]; combinations: SubjectCombinationItem[] }>('/api/student/subjects')
      .then((res) => {
        setSubjects(res.subjects);
        setCombinations(res.combinations);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Unable to load subjects.');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  const filteredSubjects = subjects.filter((sub) => {
    const matchesCat = categoryFilter === 'All' || sub.category === categoryFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      sub.name.toLowerCase().includes(q) ||
      sub.code.toLowerCase().includes(q) ||
      sub.description.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold text-[#0B5E2E] sm:text-2xl dark:text-white">
            JAMB Subjects ({subjects.length})
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Browse all {subjects.length || 25} subjects or start a quick test on any subject.
          </p>
        </div>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search subjects..."
          className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm sm:w-64 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(['All', 'Compulsory', 'Science', 'Commercial', 'Arts'] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`min-h-[38px] rounded-md border px-3 text-xs font-semibold whitespace-nowrap ${
              categoryFilter === cat
                ? 'border-[#0B5E2E] bg-[#0B5E2E] text-white dark:border-emerald-700 dark:bg-emerald-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-300 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Loading subjects...
        </div>
      ) : loadError ? (
        <div className="rounded-lg border border-slate-300 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-rose-700">{loadError}</p>
          <button
            type="button"
            onClick={loadSubjects}
            className="mt-3 rounded-md bg-[#0B5E2E] px-4 py-2 text-xs font-semibold text-white"
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSubjects.map((sub) => (
            <div key={sub.id} className="flex flex-col justify-between rounded-lg border border-slate-300 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="font-mono text-xs font-semibold text-[#0B5E2E] dark:text-emerald-400">
                  {sub.code} · {sub.isCompulsory ? 'Compulsory' : sub.category} · {sub.questionCount || 0} Qs
                </p>
                <h2 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-white">{sub.name}</h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{sub.description}</p>
                {sub.topics && sub.topics.length > 0 && (
                  <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Topics: {sub.topics.map((t) => t.name).join(' · ')}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onLaunchSubject(sub.id)}
                className="mt-4 min-h-[40px] rounded-md border border-[#0B5E2E] px-3 text-xs font-semibold text-[#0B5E2E] hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
              >
                Practise {sub.name}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-slate-300 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-display text-base font-bold text-[#0B5E2E] dark:text-white">Common Course Combinations</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {combinations.map((c) => (
            <div key={c.id} className="rounded-md border border-slate-200 p-3.5 dark:border-slate-800">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{c.faculty}</p>
              <h3 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">{c.name}</h3>
              <p className="mt-0.5 font-mono text-xs font-semibold text-[#0B5E2E] dark:text-emerald-400">{c.subjectCodes.join(' · ')}</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{c.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
