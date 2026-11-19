import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  FileUp,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { SubjectCombinationItem, SubjectItem } from '../../types/index.ts';

interface AdminQuestionRow {
  id: string;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  topicName: string;
  questionText: string;
  questionImageUrl: string | null;
  difficulty: string;
  questionSource: 'sample_practice' | 'verified_past_question';
  examYear: number | null;
  explanation: string;
  options: Array<{ label: string; text: string; isCorrect: boolean }>;
}

export function AdminSubjectsPanel() {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [combinations, setCombinations] = useState<SubjectCombinationItem[]>([]);
  const [form, setForm] = useState({ code: '', name: '', category: 'Science', description: '', isCompulsory: false });
  const [topicForm, setTopicForm] = useState({ subjectId: '', name: '' });
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch<{ subjects: SubjectItem[]; combinations: SubjectCombinationItem[] }>('/api/admin/subjects');
    setSubjects(res.subjects);
    setCombinations(res.combinations);
    if (!topicForm.subjectId && res.subjects[0]) {
      setTopicForm((f) => ({ ...f, subjectId: res.subjects[0].id }));
    }
  }, [topicForm.subjectId]);

  useEffect(() => {
    load();
  }, [load]);

  const createSubject = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    await apiFetch('/api/admin/subjects', { method: 'POST', body: JSON.stringify(form) });
    setForm({ code: '', name: '', category: 'Science', description: '', isCompulsory: false });
    setMsg('Subject added.');
    load();
  };

  const toggleActive = async (s: SubjectItem) => {
    await apiFetch(`/api/admin/subjects/${s.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    load();
  };

  const addTopic = async (e: FormEvent) => {
    e.preventDefault();
    if (!topicForm.subjectId || !topicForm.name.trim()) return;
    await apiFetch('/api/admin/topics', { method: 'POST', body: JSON.stringify(topicForm) });
    setTopicForm((f) => ({ ...f, name: '' }));
    load();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form onSubmit={createSubject} className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">Add Subject</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              required
              placeholder="Code (e.g. FRN)"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              required
              placeholder="Subject Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2 dark:border-slate-700 dark:bg-slate-800"
            />
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="Science">Science</option>
              <option value="Commercial">Commercial</option>
              <option value="Arts">Arts</option>
              <option value="Compulsory">Compulsory</option>
            </select>
            <input
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2 dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          {msg && <p className="mt-2 text-xs text-emerald-600">{msg}</p>}
          <button type="submit" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white">
            <Plus className="h-4 w-4" /> Create Subject
          </button>
        </form>

        <form onSubmit={addTopic} className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">Add Syllabus Topic</h2>
          <div className="mt-4 space-y-3">
            <select
              value={topicForm.subjectId}
              onChange={(e) => setTopicForm((f) => ({ ...f, subjectId: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input
              required
              placeholder="Topic Name"
              value={topicForm.name}
              onChange={(e) => setTopicForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <button type="submit" className="rounded-lg bg-[#0F2447] px-4 py-2 text-xs font-semibold text-white">
              Add Topic
            </button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Questions</th>
              <th className="px-4 py-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {subjects.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-mono text-xs font-bold">{s.code}</td>
                <td className="px-4 py-3 font-medium">
                  {s.name} {s.isCompulsory ? '· Compulsory' : ''}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{s.category}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">{s.questionCount || 0}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => toggleActive(s)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      s.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {s.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
          Configured 4-Subject UTME Combinations ({combinations.length})
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {combinations.map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
              <p className="font-bold text-slate-900 dark:text-white">{c.name}</p>
              <p className="font-mono text-blue-700 dark:text-blue-400">{c.subjectCodes.join(' · ')}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminQuestionsPanel() {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [questions, setQuestions] = useState<AdminQuestionRow[]>([]);
  const [filterSub, setFilterSub] = useState('');
  const [filterSource, setFilterSource] = useState('All');
  const [form, setForm] = useState({
    subjectId: '',
    topicId: '',
    questionText: '',
    questionImageUrl: '',
    difficulty: 'Medium',
    questionSource: 'sample_practice',
    examYear: '',
    explanation: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctOption: 'A',
  });
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sRes = await apiFetch<{ subjects: SubjectItem[] }>('/api/admin/subjects');
    setSubjects(sRes.subjects);
    if (!form.subjectId && sRes.subjects[0]) {
      setForm((f) => ({ ...f, subjectId: sRes.subjects[0].id }));
    }
    const params = new URLSearchParams();
    if (filterSub) params.set('subjectId', filterSub);
    if (filterSource !== 'All') params.set('source', filterSource);
    const qRes = await apiFetch<{ questions: AdminQuestionRow[] }>(`/api/admin/questions?${params.toString()}`);
    setQuestions(qRes.questions);
  }, [filterSub, filterSource, form.subjectId]);

  useEffect(() => {
    load();
  }, [load]);

  const currentSubject = subjects.find((s) => s.id === form.subjectId);

  const createQuestion = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    await apiFetch('/api/admin/questions', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        topicId: form.topicId || null,
        questionImageUrl: form.questionImageUrl || null,
        examYear: form.examYear ? Number(form.examYear) : null,
      }),
    });
    setForm((f) => ({
      ...f,
      questionText: '',
      questionImageUrl: '',
      explanation: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
    }));
    setMsg('Question added to PostgreSQL bank.');
    load();
  };

  const handleImageUpload = async (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await apiFetch<{ url: string }>('/api/admin/questions/upload-image', {
      method: 'POST',
      body: fd,
    });
    setForm((f) => ({ ...f, questionImageUrl: res.url }));
  };

  const deleteQuestion = async (id: string) => {
    await apiFetch(`/api/admin/questions/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={createQuestion} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">Create New Question</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <select
            value={form.subjectId}
            onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value, topicId: '' }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select
            value={form.topicId}
            onChange={(e) => setForm((f) => ({ ...f, topicId: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="">General Topic</option>
            {(currentSubject?.topics || []).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <select
            value={form.questionSource}
            onChange={(e) => setForm((f) => ({ ...f, questionSource: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="sample_practice">Sample Practice Question</option>
            <option value="verified_past_question">Verified Past Question</option>
          </select>

          <div className="flex gap-2">
            <select
              value={form.difficulty}
              onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
            <input
              type="number"
              placeholder="Year"
              value={form.examYear}
              onChange={(e) => setForm((f) => ({ ...f, examYear: e.target.value }))}
              className="w-24 rounded-lg border border-slate-300 px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <textarea
            required
            rows={2}
            placeholder="Question stem..."
            value={form.questionText}
            onChange={(e) => setForm((f) => ({ ...f, questionText: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-4 dark:border-slate-700 dark:bg-slate-800"
          />

          <input required placeholder="Option A" value={form.optionA} onChange={(e) => setForm((f) => ({ ...f, optionA: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
          <input required placeholder="Option B" value={form.optionB} onChange={(e) => setForm((f) => ({ ...f, optionB: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
          <input required placeholder="Option C" value={form.optionC} onChange={(e) => setForm((f) => ({ ...f, optionC: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
          <input required placeholder="Option D" value={form.optionD} onChange={(e) => setForm((f) => ({ ...f, optionD: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />

          <select
            value={form.correctOption}
            onChange={(e) => setForm((f) => ({ ...f, correctOption: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="A">Correct: A</option>
            <option value="B">Correct: B</option>
            <option value="C">Correct: C</option>
            <option value="D">Correct: D</option>
          </select>

          <input
            placeholder="Explanation..."
            value={form.explanation}
            onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2 dark:border-slate-700 dark:bg-slate-800"
          />

          <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
            <Upload className="h-3.5 w-3.5" />
            <span>{form.questionImageUrl ? 'Image Attached' : 'Attach Image'}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
            />
          </label>
        </div>
        {msg && <p className="mt-2 text-xs font-semibold text-emerald-600">{msg}</p>}
        <button type="submit" className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">
          Save Question
        </button>
      </form>

      {/* Filter & List */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3">
          <select
            value={filterSub}
            onChange={(e) => setFilterSub(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="">All Subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            <option value="All">All Sources</option>
            <option value="sample_practice">Sample Practice</option>
            <option value="verified_past_question">Verified Past Question</option>
          </select>
        </div>

        <div className="space-y-2.5">
          {questions.map((q) => (
            <div key={q.id} className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                  {q.subjectCode} · {q.difficulty} · {q.questionSource === 'verified_past_question' ? `Verified Past (${q.examYear || 'N/A'})` : 'Sample Practice'}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{q.questionText}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Correct: {q.options.find((o) => o.isCorrect)?.label} — {q.options.find((o) => o.isCorrect)?.text}
                </p>
              </div>
              <button
                type="button"
                onClick={() => deleteQuestion(q.id)}
                className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SAMPLE_CSV = `subjectCode,questionText,optionA,optionB,optionC,optionD,correctOption,difficulty,questionSource,examYear,explanation
MTH,"Solve 2x + 6 = 14","2","3","4","5","C","Easy","sample_practice","","2x = 8 therefore x = 4."
PHY,"The SI unit of electric charge is the:","Ampere","Coulomb","Volt","Ohm","B","Easy","sample_practice","","Electric charge is measured in Coulombs (C)."`;

export function AdminBulkUploadPanel() {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [payload, setPayload] = useState(SAMPLE_CSV);
  const [defaultSource, setDefaultSource] = useState<'sample_practice' | 'verified_past_question'>('sample_practice');
  const [result, setResult] = useState<{ inserted: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    setError(null);
    setResult(null);
    try {
      const res = await apiFetch<{ inserted: number; errors: string[] }>('/api/admin/questions/bulk', {
        method: 'POST',
        body: JSON.stringify({ format, payload, defaultSource }),
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk import failed.');
    }
  };

  return (
    <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">Bulk Question Upload (CSV / JSON)</h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          Import multiple questions in a single PostgreSQL transaction. Use <code className="font-mono">sample_practice</code> or <code className="font-mono">verified_past_question</code> in <code className="font-mono">questionSource</code>.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as 'csv' | 'json')}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="csv">CSV Format</option>
          <option value="json">JSON Array</option>
        </select>

        <select
          value={defaultSource}
          onChange={(e) => setDefaultSource(e.target.value as 'sample_practice' | 'verified_past_question')}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
        >
          <option value="sample_practice">Default Source: Sample Practice</option>
          <option value="verified_past_question">Default Source: Verified Past Question</option>
        </select>

        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700">
          <FileUp className="h-3.5 w-3.5" />
          <span>Load .csv / .json File</span>
          <input
            type="file"
            accept=".csv,.json,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                f.text().then(setPayload);
              }
            }}
          />
        </label>
      </div>

      <textarea
        rows={10}
        value={payload}
        onChange={(e) => setPayload(e.target.value)}
        className="w-full rounded-lg border border-slate-300 p-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
      />

      {result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <p className="font-bold">Imported {result.inserted} question(s) into PostgreSQL.</p>
          {result.errors.length > 0 && <p className="mt-1 text-rose-700">Row issues: {result.errors.join(' | ')}</p>}
        </div>
      )}
      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}

      <button
        type="button"
        onClick={handleUpload}
        className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Import Questions
      </button>
    </div>
  );
}

export function AdminExamsAndMocksPanel({ mode }: { mode: 'practice' | 'mocks' }) {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [exams, setExams] = useState<Array<{ id: string; title: string; durationMinutes: number; questionCount: number; isActive: boolean; startAt?: string; endAt?: string }>>([]);
  const [title, setTitle] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [questionCount, setQuestionCount] = useState(40);
  const [startAt, setStartAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [endAt, setEndAt] = useState(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16));

  const load = useCallback(async () => {
    const sRes = await apiFetch<{ subjects: SubjectItem[] }>('/api/admin/subjects');
    setSubjects(sRes.subjects);
    if (mode === 'practice') {
      const eRes = await apiFetch<{ examinations: typeof exams }>('/api/admin/examinations');
      setExams(eRes.examinations);
    } else {
      const mRes = await apiFetch<{ mocks: typeof exams }>('/api/admin/mocks');
      setExams(mRes.mocks);
    }
  }, [mode]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSub = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;
    if (mode === 'practice') {
      await apiFetch('/api/admin/examinations', {
        method: 'POST',
        body: JSON.stringify({
          title,
          examType: selectedIds.length === 4 ? 'utme_4_subject' : 'practice',
          durationMinutes,
          questionCount,
          subjectIds: selectedIds,
        }),
      });
    } else {
      await apiFetch('/api/admin/mocks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          subjectIds: selectedIds,
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          durationMinutes,
          questionCount,
        }),
      });
    }
    setTitle('');
    setSelectedIds([]);
    load();
  };

  const toggleActive = async (id: string, current: boolean) => {
    const url = mode === 'practice' ? `/api/admin/examinations/${id}` : `/api/admin/mocks/${id}`;
    await apiFetch(url, { method: 'PATCH', body: JSON.stringify({ isActive: !current }) });
    load();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
          {mode === 'practice' ? 'Create Practice Examination Blueprint' : 'Schedule Mock Examination'}
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            required
            placeholder="Examination Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2 dark:border-slate-700 dark:bg-slate-800"
          />
          <div className="flex gap-2">
            <input
              type="number"
              min={5}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              placeholder="Mins"
              className="w-1/2 rounded-lg border border-slate-300 px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              type="number"
              min={5}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              placeholder="Qs"
              className="w-1/2 rounded-lg border border-slate-300 px-2.5 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          {mode === 'mocks' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Start Window</label>
                <input
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">End Window</label>
                <input
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </>
          )}
        </div>
        <p className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-400">Select up to 4 subjects:</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {subjects.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleSub(s.id)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                selectedIds.includes(s.id)
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              {s.code}
            </button>
          ))}
        </div>
        <button type="submit" className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white">
          {mode === 'practice' ? 'Save Practice Exam' : 'Schedule Mock'}
        </button>
      </form>

      <div className="space-y-3">
        {exams.map((ex) => (
          <div key={ex.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{ex.title}</p>
              <p className="text-xs text-slate-500">
                {ex.questionCount} Qs · {ex.durationMinutes} mins
                {ex.startAt ? ` · ${new Date(ex.startAt).toLocaleDateString()} – ${new Date(ex.endAt!).toLocaleDateString()}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toggleActive(ex.id, ex.isActive)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                ex.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {ex.isActive ? 'Active' : 'Inactive'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminMaterialsPanel() {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [materials, setMaterials] = useState<Array<{ id: string; title: string; category: string; subjectName: string; fileName: string; downloadCount: number }>>([]);
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Study Notes');
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [sRes, mRes] = await Promise.all([
      apiFetch<{ subjects: SubjectItem[] }>('/api/admin/subjects'),
      apiFetch<{ materials: typeof materials }>('/api/admin/materials'),
    ]);
    setSubjects(sRes.subjects);
    if (!subjectId && sRes.subjects[0]) setSubjectId(sRes.subjects[0].id);
    setMaterials(mRes.materials);
  }, [subjectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !subjectId) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('subjectId', subjectId);
    fd.append('title', title);
    fd.append('description', description);
    fd.append('category', category);
    await apiFetch('/api/admin/materials', { method: 'POST', body: fd });
    setTitle('');
    setDescription('');
    setFile(null);
    setMsg('Study material uploaded.');
    load();
  };

  const deleteMaterial = async (id: string) => {
    await apiFetch(`/api/admin/materials/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleUpload} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">Upload Study Material</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800">
            <option value="Study Notes">Study Notes</option>
            <option value="Past Questions">Past Questions</option>
            <option value="Tutorials">Tutorials</option>
            <option value="Revision Materials">Revision Materials</option>
          </select>
          <input required placeholder="Material Title" value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2 dark:border-slate-700 dark:bg-slate-800" />
          <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2 dark:border-slate-700 dark:bg-slate-800" />
          <input type="file" required accept=".pdf,.txt,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-xs sm:col-span-2" />
        </div>
        {msg && <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-600"><CheckCircle2 className="h-4 w-4" />{msg}</p>}
        <button type="submit" className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white">Upload File</button>
      </form>

      <div className="space-y-2.5">
        {materials.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">{m.subjectName} · {m.category}</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{m.title}</p>
              <p className="text-xs text-slate-500">{m.fileName} · {m.downloadCount} downloads</p>
            </div>
            <button type="button" onClick={() => deleteMaterial(m.id)} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
