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
  Home,
  LogOut,
  Menu,
  Moon,
  Play,
  Settings as SettingsIcon,
  Sliders,
  Sun,
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

  const [materials, setMaterials] = useState<StudyMaterialRow[]>([]);
  const [matSubjects, setMatSubjects] = useState<SubjectItem[]>([]);
  const [matSubjectId, setMatSubjectId] = useState('');
  const [matCategory, setMatCategory] = useState('All');
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);

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
      void loadDashboard();
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
      setProfileMsg('Profile saved.');
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : 'Unable to save profile.');
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
      setPwMsg(err instanceof Error ? err.message : 'Unable to change password.');
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
        setVerifyMsg('Your email is now verified.');
      } else {
        setVerifyMsg(res.message);
      }
    } catch (err) {
      setVerifyMsg(err instanceof Error ? err.message : 'Verification failed.');
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

  const navItems: Array<{ id: StudentTab; label: string; icon: typeof Home }> = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'start-cbt', label: 'Start Examination', icon: Play },
    { id: 'practice', label: 'Practice Tests', icon: Sliders },
    { id: 'mocks', label: 'Mock Exams', icon: Award },
    { id: 'past-questions', label: 'Past Questions', icon: FileQuestion },
    { id: 'subjects', label: 'Subjects', icon: BookOpen },
    { id: 'results', label: 'Results', icon: ClipboardCheck },
    { id: 'analytics', label: 'Performance', icon: BarChart3 },
    { id: 'materials', label: 'Study Notes', icon: FileText },
    { id: 'notifications', label: 'Messages', icon: Bell },
    { id: 'profile', label: 'Profile', icon: UserIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const selectTab = (next: StudentTab) => {
    setTab(next);
    setMobileNavOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-[#F4F6F8] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Desktop Navigation Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-800 bg-[#0F2447] text-blue-100 lg:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-blue-900/70 px-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1D4ED8] text-white">
            <GraduationCap className="h-4 w-4" />
          </span>
          <span className="font-display text-sm font-bold text-white">Acadet CBT JAMB</span>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTab(item.id)}
                className={`flex min-h-[40px] w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium ${
                  active ? 'bg-[#1D4ED8] text-white' : 'text-blue-200 hover:bg-blue-900/60 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-blue-900/70 p-2.5">
          <button
            type="button"
            onClick={onLogout}
            className="flex min-h-[40px] w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-rose-300 hover:bg-rose-950/50"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="flex w-72 flex-col bg-[#0F2447] text-blue-100">
            <div className="flex h-14 items-center justify-between border-b border-blue-900 px-4">
              <span className="font-display text-sm font-bold text-white">Acadet CBT JAMB</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-blue-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-0.5 overflow-y-auto p-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectTab(item.id)}
                    className={`flex min-h-[44px] w-full items-center gap-3 rounded-md px-3 text-sm font-medium ${
                      tab === item.id ? 'bg-[#1D4ED8] text-white' : 'text-blue-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-blue-900 p-3">
              <button
                type="button"
                onClick={onLogout}
                className="flex min-h-[44px] w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-rose-300"
              >
                <LogOut className="h-4 w-4" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
          <div className="flex-1 bg-slate-950/50" onClick={() => setMobileNavOpen(false)} />
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex min-w-0 flex-1 flex-col pb-16 lg:pb-0">
        {/* Compact Top Bar (56px) */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-300 bg-white px-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              className="flex h-10 w-10 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 lg:hidden dark:text-slate-300"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="font-display text-base font-bold text-[#0F2447] dark:text-white">
              {navItems.find((n) => n.id === tab)?.label || 'Student Portal'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => selectTab('notifications')}
              aria-label="Messages"
              className="relative flex h-10 w-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Bell className="h-4 w-4" />
              {(dashboard?.stats.unreadNotificationsCount || 0) > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-700 font-mono text-[10px] font-bold text-white">
                  {dashboard?.stats.unreadNotificationsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => selectTab('profile')}
              className="flex h-10 items-center gap-2 rounded-md border border-slate-300 px-2.5 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <div className="hidden text-right sm:block">
                <p className="font-mono text-xs font-bold text-[#0F2447] dark:text-white">
                  {user.registrationNumber}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">{user.fullName}</p>
              </div>
              <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#0F2447] text-xs font-bold text-white">
                {user.fullName.charAt(0).toUpperCase()}
              </span>
            </button>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
          {tab === 'dashboard' && (
            <div className="space-y-5">
              {/* Candidate Header Card */}
              <div className="rounded-lg border border-slate-300 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="font-display text-xl font-bold text-[#0F2447] sm:text-2xl dark:text-white">
                      Welcome, {user.fullName}
                    </h1>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      Registration No: <span className="font-mono font-semibold text-slate-900 dark:text-white">{user.registrationNumber}</span> ·{' '}
                      {user.jambYear} UTME · {user.intendedCourse || 'Candidate'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectTab('start-cbt')}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-[#1D4ED8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                  >
                    <Play className="h-4 w-4" />
                    <span>Start Examination</span>
                  </button>
                </div>
              </div>

              {/* Continue Active Test Notice */}
              {dashboard?.activeSession && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/50">
                  <div>
                    <p className="text-sm font-bold text-amber-950 dark:text-amber-200">
                      Unfinished Examination: {dashboard.activeSession.examTitle}
                    </p>
                    <p className="text-xs text-amber-900 dark:text-amber-300">
                      {dashboard.activeSession.totalQuestions} questions · Your previous answers are saved.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEnterExam(dashboard.activeSession!.id)}
                    className="min-h-[40px] rounded-md bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700"
                  >
                    Continue Examination
                  </button>
                </div>
              )}

              {/* Summary Metrics Strip */}
              <div className="grid grid-cols-2 divide-y divide-slate-200 rounded-lg border border-slate-300 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                <div className="p-4">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Tests Taken</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-[#0F2447] tabular-nums dark:text-white">
                    {dashboard?.stats.totalAttempted ?? 0}
                  </p>
                </div>
                <div className="p-4">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Average Score</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-[#1D4ED8] tabular-nums dark:text-blue-400">
                    {dashboard?.stats.averagePercentage ?? 0}%
                  </p>
                </div>
                <div className="p-4">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Highest UTME Score</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
                    {dashboard?.stats.highestScoreOutOf400 ?? 0}/400
                  </p>
                </div>
                <div className="p-4">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Overall Progress</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-[#0F2447] tabular-nums dark:text-white">
                    {dashboard?.stats.overallProgress ?? 0}%
                  </p>
                </div>
              </div>

              {/* Quick Navigation Actions */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => selectTab('start-cbt')}
                  className="rounded-lg border border-slate-300 bg-white p-4 text-left hover:border-[#1D4ED8] dark:border-slate-800 dark:bg-slate-900"
                >
                  <p className="text-sm font-bold text-[#0F2447] dark:text-white">4-Subject JAMB CBT</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Use of English plus three subjects with timer.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => selectTab('past-questions')}
                  className="rounded-lg border border-slate-300 bg-white p-4 text-left hover:border-[#1D4ED8] dark:border-slate-800 dark:bg-slate-900"
                >
                  <p className="text-sm font-bold text-[#0F2447] dark:text-white">Past Questions</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Read questions by subject and check answers.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => selectTab('results')}
                  className="rounded-lg border border-slate-300 bg-white p-4 text-left hover:border-[#1D4ED8] dark:border-slate-800 dark:bg-slate-900"
                >
                  <p className="text-sm font-bold text-[#0F2447] dark:text-white">My Results</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    Review past scores and answer explanations.
                  </p>
                </button>
              </div>

              {/* Recent Results & Notices */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <div className="rounded-lg border border-slate-300 bg-white lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                    <h2 className="font-display text-sm font-bold text-[#0F2447] dark:text-white">Recent Examination Results</h2>
                    <button
                      type="button"
                      onClick={() => selectTab('results')}
                      className="text-xs font-semibold text-[#1D4ED8] hover:underline dark:text-blue-400"
                    >
                      View All
                    </button>
                  </div>
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {(dashboard?.recentResults || []).length === 0 ? (
                      <p className="p-4 text-xs text-slate-500">No examinations completed yet.</p>
                    ) : (
                      dashboard!.recentResults.map((r) => (
                        <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
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
                            className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 font-mono text-xs font-bold text-[#1D4ED8] hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                          >
                            {r.scoreOutOf400}/400
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-300 bg-white lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                    <h2 className="font-display text-sm font-bold text-[#0F2447] dark:text-white">Notices</h2>
                  </div>
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {(dashboard?.announcements || []).length === 0 ? (
                      <p className="p-4 text-xs text-slate-500">No notices at this time.</p>
                    ) : (
                      dashboard!.announcements.map((a) => (
                        <div key={a.id} className="p-4">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{a.title}</p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{a.body}</p>
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
            <div className="space-y-5">
              <div>
                <h1 className="font-display text-xl font-bold text-[#0F2447] dark:text-white">Study Materials</h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Download notes, tutorials, and past question files by subject.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-300 bg-white p-4 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
                <select
                  value={matSubjectId}
                  onChange={(e) => setMatSubjectId(e.target.value)}
                  className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">All Subjects</option>
                  {matSubjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <select
                  value={matCategory}
                  onChange={(e) => setMatCategory(e.target.value)}
                  className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="All">All Categories</option>
                  <option value="Past Questions">Past Questions</option>
                  <option value="Tutorials">Tutorials</option>
                  <option value="Study Notes">Study Notes</option>
                  <option value="Revision Materials">Revision Materials</option>
                </select>
              </div>

              <div className="divide-y divide-slate-200 rounded-lg border border-slate-300 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {materials.length === 0 ? (
                  <p className="p-6 text-center text-sm text-slate-500">No study materials found.</p>
                ) : (
                  materials.map((m) => (
                    <div key={m.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[#1D4ED8] dark:text-blue-400">
                          {m.subjectName} · {m.category} · {(m.fileSizeBytes / 1024).toFixed(1)} KB
                        </p>
                        <h3 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">{m.title}</h3>
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{m.description}</p>
                      </div>
                      <a
                        href={`/api/student/materials/${m.id}/download`}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md bg-[#0F2447] px-4 py-2 text-xs font-semibold text-white hover:bg-[#173566]"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download</span>
                      </a>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="font-display text-xl font-bold text-[#0F2447] dark:text-white">Messages</h1>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await apiFetch('/api/student/notifications/read-all', { method: 'POST' });
                      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                      void loadDashboard();
                    } catch {
                      // handled gracefully
                    }
                  }}
                  className="min-h-[38px] rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  Mark All Read
                </button>
              </div>
              <div className="divide-y divide-slate-200 rounded-lg border border-slate-300 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {notifications.length === 0 ? (
                  <p className="p-6 text-center text-sm text-slate-500">No messages yet.</p>
                ) : (
                  notifications.map((n) => (
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
                      className={`cursor-pointer p-4 ${n.isRead ? '' : 'bg-blue-50/60 dark:bg-blue-950/30'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{n.title}</h3>
                        <span className="text-[11px] text-slate-500">{new Date(n.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'profile' && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="rounded-lg border border-slate-300 bg-white p-5 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
                <h1 className="font-display text-lg font-bold text-[#0F2447] dark:text-white">My Profile</h1>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
                  <div>
                    <p className="text-xs text-slate-500">Registration Number</p>
                    <p className="font-mono text-sm font-bold text-[#0F2447] dark:text-blue-400">
                      {user.registrationNumber}
                    </p>
                  </div>
                  {user.emailVerified ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Email Verified
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendVerify}
                      className="min-h-[36px] rounded-md bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700"
                    >
                      Verify Email
                    </button>
                  )}
                </div>
                {verifyMsg && <p className="mt-2 text-xs text-emerald-700">{verifyMsg}</p>}

                <form onSubmit={handleSaveProfile} className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-400">Full Name</label>
                    <input
                      value={profileForm.fullName}
                      onChange={(e) => setProfileForm((f) => ({ ...f, fullName: e.target.value }))}
                      className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-400">Phone Number</label>
                    <input
                      value={profileForm.phoneNumber}
                      onChange={(e) => setProfileForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                      className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-400">JAMB Year</label>
                    <input
                      type="number"
                      value={profileForm.jambYear}
                      onChange={(e) => setProfileForm((f) => ({ ...f, jambYear: e.target.value }))}
                      className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-400">Intended Course</label>
                    <input
                      value={profileForm.intendedCourse}
                      onChange={(e) => setProfileForm((f) => ({ ...f, intendedCourse: e.target.value }))}
                      className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-400">Preferred Institution</label>
                    <input
                      value={profileForm.preferredInstitution}
                      onChange={(e) => setProfileForm((f) => ({ ...f, preferredInstitution: e.target.value }))}
                      className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  {profileMsg && <p className="sm:col-span-2 text-xs font-semibold text-emerald-700">{profileMsg}</p>}
                  <div className="sm:col-span-2">
                    <button type="submit" className="min-h-[42px] rounded-md bg-[#0F2447] px-5 text-sm font-semibold text-white hover:bg-[#173566]">
                      Save Profile
                    </button>
                  </div>
                </form>
              </div>

              <div className="rounded-lg border border-slate-300 bg-white p-5 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="font-display text-lg font-bold text-[#0F2447] dark:text-white">Change Password</h2>
                <form onSubmit={handleChangePassword} className="mt-4 space-y-3.5">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-400">Current Password</label>
                    <input
                      type="password"
                      required
                      value={pwForm.currentPassword}
                      onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
                      className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-400">New Password</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={pwForm.newPassword}
                      onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                      className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  {pwMsg && <p className="text-xs font-semibold text-[#1D4ED8]">{pwMsg}</p>}
                  <button type="submit" className="min-h-[42px] rounded-md bg-[#0F2447] px-4 text-sm font-semibold text-white hover:bg-[#173566]">
                    Update Password
                  </button>
                </form>
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="max-w-2xl rounded-lg border border-slate-300 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h1 className="font-display text-lg font-bold text-[#0F2447] dark:text-white">Examination Settings</h1>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Changes are saved automatically to your account.
              </p>

              <div className="mt-5 divide-y divide-slate-200 dark:divide-slate-800">
                <div className="flex items-center justify-between py-3.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Display Theme</p>
                    <p className="text-xs text-slate-500">Choose light or dark screen mode</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updatePreference({ theme: user.preferences?.theme === 'dark' ? 'light' : 'dark' })
                    }
                    className="inline-flex min-h-[38px] items-center gap-2 rounded-md border border-slate-300 px-3 text-xs font-semibold dark:border-slate-700"
                  >
                    {user.preferences?.theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
                    <span>{user.preferences?.theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between py-3.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Question Text Size</p>
                    <p className="text-xs text-slate-500">Adjust question font size inside the exam screen</p>
                  </div>
                  <select
                    value={user.preferences?.fontSize || 'normal'}
                    onChange={(e) => updatePreference({ fontSize: e.target.value as 'normal' | 'large' })}
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="normal">Standard</option>
                    <option value="large">Large</option>
                  </select>
                </div>

                <label className="flex items-center justify-between py-3.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Show Question Number Grid</p>
                    <p className="text-xs text-slate-500">Display question grid beside questions on desktop</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={user.preferences?.showQuestionPalette !== false}
                    onChange={(e) => updatePreference({ showQuestionPalette: e.target.checked })}
                    className="h-4 w-4 rounded text-[#1D4ED8]"
                  />
                </label>

                <label className="flex items-center justify-between py-3.5">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Move to Next Question Automatically</p>
                    <p className="text-xs text-slate-500">Advance after picking option A, B, C, or D</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(user.preferences?.autoNextQuestion)}
                    onChange={(e) => updatePreference({ autoNextQuestion: e.target.checked })}
                    className="h-4 w-4 rounded text-[#1D4ED8]"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (56px compact thumb zone) */}
      <nav className="fixed right-0 bottom-0 left-0 z-30 grid h-14 grid-cols-5 border-t border-slate-300 bg-white lg:hidden dark:border-slate-800 dark:bg-slate-900">
        {[
          { id: 'dashboard' as StudentTab, label: 'Home', icon: Home },
          { id: 'start-cbt' as StudentTab, label: 'Start Exam', icon: Play },
          { id: 'past-questions' as StudentTab, label: 'Past Qs', icon: FileQuestion },
          { id: 'results' as StudentTab, label: 'Results', icon: ClipboardCheck },
        ].map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectTab(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                active ? 'text-[#1D4ED8] dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400"
        >
          <Menu className="h-4 w-4" />
          <span>Menu</span>
        </button>
      </nav>
    </div>
  );
}
