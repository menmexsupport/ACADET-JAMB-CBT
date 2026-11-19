import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileQuestion,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Play,
  Settings as SettingsIcon,
  Sliders,
  Sun,
  TrendingUp,
  User as UserIcon,
  X,
} from 'lucide-react';
import { apiFetch, setSessionToken } from '../../lib/api.ts';
import { AuthUser, ExamResultItem, SubjectItem, UserPreferences } from '../../types/index.ts';
import {
  MockExamsView,
  PastQuestionsView,
  PracticeExamsView,
  StartCbtView,
  SubjectsView,
} from './StudentExamLaunchers.tsx';
import { AnalyticsView, ResultsView } from './StudentResultsAndAnalytics.tsx';

export type StudentTab =
  | 'dashboard'
  | 'start-cbt'
  | 'practice'
  | 'mocks'
  | 'past-questions'
  | 'subjects'
  | 'results'
  | 'analytics'
  | 'materials'
  | 'notifications'
  | 'profile'
  | 'settings';

interface StudentWorkspaceProps {
  user: AuthUser;
  onUserUpdated: (user: AuthUser) => void;
  onEnterExam: (sessionId: string) => void;
  onLogout: () => void;
  initialTab?: StudentTab;
  initialResultSessionId?: string | null;
}

interface DashboardResponse {
  stats: {
    totalAttempted: number;
    averagePercentage: number;
    highestPercentage: number;
    highestScoreOutOf400: number;
    overallProgress: number;
    unreadNotificationsCount: number;
  };
  activeSession: {
    id: string;
    examTitle: string;
    totalQuestions: number;
    remainingSeconds: number;
  } | null;
  recentResults: ExamResultItem[];
  announcements: Array<{ id: string; title: string; body: string; isPinned: boolean; createdAt: string }>;
  practiceExams: Array<{ id: string; title: string; durationMinutes: number; questionCount: number }>;
  upcomingMocks: Array<{ id: string; title: string; startAt: string; durationMinutes: number }>;
}

