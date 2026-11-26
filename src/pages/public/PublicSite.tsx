import { FormEvent, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Eye,
  GraduationCap,
  Menu,
  X,
} from 'lucide-react';
import SampleCbtPreview from '../../components/exam/SampleCbtPreview.tsx';
import { apiFetch, setSessionToken } from '../../lib/api.ts';
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
    q: 'How are the four JAMB subjects selected?',
    a: 'Use of English is compulsory for every candidate. You select three other subjects from the 25 available JAMB subjects or pick one of the preset course combinations.',
  },
  {
    q: 'What happens if my page refreshes or my connection drops during an examination?',
    a: 'Every answer you click and every question you mark is saved automatically on the server. When you open your account again, you can continue from where you stopped with your remaining time.',
  },
  {
    q: 'What is the difference between Sample Practice Questions and Past Questions?',
    a: 'Every question clearly shows its source. Practice questions are curriculum-based exercises, while past questions show their examination year.',
  },
  {
    q: 'Can I check correct answers and explanations after submitting?',
    a: 'Yes. Immediately you submit your examination, you see your score out of 400, your subject-by-subject scores, and the explanation for each question.',
  },
  {
    q: 'How do scheduled Mock Examinations work?',
    a: 'Mock examinations run during scheduled dates set by the examination administrator. Registered students can start the test during the open window.',
  },
];

