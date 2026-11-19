import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileCheck2,
  GraduationCap,
  Layers,
  Lock,
  Mail,
  MapPin,
  Menu,
  Phone,
  ShieldCheck,
  X,
} from 'lucide-react';
import { apiFetch, setSessionToken } from '../../lib/api.ts';
import heroStudentPhoto from '../../assets/images/hero_jamb_student_1795029634215.jpg';
import { AuthUser, PlatformSettings, SubjectCombinationItem, SubjectItem } from '../../types/index.ts';

export type PublicRoute =
  | '/'
  | '/about'
  | '/how-it-works'
  | '/subjects'
  | '/features'
  | '/faq'
  | '/contact'
  | '/login'
  | '/register'
  | '/forgot-password'
  | '/reset-password'
  | '/verify-email';

interface PublicSiteProps {
  route: PublicRoute;
  onNavigate: (path: string) => void;
  onAuthenticated: (user: AuthUser) => void;
}

interface OverviewData {
  settings: PlatformSettings;
  subjects: SubjectItem[];
  combinations: SubjectCombinationItem[];
  stats: {
    subjectsCount: number;
    questionsCount: number;
    studentsCount: number;
    completedExamsCount: number;
    materialsCount: number;
  };
}

const FAQ_ITEMS = [
  {
    q: 'How does Acadet JAMB CBT structure the 4-subject UTME practice?',
    a: 'Every 4-subject UTME simulation enforces the official JAMB rule: Use of English is compulsory alongside three other approved subjects from your faculty combination.',
  },
  {
    q: 'What happens if my browser refreshes or my internet drops mid-exam?',
    a: 'Every answer and mark-for-review flag is saved directly to PostgreSQL as you click. Refreshing or re-opening the session restores your exact progress and remaining server timer.',
  },
  {
    q: 'How are Sample Practice Questions distinguished from Verified Past Questions?',
    a: 'Each question in the bank carries an explicit source label. Sample Practice Questions are curriculum-aligned drills, while Verified Past Questions display their verified examination year.',
  },
  {
    q: 'Can I review solutions and explanations after submitting my exam?',
    a: 'Yes. Immediately upon submission, your attempt is graded on the server with a /400 UTME scaled score, subject breakdown, downloadable PDF report, and question-by-question explanations.',
  },
  {
    q: 'How do scheduled Mock Examinations work?',
    a: 'Administrators schedule official timed mock windows with eligibility criteria. Candidates register ahead of time and launch the mock strictly within the active schedule window.',
  },
];

const DEMO_CBT_QUESTIONS = [
  {
    subject: 'Use of English',
    code: 'ENG',
    question: 'Choose the option that best completes the sentence: Neither the principal nor the teachers _____ aware of the change in timetable.',
    options: [
      { label: 'A', text: 'was' },
      { label: 'B', text: 'were' },
      { label: 'C', text: 'is' },
      { label: 'D', text: 'has been' },
    ],
    answer: 'B',
  },
  {
    subject: 'Mathematics',
    code: 'MTH',
    question: 'If log₁₀(x) = 2, what is the value of x + 15?',
    options: [
      { label: 'A', text: '35' },
      { label: 'B', text: '100' },
      { label: 'C', text: '115' },
      { label: 'D', text: '215' },
    ],
    answer: 'C',
  },
  {
    subject: 'Physics',
    code: 'PHY',
    question: 'A wave of frequency 50 Hz travels with a speed of 300 m/s. Calculate its wavelength.',
    options: [
      { label: 'A', text: '6.0 m' },
      { label: 'B', text: '0.17 m' },
      { label: 'C', text: '150 m' },
      { label: 'D', text: '250 m' },
    ],
    answer: 'A',
  },
];