interface StudyMaterialRow {
  id: string;
  title: string;
  description: string;
  category: string;
  subjectName: string;
  subjectCode: string;
  fileName: string;
  fileSizeBytes: number;
  downloadCount: number;
}

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export default function StudentWorkspace({
  user,
  onUserUpdated,
  onEnterExam,
  onLogout,
  initialTab = 'dashboard',
  initialResultSessionId = null,
}: StudentWorkspaceProps) {
  const [tab, setTab] = useState<StudentTab>(initialTab);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [resultSessionToOpen, setResultSessionToOpen] = useState<string | null>(initialResultSessionId);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (initialResultSessionId) {
      setResultSessionToOpen(initialResultSessionId);
      setTab('results');
    }
  }, [initialResultSessionId]);

  // Materials state
  const [materials, setMaterials] = useState<StudyMaterialRow[]>([]);
  const [matSubjects, setMatSubjects] = useState<SubjectItem[]>([]);
  const [matSubjectId, setMatSubjectId] = useState('');
  const [matCategory, setMatCategory] = useState('All');

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

  // Profile state
  const [profileForm, setProfileForm] = useState({
    fullName: user.fullName,
    phoneNumber: user.phoneNumber || '',
    jambYear: String(user.jambYear || 2026),
    intendedCourse: user.intendedCourse || '',
    preferredInstitution: user.preferredInstitution || '',
  });
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '' });
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const data = await apiFetch<DashboardResponse>('/api/student/dashboard');
      setDashboard(data);
    } catch {
      // handled gracefully
    }
  }, []);

  useEffect(() => {
    if (tab === 'dashboard') {
      loadDashboard();
    }
  }, [tab, loadDashboard]);

  useEffect(() => {
    if (tab === 'materials') {
      apiFetch<{ subjects: SubjectItem[] }>('/api/student/subjects')
        .then((r) => setMatSubjects(r.subjects))
        .catch(() => {});
      const params = new URLSearchParams();
      if (matSubjectId) params.set('subjectId', matSubjectId);
      if (matCategory !== 'All') params.set('category', matCategory);
      apiFetch<{ materials: StudyMaterialRow[] }>(`/api/student/materials?${params.toString()}`)
        .then((r) => setMaterials(r.materials))
        .catch(() => {});
    }
  }, [tab, matSubjectId, matCategory]);

  useEffect(() => {
    if (tab === 'notifications') {
      apiFetch<{ notifications: NotificationRow[] }>('/api/student/notifications')
        .then((r) => setNotifications(r.notifications))
        .catch(() => {});
    }
  }, [tab]);

  const handleQuickLaunchSubject = async (subjectId: string) => {
    try {
      const res = await apiFetch<{ sessionId: string }>('/api/exams/start', {
        method: 'POST',
        body: JSON.stringify({
          examType: 'practice',
          examMode: 'timed',
          subjectIds: [subjectId],
          questionCount: 10,
          durationMinutes: 15,
        }),
      });
      onEnterExam(res.sessionId);
    } catch {
      // handled gracefully
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    try {
      const res = await apiFetch<{ user: AuthUser }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({ ...profileForm, jambYear: Number(profileForm.jambYear) }),
      });
      onUserUpdated(res.user);
      setProfileMsg('Profile updated successfully.');
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    try {
      const res = await apiFetch<{ message: string; token?: string }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(pwForm),
      });
      if (res.token) setSessionToken(res.token);
      setPwMsg(res.message);
      setPwForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      setPwMsg(err instanceof Error ? err.message : 'Password change failed.');
    }
  };

  const handleResendVerify = async () => {
    setVerifyMsg(null);
    try {
      const res = await apiFetch<{ message: string; devVerifyToken?: string }>('/api/auth/resend-verification', {
        method: 'POST',
      });
      if (res.devVerifyToken) {
        await apiFetch('/api/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token: res.devVerifyToken }),
        });
        const me = await apiFetch<{ user: AuthUser | null }>('/api/auth/me');
        if (me.user) onUserUpdated(me.user);
        setVerifyMsg('Email verified successfully!');
      } else {
        setVerifyMsg(res.message);
      }
    } catch (err) {
      setVerifyMsg(err instanceof Error ? err.message : 'Verification request failed.');
    }
  };

  const updatePreference = async (patch: Partial<UserPreferences>) => {
    try {
      const res = await apiFetch<{ preferences: UserPreferences }>('/api/auth/preferences', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      onUserUpdated({ ...user, preferences: res.preferences });
    } catch {
      // ignore failed preference sync
    }
  };

  const navItems: Array<{ id: StudentTab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'start-cbt', label: 'Start CBT', icon: Play },
    { id: 'practice', label: 'Practice Exams', icon: Sliders },
    { id: 'mocks', label: 'Mock Examinations', icon: Award },
    { id: 'past-questions', label: 'Past Questions', icon: FileQuestion },
    { id: 'subjects', label: 'Subjects', icon: BookOpen },
    { id: 'results', label: 'My Results', icon: ClipboardCheck },
    { id: 'analytics', label: 'Performance Analytics', icon: BarChart3 },
    { id: 'materials', label: 'Study Materials', icon: FileText },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'profile', label: 'Profile', icon: UserIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const selectTab = (next: StudentTab) => {
    setTab(next);
    setMobileNavOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop Navy Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-[#0F2447] text-blue-100 lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-blue-900/70 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="font-display text-base font-extrabold text-white">Acadet JAMB CBT</span>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTab(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                  active ? 'bg-blue-600 text-white' : 'text-blue-200 hover:bg-blue-900/60 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-blue-900/70 p-3">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-rose-300 hover:bg-rose-950/50 hover:text-rose-200"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="w-72 bg-[#0F2447] p-4 text-blue-100 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b border-blue-900 pb-3">
              <span className="font-display text-base font-extrabold text-white">Acadet JAMB CBT</span>
              <button type="button" onClick={() => setMobileNavOpen(false)} className="p-1 text-blue-200">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectTab(item.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                      tab === item.id ? 'bg-blue-600 text-white' : 'text-blue-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={onLogout}
                className="mt-3 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-rose-300"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
          <div className="flex-1 bg-slate-950/50" onClick={() => setMobileNavOpen(false)} />
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex min-w-0 flex-1 flex-col pb-16 lg:pb-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="font-display text-sm font-bold text-slate-900 sm:text-base dark:text-white">
              {navItems.find((n) => n.id === tab)?.label || 'Student Portal'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => selectTab('notifications')}
              aria-label="Notifications"
              className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Bell className="h-5 w-5" />
              {(dashboard?.stats.unreadNotificationsCount || 0) > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 font-mono text-[10px] font-bold text-white">
                  {dashboard?.stats.unreadNotificationsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => selectTab('profile')}
              className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-1.5 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <div className="hidden text-right sm:block">
                <p className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                  {user.registrationNumber}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{user.fullName}</p>
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {user.fullName.charAt(0).toUpperCase()}
              </span>
            </button>
          </div>
        </header>

        {/* Viewport Body */}
        <div className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
          {tab === 'dashboard' && (
            <div className="space-y-6">
              {/* Welcome Navy Banner */}
              <div className="rounded-2xl bg-[#0F2447] p-6 text-white sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="font-display text-2xl font-bold sm:text-3xl">
                      Welcome back, {user.fullName.split(' ')[0]}!
                    </h1>
                    <p className="mt-1.5 text-sm text-blue-200">
                      Registration No: <span className="font-mono font-bold text-white">{user.registrationNumber}</span> ·{' '}
                      Target: {user.jambYear} UTME · {user.intendedCourse || 'Candidate'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectTab('start-cbt')}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-500"
                  >
                    <Play className="h-4 w-4" />
                    <span>Quick Start CBT</span>
                  </button>
                </div>
              </div>

              {/* Active Session Recovery Banner */}
              {dashboard?.activeSession && (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/50">
                  <div>
                    <p className="text-sm font-bold text-amber-950 dark:text-amber-200">
                      Examination In Progress: {dashboard.activeSession.examTitle}
                    </p>
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      {dashboard.activeSession.totalQuestions} questions · Your answers are synced to PostgreSQL.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEnterExam(dashboard.activeSession!.id)}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700"
                  >
                    Resume Exam Now
                  </button>
                </div>
              )}

              {/* 4 KPI Cards */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Exams Attempted</p>
                  <p className="mt-2 font-mono text-2xl font-extrabold text-slate-900 tabular-nums dark:text-white">
                    {dashboard?.stats.totalAttempted ?? 0}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Average Score</p>
                  <p className="mt-2 font-mono text-2xl font-extrabold text-blue-700 tabular-nums dark:text-blue-400">
                    {dashboard?.stats.averagePercentage ?? 0}%
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Highest UTME Score</p>
                  <p className="mt-2 font-mono text-2xl font-extrabold text-emerald-600 tabular-nums">
                    {dashboard?.stats.highestScoreOutOf400 ?? 0}/400
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Overall Progress</p>
                  <div className="mt-2 flex items-center gap-2">
                    <p className="font-mono text-2xl font-extrabold text-slate-900 tabular-nums dark:text-white">
                      {dashboard?.stats.overallProgress ?? 0}%
                    </p>
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                  </div>
                </div>
              </div>

              {/* Announcements & Quick Practice Grid */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">Important Announcements</h2>
                  <div className="mt-4 space-y-3">
                    {(dashboard?.announcements || []).length === 0 ? (
                      <p className="text-xs text-slate-500">No active announcements.</p>
                    ) : (
                      dashboard!.announcements.map((a) => (
                        <div key={a.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{a.title}</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{a.body}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">Recent Examination History</h2>
                    <button
                      type="button"
                      onClick={() => selectTab('results')}
                      className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-400"
                    >
                      View All
                    </button>
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {(dashboard?.recentResults || []).length === 0 ? (
                      <p className="text-xs text-slate-500">You have not completed any exams yet. Launch a CBT drill to get started!</p>
                    ) : (
                      dashboard!.recentResults.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between rounded-lg border border-slate-100 p-3 dark:border-slate-800"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{r.examTitle}</p>
                            <p className="text-xs text-slate-500">
                              {r.correctCount}/{r.totalQuestions} correct · {new Date(r.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setResultSessionToOpen(r.sessionId);
                              selectTab('results');
                            }}
                            className="shrink-0 rounded-lg bg-blue-50 px-3 py-1.5 font-mono text-xs font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300"
                          >
                            {r.scoreOutOf400}/400
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'start-cbt' && <StartCbtView student={user} onSessionStarted={onEnterExam} />}
          {tab === 'practice' && <PracticeExamsView onSessionStarted={onEnterExam} />}
          {tab === 'mocks' && (
            <MockExamsView
              onSessionStarted={onEnterExam}
              onViewResult={(sId) => {
                setResultSessionToOpen(sId);
                selectTab('results');
              }}
            />
          )}
          {tab === 'past-questions' && <PastQuestionsView onSessionStarted={onEnterExam} />}
          {tab === 'subjects' && <SubjectsView onLaunchSubject={handleQuickLaunchSubject} />}
          {tab === 'results' && (
            <ResultsView
              student={user}
              initialSessionId={resultSessionToOpen}
              onClearInitialSession={() => setResultSessionToOpen(null)}
            />
          )}
          {tab === 'analytics' && <AnalyticsView />}

          {tab === 'materials' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Study Materials</h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Download subject tutorials, revision handbooks, study notes, and past paper packs.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
                <select
                  value={matSubjectId}
                  onChange={(e) => setMatSubjectId(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">All Subjects</option>
                  {matSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={matCategory}
                  onChange={(e) => setMatCategory(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="All">All Categories</option>
                  <option value="Past Questions">Past Questions</option>
                  <option value="Tutorials">Tutorials</option>
                  <option value="Study Notes">Study Notes</option>
                  <option value="Revision Materials">Revision Materials</option>
                </select>
              </div>

              <div className="space-y-3">
                {materials.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                        {m.subjectName} · {m.category} · {(m.fileSizeBytes / 1024).toFixed(1)} KB
                      </p>
                      <h3 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-white">{m.title}</h3>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{m.description}</p>
                    </div>
                    <a
                      href={`/api/student/materials/${m.id}/download`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Notifications</h1>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await apiFetch('/api/student/notifications/read-all', { method: 'POST' });
                      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                      loadDashboard();
                    } catch {
                      // handled gracefully
                    }
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200"
                >
                  Mark All Read
                </button>
              </div>
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={async () => {
                      if (!n.isRead) {
                        try {
                          await apiFetch(`/api/student/notifications/${n.id}/read`, { method: 'POST' });
                          setNotifications((prev) =>
                            prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))
                          );
                        } catch {
                          // handled gracefully
                        }
                      }
                    }}
                    className={`cursor-pointer rounded-xl border p-4 ${
                      n.isRead
                        ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                        : 'border-blue-300 bg-blue-50/70 dark:border-blue-800 dark:bg-blue-950/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">{n.title}</h3>
                      <span className="text-[11px] text-slate-500">{new Date(n.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'profile' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
                <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">Candidate Profile</h1>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
                  <div>
                    <p className="text-xs text-slate-500">Registration Number</p>
                    <p className="font-mono text-sm font-bold text-[#0F2447] dark:text-blue-400">
                      {user.registrationNumber}
                    </p>
                  </div>
                  {user.emailVerified ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" /> Email Verified
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendVerify}
                      className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600"
                    >
                      Verify Email Now
                    </button>
                  )}
                </div>
                {verifyMsg && <p className="mt-2 text-xs text-emerald-600">{verifyMsg}</p>}

                <form onSubmit={handleSaveProfile} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Full Name</label>
                    <input
                      value={profileForm.fullName}
                      onChange={(e) => setProfileForm((f) => ({ ...f, fullName: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Phone Number</label>
                    <input
                      value={profileForm.phoneNumber}
                      onChange={(e) => setProfileForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">JAMB Year</label>
                    <input
                      type="number"
                      value={profileForm.jambYear}
                      onChange={(e) => setProfileForm((f) => ({ ...f, jambYear: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Intended Course</label>
                    <input
                      value={profileForm.intendedCourse}
                      onChange={(e) => setProfileForm((f) => ({ ...f, intendedCourse: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Preferred Institution</label>
                    <input
                      value={profileForm.preferredInstitution}
                      onChange={(e) => setProfileForm((f) => ({ ...f, preferredInstitution: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  {profileMsg && <p className="sm:col-span-2 text-xs font-semibold text-emerald-600">{profileMsg}</p>}
                  <div className="sm:col-span-2">
                    <button type="submit" className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                      Save Profile
                    </button>
                  </div>
                </form>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">Change Password</h2>
                <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Current Password</label>
                    <input
                      type="password"
                      required
                      value={pwForm.currentPassword}
                      onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">New Password</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={pwForm.newPassword}
                      onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  {pwMsg && <p className="text-xs font-semibold text-blue-600">{pwMsg}</p>}
                  <button type="submit" className="rounded-lg bg-[#0F2447] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
                    Update Password
                  </button>
                </form>
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">CBT & Workspace Settings</h1>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Preferences are persisted directly in your PostgreSQL student profile.
              </p>

              <div className="mt-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Interface Theme</p>
                    <p className="text-xs text-slate-500">Switch between Light and Dark mode</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updatePreference({ theme: user.preferences?.theme === 'dark' ? 'light' : 'dark' })
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold dark:border-slate-700"
                  >
                    {user.preferences?.theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
                    <span>{user.preferences?.theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Exam Font Scaling</p>
                    <p className="text-xs text-slate-500">Larger text in the CBT Exam Hall</p>
                  </div>
                  <select
                    value={user.preferences?.fontSize || 'normal'}
                    onChange={(e) => updatePreference({ fontSize: e.target.value as 'normal' | 'large' })}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="normal">Standard</option>
                    <option value="large">Large</option>
                  </select>
                </div>

                <label className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Show Question Palette</p>
                    <p className="text-xs text-slate-500">Display numbered question navigation grid on desktop</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={user.preferences?.showQuestionPalette !== false}
                    onChange={(e) => updatePreference({ showQuestionPalette: e.target.checked })}
                    className="h-4 w-4 rounded text-blue-600"
                  />
                </label>

                <label className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Auto-Next After Answering</p>
                    <p className="text-xs text-slate-500">Automatically advance to the next question upon selecting A–D</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(user.preferences?.autoNextQuestion)}
                    onChange={(e) => updatePreference({ autoNextQuestion: e.target.checked })}
                    className="h-4 w-4 rounded text-blue-600"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed right-0 bottom-0 left-0 z-30 flex items-center justify-around border-t border-slate-200 bg-white py-2 lg:hidden dark:border-slate-800 dark:bg-slate-900">
        {[
          { id: 'dashboard' as StudentTab, label: 'Home', icon: LayoutDashboard },
          { id: 'start-cbt' as StudentTab, label: 'Start CBT', icon: Play },
          { id: 'mocks' as StudentTab, label: 'Mocks', icon: Award },
          { id: 'results' as StudentTab, label: 'Results', icon: ClipboardCheck },
          { id: 'materials' as StudentTab, label: 'Materials', icon: FileText },
        ].map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectTab(item.id)}
              className={`flex flex-col items-center gap-0.5 px-2 text-[11px] font-semibold ${
                active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