export default function PublicSite({ route, onNavigate, onAuthenticated }: PublicSiteProps) {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSampleCbt, setShowSampleCbt] = useState(false);
  const [subjectCategory, setSubjectCategory] = useState<'All' | 'Compulsory' | 'Science' | 'Commercial' | 'Arts'>('All');

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
          void loadOverview(retriesLeft - 1);
        }, 1200);
      } else {
        setOverviewError(true);
        setOverviewLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadOverview();
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
      setAuthError(err instanceof Error ? err.message : 'Unable to log in. Please check your details.');
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
      setAuthError(err instanceof Error ? err.message : 'Could not create account.');
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
      setContactStatus(err instanceof Error ? err.message : 'Failed to send message.');
    }
  };

  const navLinks: Array<{ label: string; path: PublicRoute }> = [
    { label: 'Home', path: '/' },
    { label: 'Subjects', path: '/subjects' },
    { label: 'How It Works', path: '/how-it-works' },
    { label: 'FAQ', path: '/faq' },
    { label: 'Contact', path: '/contact' },
  ];

  const go = (path: string) => {
    setMobileMenuOpen(false);
    setAuthError(null);
    setAuthSuccess(null);
    onNavigate(path);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  if (showSampleCbt) {
    return <SampleCbtPreview onClose={() => setShowSampleCbt(false)} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F6F9] text-[#0F172A]">
      {/* Compact Application Header */}
      <header className="sticky top-0 z-40 border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => go('/')}
            className="flex shrink-0 items-center gap-2.5 whitespace-nowrap text-left"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#0F2447] text-white">
              <GraduationCap className="h-4 w-4" />
            </span>
            <span className="font-display text-base font-bold tracking-tight text-[#0F2447]">
              Acadet CBT JAMB
            </span>
          </button>

          <nav className="hidden items-center gap-5 md:flex">
            {navLinks.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => go(item.path)}
                className={`shrink-0 whitespace-nowrap text-sm font-medium ${
                  route === item.path
                    ? 'font-semibold text-[#1D4ED8] underline decoration-2 underline-offset-8'
                    : 'text-slate-600 hover:text-[#0F2447]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => go('/login')}
              className="hidden h-9 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-800 whitespace-nowrap hover:bg-slate-50 sm:inline-flex"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => go('/register')}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-[#0F2447] px-3.5 text-sm font-semibold text-white whitespace-nowrap hover:bg-[#173566]"
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 md:hidden"
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
                  className={`min-h-[44px] rounded-md px-3 py-2 text-left text-sm font-medium ${
                    route === item.path ? 'bg-blue-50 font-semibold text-[#1D4ED8]' : 'text-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => go('/about')}
                className="min-h-[44px] rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700"
              >
                About
              </button>
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  onClick={() => go('/login')}
                  className="min-h-[44px] rounded-md border border-slate-300 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-800"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => go('/register')}
                  className="min-h-[44px] rounded-md bg-[#0F2447] px-3 py-2 text-center text-sm font-semibold text-white"
                >
                  Create Account
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {route === '/' && (
          <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
            {/* Simple, Direct First Screen */}
            <section className="rounded-lg border border-slate-300 bg-white p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-3.5">
                    {/* Simple JAMB Institutional Emblem */}
                    <svg
                      viewBox="0 0 64 64"
                      className="h-14 w-14 shrink-0"
                      role="img"
                      aria-label="JAMB UTME Emblem"
                    >
                      <circle cx="32" cy="32" r="30" fill="#FFFFFF" stroke="#15803D" strokeWidth="2.5" />
                      <circle cx="32" cy="32" r="24" fill="#F8FAFC" stroke="#0F2447" strokeWidth="1.5" />
                      {/* Open Book */}
                      <path
                        d="M17 24c5-2 10-2 15 1 5-3 10-3 15-1v16c-5-2-10-1-15 2-5-3-10-4-15-2V24z"
                        fill="#FFFFFF"
                        stroke="#0F2447"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                      <line x1="32" y1="25" x2="32" y2="42" stroke="#0F2447" strokeWidth="1.8" />
                      {/* Torch / Flame Crest */}
                      <path d="M32 13l2.2 4.5-2.2 2.5-2.2-2.5L32 13z" fill="#15803D" />
                      {/* JAMB Banner */}
                      <rect x="18" y="45" width="28" height="9" rx="2" fill="#15803D" />
                      <text
                        x="32"
                        y="51.5"
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="6.5"
                        fontWeight="700"
                        fontFamily="system-ui, sans-serif"
                        letterSpacing="0.8"
                      >
                        JAMB
                      </text>
                    </svg>

                    <div>
                      <p className="text-xs font-semibold tracking-wide text-[#1D4ED8]">
                        UTME COMPUTER-BASED TESTING PORTAL
                      </p>
                      <h1 className="mt-1 font-display text-2xl font-bold text-[#0F2447] sm:text-3xl">
                        Acadet CBT JAMB
                      </h1>
                    </div>
                  </div>

                  <p className="mt-4 text-base text-slate-700">
                    Prepare for your JAMB examination with practice tests.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => go('/login')}
                      className="inline-flex min-h-[44px] min-w-[130px] items-center justify-center rounded-[10px] bg-[#0F2447] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#173566]"
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      onClick={() => go('/register')}
                      className="inline-flex min-h-[44px] min-w-[150px] items-center justify-center rounded-[10px] bg-[#1D4ED8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                      Create Account
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSampleCbt(true)}
                      className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-2.5 text-sm font-semibold text-[#0F172A] hover:bg-[#F8FAFC]"
                    >
                      <Eye className="h-4 w-4 text-[#1D4ED8]" />
                      <span>Preview CBT Screen</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Simple Examination Information Section */}
            <section className="rounded-lg border border-slate-300 bg-white">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="font-display text-base font-bold text-[#0F2447]">
                  Examination Information
                </h2>
              </div>

              <div className="grid grid-cols-1 divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <div className="space-y-4 p-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">1. Subject Combination</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      Use of English is compulsory for all students. Select three other subjects from{' '}
                      {overview?.stats.subjectsCount ?? 25} available JAMB subjects to start a full four-subject test.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">2. Practice &amp; Timed Modes</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      Take a timed examination with an active countdown timer and built-in calculator, or practise at your own pace in Study Mode.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 p-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">3. Automatic Answer Saving</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      Your answers and marked questions save automatically every time you select an option. You can switch freely between your four subjects.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">4. Instant Results &amp; Review</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      As soon as you submit, view your score out of 400, your breakdown for each subject, and explanations for the correct answers.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3.5 text-sm">
                <span className="text-slate-700">
                  {overview?.stats.subjectsCount ?? 25} JAMB subjects and{' '}
                  {overview?.stats.questionsCount ?? 100}+ practice questions available.
                </span>
                <button
                  type="button"
                  onClick={() => go('/subjects')}
                  className="font-semibold text-[#1D4ED8] hover:underline whitespace-nowrap"
                >
                  View Available Subjects
                </button>
              </div>
            </section>
          </div>
        )}

        {route === '/about' && (
          <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
            <div className="rounded-lg border border-slate-300 bg-white p-6 sm:p-8">
              <h1 className="font-display text-2xl font-bold text-[#0F2447]">About Acadet CBT JAMB</h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">
                Acadet CBT JAMB is an examination practice application built to help secondary school students prepare for the JAMB Unified Tertiary Matriculation Examination (UTME).
              </p>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-sm font-bold text-[#0F2447]">Authentic CBT Format</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Practise with four subjects (Use of English plus three electives), a question number grid, question marking, and an on-screen calculator.
                  </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-sm font-bold text-[#0F2447]">Fair Grading &amp; Clear Sources</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Answers stay locked on the server until submission. Every question is clearly marked as either a Practice Question or a Verified Past Question.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {route === '/how-it-works' && (
          <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
            <div className="rounded-lg border border-slate-300 bg-white p-6 sm:p-8">
              <h1 className="font-display text-2xl font-bold text-[#0F2447]">How It Works</h1>
              <p className="mt-1 text-sm text-slate-600">
                Follow these four steps to prepare for your UTME examination.
              </p>
              <div className="mt-6 divide-y divide-slate-200 rounded-md border border-slate-200">
                {[
                  ['1. Create Your Account', 'Register with your name, email, target year, and intended course to receive your candidate registration number.'],
                  ['2. Select Your Four Subjects', 'Use of English is included automatically. Pick three other subjects or choose a course combination.'],
                  ['3. Take Your Practice Test', 'Answer questions, switch between subjects, mark difficult questions for later review, and watch your countdown timer.'],
                  ['4. Check Your Results', 'Submit to see your total score out of 400, your subject-by-subject scores, and answer explanations.'],
                ].map(([title, desc]) => (
                  <div key={title} className="p-4 sm:p-5">
                    <h2 className="text-sm font-bold text-[#0F2447]">{title}</h2>
                    <p className="mt-1 text-sm text-slate-600">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {route === '/subjects' && (
          <section className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
            <div className="rounded-lg border border-slate-300 bg-white p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-[#0F2447]">
                    Available JAMB Subjects ({overview?.subjects.length ?? 25})
                  </h1>
                  <p className="mt-1 text-sm text-slate-600">
                    Use of English is compulsory. Choose three other subjects based on your course.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(['All', 'Compulsory', 'Science', 'Commercial', 'Arts'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSubjectCategory(cat)}
                      className={`min-h-[38px] rounded-md border px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
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
                <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">
                  Loading subjects...
                </div>
              ) : overviewError && (!overview || overview.subjects.length === 0) ? (
                <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-6 text-center">
                  <p className="text-sm text-slate-700">Unable to load subjects right now.</p>
                  <button
                    type="button"
                    onClick={() => loadOverview(2)}
                    className="mt-3 rounded-md bg-[#0F2447] px-4 py-2 text-xs font-semibold text-white"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(overview?.subjects || [])
                    .filter((s) => subjectCategory === 'All' || s.category === subjectCategory)
                    .map((s) => (
                      <div key={s.id} className="rounded-md border border-slate-200 bg-slate-50/50 p-4">
                        <p className="font-mono text-xs font-semibold text-[#1D4ED8]">
                          {s.code} · {s.isCompulsory ? 'Compulsory' : s.category}
                        </p>
                        <h2 className="mt-1 text-base font-bold text-slate-900">{s.name}</h2>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600">{s.description}</p>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-300 bg-white p-6">
              <h2 className="font-display text-lg font-bold text-[#0F2447]">Common Course Combinations</h2>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {(overview?.combinations || []).map((c) => (
                  <div key={c.id} className="rounded-md border border-slate-200 p-4">
                    <p className="text-xs font-semibold text-emerald-700">{c.faculty}</p>
                    <h3 className="mt-0.5 text-sm font-bold text-slate-900">{c.name}</h3>
                    <p className="mt-1 font-mono text-xs font-semibold text-[#1D4ED8]">
                      {c.subjectCodes.join(' · ')}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">{c.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {route === '/features' && (
          <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
            <div className="rounded-lg border border-slate-300 bg-white p-6 sm:p-8">
              <h1 className="font-display text-2xl font-bold text-[#0F2447]">Application Features</h1>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Timed 4-Subject Tests', 'Practise Use of English and three electives together with a live countdown clock.'],
                  ['Automatic Saving', 'Your selected answers save immediately so refreshing does not erase your work.'],
                  ['Question Number Grid', 'See answered, unanswered, and flagged questions at a glance and jump to any number.'],
                  ['Built-in Calculator', 'Open the CBT calculator directly inside your examination screen whenever needed.'],
                  ['Detailed Score Breakdown', 'Get your total UTME score out of 400 and individual subject percentages right away.'],
                  ['Study Materials', 'Download subject notes and revision handouts from your student account.'],
                ].map(([title, desc]) => (
                  <div key={title} className="rounded-md border border-slate-200 bg-slate-50/50 p-4">
                    <h2 className="text-sm font-bold text-[#0F2447]">{title}</h2>
                    <p className="mt-1 text-sm text-slate-600">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {route === '/faq' && (
          <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
            <div className="rounded-lg border border-slate-300 bg-white p-6 sm:p-8">
              <h1 className="font-display text-2xl font-bold text-[#0F2447]">Frequently Asked Questions</h1>
              <div className="mt-6 divide-y divide-slate-200 rounded-md border border-slate-200">
                {FAQ_ITEMS.map((item, idx) => (
                  <div key={item.q}>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                      className="flex min-h-[48px] w-full items-center justify-between gap-4 px-4 py-3.5 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50"
                    >
                      <span>{item.q}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                          openFaq === idx ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {openFaq === idx && (
                      <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3.5 text-sm leading-relaxed text-slate-700">
                        {item.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {route === '/contact' && (
          <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
            <div className="grid grid-cols-1 gap-6 rounded-lg border border-slate-300 bg-white p-6 sm:p-8 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <h1 className="font-display text-2xl font-bold text-[#0F2447]">Contact Support</h1>
                <p className="mt-2 text-sm text-slate-600">
                  Send us a message if you need help with your account, subject setup, or mock examination schedule.
                </p>
                <div className="mt-5 space-y-2.5 border-t border-slate-200 pt-4 text-sm text-slate-700">
                  <p>
                    <span className="font-semibold text-slate-900">Email:</span>{' '}
                    {overview?.settings.supportEmail || 'support@acadetjamb.com'}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-900">Phone:</span>{' '}
                    {overview?.settings.supportPhone || '+234 800 222 3380'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleContactSubmit} className="space-y-4 lg:col-span-7">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Full Name</label>
                    <input
                      required
                      value={contactForm.fullName}
                      onChange={(e) => setContactForm((f) => ({ ...f, fullName: e.target.value }))}
                      className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Email Address</label>
                    <input
                      type="email"
                      required
                      value={contactForm.email}
                      onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                      className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-[#1D4ED8] focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Subject</label>
                  <input
                    required
                    value={contactForm.subject}
                    onChange={(e) => setContactForm((f) => ({ ...f, subject: e.target.value }))}
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Message</label>
                  <textarea
                    required
                    rows={4}
                    value={contactForm.message}
                    onChange={(e) => setContactForm((f) => ({ ...f, message: e.target.value }))}
                    className="w-full rounded-md border border-slate-300 p-3 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                {contactStatus && (
                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                    {contactStatus}
                  </p>
                )}
                <button
                  type="submit"
                  className="min-h-[44px] rounded-md bg-[#0F2447] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#173566]"
                >
                  Send Message
                </button>
              </form>
            </div>
          </section>
        )}

        {route === '/login' && (
          <section className="mx-auto max-w-md px-4 py-10">
            <div className="rounded-lg border border-slate-300 bg-white p-6 sm:p-7">
              <div className="mb-5 grid grid-cols-2 gap-1 rounded-md border border-slate-200 bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('student');
                    setAuthError(null);
                  }}
                  className={`min-h-[38px] rounded-sm text-xs font-semibold ${
                    loginMode === 'student' ? 'bg-white text-[#0F2447]' : 'text-slate-600'
                  }`}
                >
                  Student Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('admin');
                    setAuthError(null);
                  }}
                  className={`min-h-[38px] rounded-sm text-xs font-semibold ${
                    loginMode === 'admin' ? 'bg-white text-[#0F2447]' : 'text-slate-600'
                  }`}
                >
                  Administrator
                </button>
              </div>

              <h1 className="font-display text-xl font-bold text-[#0F2447]">
                {loginMode === 'admin' ? 'Administrator Login' : 'Student Login'}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {loginMode === 'admin'
                  ? 'Log in to manage questions, subjects, and student records.'
                  : 'Log in with your email, username, or registration number.'}
              </p>

              <form onSubmit={handleLoginSubmit} className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    {loginMode === 'admin' ? 'Email or Username' : 'Email, Username, or Registration No.'}
                  </label>
                  <input
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={loginMode === 'admin' ? 'Enter admin email or username' : 'Enter email or registration number'}
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-[#1D4ED8] focus:outline-none"
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
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                {authError && (
                  <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                    {authError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="min-h-[44px] w-full rounded-md bg-[#0F2447] py-2.5 text-sm font-semibold text-white hover:bg-[#173566] disabled:opacity-60"
                >
                  {authLoading ? 'Logging in...' : 'Login'}
                </button>
              </form>

              {loginMode === 'student' && (
                <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4 text-xs">
                  <button type="button" onClick={() => go('/forgot-password')} className="font-semibold text-[#1D4ED8] hover:underline">
                    Forgot password?
                  </button>
                  <button type="button" onClick={() => go('/register')} className="font-semibold text-[#0F2447] hover:underline">
                    Create Account
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {route === '/register' && (
          <section className="mx-auto max-w-2xl px-4 py-8">
            <div className="rounded-lg border border-slate-300 bg-white p-6 sm:p-7">
              <h1 className="font-display text-xl font-bold text-[#0F2447]">Create Student Account</h1>
              <p className="mt-1 text-sm text-slate-600">
                Fill in your details below to create your Acadet CBT JAMB account.
              </p>

              <form onSubmit={handleRegisterSubmit} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Full Name</label>
                  <input
                    required
                    value={regForm.fullName}
                    onChange={(e) => setRegForm((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="Enter your full name"
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    required
                    value={regForm.email}
                    onChange={(e) => setRegForm((f) => ({ ...f, email: e.target.value }))}
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Username</label>
                  <input
                    required
                    value={regForm.username}
                    onChange={(e) => setRegForm((f) => ({ ...f, username: e.target.value }))}
                    placeholder="Choose a username"
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Phone Number</label>
                  <input
                    required
                    value={regForm.phoneNumber}
                    onChange={(e) => setRegForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                    placeholder="08012345678"
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">JAMB Examination Year</label>
                  <select
                    value={regForm.jambYear}
                    onChange={(e) => setRegForm((f) => ({ ...f, jambYear: e.target.value }))}
                    className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  >
                    <option value="2026">2026 UTME</option>
                    <option value="2027">2027 UTME</option>
                    <option value="2028">2028 UTME</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Intended Course</label>
                  <input
                    required
                    value={regForm.intendedCourse}
                    onChange={(e) => setRegForm((f) => ({ ...f, intendedCourse: e.target.value }))}
                    placeholder="e.g. Medicine & Surgery"
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Preferred Institution</label>
                  <input
                    required
                    value={regForm.preferredInstitution}
                    onChange={(e) => setRegForm((f) => ({ ...f, preferredInstitution: e.target.value }))}
                    placeholder="e.g. University of Ibadan"
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">Password (minimum 8 characters)</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={regForm.password}
                    onChange={(e) => setRegForm((f) => ({ ...f, password: e.target.value }))}
                    className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-[#1D4ED8] focus:outline-none"
                  />
                </div>

                {authError && (
                  <div className="sm:col-span-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                    {authError}
                  </div>
                )}

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={authLoading}
                    className="min-h-[44px] w-full rounded-md bg-[#1D4ED8] py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                  >
                    {authLoading ? 'Creating Account...' : 'Create Account'}
                  </button>
                </div>
              </form>

              <p className="mt-5 border-t border-slate-200 pt-4 text-center text-xs text-slate-600">
                Already have an account?{' '}
                <button type="button" onClick={() => go('/login')} className="font-semibold text-[#1D4ED8] hover:underline">
                  Login here
                </button>
              </p>
            </div>
          </section>
        )}

        {route === '/forgot-password' && (
          <section className="mx-auto max-w-md px-4 py-10">
            <div className="rounded-lg border border-slate-300 bg-white p-6">
              <h1 className="font-display text-xl font-bold text-[#0F2447]">Reset Password</h1>
              <p className="mt-1 text-sm text-slate-600">Enter your email address to receive a password reset link.</p>
              <form onSubmit={handleForgotSubmit} className="mt-5 space-y-4">
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm focus:border-[#1D4ED8] focus:outline-none"
                />
                {authSuccess && <p className="rounded-md bg-emerald-50 p-3 text-xs text-emerald-800">{authSuccess}</p>}
                {authError && <p className="rounded-md bg-rose-50 p-3 text-xs text-rose-800">{authError}</p>}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="min-h-[44px] w-full rounded-md bg-[#0F2447] py-2.5 text-sm font-semibold text-white hover:bg-[#173566]"
                >
                  Send Reset Link
                </button>
              </form>
              <button type="button" onClick={() => go('/login')} className="mt-4 text-xs font-semibold text-[#1D4ED8] hover:underline">
                Back to Login
              </button>
            </div>
          </section>
        )}

        {route === '/reset-password' && (
          <section className="mx-auto max-w-md px-4 py-10">
            <div className="rounded-lg border border-slate-300 bg-white p-6">
              <h1 className="font-display text-xl font-bold text-[#0F2447]">Choose a New Password</h1>
              <form onSubmit={handleResetSubmit} className="mt-5 space-y-4">
                <input
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Reset code"
                  className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="New password (minimum 8 characters)"
                  className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm"
                />
                {authSuccess && <p className="rounded-md bg-emerald-50 p-3 text-xs text-emerald-800">{authSuccess}</p>}
                {authError && <p className="rounded-md bg-rose-50 p-3 text-xs text-rose-800">{authError}</p>}
                <button type="submit" className="min-h-[44px] w-full rounded-md bg-[#0F2447] py-2.5 text-sm font-semibold text-white">
                  Save New Password
                </button>
              </form>
            </div>
          </section>
        )}

        {route === '/verify-email' && (
          <section className="mx-auto max-w-md px-4 py-12 text-center">
            <div className="rounded-lg border border-slate-300 bg-white p-6">
              <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-700" />
              <h1 className="mt-3 font-display text-xl font-bold text-[#0F2447]">Email Verification</h1>
              <p className="mt-2 text-sm text-slate-600">{verifyStatus || 'Checking verification link...'}</p>
              <button
                type="button"
                onClick={() => go('/login')}
                className="mt-5 min-h-[44px] rounded-md bg-[#0F2447] px-5 py-2 text-sm font-semibold text-white"
              >
                Continue to Login
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-slate-300 bg-white text-slate-600">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 text-xs sm:px-6">
          <p className="font-semibold text-[#0F2447]">Acadet CBT JAMB</p>
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => go('/about')} className="hover:text-[#0F2447]">About</button>
            <button type="button" onClick={() => go('/subjects')} className="hover:text-[#0F2447]">Subjects</button>
            <button type="button" onClick={() => go('/how-it-works')} className="hover:text-[#0F2447]">How It Works</button>
            <button type="button" onClick={() => go('/faq')} className="hover:text-[#0F2447]">FAQ</button>
            <button type="button" onClick={() => go('/contact')} className="hover:text-[#0F2447]">Contact</button>
          </div>
          <p>© {new Date().getFullYear()} Acadet CBT JAMB</p>
        </div>
      </footer>
    </div>
  );
}
