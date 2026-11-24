import { useCallback, useEffect, useState } from 'react';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  ClipboardCheck,
  Download,
  FileQuestion,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Search,
  Settings,
  Shield,
  Sliders,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import { apiFetch } from '../../lib/api.ts';
import { AuthUser, PlatformSettings } from '../../types/index.ts';
import {
  AdminBulkUploadPanel,
  AdminExamsAndMocksPanel,
  AdminMaterialsPanel,
  AdminQuestionsPanel,
  AdminSubjectsPanel,
} from './AdminContentPanels.tsx';

type AdminSection =
  | 'overview'
  | 'students'
  | 'subjects'
  | 'questions'
  | 'bulk-upload'
  | 'practice-exams'
  | 'mock-exams'
  | 'attempts'
  | 'results'
  | 'materials'
  | 'announcements'
  | 'notifications'
  | 'reports'
  | 'admin-accounts'
  | 'audit-logs'
  | 'settings';

interface AdminWorkspaceProps {
  admin: AuthUser;
  onLogout: () => void;
}

export default function AdminWorkspace({ admin, onLogout }: AdminWorkspaceProps) {
  const [section, setSection] = useState<AdminSection>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);

  const [overview, setOverview] = useState<{
    metrics: Record<string, number>;
    recentResults: Array<{ id: string; examTitle: string; scoreOutOf400: number; percentage: string; createdAt: string }>;
  } | null>(null);

  const [students, setStudents] = useState<
    Array<{
      id: string;
      fullName: string;
      email: string;
      registrationNumber: string;
      jambYear: number;
      intendedCourse: string;
      accountStatus: string;
      attemptsCount: number;
    }>
  >([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<{
    student: { fullName: string; email: string; registrationNumber: string; phoneNumber: string; preferredInstitution: string; intendedCourse: string; jambYear: number };
    history: Array<{ id: string; examTitle: string; scoreOutOf400: number; percentage: string; createdAt: string }>;
  } | null>(null);

  const [attempts, setAttempts] = useState<Array<{ id: string; examTitle: string; studentName: string; registrationNumber: string; status: string; scoreOutOf400: number | null; startedAt: string }>>([]);
  const [results, setResults] = useState<Array<{ id: string; examTitle: string; studentName: string; registrationNumber: string; scoreOutOf400: number; percentage: string; createdAt: string }>>([]);

  const [announcements, setAnnouncements] = useState<Array<{ id: string; title: string; body: string; isPinned: boolean; isActive: boolean }>>([]);
  const [annForm, setAnnForm] = useState({ title: '', body: '', isPinned: true });
  const [notifForm, setNotifForm] = useState({ title: '', message: '', targetUserId: '' });
  const [notifList, setNotifList] = useState<Array<{ id: string; title: string; message: string; createdAt: string }>>([]);

  const [reports, setReports] = useState<{
    totalCompletedResults: number;
    averageScoreOutOf400: number;
    subjectPerformance: Array<{ subjectCode: string; subjectName: string; attempts: number; averageAccuracy: number }>;
  } | null>(null);
  const [adminAccounts, setAdminAccounts] = useState<Array<{ id: string; fullName: string; email: string; username: string; role: string; isActive: boolean }>>([]);
  const [newAdminForm, setNewAdminForm] = useState({ fullName: '', email: '', username: '', password: '', role: 'admin' });
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; actorEmail: string; actorRole: string; action: string; entityType: string; createdAt: string }>>([]);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);

  const loadSectionData = useCallback(async () => {
    if (section === 'overview') {
      const res = await apiFetch<typeof overview>('/api/admin/overview');
      setOverview(res);
    } else if (section === 'students') {
      const res = await apiFetch<{ students: typeof students }>(
        `/api/admin/students?search=${encodeURIComponent(studentSearch)}`
      );
      setStudents(res.students);
    } else if (section === 'attempts') {
      const res = await apiFetch<{ attempts: typeof attempts }>('/api/admin/attempts');
      setAttempts(res.attempts);
    } else if (section === 'results') {
      const res = await apiFetch<{ results: typeof results }>('/api/admin/results');
      setResults(res.results);
    } else if (section === 'announcements') {
      const res = await apiFetch<{ announcements: typeof announcements }>('/api/admin/announcements');
      setAnnouncements(res.announcements);
    } else if (section === 'notifications') {
      const [nRes, sRes] = await Promise.all([
        apiFetch<{ notifications: typeof notifList }>('/api/admin/notifications'),
        apiFetch<{ students: typeof students }>('/api/admin/students'),
      ]);
      setNotifList(nRes.notifications);
      setStudents(sRes.students);
    } else if (section === 'reports') {
      const res = await apiFetch<typeof reports>('/api/admin/reports');
      setReports(res);
    } else if (section === 'admin-accounts' && admin.role === 'super_admin') {
      const res = await apiFetch<{ admins: typeof adminAccounts }>('/api/admin/accounts');
      setAdminAccounts(res.admins);
    } else if (section === 'audit-logs') {
      const res = await apiFetch<{ logs: typeof auditLogs }>('/api/admin/audit-logs');
      setAuditLogs(res.logs);
    } else if (section === 'settings') {
      const res = await apiFetch<{ settings: PlatformSettings }>('/api/admin/settings');
      setSettings(res.settings);
    }
  }, [section, studentSearch, admin.role]);

  useEffect(() => {
    void loadSectionData();
  }, [loadSectionData]);

  const navItems: Array<{ id: AdminSection; label: string; icon: typeof LayoutDashboard; superOnly?: boolean }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'subjects', label: 'Subjects', icon: BookOpen },
    { id: 'questions', label: 'Question Bank', icon: FileQuestion },
    { id: 'bulk-upload', label: 'Bulk Upload', icon: UploadCloud },
    { id: 'practice-exams', label: 'Practice Exams', icon: Sliders },
    { id: 'mock-exams', label: 'Mock Exams', icon: Award },
    { id: 'attempts', label: 'Attempts', icon: History },
    { id: 'results', label: 'Results', icon: ClipboardCheck },
    { id: 'materials', label: 'Study Materials', icon: FileText },
    { id: 'announcements', label: 'Notices', icon: Megaphone },
    { id: 'notifications', label: 'Messages', icon: Bell },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'admin-accounts', label: 'Admin Accounts', icon: Shield, superOnly: true },
    { id: 'audit-logs', label: 'Activity Logs', icon: FileSpreadsheet },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const selectSection = (s: AdminSection) => {
    setSection(s);
    setMobileOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-[#F4F6F8] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Admin Navy Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-800 bg-[#0F2447] text-blue-100 lg:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-blue-900/70 px-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-700 text-white">
            <GraduationCap className="h-4 w-4" />
          </span>
          <span className="font-display text-sm font-bold text-white">Acadet Admin</span>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
          {navItems
            .filter((n) => !n.superOnly || admin.role === 'super_admin')
            .map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectSection(item.id)}
                  className={`flex min-h-[38px] w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-xs font-semibold ${
                    section === item.id ? 'bg-[#1D4ED8] text-white' : 'text-blue-200 hover:bg-blue-900/60 hover:text-white'
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
            className="flex min-h-[38px] w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-950/50"
          >
            <LogOut className="h-4 w-4" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="flex w-72 flex-col bg-[#0F2447] text-blue-100">
            <div className="flex h-14 items-center justify-between border-b border-blue-900 px-4">
              <span className="font-display text-sm font-bold text-white">Acadet Admin</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-blue-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-0.5 overflow-y-auto p-3">
              {navItems
                .filter((n) => !n.superOnly || admin.role === 'super_admin')
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectSection(item.id)}
                    className={`flex min-h-[42px] w-full items-center gap-2.5 rounded-md px-3 text-left text-xs font-semibold ${
                      section === item.id ? 'bg-[#1D4ED8] text-white' : 'text-blue-200'
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </button>
                ))}
            </div>
            <div className="border-t border-blue-900 p-3">
              <button type="button" onClick={onLogout} className="flex min-h-[42px] w-full items-center gap-2 px-3 text-xs text-rose-300">
                <LogOut className="h-4 w-4" /> Log Out
              </button>
            </div>
          </div>
          <div className="flex-1 bg-slate-950/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-300 bg-white px-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="flex h-10 w-10 items-center justify-center rounded-md text-slate-700 lg:hidden dark:text-slate-300"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="font-display text-base font-bold text-[#0F2447] dark:text-white">
              {navItems.find((n) => n.id === section)?.label}
            </h1>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-slate-900 dark:text-white">{admin.fullName}</p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400">{admin.role}</p>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
          {section === 'overview' && overview && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 divide-y divide-slate-200 rounded-lg border border-slate-300 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {[
                  ['Total Students', overview.metrics.totalStudents],
                  ['Active Students', overview.metrics.activeStudents],
                  ['Question Bank', overview.metrics.totalQuestions],
                  ['Completed Exams', overview.metrics.totalCompleted],
                ].map(([label, val]) => (
                  <div key={String(label)} className="p-4">
                    <p className="text-xs font-medium text-slate-500">{String(label)}</p>
                    <p className="mt-1 font-mono text-2xl font-bold text-[#0F2447] tabular-nums dark:text-white">{val}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                  <h2 className="font-display text-sm font-bold text-[#0F2447] dark:text-white">Recent Completed Examinations</h2>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {overview.recentResults.map((r) => (
                    <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="font-medium">{r.examTitle}</span>
                      <span className="font-mono text-xs font-bold text-[#1D4ED8]">{r.scoreOutOf400}/400 ({r.percentage}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {section === 'students' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute top-3.5 left-3 h-4 w-4 text-slate-400" />
                <input
                  placeholder="Search students by name, email, or registration number..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="h-11 w-full rounded-md border border-slate-300 bg-white pr-3 pl-9 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950">
                    <tr>
                      <th className="px-4 py-3">Reg No.</th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Course / Year</th>
                      <th className="px-4 py-3 text-right">Attempts</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {students.map((s) => (
                      <tr key={s.id}>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-[#1D4ED8]">{s.registrationNumber}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold">{s.fullName}</p>
                          <p className="text-xs text-slate-500">{s.email}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">{s.intendedCourse} · {s.jambYear}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs">{s.attemptsCount}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await apiFetch<typeof selectedStudentDetail>(`/api/admin/students/${s.id}`);
                                setSelectedStudentDetail(res);
                              }}
                              className="min-h-[34px] rounded-md border border-slate-300 px-2.5 text-xs font-semibold hover:bg-slate-50 dark:border-slate-700"
                            >
                              View
                            </button>
                            {s.accountStatus === 'active' ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiFetch(`/api/admin/students/${s.id}/suspend`, { method: 'POST', body: JSON.stringify({}) });
                                  void loadSectionData();
                                }}
                                className="min-h-[34px] rounded-md bg-rose-50 px-2.5 text-xs font-semibold text-rose-700"
                              >
                                Suspend
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiFetch(`/api/admin/students/${s.id}/reactivate`, { method: 'POST' });
                                  void loadSectionData();
                                }}
                                className="min-h-[34px] rounded-md bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700"
                              >
                                Reactivate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedStudentDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
                  <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-300 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-lg font-bold">{selectedStudentDetail.student.fullName}</h3>
                      <button type="button" onClick={() => setSelectedStudentDetail(null)}><X className="h-5 w-5" /></button>
                    </div>
                    <p className="mt-1 font-mono text-xs text-[#1D4ED8]">{selectedStudentDetail.student.registrationNumber}</p>
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                      {selectedStudentDetail.student.email} · {selectedStudentDetail.student.phoneNumber} · {selectedStudentDetail.student.preferredInstitution}
                    </p>
                    <h4 className="mt-4 text-xs font-bold text-slate-900 dark:text-white">Examination History</h4>
                    <div className="mt-2 space-y-2">
                      {selectedStudentDetail.history.length === 0 ? (
                        <p className="text-xs text-slate-500">No exams completed yet.</p>
                      ) : (
                        selectedStudentDetail.history.map((h) => (
                          <div key={h.id} className="flex justify-between rounded-md border border-slate-200 p-2.5 text-xs dark:border-slate-800">
                            <span>{h.examTitle}</span>
                            <span className="font-mono font-bold">{h.scoreOutOf400}/400 ({h.percentage}%)</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {section === 'subjects' && <AdminSubjectsPanel />}
          {section === 'questions' && <AdminQuestionsPanel />}
          {section === 'bulk-upload' && <AdminBulkUploadPanel />}
          {section === 'practice-exams' && <AdminExamsAndMocksPanel mode="practice" />}
          {section === 'mock-exams' && <AdminExamsAndMocksPanel mode="mocks" />}

          {section === 'attempts' && (
            <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Examination</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">UTME Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {attempts.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-3 text-xs">
                        <p className="font-bold">{a.studentName}</p>
                        <p className="font-mono text-slate-500">{a.registrationNumber}</p>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium">{a.examTitle}</td>
                      <td className="px-4 py-3 text-xs">{a.status}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-bold">
                        {a.scoreOutOf400 !== null ? `${a.scoreOutOf400}/400` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {section === 'results' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <a
                  href="/api/admin/results/export"
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md bg-emerald-700 px-4 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  <Download className="h-4 w-4" /> Export CSV Report
                </a>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950">
                    <tr>
                      <th className="px-4 py-3">Reg No.</th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Examination</th>
                      <th className="px-4 py-3 text-right">Score (/400)</th>
                      <th className="px-4 py-3 text-right">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {results.map((r) => (
                      <tr key={r.id}>
                        <td className="px-4 py-3 font-mono text-xs">{r.registrationNumber}</td>
                        <td className="px-4 py-3 text-xs font-semibold">{r.studentName}</td>
                        <td className="px-4 py-3 text-xs">{r.examTitle}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-bold text-[#1D4ED8]">{r.scoreOutOf400}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-bold text-emerald-700">{r.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {section === 'materials' && <AdminMaterialsPanel />}

          {section === 'announcements' && (
            <div className="space-y-5">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await apiFetch('/api/admin/announcements', { method: 'POST', body: JSON.stringify(annForm) });
                  setAnnForm({ title: '', body: '', isPinned: true });
                  void loadSectionData();
                }}
                className="space-y-3 rounded-lg border border-slate-300 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <h2 className="font-display text-base font-bold text-[#0F2447] dark:text-white">Publish Notice</h2>
                <input
                  required
                  placeholder="Notice Title"
                  value={annForm.title}
                  onChange={(e) => setAnnForm((f) => ({ ...f, title: e.target.value }))}
                  className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
                <textarea
                  required
                  rows={3}
                  placeholder="Notice details..."
                  value={annForm.body}
                  onChange={(e) => setAnnForm((f) => ({ ...f, body: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 p-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
                <label className="flex items-center gap-2 text-xs font-medium">
                  <input type="checkbox" checked={annForm.isPinned} onChange={(e) => setAnnForm((f) => ({ ...f, isPinned: e.target.checked }))} />
                  Show on student home screen
                </label>
                <button type="submit" className="min-h-[40px] rounded-md bg-[#0F2447] px-4 text-xs font-semibold text-white">Publish Notice</button>
              </form>

              <div className="divide-y divide-slate-200 rounded-lg border border-slate-300 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {announcements.map((a) => (
                  <div key={a.id} className="flex items-start justify-between p-4">
                    <div>
                      <p className="text-sm font-bold">{a.title} {a.isPinned ? '· Pinned' : ''}</p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{a.body}</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/announcements/${a.id}`, { method: 'DELETE' });
                        void loadSectionData();
                      }}
                      className="text-xs font-semibold text-rose-700"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'notifications' && (
            <div className="space-y-5">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await apiFetch('/api/admin/notifications', {
                    method: 'POST',
                    body: JSON.stringify({
                      title: notifForm.title,
                      message: notifForm.message,
                      targetUserId: notifForm.targetUserId || null,
                    }),
                  });
                  setNotifForm({ title: '', message: '', targetUserId: '' });
                  void loadSectionData();
                }}
                className="space-y-3 rounded-lg border border-slate-300 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <h2 className="font-display text-base font-bold text-[#0F2447] dark:text-white">Send Message</h2>
                <select
                  value={notifForm.targetUserId}
                  onChange={(e) => setNotifForm((f) => ({ ...f, targetUserId: e.target.value }))}
                  className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">All Students</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.fullName} ({s.registrationNumber})</option>
                  ))}
                </select>
                <input
                  required
                  placeholder="Title"
                  value={notifForm.title}
                  onChange={(e) => setNotifForm((f) => ({ ...f, title: e.target.value }))}
                  className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
                <textarea
                  required
                  rows={2}
                  placeholder="Message..."
                  value={notifForm.message}
                  onChange={(e) => setNotifForm((f) => ({ ...f, message: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 p-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
                <button type="submit" className="min-h-[40px] rounded-md bg-[#0F2447] px-4 text-xs font-semibold text-white">Send Message</button>
              </form>

              <div className="divide-y divide-slate-200 rounded-lg border border-slate-300 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {notifList.map((n) => (
                  <div key={n.id} className="p-4 text-xs">
                    <p className="font-bold">{n.title}</p>
                    <p className="mt-1 text-slate-600 dark:text-slate-400">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'reports' && reports && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 divide-y divide-slate-200 rounded-lg border border-slate-300 bg-white sm:grid-cols-2 sm:divide-x sm:divide-y-0 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                <div className="p-5">
                  <p className="text-xs text-slate-500">Total Completed Results</p>
                  <p className="mt-1 font-mono text-2xl font-bold">{reports.totalCompletedResults}</p>
                </div>
                <div className="p-5">
                  <p className="text-xs text-slate-500">Average UTME Score</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-[#1D4ED8]">{reports.averageScoreOutOf400}/400</p>
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950">
                    <tr>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3 text-right">Attempts</th>
                      <th className="px-4 py-3 text-right">Average Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {reports.subjectPerformance.map((sp) => (
                      <tr key={sp.subjectCode}>
                        <td className="px-4 py-2.5 font-medium">{sp.subjectName} ({sp.subjectCode})</td>
                        <td className="px-4 py-2.5 text-right font-mono">{sp.attempts}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">{sp.averageAccuracy}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {section === 'admin-accounts' && (
            <div className="space-y-5">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await apiFetch('/api/admin/accounts', { method: 'POST', body: JSON.stringify(newAdminForm) });
                  setNewAdminForm({ fullName: '', email: '', username: '', password: '', role: 'admin' });
                  void loadSectionData();
                }}
                className="grid grid-cols-1 gap-3 rounded-lg border border-slate-300 bg-white p-5 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900"
              >
                <h2 className="font-display text-base font-bold sm:col-span-2">Create Administrator Account</h2>
                <input required placeholder="Full Name" value={newAdminForm.fullName} onChange={(e) => setNewAdminForm((f) => ({ ...f, fullName: e.target.value }))} className="h-11 rounded-md border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800" />
                <input required type="email" placeholder="Email" value={newAdminForm.email} onChange={(e) => setNewAdminForm((f) => ({ ...f, email: e.target.value }))} className="h-11 rounded-md border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800" />
                <input required placeholder="Username" value={newAdminForm.username} onChange={(e) => setNewAdminForm((f) => ({ ...f, username: e.target.value }))} className="h-11 rounded-md border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800" />
                <input required type="password" minLength={8} placeholder="Password" value={newAdminForm.password} onChange={(e) => setNewAdminForm((f) => ({ ...f, password: e.target.value }))} className="h-11 rounded-md border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800" />
                <button type="submit" className="min-h-[42px] rounded-md bg-[#0F2447] px-4 text-xs font-semibold text-white sm:col-span-2">Create Admin</button>
              </form>

              <div className="divide-y divide-slate-200 rounded-lg border border-slate-300 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {adminAccounts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-4 text-xs">
                    <div>
                      <p className="font-bold">{a.fullName} ({a.role})</p>
                      <p className="text-slate-500">{a.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/accounts/${a.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !a.isActive }) });
                        void loadSectionData();
                      }}
                      className={`min-h-[34px] rounded-md px-3 font-semibold ${a.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {a.isActive ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {section === 'audit-logs' && (
            <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950">
                  <tr>
                    <th className="px-4 py-3">Date &amp; Time</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Item</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {auditLogs.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-2.5 font-mono text-slate-500">{new Date(l.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2.5">{l.actorEmail} ({l.actorRole})</td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-[#1D4ED8]">{l.action}</td>
                      <td className="px-4 py-2.5">{l.entityType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {section === 'settings' && settings && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSettingsMsg(null);
                const res = await apiFetch<{ settings: PlatformSettings }>('/api/admin/settings', {
                  method: 'PATCH',
                  body: JSON.stringify(settings),
                });
                setSettings(res.settings);
                setSettingsMsg('Application settings saved.');
              }}
              className="max-w-2xl space-y-4 rounded-lg border border-slate-300 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
            >
              <h2 className="font-display text-lg font-bold text-[#0F2447] dark:text-white">Application Settings</h2>
              <div>
                <label className="mb-1 block text-xs font-semibold">Application Name</label>
                <input value={settings.siteName} onChange={(e) => setSettings({ ...settings, siteName: e.target.value })} className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Short Description</label>
                <input value={settings.tagline} onChange={(e) => setSettings({ ...settings, tagline: e.target.value })} className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold">Support Email</label>
                  <input value={settings.supportEmail} onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })} className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold">Support Phone</label>
                  <input value={settings.supportPhone} onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })} className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input type="checkbox" checked={settings.allowStudentRegistration} onChange={(e) => setSettings({ ...settings, allowStudentRegistration: e.target.checked })} />
                Allow new student account registration
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input type="checkbox" checked={settings.defaultAllowReview} onChange={(e) => setSettings({ ...settings, defaultAllowReview: e.target.checked })} />
                Allow students to review answers after submission
              </label>
              {settingsMsg && <p className="text-xs font-semibold text-emerald-700">{settingsMsg}</p>}
              <button type="submit" className="min-h-[42px] rounded-md bg-[#0F2447] px-5 text-sm font-semibold text-white">Save Settings</button>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
