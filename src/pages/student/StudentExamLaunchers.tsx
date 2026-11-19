import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileQuestion,
  Play,
  SlidersHorizontal,
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
  onSessionStarted,
}: {
  student?: { fullName: string; registrationNumber?: string; jambYear?: number };
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
        const defaults = res.subjects
          .filter((s) => ['MTH', 'PHY', 'CHM'].includes(s.code))
          .map((s) => s.id);
        setSelectedElectiveIds((prev) => (prev.length === 3 ? prev : defaults));
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
      setError('Select exactly 3 elective subjects alongside compulsory Use of English.');
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
      setError(err instanceof Error ? err.message : 'Unable to start UTME CBT.');
      setLaunching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#0F2447] dark:text-white">
          JAMB UTME CBT Check-In Desk
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Use of English is compulsory. Select 3 elective subjects or apply a faculty preset to begin your CBT session.
        </p>
      </div>

      {/* Faculty Presets */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Quick Faculty Combinations</h2>
        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {combinations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => applyCombination(c)}
              className="rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-blue-500 hover:bg-blue-50/50 dark:border-slate-700 dark:hover:bg-blue-950/40"
            >
              <p className="truncate text-xs font-bold text-slate-900 dark:text-white">{c.name}</p>
              <p className="mt-1 font-mono text-[11px] text-blue-700 dark:text-blue-400">
                {c.subjectCodes.join(' · ')}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Subject Selection & Candidate Check-In Slip */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Select 3 Electives ({selectedElectiveIds.length}/3 selected)
            </h2>
            {englishSubject && (
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                + {englishSubject.name} (Compulsory)
              </span>
            )}
          </div>

          {subjectsLoading ? (
            <div className="rounded-lg border border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-slate-800">
              Loading 25 JAMB UTME subjects...
            </div>
          ) : electives.length === 0 ? (
            <div className="rounded-lg border border-slate-200 p-6 text-center dark:border-slate-800">
              <p className="text-xs text-slate-500">No subjects loaded.</p>
              <button
                type="button"
                onClick={loadSubjects}
                className="mt-2 rounded-lg bg-[#0F2447] px-3 py-1.5 text-xs font-semibold text-white"
              >
                Reload Subjects
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {electives.map((sub) => {
                const selected = selectedElectiveIds.includes(sub.id);
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => toggleElective(sub.id)}
                    className={`flex items-center justify-between rounded-lg border px-3.5 py-3 text-left transition-colors ${
                      selected
                        ? 'border-blue-600 bg-blue-50 text-blue-950 dark:border-blue-500 dark:bg-blue-950/60 dark:text-white'
                        : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold">{sub.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {sub.code} · {sub.questionCount || 0} questions
                      </p>
                    </div>
                    {selected && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Candidate Check-In Slip & Launch Parameters */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 pb-3 dark:border-slate-800">
            <h2 className="font-display text-base font-bold text-[#0F2447] dark:text-white">
              Candidate Exam Slip
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
            {/* Active 4-Subject Allocation Summary */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Selected 4-Subject Paper</p>
              <p className="mt-1 text-xs font-bold text-slate-900 dark:text-white">
                {selectedSubjectsList.map((s) => s.name).join(' · ')}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                CBT Testing Mode
              </label>
              <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setExamMode('timed')}
                  className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
                    examMode === 'timed'
                      ? 'bg-white text-[#0F2447] shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Timed UTME Exam
                </button>
                <button
                  type="button"
                  onClick={() => setExamMode('revision')}
                  className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
                    examMode === 'revision'
                      ? 'bg-white text-[#0F2447] shadow-xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Untimed Study Mode
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Questions
                </label>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value={20}>20 Questions</option>
                  <option value={40}>40 Questions</option>
                  <option value={80}>80 Questions</option>
                  <option value={120}>120 Questions</option>
                  <option value={180}>180 Questions</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Time Limit
                </label>
                <select
                  disabled={examMode === 'revision'}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value={20}>20 Minutes</option>
                  <option value={45}>45 Minutes</option>
                  <option value={60}>60 Minutes</option>
                  <option value={90}>90 Minutes</option>
                  <option value={120}>120 Mins (UTME)</option>
                </select>
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>
            )}

            <button
              type="button"
              disabled={launching || selectedElectiveIds.length !== 3}
              onClick={launchUtme}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              <span>{launching ? 'Initializing Exam Hall...' : 'Enter CBT Exam Hall'}</span>
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
      setError(err instanceof Error ? err.message : 'Unable to start practice exam.');
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
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Practice Examinations</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Configure subject-based, topic-based, timed, or untimed revision drills, or pick a curated practice paper.
        </p>
      </div>

      {/* Custom Configurator */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-blue-600" />
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">Custom Practice Configurator</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Subject</label>
            <select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setTopicId('');
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.questionCount || 0} Qs)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Topic (Optional)</label>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">All Topics</option>
              {(currentSubject?.topics || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Practice Mode</label>
            <select
              value={examMode}
              onChange={(e) => setExamMode(e.target.value as 'timed' | 'revision')}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="timed">Timed CBT Mode</option>
              <option value="revision">Revision Mode (Untimed)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Difficulty</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as 'All' | 'Easy' | 'Medium' | 'Hard')}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="All">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Questions</label>
            <input
              type="number"
              min={5}
              max={60}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Duration (Mins)</label>
            <input
              type="number"
              min={5}
              max={120}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={randomize}
              onChange={(e) => setRandomize(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            Randomize question selection
          </label>

          <button
            type="button"
            disabled={launching}
            onClick={startCustomPractice}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Play className="h-4 w-4" />
            <span>{launching ? 'Starting...' : 'Start Custom Practice'}</span>
          </button>
        </div>

        {error && <p className="mt-3 text-xs font-medium text-rose-600">{error}</p>}
      </div>

      {/* Curated Practice Blueprints */}
      <div>
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">Recommended Practice Papers</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {blueprints.map((bp) => (
            <div key={bp.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                  {bp.questionCount} Questions · {bp.durationMinutes} Minutes
                </p>
                <h3 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-white">{bp.title}</h3>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">{bp.description}</p>
              </div>
              <button
                type="button"
                disabled={launching}
                onClick={() => launchBlueprint(bp)}
                className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0F2447] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Start CBT</span>
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
    loadMocks();
  }, [loadMocks]);

  const registerMock = async (mockId: string) => {
    try {
      setError(null);
      await apiFetch(`/api/student/mocks/${mockId}/register`, { method: 'POST' });
      await loadMocks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register.');
    }
  };

  const startMock = async (mockId: string) => {
    try {
      setError(null);
      const res = await apiFetch<{ sessionId: string }>(`/api/exams/mock/${mockId}/start`, { method: 'POST' });
      onSessionStarted(res.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cannot launch mock examination.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Scheduled Mock Examinations</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          National UTME simulations with server-enforced schedule windows and eligibility rules.
        </p>
      </div>

      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800">{error}</p>}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Loading mock examinations...
        </div>
      ) : mocks.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <Award className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">No scheduled mocks at this time.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {mocks.map((m) => (
            <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-xs font-bold ${
                    m.windowStatus === 'active'
                      ? 'text-emerald-600'
                      : m.windowStatus === 'upcoming'
                      ? 'text-blue-600'
                      : 'text-slate-500'
                  }`}
                >
                  {m.windowStatus === 'active' ? 'Window Open Now' : m.windowStatus === 'upcoming' ? 'Upcoming' : 'Window Closed'}
                </span>
                <span className="font-mono text-xs text-slate-500">
                  {m.durationMinutes} mins · {m.questionCount} Qs
                </span>
              </div>

              <h2 className="mt-2 font-display text-lg font-bold text-slate-900 dark:text-white">{m.title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{m.description}</p>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Opens: {new Date(m.startAt).toLocaleDateString()}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Closes: {new Date(m.endAt).toLocaleDateString()}
                </span>
              </div>

              <p className="mt-2 text-xs font-medium text-blue-700 dark:text-blue-400">
                Subjects: {m.subjects.map((s) => s.name).join(', ')}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {m.sessionId && m.sessionStatus !== 'in_progress' ? (
                  <button
                    type="button"
                    onClick={() => onViewResult(m.sessionId!)}
                    className="rounded-lg border border-blue-600 px-4 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-400"
                  >
                    View Mock Result
                  </button>
                ) : m.windowStatus === 'active' ? (
                  <button
                    type="button"
                    onClick={() => startMock(m.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>{m.sessionStatus === 'in_progress' ? 'Resume Mock Exam' : 'Start Mock Exam'}</span>
                  </button>
                ) : m.windowStatus === 'upcoming' && !m.isRegistered ? (
                  <button
                    type="button"
                    onClick={() => registerMock(m.id)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Register Interest
                  </button>
                ) : m.isRegistered ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" /> Registered for Mock
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
      .then((res) => {
        setSubjects(res.subjects);
      })
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Past & Practice Question Bank</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Browse questions by subject and difficulty. Sample practice items and verified past questions are clearly labeled.
          </p>
        </div>
        <button
          type="button"
          onClick={startFilteredCbt}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <Play className="h-4 w-4" />
          <span>Practice as Timed CBT</span>
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3 dark:border-slate-800 dark:bg-slate-900">
        <select
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="All">All Sources</option>
          <option value="sample_practice">Sample Practice Questions</option>
          <option value="verified_past_question">Verified Past Questions</option>
        </select>

        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="All">All Difficulties</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Loading question bank...
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <FileQuestion className="mx-auto mb-2 h-8 w-8 text-slate-400" />
          No questions match the selected filters.
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx) => {
            const revealed = Boolean(revealedIds[q.id]);
            return (
              <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                    #{idx + 1} · {q.subjectName} · {q.topicName} · {q.difficulty} ·{' '}
                    {q.questionSource === 'verified_past_question'
                      ? `Verified Past Question${q.examYear ? ` (${q.examYear})` : ''}`
                      : 'Sample Practice Question'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRevealedIds((p) => ({ ...p, [q.id]: !p[q.id] }))}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-blue-700 dark:text-slate-400"
                  >
                    {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    <span>{revealed ? 'Hide Solution' : 'Reveal Answer'}</span>
                  </button>
                </div>

                <p className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">{q.questionText}</p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {q.options.map((opt) => (
                    <div
                      key={opt.label}
                      className={`rounded-lg border px-3 py-2 text-xs ${
                        revealed && opt.isCorrect
                          ? 'border-emerald-500 bg-emerald-50 font-semibold text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200'
                          : 'border-slate-200 bg-slate-50/60 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300'
                      }`}
                    >
                      <span className="font-bold">{opt.label}.</span> {opt.text}
                    </div>
                  ))}
                </div>
                {revealed && q.explanation && (
                  <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-300">
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            JAMB UTME Subjects & Combinations ({subjects.length})
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Explore all {subjects.length || 25} active UTME subjects, syllabus topics, and start quick subject-focused CBT drills.
          </p>
        </div>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter subjects by name or code..."
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:w-64 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(['All', 'Compulsory', 'Science', 'Commercial', 'Arts'] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              categoryFilter === cat
                ? 'border-[#0F2447] bg-[#0F2447] text-white dark:border-blue-600 dark:bg-blue-600'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Loading JAMB UTME subjects...
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-rose-600">{loadError}</p>
          <button
            type="button"
            onClick={loadSubjects}
            className="mt-3 rounded-lg bg-[#0F2447] px-4 py-2 text-xs font-semibold text-white"
          >
            Retry Loading Subjects
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSubjects.map((sub) => (
          <div key={sub.id} className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                {sub.code} · {sub.isCompulsory ? 'Compulsory' : sub.category} · {sub.questionCount || 0} Qs
              </p>
              <h2 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-white">{sub.name}</h2>
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">{sub.description}</p>
              {sub.topics && sub.topics.length > 0 && (
                <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                  Topics: {sub.topics.map((t) => t.name).join(' · ')}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onLaunchSubject(sub.id)}
              className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-600 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Practice {sub.code}</span>
            </button>
          </div>
          ))}
        </div>
      )}

      <div>
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">Approved 4-Subject Faculty Combinations</h2>
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          {combinations.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{c.faculty}</p>
              <h3 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-white">{c.name}</h3>
              <p className="mt-1 font-mono text-xs font-bold text-blue-700 dark:text-blue-400">{c.subjectCodes.join(' · ')}</p>
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">{c.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