export default function PublicSite({ route, onNavigate, onAuthenticated }: PublicSiteProps) {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [subjectCategory, setSubjectCategory] = useState<'All' | 'Compulsory' | 'Science' | 'Commercial' | 'Arts'>('All');

  // Interactive Hero CBT Demo state
  const [demoIdx, setDemoIdx] = useState(0);
  const [demoAnswers, setDemoAnswers] = useState<Record<number, string>>({});
  const [demoChecked, setDemoChecked] = useState(false);

  // Login state
  const [loginMode, setLoginMode] = useState<'student' | 'admin'>('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Register state
  const [regForm, setRegForm] = useState({
    fullName: '',
    email: '',
    username: '',
    password: '',
    phoneNumber: '',
    jambYear: '2026',
    intendedCourse: '',
    preferredInstitution: '',
  });

  // Forgot / Reset / Verify state
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null);

  // Contact state
  const [contactForm, setContactForm] = useState({ fullName: '', email: '', subject: '', message: '' });
  const [contactStatus, setContactStatus] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const loadOverview = async (retriesLeft = 4): Promise<void> => {
    setOverviewLoading(true);
    setOverviewError(false);
    try {
      const data = await apiFetch<OverviewData>('/api/public/overview');
      setOverview(data);
      setOverviewLoading(false);
    } catch {
      if (retriesLeft > 0) {
        setTimeout(() => {
          loadOverview(retriesLeft - 1);
        }, 1200);
      } else {
        setOverviewError(true);
        setOverviewLoading(false);
      }
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (route === '/reset-password') {
      const t = params.get('token') || '';
      if (t) setResetToken(t);
    }
    if (route === '/verify-email') {
      const t = params.get('token') || '';
      if (t) {
        apiFetch<{ message: string }>('/api/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token: t }),
        })
          .then((res) => setVerifyStatus(res.message))
          .catch((err) => setVerifyStatus(err instanceof Error ? err.message : 'Verification failed.'));
      }
    }
  }, [route]);

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setAuthLoading(true);
    try {
      const endpoint = loginMode === 'admin' ? '/api/auth/admin/login' : '/api/auth/login';
      const res = await apiFetch<{ user: AuthUser; token?: string }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      if (res.token) setSessionToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await apiFetch<{ user: AuthUser; token?: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          ...regForm,
          jambYear: Number(regForm.jambYear),
        }),
      });
      if (res.token) setSessionToken(res.token);
      onAuthenticated(res.user);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setAuthLoading(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail }),
      });
      setAuthSuccess(res.message);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to send reset request.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setAuthLoading(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, newPassword: resetNewPassword }),
      });
      setAuthSuccess(res.message);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleContactSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setContactStatus(null);
    try {
      const res = await apiFetch<{ message: string }>('/api/public/contact', {
        method: 'POST',
        body: JSON.stringify(contactForm),
      });
      setContactStatus(res.message);
      setContactForm({ fullName: '', email: '', subject: '', message: '' });
    } catch (err) {
      setContactStatus(err instanceof Error ? err.message : 'Failed to send inquiry.');
    }
  };

  const siteName = overview?.settings.siteName || 'Acadet JAMB CBT';
  const navLinks: Array<{ label: string; path: PublicRoute }> = [
    { label: 'Home', path: '/' },
    { label: 'Subjects', path: '/subjects' },
    { label: 'How It Works', path: '/how-it-works' },
    { label: 'Features', path: '/features' },
    { label: 'Contact', path: '/contact' },
  ];

  const go = (path: string) => {
    setMobileMenuOpen(false);
    setAuthError(null);
    setAuthSuccess(null);
    onNavigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: Brand wordmark — Concise single-line nav links — Auth CTAs */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => go('/')}
            className="flex shrink-0 items-center gap-2.5 whitespace-nowrap text-left"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0F2447] text-white">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight text-[#0F2447]">
              {siteName}
            </span>
          </button>

          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => go(item.path)}
                className={`shrink-0 whitespace-nowrap text-sm font-medium transition-colors ${
                  route === item.path
                    ? 'text-blue-700 underline decoration-2 underline-offset-8'
                    : 'text-slate-600 hover:text-[#0F2447]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => go('/login')}
              className="hidden shrink-0 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:inline-flex"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => go('/register')}
              className="shrink-0 whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {navLinks.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => go(item.path)}
                  className={`rounded-lg px-3 py-2 text-left text-sm font-medium ${
                    route === item.path ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => go('/about')}
                className="rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700"
              >
                About Acadet
              </button>
              <button
                type="button"
                onClick={() => go('/login')}
                className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-center text-sm font-semibold text-slate-800"
              >
                Login
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {route === '/' && (
          <>
            {/* Standard CBT Portal Hero with Live Interactive CBT Preview */}
            <section className="bg-[#0B1F3F] text-white">
              <div className="mx-auto grid max-w-7xl grid-cols-1 items-stretch gap-10 px-4 py-12 sm:px-6 lg:grid-cols-12 lg:py-16">
                <div className="flex flex-col justify-center lg:col-span-6">
                  <p className="text-xs font-semibold tracking-wide text-emerald-400">
                    Standard JAMB UTME Computer-Based Testing System
                  </p>
                  <h1 className="mt-3 max-w-xl font-display text-3xl font-extrabold tracking-tight text-balance sm:text-5xl">
                    Practice JAMB UTME in a Real CBT Hall
                  </h1>
                  <p className="mt-4 max-w-xl text-base leading-relaxed text-blue-100">
                    Experience the authentic 4-subject UTME workstation with compulsory Use of English, 8-key keyboard navigation, built-in calculator, PostgreSQL auto-save, and instant /400 scoring.
                  </p>

                  <ul className="mt-6 grid grid-cols-1 gap-2.5 text-sm text-blue-50 sm:grid-cols-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      <span>Use of English + 3 Electives</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      <span>Server Countdown &amp; Auto-Save</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      <span>Timed Exam &amp; Study Modes</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      <span>Subject Analytics &amp; PDF Slip</span>
                    </li>
                  </ul>

                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => go('/register')}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-500"
                    >
                      <span>Start Practising</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => go('/login')}
                      className="inline-flex items-center gap-2 rounded-lg border border-blue-400/40 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
                    >
                      <span>Candidate Sign In</span>
                    </button>
                  </div>
                </div>

                {/* Live Interactive Sample CBT Terminal */}
                <div className="lg:col-span-6">
                  <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-blue-800 bg-white text-slate-900 shadow-2xl">
                    {/* CBT Mini Header */}
                    <div className="flex items-center justify-between bg-[#0F2447] px-4 py-3 text-white">
                      <div>
                        <p className="text-xs font-bold">Sample CBT Workstation</p>
                        <p className="text-[11px] text-blue-200">Interactive UTME Preview · Question {demoIdx + 1} of 3</p>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-md border border-blue-700 bg-[#0A1D3D] px-2.5 py-1 font-mono text-xs font-bold tabular-nums">
                        <Clock className="h-3.5 w-3.5 text-emerald-400" />
                        <span>01:59:40</span>
                      </div>
                    </div>

                    {/* Subject Switcher */}
                    <div className="flex gap-1 border-b border-slate-200 bg-slate-100 px-3 py-2">
                      {DEMO_CBT_QUESTIONS.map((q, idx) => (
                        <button
                          key={q.code}
                          type="button"
                          onClick={() => {
                            setDemoIdx(idx);
                            setDemoChecked(false);
                          }}
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                            demoIdx === idx
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {q.subject}
                        </button>
                      ))}
                    </div>

                    {/* Active Sample Question */}
                    <div className="flex flex-1 flex-col justify-between p-5">
                      <div>
                        <p className="text-xs font-semibold text-blue-700">
                          {DEMO_CBT_QUESTIONS[demoIdx].subject} · Sample Practice Question
                        </p>
                        <p className="mt-2 text-sm leading-relaxed font-semibold text-slate-900">
                          {DEMO_CBT_QUESTIONS[demoIdx].question}
                        </p>
                        <div className="mt-4 space-y-2">
                          {DEMO_CBT_QUESTIONS[demoIdx].options.map((opt) => {
                            const selected = demoAnswers[demoIdx] === opt.label;
                            const isCorrect = opt.label === DEMO_CBT_QUESTIONS[demoIdx].answer;
                            let rowCls = 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50';
                            if (demoChecked && isCorrect) {
                              rowCls = 'border-emerald-500 bg-emerald-50 text-emerald-950';
                            } else if (demoChecked && selected && !isCorrect) {
                              rowCls = 'border-rose-400 bg-rose-50 text-rose-950';
                            } else if (selected) {
                              rowCls = 'border-blue-600 bg-blue-50 text-blue-950';
                            }
                            return (
                              <button
                                key={opt.label}
                                type="button"
                                onClick={() => {
                                  setDemoAnswers((prev) => ({ ...prev, [demoIdx]: opt.label }));
                                  setDemoChecked(false);
                                }}
                                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${rowCls}`}
                              >
                                <span
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border font-mono text-[11px] font-bold ${
                                    selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  {opt.label}
                                </span>
                                <span>{opt.text}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-3">
                        <div className="flex items-center gap-1.5">
                          {DEMO_CBT_QUESTIONS.map((_, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setDemoIdx(idx);
                                setDemoChecked(false);
                              }}
                              className={`h-7 w-7 rounded font-mono text-xs font-bold ${
                                demoIdx === idx
                                  ? 'bg-blue-600 text-white'
                                  : demoAnswers[idx]
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {idx + 1}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setDemoChecked(true)}
                          className="rounded-lg bg-[#0F2447] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-900"
                        >
                          {demoChecked
                            ? demoAnswers[demoIdx] === DEMO_CBT_QUESTIONS[demoIdx].answer
                              ? 'Correct Answer!'
                              : `Answer: ${DEMO_CBT_QUESTIONS[demoIdx].answer}`
                            : 'Check Sample'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Full-Width Platform Statistics Strip */}
            <section className="border-b border-slate-200 bg-white">
              <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-slate-200 px-4 sm:px-6 lg:grid-cols-4">
                <div className="px-4 py-6 text-center">
                  <p className="font-mono text-2xl font-extrabold text-[#0F2447] tabular-nums sm:text-3xl">
                    {overview?.stats.subjectsCount ?? 25}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">Active UTME Subjects</p>
                </div>
                <div className="px-4 py-6 text-center">
                  <p className="font-mono text-2xl font-extrabold text-blue-700 tabular-nums sm:text-3xl">
                    {overview?.stats.questionsCount ?? 100}+
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">Curated Question Bank</p>
                </div>
                <div className="px-4 py-6 text-center">
                  <p className="font-mono text-2xl font-extrabold text-emerald-600 tabular-nums sm:text-3xl">
                    {overview?.stats.studentsCount ?? 0}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">Registered Candidates</p>
                </div>
                <div className="px-4 py-6 text-center">
                  <p className="font-mono text-2xl font-extrabold text-[#0F2447] tabular-nums sm:text-3xl">
                    {overview?.stats.completedExamsCount ?? 0}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">Graded CBT Attempts</p>
                </div>
              </div>
            </section>

            {/* Candidate Readiness Showcase */}
            <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
              <div className="grid grid-cols-1 items-stretch gap-8 overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid-cols-12">
                <div className="min-h-[260px] bg-slate-100 lg:col-span-5">
                  {!heroImgFailed ? (
                    <img
                      src={heroStudentPhoto}
                      alt="Nigerian UTME candidate studying with Acadet JAMB CBT"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full min-h-[260px] flex-col items-center justify-center bg-[#0F2447] p-8 text-center text-white">
                      <GraduationCap className="h-12 w-12 text-emerald-400" />
                      <p className="mt-3 font-display text-lg font-bold">Acadet JAMB CBT</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col justify-center p-6 sm:p-10 lg:col-span-7">
                  <p className="text-xs font-semibold text-blue-700">Standard UTME Preparation</p>
                  <h2 className="mt-2 font-display text-2xl font-bold text-[#0F2447] sm:text-3xl">
                    Transparent Practice &amp; Scheduled Mock Simulations
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
                    Every session matches official JAMB rules: Use of English is mandatory alongside three electives, answers persist on every click, and server-side grading computes your exact /400 score and per-subject accuracy.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => go('/register')}
                      className="rounded-lg bg-[#0F2447] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-900"
                    >
                      Create Candidate Account
                    </button>
                    <button
                      type="button"
                      onClick={() => go('/faq')}
                      className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Read Candidate FAQ
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Available Subjects Showcase */}
            <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-[#0F2447] sm:text-3xl">
                    Official JAMB UTME Subject Catalogue ({overview?.subjects.length ?? 25})
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
                    Use of English is compulsory for all candidates alongside three approved subjects matching your target university course.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => go('/subjects')}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:underline whitespace-nowrap shrink-0"
                >
                  <span>View combinations &amp; details</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-6 flex flex-wrap gap-1.5">
                {(['All', 'Compulsory', 'Science', 'Commercial', 'Arts'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSubjectCategory(cat)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      subjectCategory === cat
                        ? 'border-[#0F2447] bg-[#0F2447] text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {overviewLoading && (!overview || overview.subjects.length === 0) ? (
                <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                  Loading all 25 JAMB UTME subjects...
                </div>
              ) : overviewError && (!overview || overview.subjects.length === 0) ? (
                <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-center">
                  <p className="text-sm text-slate-600">Unable to load subjects right now.</p>
                  <button
                    type="button"
                    onClick={() => loadOverview(2)}
                    className="mt-3 rounded-lg bg-[#0F2447] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-900"
                  >
                    Retry Loading Subjects
                  </button>
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {(overview?.subjects || [])
                    .filter((sub) => subjectCategory === 'All' || sub.category === subjectCategory)
                    .map((sub) => (
                    <div
                      key={sub.id}
                      className="rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-blue-300"
                    >
                      <p className="text-xs font-semibold text-blue-700">
                        {sub.code} · {sub.isCompulsory ? 'Compulsory' : sub.category}
                      </p>
                      <h3 className="mt-1.5 font-display text-base font-bold text-slate-900">{sub.name}</h3>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600">{sub.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* CBT Practice Features & Past Questions Integrity */}
            <section className="border-y border-slate-200 bg-white py-14">
              <div className="mx-auto max-w-7xl px-4 sm:px-6">
                <h2 className="font-display text-2xl font-bold text-[#0F2447] sm:text-3xl">
                  Built for Authentic UTME Exam Readiness
                </h2>
                <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-6">
                    <Clock className="h-6 w-6 text-blue-700" />
                    <h3 className="mt-4 font-display text-lg font-bold text-slate-900">Timed 4-Subject CBT Engine</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      Switch seamlessly between Use of English and your three electives, flag questions for review, use the built-in calculator, and rely on server-authoritative timing.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-6">
                    <FileCheck2 className="h-6 w-6 text-emerald-600" />
                    <h3 className="mt-4 font-display text-lg font-bold text-slate-900">Past Questions & Sample Drills</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      Filter by subject, syllabus topic, year, or difficulty. Sample practice questions and verified past papers are transparently labeled so you always know your source.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-6">
                    <BarChart3 className="h-6 w-6 text-blue-700" />
                    <h3 className="mt-4 font-display text-lg font-bold text-slate-900">Subject Performance Analytics</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      Track your scaled /400 UTME score trajectory, accuracy per subject, and time spent. Download clean PDF performance reports after every attempt.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* How It Works */}
            <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
              <h2 className="font-display text-2xl font-bold text-[#0F2447] sm:text-3xl">How Acadet JAMB CBT Works</h2>
              <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
                {[
                  {
                    step: '01. Create Your Candidate Profile',
                    desc: 'Register with your intended course, preferred institution, and target JAMB year to receive your unique ACD-JAMB registration code.',
                  },
                  {
                    step: '02. Configure Practice or Join Mocks',
                    desc: 'Choose a 4-subject UTME simulation, topic-based drill, past question sprint, or active scheduled Mock Examination.',
                  },
                  {
                    step: '03. Review Explanations & Improve',
                    desc: 'Get instant server-verified grading out of 400, review step-by-step explanations, and download study materials.',
                  },
                ].map((item) => (
                  <div key={item.step} className="rounded-xl border border-slate-200 bg-white p-6">
                    <h3 className="font-display text-base font-bold text-[#0F2447]">{item.step}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {route === '/about' && (
          <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
            <h1 className="font-display text-3xl font-extrabold text-[#0F2447]">About Acadet JAMB CBT</h1>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              Acadet JAMB CBT is a dedicated Computer-Based Testing platform engineered specifically for Nigerian UTME candidates.
              Our mission is to eliminate exam-day anxiety by mirroring the real CBT workflow—complete with compulsory Use of English,
              three-elective subject combinations, keyboard-friendly navigation, built-in calculator, and strict server-side grading integrity.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <ShieldCheck className="h-6 w-6 text-emerald-600" />
                <h2 className="mt-3 font-display text-lg font-bold text-slate-900">Academic Integrity</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Correct answers and explanations remain strictly locked on the server during active examinations and are never transmitted to the browser until submission.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <Layers className="h-6 w-6 text-blue-700" />
                <h2 className="mt-3 font-display text-lg font-bold text-slate-900">Source Transparency</h2>
                <p className="mt-2 text-sm text-slate-600">
                  We clearly distinguish curated Sample Practice Questions from Verified Past Questions so educators and candidates maintain complete trust in the question bank.
                </p>
              </div>
            </div>
          </section>
        )}

        {route === '/how-it-works' && (
          <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
            <h1 className="font-display text-3xl font-extrabold text-[#0F2447]">How It Works</h1>
            <p className="mt-3 text-base text-slate-600">
              Go from registration to full UTME exam mastery in four structured steps.
            </p>
            <div className="mt-8 space-y-4">
              {[
                ['1. Student Registration', 'Create an account with your JAMB examination year, intended course, and preferred university. Receive an instant ACD-JAMB registration number.'],
                ['2. Subject Combination Selection', 'Pick Use of English plus 3 electives—or load a faculty preset for Medicine, Engineering, Law, Accounting, or Social Sciences.'],
                ['3. Live CBT Exam Hall', 'Practice under realistic timed conditions with auto-save per click, question palette tracking, mark-for-review, and automatic crash/refresh recovery.'],
                ['4. Analytics & PDF Reports', 'Review your /400 score, inspect subject strengths, read explanations, and download study PDFs to close weak topics.'],
              ].map(([title, desc]) => (
                <div key={title} className="rounded-xl border border-slate-200 bg-white p-6">
                  <h2 className="font-display text-lg font-bold text-[#0F2447]">{title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{desc}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {route === '/subjects' && (
          <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-extrabold text-[#0F2447]">
                  Available JAMB UTME Subjects ({overview?.subjects.length ?? 25})
                </h1>
                <p className="mt-2 text-base text-slate-600">
                  All {overview?.subjects.length ?? 25} active JAMB UTME subjects and recommended 4-subject faculty combinations.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(['All', 'Compulsory', 'Science', 'Commercial', 'Arts'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSubjectCategory(cat)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      subjectCategory === cat
                        ? 'border-[#0F2447] bg-[#0F2447] text-white'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            {overviewLoading && (!overview || overview.subjects.length === 0) ? (
              <div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                Loading all 25 JAMB UTME subjects...
              </div>
            ) : overviewError && (!overview || overview.subjects.length === 0) ? (
              <div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 text-center">
                <p className="text-sm text-slate-600">Unable to load subjects right now.</p>
                <button
                  type="button"
                  onClick={() => loadOverview(2)}
                  className="mt-3 rounded-lg bg-[#0F2447] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-900"
                >
                  Retry Loading Subjects
                </button>
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(overview?.subjects || [])
                  .filter((s) => subjectCategory === 'All' || s.category === subjectCategory)
                  .map((s) => (
                  <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-5">
                    <p className="text-xs font-semibold text-blue-700">
                      {s.code} · {s.isCompulsory ? 'Compulsory' : s.category}
                    </p>
                    <h2 className="mt-1 font-display text-lg font-bold text-slate-900">{s.name}</h2>
                    <p className="mt-2 text-sm text-slate-600">{s.description}</p>
                  </div>
                ))}
              </div>
            )}

            <h2 className="mt-12 font-display text-2xl font-bold text-[#0F2447]">Official 4-Subject Faculty Combinations</h2>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              {(overview?.combinations || []).map((c) => (
                <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold text-emerald-700">{c.faculty}</p>
                  <h3 className="mt-1 font-display text-base font-bold text-slate-900">{c.name}</h3>
                  <p className="mt-1 font-mono text-xs font-semibold text-blue-700">
                    {c.subjectCodes.join(' · ')}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">{c.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {route === '/features' && (
          <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h1 className="font-display text-3xl font-extrabold text-[#0F2447]">Platform Features</h1>
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['Server-Authoritative Timer', 'Countdown durations are enforced by PostgreSQL timestamps so refreshing cannot reset exam time.', Clock],
                ['PostgreSQL Auto-Save', 'Every selected option and flagged question persists immediately to the database.', Lock],
                ['4-Subject UTME Engine', 'Compulsory Use of English combined with three electives and live subject tab switching.', BookOpen],
                ['Scheduled Mock Exams', 'Timed national simulations with backend start/end window and year eligibility enforcement.', Award],
                ['Performance Analytics', 'Visual score trends, subject accuracy charts, and downloadable PDF scorecards.', BarChart3],
                ['Study Materials Library', 'Subject-organized PDF revision guides, notes, and past paper packs.', FileCheck2],
              ].map(([title, desc, IconComp]) => {
                const Icon = IconComp as typeof Clock;
                return (
                  <div key={String(title)} className="rounded-xl border border-slate-200 bg-white p-6">
                    <Icon className="h-6 w-6 text-blue-700" />
                    <h2 className="mt-3 font-display text-lg font-bold text-slate-900">{String(title)}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{String(desc)}</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {route === '/faq' && (
          <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
            <h1 className="font-display text-3xl font-extrabold text-[#0F2447]">Frequently Asked Questions</h1>
            <div className="mt-8 space-y-3">
              {FAQ_ITEMS.map((item, idx) => (
                <div key={item.q} className="rounded-xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-display text-base font-bold text-slate-900"
                  >
                    <span>{item.q}</span>
                    <ChevronDown className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === idx && (
                    <div className="border-t border-slate-100 px-5 py-4 text-sm leading-relaxed text-slate-600">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {route === '/contact' && (
          <section className="mx-auto grid max-w-5xl grid-cols-1 gap-8 px-4 py-14 sm:px-6 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <h1 className="font-display text-3xl font-extrabold text-[#0F2447]">Contact Support</h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Have questions about UTME mock schedules, subject combinations, or candidate registration? Reach our team directly.
              </p>
              <div className="mt-6 space-y-4 text-sm text-slate-700">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-blue-700" />
                  <span>{overview?.settings.supportEmail || 'support@acadetjamb.com'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-blue-700" />
                  <span>{overview?.settings.supportPhone || '+234 800 222 3380'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-blue-700" />
                  <span>Lagos & Abuja, Nigeria</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Full Name</label>
                    <input
                      required
                      value={contactForm.fullName}
                      onChange={(e) => setContactForm((f) => ({ ...f, fullName: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Email Address</label>
                    <input
                      type="email"
                      required
                      value={contactForm.email}
                      onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Subject</label>
                  <input
                    required
                    value={contactForm.subject}
                    onChange={(e) => setContactForm((f) => ({ ...f, subject: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Message</label>
                  <textarea
                    required
                    rows={4}
                    value={contactForm.message}
                    onChange={(e) => setContactForm((f) => ({ ...f, message: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                {contactStatus && (
                  <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">{contactStatus}</p>
                )}
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Send Message
                </button>
              </form>
            </div>
          </section>
        )}

        {route === '/login' && (
          <section className="mx-auto max-w-md px-4 py-14">
            <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xs">
              <div className="mb-6 flex rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('student');
                    setAuthError(null);
                  }}
                  className={`flex-1 rounded-md py-2 text-xs font-semibold transition-colors ${
                    loginMode === 'student' ? 'bg-white text-[#0F2447] shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Student Portal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('admin');
                    setAuthError(null);
                  }}
                  className={`flex-1 rounded-md py-2 text-xs font-semibold transition-colors ${
                    loginMode === 'admin' ? 'bg-white text-[#0F2447] shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Administrator
                </button>
              </div>

              <h1 className="font-display text-2xl font-bold text-[#0F2447]">
                {loginMode === 'admin' ? 'Administrator Sign In' : 'Student Sign In'}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {loginMode === 'admin'
                  ? 'Access the Acadet JAMB CBT administrative console.'
                  : 'Sign in with your email, username, or ACD-JAMB registration number.'}
              </p>

              <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {loginMode === 'admin' ? 'Admin Email or Username' : 'Email, Username, or Registration No.'}
                  </label>
                  <input
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={loginMode === 'admin' ? 'admin@acadetjamb.com' : 'adewale@acadetjamb.com'}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>

                {authError && (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                    {authError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {authLoading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              {loginMode === 'student' && (
                <>
                  <div className="mt-5 flex items-center justify-between text-xs">
                    <button type="button" onClick={() => go('/forgot-password')} className="font-semibold text-blue-700 hover:underline">
                      Forgot password?
                    </button>
                    <button type="button" onClick={() => go('/register')} className="font-semibold text-emerald-700 hover:underline">
                      Create student account
                    </button>
                  </div>

                  <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <div className="flex items-center justify-between gap-2">
                      <span>Starter Student Demo</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIdentifier('adewale@acadetjamb.com');
                          setPassword('Student@2026');
                          setAuthError(null);
                        }}
                        className="font-semibold text-blue-700 hover:underline"
                      >
                        Fill Credentials
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {route === '/register' && (
          <section className="mx-auto max-w-2xl px-4 py-12">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
              <h1 className="font-display text-2xl font-bold text-[#0F2447]">Student UTME Registration</h1>
              <p className="mt-1 text-sm text-slate-600">
                Create your candidate profile to receive a unique Acadet JAMB Registration Number.
              </p>

              <form onSubmit={handleRegisterSubmit} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Full Name</label>
                  <input
                    required
                    value={regForm.fullName}
                    onChange={(e) => setRegForm((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="e.g. Adewale Ogunleye"
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    required
                    value={regForm.email}
                    onChange={(e) => setRegForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Username</label>
                  <input
                    required
                    value={regForm.username}
                    onChange={(e) => setRegForm((f) => ({ ...f, username: e.target.value }))}
                    placeholder="letters, numbers, underscore"
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Phone Number</label>
                  <input
                    required
                    value={regForm.phoneNumber}
                    onChange={(e) => setRegForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                    placeholder="08012345678"
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">JAMB Examination Year</label>
                  <select
                    value={regForm.jambYear}
                    onChange={(e) => setRegForm((f) => ({ ...f, jambYear: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    <option value="2026">2026 UTME</option>
                    <option value="2027">2027 UTME</option>
                    <option value="2028">2028 UTME</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Intended Course of Study</label>
                  <input
                    required
                    value={regForm.intendedCourse}
                    onChange={(e) => setRegForm((f) => ({ ...f, intendedCourse: e.target.value }))}
                    placeholder="e.g. Medicine & Surgery"
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Preferred Institution</label>
                  <input
                    required
                    value={regForm.preferredInstitution}
                    onChange={(e) => setRegForm((f) => ({ ...f, preferredInstitution: e.target.value }))}
                    placeholder="e.g. University of Ibadan"
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Password (min 8 characters)</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={regForm.password}
                    onChange={(e) => setRegForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>

                {authError && (
                  <div className="sm:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                    {authError}
                  </div>
                )}

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {authLoading ? 'Creating Candidate Account...' : 'Create Student Account'}
                  </button>
                </div>
              </form>

              <p className="mt-5 text-center text-xs text-slate-600">
                Already registered?{' '}
                <button type="button" onClick={() => go('/login')} className="font-semibold text-blue-700 hover:underline">
                  Sign in here
                </button>
              </p>
            </div>
          </section>
        )}

        {route === '/forgot-password' && (
          <section className="mx-auto max-w-md px-4 py-14">
            <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xs">
              <h1 className="font-display text-xl font-bold text-[#0F2447]">Reset Forgotten Password</h1>
              <p className="mt-1 text-sm text-slate-600">Enter your registered email to receive a password recovery link.</p>
              <form onSubmit={handleForgotSubmit} className="mt-5 space-y-4">
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="student@example.com"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                />
                {authSuccess && <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{authSuccess}</p>}
                {authError && <p className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{authError}</p>}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Send Recovery Link
                </button>
              </form>
              <button type="button" onClick={() => go('/login')} className="mt-4 text-xs font-semibold text-blue-700 hover:underline">
                Back to Sign In
              </button>
            </div>
          </section>
        )}

        {route === '/reset-password' && (
          <section className="mx-auto max-w-md px-4 py-14">
            <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xs">
              <h1 className="font-display text-xl font-bold text-[#0F2447]">Set New Password</h1>
              <form onSubmit={handleResetSubmit} className="mt-5 space-y-4">
                <input
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Reset token"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="New password (min 8 chars)"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
                />
                {authSuccess && <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">{authSuccess}</p>}
                {authError && <p className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800">{authError}</p>}
                <button type="submit" className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white">
                  Update Password
                </button>
              </form>
            </div>
          </section>
        )}

        {route === '/verify-email' && (
          <section className="mx-auto max-w-md px-4 py-16 text-center">
            <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xs">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
              <h1 className="mt-3 font-display text-xl font-bold text-[#0F2447]">Email Verification</h1>
              <p className="mt-2 text-sm text-slate-600">{verifyStatus || 'Processing verification token...'}</p>
              <button
                type="button"
                onClick={() => go('/login')}
                className="mt-5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white"
              >
                Continue to Login
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-[#0F2447] text-blue-100">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <p className="font-display text-lg font-extrabold text-white">{siteName}</p>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-blue-200">
              {overview?.settings.tagline || 'Prepare, Practice and Pass JAMB UTME with Confidence.'}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold text-white">Platform</p>
            <div className="mt-3 flex flex-col gap-2 text-xs text-blue-200">
              <button type="button" onClick={() => go('/about')} className="text-left hover:text-white">About Acadet</button>
              <button type="button" onClick={() => go('/subjects')} className="text-left hover:text-white">JAMB Subjects</button>
              <button type="button" onClick={() => go('/how-it-works')} className="text-left hover:text-white">How It Works</button>
              <button type="button" onClick={() => go('/faq')} className="text-left hover:text-white">FAQ</button>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-white">Support</p>
            <div className="mt-3 space-y-1.5 text-xs text-blue-200">
              <p>{overview?.settings.supportEmail || 'support@acadetjamb.com'}</p>
              <p>{overview?.settings.supportPhone || '+234 800 222 3380'}</p>
              <button type="button" onClick={() => go('/contact')} className="font-semibold text-emerald-400 hover:underline">
                Contact Us
              </button>
            </div>
          </div>
        </div>
        <div className="border-t border-blue-900/70 px-4 py-4 text-center text-xs text-blue-300">
          © {new Date().getFullYear()} Acadet JAMB CBT. Dedicated UTME Examination Practice Platform.
        </div>
      </footer>
    </div>
  );
}
