import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileQuestion,
  FileText,
  Home,
  LayoutGrid,
  LogOut,
  Moon,
  Play,
  Settings as SettingsIcon,
  Shuffle,
  Sliders,
  Sun,
  Trophy,
  User as UserIcon,
  X,
} from 'lucide-react';
import BrandEmblem from '../../components/common/BrandEmblem.tsx';
import SampleCbtPreview, { SampleSubject } from '../../components/exam/SampleCbtPreview.tsx';
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

const DEFAULT_FOUR_SUBJECTS: SampleSubject[] = [
  { code: 'ENG', name: 'Use of English' },
  { code: 'MTH', name: 'Mathematics' },
  { code: 'PHY', name: 'Physics' },
  { code: 'CHM', name: 'Chemistry' },
];

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
  | 'leaderboard'
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

interface LeaderboardEntry {
  rank: number;
  userId: string;
  fullName: string;
  intendedCourse: string;
  jambYear: number;
  bestScoreOutOf400: number;
  averagePercentage: number;
  attemptsCount: number;
  isCurrentUser: boolean;
}

interface DashboardResponse {
  stats: {
    totalAttempted: number;
    averagePercentage: number;
    highestPercentage: number;
    highestScoreOutOf400: number;
    totalQuestionsAttempted: number;
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
  availableMaterials?: Array<{
    id: string;
    title: string;
    category: string;
    subjectName: string;
    fileSizeBytes: number;
  }>;
  leaderboard?: LeaderboardEntry[];
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
  const [showSampleCbt, setShowSampleCbt] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [randomLaunching, setRandomLaunching] = useState(false);
  const [quickLaunchMsg, setQuickLaunchMsg] = useState<string | null>(null);
  const [resultSessionToOpen, setResultSessionToOpen] = useState<string | null>(initialResultSessionId);
  const [selectedFourSubjects, setSelectedFourSubjects] = useState<SampleSubject[]>(() => {
    try {
      const raw = localStorage.getItem('acadet_selected_utme_subjects');
      if (raw) {
        const parsed = JSON.parse(raw) as SampleSubject[];
        if (Array.isArray(parsed) && parsed.length === 4) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_FOUR_SUBJECTS;
  });

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
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

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

  useEffect(() => {
    if (tab === 'leaderboard') {
      setLeaderboardLoading(true);
      apiFetch<{ leaderboard: LeaderboardEntry[] }>('/api/student/leaderboard')
        .then((r) => setLeaderboardRows(r.leaderboard))
        .catch(() => {})
        .finally(() => setLeaderboardLoading(false));
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

  const handleStartRandomPractice = async () => {
    try {
      setRandomLaunching(true);
      setQuickLaunchMsg(null);
      const subRes = await apiFetch<{ subjects: SubjectItem[] }>('/api/student/subjects');
      const selectedCodes = new Set(selectedFourSubjects.map((s) => s.code));
      let matchedIds = subRes.subjects
        .filter((s) => selectedCodes.has(s.code) && (s.questionCount || 0) > 0)
        .map((s) => s.id);
      if (matchedIds.length === 0) {
        matchedIds = subRes.subjects.filter((s) => (s.questionCount || 0) > 0).slice(0, 4).map((s) => s.id);
      }
      if (matchedIds.length === 0) {
        setQuickLaunchMsg('No active questions available yet for random practice.');
        setRandomLaunching(false);
        return;
      }
      const res = await apiFetch<{ sessionId: string }>('/api/exams/start', {
        method: 'POST',
        body: JSON.stringify({
          examType: 'practice',
          examMode: 'timed',
          subjectIds: matchedIds,
          questionCount: 20,
          durationMinutes: 25,
          randomize: true,
        }),
      });
      onEnterExam(res.sessionId);
    } catch (err) {
      setQuickLaunchMsg(err instanceof Error ? err.message : 'Unable to start random practice.');
      setRandomLaunching(false);
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
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'start-cbt', label: 'Take CBT', icon: Play },
    { id: 'practice', label: 'Practice by Subject', icon: Sliders },
    { id: 'mocks', label: 'Mock Examination', icon: Award },
    { id: 'past-questions', label: 'Past Questions', icon: FileQuestion },
    { id: 'subjects', label: 'Subjects', icon: BookOpen },
    { id: 'results', label: 'My Results', icon: ClipboardCheck },
    { id: 'analytics', label: 'Performance', icon: BarChart3 },
    { id: 'materials', label: 'Study Materials', icon: FileText },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    { id: 'notifications', label: 'Messages', icon: Bell },
    { id: 'profile', label: 'My Profile', icon: UserIcon },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const primaryMobileTabs: Array<{ id: StudentTab; label: string; icon: typeof Home }> = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'start-cbt', label: 'Take CBT', icon: Play },
    { id: 'results', label: 'Results', icon: ClipboardCheck },
    { id: 'materials', label: 'Materials', icon: FileText },
  ];

  const secondaryMobileItems = navItems.filter(
    (item) => !primaryMobileTabs.some((primary) => primary.id === item.id)
  );

  const isMoreTabActive =
    mobileNavOpen || !primaryMobileTabs.some((primary) => primary.id === tab);

  const selectTab = (next: StudentTab) => {
    setTab(next);
    setMobileNavOpen(false);
    setQuickLaunchMsg(null);
  };

  if (showSampleCbt) {
    return (
      <SampleCbtPreview
        candidateName={user.fullName}
        registrationNumber={user.registrationNumber}
        selectedSubjects={selectedFourSubjects}
        onClose={() => setShowSampleCbt(false)}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F2F4F7] text-[#111827] dark:bg-slate-950 dark:text-slate-100">
      {/* Deep Green Institutional Navigation Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[#094D25] bg-[#0B5E2E] text-emerald-50 lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-white/15 px-4">
          <BrandEmblem sizeClass="h-9 w-9" />
          <div className="min-w-0 leading-tight">
            <span className="block truncate font-display text-sm font-bold text-white">
              Pre-JAMB Academy CBT
            </span>
            <span className="block truncate text-[10px] text-emerald-100">
              Candidate Portal
            </span>
          </div>
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
                  active
                    ? 'bg-white font-bold text-[#0B5E2E]'
                    : 'text-emerald-50 hover:bg-[#094D25] hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.id === 'notifications' && (dashboard?.stats.unreadNotificationsCount || 0) > 0 && (
                  <span
                    className={`ml-auto rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums ${
                      active ? 'bg-[#0B5E2E] text-white' : 'bg-amber-400 text-[#111827]'
                    }`}
                  >
                    {dashboard?.stats.unreadNotificationsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/15 p-2.5">
          <button
            type="button"
            onClick={onLogout}
            className="flex min-h-[40px] w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-semibold text-white hover:bg-[#094D25]"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Secondary Navigation Bottom Sheet */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-slate-950/50 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="More options"
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-lg border-t border-[#CBD5E1] bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3 dark:border-slate-800">
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-bold text-[#0B5E2E] dark:text-emerald-400">
                  {user.fullName}
                </p>
                <p className="font-mono text-xs text-[#4B5563] dark:text-slate-400">
                  {user.registrationNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
                className="flex h-11 w-11 items-center justify-center rounded-md text-[#4B5563] hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-3">
              <div className="grid grid-cols-2 gap-2">
                {secondaryMobileItems.map((item) => {
                  const Icon = item.icon;
                  const active = tab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectTab(item.id)}
                      className={`flex min-h-[48px] items-center gap-2.5 rounded-md border px-3 py-2 text-left text-sm font-medium ${
                        active
                          ? 'border-[#0B5E2E] bg-emerald-50 font-bold text-[#0B5E2E] dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'border-[#E5E7EB] bg-white text-[#111827] hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                      {item.id === 'notifications' && (dashboard?.stats.unreadNotificationsCount || 0) > 0 && (
                        <span className="ml-auto font-mono text-xs font-bold text-rose-700 tabular-nums dark:text-rose-400">
                          {dashboard?.stats.unreadNotificationsCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 border-t border-[#E5E7EB] pt-3 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavOpen(false);
                    onLogout();
                  }}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
        {/* Top Portal Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#CBD5E1] bg-white px-4 sm:px-6 lg:h-16 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-w-0 items-center gap-2.5">
            {tab !== 'dashboard' ? (
              <button
                type="button"
                onClick={() => selectTab('dashboard')}
                aria-label="Back to Dashboard"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[#111827] hover:bg-slate-100 lg:hidden dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            ) : (
              <div className="lg:hidden">
                <BrandEmblem sizeClass="h-8 w-8" />
              </div>
            )}
            <h2 className="truncate font-display text-base font-bold text-[#111827] dark:text-white">
              {tab === 'dashboard' ? (
                <>
                  <span className="lg:hidden">Pre-JAMB Academy CBT</span>
                  <span className="hidden lg:inline">Candidate Dashboard</span>
                </>
              ) : (
                navItems.find((n) => n.id === tab)?.label || 'Candidate Portal'
              )}
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <button
              type="button"
              onClick={() => selectTab('notifications')}
              aria-label="Messages"
              className="relative flex h-10 w-10 items-center justify-center rounded-md border border-[#CBD5E1] text-[#374151] hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Bell className="h-4 w-4" />
              {(dashboard?.stats.unreadNotificationsCount || 0) > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-sm bg-[#DC2626] px-1 font-mono text-[10px] font-bold text-white tabular-nums">
                  {dashboard?.stats.unreadNotificationsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => selectTab('profile')}
              aria-label="My Profile"
              className="flex h-10 items-center gap-2 rounded-md border border-[#CBD5E1] px-2.5 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <div className="hidden text-right sm:block">
                <p className="font-mono text-xs font-bold text-[#111827] tabular-nums dark:text-white">
                  {user.registrationNumber}
                </p>
                <p className="text-[11px] text-[#4B5563] dark:text-slate-400">{user.fullName}</p>
              </div>
              <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#0B5E2E] text-xs font-bold text-white">
                {user.fullName.charAt(0).toUpperCase()}
              </span>
            </button>
          </div>
        </header>

        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:px-6 sm:py-6">
          {tab === 'dashboard' && (
            <div className="space-y-5">
              {/* Candidate Welcome & Selected Subjects Card */}
              <section className="rounded-md border border-[#CBD5E1] bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-bold tracking-wide text-[#0B5E2E] uppercase dark:text-emerald-400">
                      {user.jambYear} UTME · {user.intendedCourse || 'General Candidate'}
                    </p>
                    <h1 className="mt-1 font-display text-xl font-bold text-[#111827] sm:text-2xl dark:text-white">
                      Welcome back, {user.fullName}.
                    </h1>
                    <p className="mt-0.5 font-mono text-xs font-semibold text-[#4B5563] tabular-nums dark:text-slate-400">
                      Reg. No: <span className="text-[#111827] dark:text-white">{user.registrationNumber}</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowSampleCbt(true)}
                    className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-md border border-[#CBD5E1] bg-[#F9FAFB] px-3.5 text-xs font-bold text-[#111827] hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <Eye className="h-4 w-4 text-[#0B5E2E]" />
                    <span>Preview CBT Screen</span>
                  </button>
                </div>

                {/* Selected 4 UTME Subjects */}
                <div className="mt-4 border-t border-[#E5E7EB] pt-3.5 dark:border-slate-800">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#4B5563] dark:text-slate-400">
                      Registered Four-Subject Combination
                    </p>
                    <button
                      type="button"
                      onClick={() => selectTab('start-cbt')}
                      className="text-xs font-bold text-[#0B5E2E] hover:underline dark:text-emerald-400"
                    >
                      Change subjects
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {selectedFourSubjects.map((sub, idx) => (
                      <div
                        key={sub.code}
                        className="flex min-h-[38px] items-center justify-between gap-1.5 rounded-md border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1.5 dark:border-slate-800 dark:bg-slate-950"
                      >
                        <span className="truncate text-xs font-semibold text-[#111827] dark:text-slate-200">
                          {sub.name}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] font-bold text-[#0B5E2E] dark:text-emerald-400">
                          {idx === 0 ? 'COMP' : sub.code}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* 4-Stat Overview Strip */}
              <section
                aria-label="Examination statistics"
                className="grid grid-cols-2 overflow-hidden rounded-md border border-[#CBD5E1] bg-white sm:grid-cols-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="border-r border-b border-[#CBD5E1] p-4 sm:border-b-0 dark:border-slate-800">
                  <p className="text-xs font-medium text-[#4B5563] dark:text-slate-400">
                    Total Examinations Taken
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold text-[#111827] tabular-nums dark:text-white">
                    {dashboard?.stats.totalAttempted ?? 0}
                  </p>
                </div>

                <div className="border-b border-[#CBD5E1] p-4 sm:border-r sm:border-b-0 dark:border-slate-800">
                  <p className="text-xs font-medium text-[#4B5563] dark:text-slate-400">Average Score</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-[#0B5E2E] tabular-nums dark:text-emerald-400">
                    {dashboard?.stats.averagePercentage ?? 0}%
                  </p>
                </div>

                <div className="border-r border-[#CBD5E1] p-4 dark:border-slate-800">
                  <p className="text-xs font-medium text-[#4B5563] dark:text-slate-400">Highest Score</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-[#0B5E2E] tabular-nums dark:text-emerald-400">
                    {dashboard?.stats.highestScoreOutOf400 ?? 0}/400
                  </p>
                </div>

                <div className="p-4">
                  <p className="text-xs font-medium text-[#4B5563] dark:text-slate-400">
                    Questions Attempted
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold text-[#111827] tabular-nums dark:text-white">
                    {dashboard?.stats.totalQuestionsAttempted ?? 0}
                  </p>
                </div>
              </section>

              {/* Prominent START YOUR CBT PRACTICE Card */}
              <section className="rounded-md border border-[#CBD5E1] bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-[#E5E7EB] bg-[#F9FAFB] px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950">
                  <h2 className="font-display text-sm font-bold tracking-wide text-[#0B5E2E] uppercase dark:text-emerald-400">
                    START YOUR CBT PRACTICE
                  </h2>
                  <p className="mt-0.5 text-xs text-[#4B5563] dark:text-slate-400">
                    Choose an examination mode and begin your preparation.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => selectTab('start-cbt')}
                    className="flex min-h-[52px] items-center justify-center gap-2 rounded-md bg-[#0B5E2E] px-4 py-3 text-sm font-bold text-white hover:bg-[#084722]"
                  >
                    <Play className="h-4 w-4 shrink-0" />
                    <span>Start Full UTME Mock</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => selectTab('practice')}
                    className="flex min-h-[52px] items-center justify-center gap-2 rounded-md border border-[#0B5E2E] bg-white px-4 py-3 text-sm font-bold text-[#0B5E2E] hover:bg-emerald-50 dark:bg-slate-900 dark:text-emerald-400 dark:hover:bg-slate-800"
                  >
                    <Sliders className="h-4 w-4 shrink-0" />
                    <span>Practice by Subject</span>
                  </button>

                  <button
                    type="button"
                    disabled={randomLaunching}
                    onClick={handleStartRandomPractice}
                    className="flex min-h-[52px] items-center justify-center gap-2 rounded-md border border-[#CBD5E1] bg-[#F9FAFB] px-4 py-3 text-sm font-bold text-[#111827] hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <Shuffle className="h-4 w-4 shrink-0 text-[#0B5E2E]" />
                    <span>{randomLaunching ? 'Starting...' : 'Random Practice'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (dashboard?.activeSession) {
                        onEnterExam(dashboard.activeSession.id);
                      } else {
                        setQuickLaunchMsg(
                          'No paused examination in progress. Click "Start Full UTME Mock" or "Practice by Subject" to begin a new test.'
                        );
                      }
                    }}
                    className={`flex min-h-[52px] items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-bold ${
                      dashboard?.activeSession
                        ? 'bg-amber-700 text-white hover:bg-amber-800'
                        : 'border border-[#CBD5E1] bg-[#F9FAFB] text-[#111827] hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
                    }`}
                  >
                    <Play className={`h-4 w-4 shrink-0 ${dashboard?.activeSession ? 'text-white' : 'text-[#0B5E2E]'}`} />
                    <span>Continue Previous Examination</span>
                  </button>
                </div>

                {quickLaunchMsg && (
                  <p className="border-t border-[#E5E7EB] bg-[#F9FAFB] px-5 py-2.5 text-xs font-medium text-[#374151] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                    {quickLaunchMsg}
                  </p>
                )}
              </section>

              {/* Recent History & Performance Summary */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <section className="rounded-md border border-[#CBD5E1] bg-white lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                    <h2 className="font-display text-sm font-bold text-[#111827] dark:text-white">
                      Recent Examination History
                    </h2>
                    <button
                      type="button"
                      onClick={() => selectTab('results')}
                      className="text-xs font-bold text-[#0B5E2E] hover:underline dark:text-emerald-400"
                    >
                      View All
                    </button>
                  </div>
                  <div className="divide-y divide-[#E5E7EB] dark:divide-slate-800">
                    {(dashboard?.recentResults || []).length === 0 ? (
                      <p className="p-4 text-xs text-[#4B5563] dark:text-slate-400">
                        No examinations completed yet. Start a UTME test above to see your history.
                      </p>
                    ) : (
                      dashboard!.recentResults.map((r) => (
                        <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#111827] dark:text-white">{r.examTitle}</p>
                            <p className="text-xs text-[#4B5563] tabular-nums dark:text-slate-400">
                              {r.correctCount}/{r.totalQuestions} correct · {new Date(r.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setResultSessionToOpen(r.sessionId);
                              selectTab('results');
                            }}
                            className="min-h-[34px] shrink-0 rounded-md border border-[#0B5E2E]/30 bg-emerald-50 px-3 py-1 font-mono text-xs font-bold text-[#0B5E2E] tabular-nums hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          >
                            {r.scoreOutOf400}/400
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-md border border-[#CBD5E1] bg-white lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                    <h2 className="font-display text-sm font-bold text-[#111827] dark:text-white">
                      Performance Summary
                    </h2>
                    <button
                      type="button"
                      onClick={() => selectTab('analytics')}
                      className="text-xs font-bold text-[#0B5E2E] hover:underline dark:text-emerald-400"
                    >
                      Details
                    </button>
                  </div>
                  <div className="space-y-3 p-4 text-xs">
                    <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2.5 dark:border-slate-800">
                      <span className="text-[#4B5563] dark:text-slate-400">Readiness Score</span>
                      <span className="font-mono text-sm font-bold text-[#0B5E2E] tabular-nums dark:text-emerald-400">
                        {dashboard?.stats.overallProgress ?? 0}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2.5 dark:border-slate-800">
                      <span className="text-[#4B5563] dark:text-slate-400">Best Percentage</span>
                      <span className="font-mono text-sm font-bold text-[#111827] tabular-nums dark:text-white">
                        {dashboard?.stats.highestPercentage ?? 0}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#4B5563] dark:text-slate-400">Scheduled Upcoming Mocks</span>
                      <span className="font-mono text-sm font-bold text-[#111827] tabular-nums dark:text-white">
                        {dashboard?.upcomingMocks?.length ?? 0}
                      </span>
                    </div>
                  </div>
                </section>
              </div>

              {/* Study Materials, Announcements & Leaderboard */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <section className="rounded-md border border-[#CBD5E1] bg-white lg:col-span-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                    <h2 className="font-display text-sm font-bold text-[#111827] dark:text-white">
                      Available Study Materials
                    </h2>
                    <button
                      type="button"
                      onClick={() => selectTab('materials')}
                      className="text-xs font-bold text-[#0B5E2E] hover:underline dark:text-emerald-400"
                    >
                      All Files
                    </button>
                  </div>
                  <div className="divide-y divide-[#E5E7EB] dark:divide-slate-800">
                    {(dashboard?.availableMaterials || []).length === 0 ? (
                      <p className="p-4 text-xs text-[#4B5563] dark:text-slate-400">
                        No study materials uploaded yet.
                      </p>
                    ) : (
                      dashboard!.availableMaterials!.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-2 px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-[#111827] dark:text-white">{m.title}</p>
                            <p className="text-[11px] text-[#4B5563] dark:text-slate-400">
                              {m.subjectName} · {m.category}
                            </p>
                          </div>
                          <a
                            href={`/api/student/materials/${m.id}/download`}
                            className="shrink-0 rounded-md border border-[#0B5E2E] px-2.5 py-1 text-[11px] font-bold text-[#0B5E2E] hover:bg-emerald-50 dark:text-emerald-400"
                          >
                            Get
                          </a>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-md border border-[#CBD5E1] bg-white lg:col-span-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="border-b border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                    <h2 className="font-display text-sm font-bold text-[#111827] dark:text-white">Announcements</h2>
                  </div>
                  <div className="divide-y divide-[#E5E7EB] dark:divide-slate-800">
                    {(dashboard?.announcements || []).length === 0 ? (
                      <p className="p-4 text-xs text-[#4B5563] dark:text-slate-400">No announcements at this time.</p>
                    ) : (
                      dashboard!.announcements.map((a) => (
                        <div key={a.id} className="p-4">
                          <p className="text-xs font-bold text-[#111827] dark:text-white">{a.title}</p>
                          <p className="mt-1 text-xs leading-relaxed text-[#4B5563] dark:text-slate-400">{a.body}</p>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-md border border-[#CBD5E1] bg-white lg:col-span-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                    <h2 className="font-display text-sm font-bold text-[#111827] dark:text-white">Leaderboard</h2>
                    <button
                      type="button"
                      onClick={() => selectTab('leaderboard')}
                      className="text-xs font-bold text-[#0B5E2E] hover:underline dark:text-emerald-400"
                    >
                      View Rankings
                    </button>
                  </div>
                  <div className="divide-y divide-[#E5E7EB] dark:divide-slate-800">
                    {(dashboard?.leaderboard || []).length === 0 ? (
                      <p className="p-4 text-xs text-[#4B5563] dark:text-slate-400">
                        Complete an exam to appear on the UTME leaderboard.
                      </p>
                    ) : (
                      dashboard!.leaderboard!.map((entry) => (
                        <div
                          key={entry.userId}
                          className={`flex items-center justify-between gap-2 px-4 py-2.5 text-xs ${
                            entry.isCurrentUser ? 'bg-emerald-50/70 dark:bg-emerald-950/30' : ''
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-[#0B5E2E] font-mono text-[11px] font-bold text-white">
                              {entry.rank}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-bold text-[#111827] dark:text-white">
                                {entry.fullName} {entry.isCurrentUser ? '(You)' : ''}
                              </p>
                              <p className="truncate text-[11px] text-[#4B5563] dark:text-slate-400">
                                {entry.intendedCourse}
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 font-mono text-xs font-bold text-[#0B5E2E] tabular-nums dark:text-emerald-400">
                            {entry.bestScoreOutOf400}/400
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}

          {tab === 'start-cbt' && (
            <StartCbtView
              student={user}
              onSubjectsChanged={(subs) => setSelectedFourSubjects(subs)}
              onSessionStarted={onEnterExam}
            />
          )}
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

          {tab === 'leaderboard' && (
            <div className="space-y-5">
              <div>
                <h1 className="font-display text-xl font-bold text-[#0B5E2E] dark:text-emerald-400">
                  UTME Candidate Leaderboard
                </h1>
                <p className="mt-1 text-sm text-[#4B5563] dark:text-slate-400">
                  Top candidate scores based on completed UTME CBT examinations.
                </p>
              </div>

              <div className="overflow-hidden rounded-md border border-[#CBD5E1] bg-white dark:border-slate-800 dark:bg-slate-900">
                {leaderboardLoading ? (
                  <p className="p-6 text-center text-sm text-[#4B5563]">Loading leaderboard...</p>
                ) : leaderboardRows.length === 0 ? (
                  <p className="p-6 text-center text-sm text-[#4B5563]">
                    No ranked examinations yet. Complete an examination to join the leaderboard.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-[#CBD5E1] bg-[#F3F4F6] text-xs font-bold text-[#374151] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                        <tr>
                          <th className="px-4 py-3">Rank</th>
                          <th className="px-4 py-3">Candidate</th>
                          <th className="px-4 py-3">Course</th>
                          <th className="px-4 py-3 text-right">Attempts</th>
                          <th className="px-4 py-3 text-right">Avg %</th>
                          <th className="px-4 py-3 text-right">Best Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E7EB] dark:divide-slate-800">
                        {leaderboardRows.map((row) => (
                          <tr
                            key={row.userId}
                            className={row.isCurrentUser ? 'bg-emerald-50/70 dark:bg-emerald-950/30' : ''}
                          >
                            <td className="px-4 py-3 font-mono text-xs font-bold text-[#0B5E2E] tabular-nums dark:text-emerald-400">
                              #{row.rank}
                            </td>
                            <td className="px-4 py-3 font-semibold text-[#111827] dark:text-white">
                              {row.fullName} {row.isCurrentUser ? '(You)' : ''}
                            </td>
                            <td className="px-4 py-3 text-xs text-[#4B5563] dark:text-slate-400">
                              {row.intendedCourse}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                              {row.attemptsCount}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                              {row.averagePercentage}%
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-xs font-bold text-[#0B5E2E] tabular-nums dark:text-emerald-400">
                              {row.bestScoreOutOf400}/400
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'materials' && (
            <div className="space-y-5">
              <div>
                <h1 className="font-display text-xl font-bold text-[#0B5E2E] dark:text-emerald-400">Study Materials</h1>
                <p className="mt-1 text-sm text-[#4B5563] dark:text-slate-400">
                  Download notes, tutorials, and past question files by subject.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-md border border-[#CBD5E1] bg-white p-4 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
                <select
                  value={matSubjectId}
                  onChange={(e) => setMatSubjectId(e.target.value)}
                  className="h-11 rounded-md border border-[#CBD5E1] bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">All Subjects</option>
                  {matSubjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <select
                  value={matCategory}
                  onChange={(e) => setMatCategory(e.target.value)}
                  className="h-11 rounded-md border border-[#CBD5E1] bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="All">All Categories</option>
                  <option value="Past Questions">Past Questions</option>
                  <option value="Tutorials">Tutorials</option>
                  <option value="Study Notes">Study Notes</option>
                  <option value="Revision Materials">Revision Materials</option>
                </select>
              </div>

              <div className="divide-y divide-[#E5E7EB] rounded-md border border-[#CBD5E1] bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {materials.length === 0 ? (
                  <p className="p-6 text-center text-sm text-[#4B5563]">No study materials found.</p>
                ) : (
                  materials.map((m) => (
                    <div key={m.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[#0B5E2E] dark:text-emerald-400">
                          {m.subjectName} · {m.category} · {(m.fileSizeBytes / 1024).toFixed(1)} KB
                        </p>
                        <h3 className="mt-0.5 text-sm font-bold text-[#111827] dark:text-white">{m.title}</h3>
                        <p className="mt-0.5 text-xs text-[#4B5563] dark:text-slate-400">{m.description}</p>
                      </div>
                      <a
                        href={`/api/student/materials/${m.id}/download`}
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md bg-[#0B5E2E] px-4 py-2 text-xs font-bold text-white hover:bg-[#084722]"
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
                <h1 className="font-display text-xl font-bold text-[#0B5E2E] dark:text-emerald-400">Messages</h1>
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
                  className="min-h-[38px] rounded-md border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#374151] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  Mark All Read
                </button>
              </div>
              <div className="divide-y divide-[#E5E7EB] rounded-md border border-[#CBD5E1] bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {notifications.length === 0 ? (
                  <p className="p-6 text-center text-sm text-[#4B5563]">No messages yet.</p>
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
                      className={`cursor-pointer p-4 ${n.isRead ? '' : 'bg-emerald-50/60 dark:bg-emerald-950/30'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-[#111827] dark:text-white">{n.title}</h3>
                        <span className="text-[11px] text-[#4B5563]">{new Date(n.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="mt-1 text-xs text-[#374151] dark:text-slate-300">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'profile' && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="rounded-md border border-[#CBD5E1] bg-white p-5 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
                <h1 className="font-display text-lg font-bold text-[#0B5E2E] dark:text-emerald-400">My Profile</h1>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#E5E7EB] bg-[#F9FAFB] p-3 dark:border-slate-700 dark:bg-slate-950">
                  <div>
                    <p className="text-xs text-[#4B5563]">Registration Number</p>
                    <p className="font-mono text-sm font-bold text-[#0B5E2E] dark:text-emerald-400">
                      {user.registrationNumber}
                    </p>
                  </div>
                  {user.emailVerified ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#16A34A]">
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
                {verifyMsg && <p className="mt-2 text-xs text-[#16A34A]">{verifyMsg}</p>}

                <form onSubmit={handleSaveProfile} className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-[#374151] dark:text-slate-400">Full Name</label>
                    <input
                      value={profileForm.fullName}
                      onChange={(e) => setProfileForm((f) => ({ ...f, fullName: e.target.value }))}
                      className="h-11 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#374151] dark:text-slate-400">Phone Number</label>
                    <input
                      value={profileForm.phoneNumber}
                      onChange={(e) => setProfileForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                      className="h-11 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#374151] dark:text-slate-400">JAMB Year</label>
                    <input
                      type="number"
                      value={profileForm.jambYear}
                      onChange={(e) => setProfileForm((f) => ({ ...f, jambYear: e.target.value }))}
                      className="h-11 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#374151] dark:text-slate-400">Intended Course</label>
                    <input
                      value={profileForm.intendedCourse}
                      onChange={(e) => setProfileForm((f) => ({ ...f, intendedCourse: e.target.value }))}
                      className="h-11 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#374151] dark:text-slate-400">Preferred Institution</label>
                    <input
                      value={profileForm.preferredInstitution}
                      onChange={(e) => setProfileForm((f) => ({ ...f, preferredInstitution: e.target.value }))}
                      className="h-11 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  {profileMsg && <p className="sm:col-span-2 text-xs font-semibold text-[#16A34A]">{profileMsg}</p>}
                  <div className="sm:col-span-2">
                    <button type="submit" className="min-h-[42px] rounded-md bg-[#0B5E2E] px-5 text-sm font-bold text-white hover:bg-[#084722]">
                      Save Profile
                    </button>
                  </div>
                </form>
              </div>

              <div className="rounded-md border border-[#CBD5E1] bg-white p-5 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
                <h2 className="font-display text-lg font-bold text-[#0B5E2E] dark:text-emerald-400">Change Password</h2>
                <form onSubmit={handleChangePassword} className="mt-4 space-y-3.5">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#374151] dark:text-slate-400">Current Password</label>
                    <input
                      type="password"
                      required
                      value={pwForm.currentPassword}
                      onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
                      className="h-11 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#374151] dark:text-slate-400">New Password</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={pwForm.newPassword}
                      onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
                      className="h-11 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  {pwMsg && <p className="text-xs font-semibold text-[#0B5E2E]">{pwMsg}</p>}
                  <button type="submit" className="min-h-[42px] rounded-md bg-[#0B5E2E] px-4 text-sm font-bold text-white hover:bg-[#084722]">
                    Update Password
                  </button>
                </form>
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="max-w-2xl rounded-md border border-[#CBD5E1] bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <h1 className="font-display text-lg font-bold text-[#0B5E2E] dark:text-emerald-400">Examination Settings</h1>
              <p className="mt-1 text-xs text-[#4B5563] dark:text-slate-400">
                Changes are saved automatically to your account.
              </p>

              <div className="mt-5 divide-y divide-[#E5E7EB] dark:divide-slate-800">
                <div className="flex items-center justify-between py-3.5">
                  <div>
                    <p className="text-sm font-semibold text-[#111827] dark:text-white">Display Theme</p>
                    <p className="text-xs text-[#4B5563]">Choose light or dark screen mode</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updatePreference({ theme: user.preferences?.theme === 'dark' ? 'light' : 'dark' })
                    }
                    className="inline-flex min-h-[38px] items-center gap-2 rounded-md border border-[#CBD5E1] px-3 text-xs font-semibold dark:border-slate-700"
                  >
                    {user.preferences?.theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
                    <span>{user.preferences?.theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between py-3.5">
                  <div>
                    <p className="text-sm font-semibold text-[#111827] dark:text-white">Question Text Size</p>
                    <p className="text-xs text-[#4B5563]">Adjust question font size inside the exam screen</p>
                  </div>
                  <select
                    value={user.preferences?.fontSize || 'normal'}
                    onChange={(e) => updatePreference({ fontSize: e.target.value as 'normal' | 'large' })}
                    className="h-9 rounded-md border border-[#CBD5E1] bg-white px-3 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="normal">Standard</option>
                    <option value="large">Large</option>
                  </select>
                </div>

                <label className="flex items-center justify-between py-3.5">
                  <div>
                    <p className="text-sm font-semibold text-[#111827] dark:text-white">Show Question Palette</p>
                    <p className="text-xs text-[#4B5563]">Display question palette beside questions on desktop</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={user.preferences?.showQuestionPalette !== false}
                    onChange={(e) => updatePreference({ showQuestionPalette: e.target.checked })}
                    className="h-4 w-4 rounded accent-[#0B5E2E]"
                  />
                </label>

                <label className="flex items-center justify-between py-3.5">
                  <div>
                    <p className="text-sm font-semibold text-[#111827] dark:text-white">Move to Next Question Automatically</p>
                    <p className="text-xs text-[#4B5563]">Advance after picking option A, B, C, or D</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(user.preferences?.autoNextQuestion)}
                    onChange={(e) => updatePreference({ autoNextQuestion: e.target.checked })}
                    className="h-4 w-4 rounded accent-[#0B5E2E]"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Primary mobile navigation"
        className="fixed right-0 bottom-0 left-0 z-30 grid grid-cols-5 border-t border-[#CBD5E1] bg-white pb-[env(safe-area-inset-bottom)] lg:hidden dark:border-slate-800 dark:bg-slate-900"
      >
        {primaryMobileTabs.map((item) => {
          const Icon = item.icon;
          const active = !mobileNavOpen && tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectTab(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-[54px] flex-col items-center justify-center gap-1 border-t-2 px-1 text-[11px] leading-none font-semibold ${
                active
                  ? 'border-[#0B5E2E] text-[#0B5E2E] dark:border-emerald-400 dark:text-emerald-400'
                  : 'border-transparent text-[#4B5563] hover:text-[#111827] dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileNavOpen((prev) => !prev)}
          aria-expanded={mobileNavOpen}
          className={`flex min-h-[54px] flex-col items-center justify-center gap-1 border-t-2 px-1 text-[11px] leading-none font-semibold ${
            isMoreTabActive
              ? 'border-[#0B5E2E] text-[#0B5E2E] dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-[#4B5563] hover:text-[#111827] dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <LayoutGrid className="h-5 w-5 shrink-0" strokeWidth={isMoreTabActive ? 2.25 : 1.75} />
          <span className="whitespace-nowrap">More</span>
        </button>
      </nav>
    </div>
  );
}
