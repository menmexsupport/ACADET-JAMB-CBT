import { FormEvent, useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileQuestion,
  FileText,
  LogIn,
  Menu,
  Monitor,
  UserPlus,
  X,
} from 'lucide-react';
import cbtHallImg from '../../assets/images/cbt_exam_hall_1795681516128.jpg';
import BrandEmblem from '../../components/common/BrandEmblem.tsx';
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

const CORE_FEATURES = [
  {
    title: 'CBT Practice',
    desc: 'Authentic computer-based examination screen with question palette and countdown timer.',
    icon: Monitor,
  },
  {
    title: 'UTME-Style Questions',
    desc: 'Curriculum-aligned 4-subject UTME questions covering Use of English and core electives.',
    icon: FileQuestion,
  },
  {
    title: 'Instant Examination Results',
    desc: 'Immediate UTME scoring out of 400 with complete subject-by-subject breakdown.',
    icon: ClipboardCheck,
  },
  {
    title: 'Performance Tracking',
    desc: 'Monitor your average accuracy, attempt history, and readiness across every subject.',
    icon: BarChart3,
  },
  {
    title: 'Study Materials',
    desc: 'Access downloadable subject notes, revision handouts, and past question files.',
    icon: FileText,
  },
  {
    title: 'Detailed Explanations',
    desc: 'Review every question after submission with verified answers and clear explanations.',
    icon: BookOpen,
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
  const [policyModal, setPolicyModal] = useState<'privacy' | 'terms' | null>(null);

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
    { label: 'About', path: '/about' },
    { label: 'Features', path: '/features' },
    { label: 'FAQs', path: '/faq' },
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
    <div className="flex min-h-screen flex-col bg-[#F2F4F7] text-[#111827]">
      {/* Deep Green Institutional Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-[#094D25] bg-[#0B5E2E] text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => go('/')}
            className="flex shrink-0 items-center gap-3 text-left"
          >
            <BrandEmblem sizeClass="h-10 w-10" />
            <div className="leading-tight">
              <span className="block font-display text-base font-bold tracking-tight text-white">
                Pre-JAMB Academy CBT
              </span>
              <span className="hidden text-[11px] font-medium text-emerald-100 sm:block">
                ...Practice Today, Excel Tomorrow
              </span>
            </div>
          </button>

          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => go(item.path)}
                className={`shrink-0 whitespace-nowrap text-sm font-medium ${
                  route === item.path
                    ? 'font-bold text-white underline decoration-2 underline-offset-8'
                    : 'text-emerald-100 hover:text-white'
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
              className="hidden h-9 shrink-0 items-center justify-center rounded-md border border-white/40 bg-[#094D25] px-3.5 text-sm font-semibold text-white whitespace-nowrap hover:bg-[#084722] sm:inline-flex"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => go('/register')}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-white px-3.5 text-sm font-bold text-[#0B5E2E] whitespace-nowrap hover:bg-emerald-50"
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-white hover:bg-[#094D25] md:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-[#094D25] bg-[#094D25] px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {navLinks.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => go(item.path)}
                  className={`min-h-[44px] rounded-md px-3 py-2 text-left text-sm font-medium ${
                    route === item.path ? 'bg-[#0B5E2E] font-bold text-white' : 'text-emerald-100 hover:bg-[#0B5E2E]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => go('/subjects')}
                className="min-h-[44px] rounded-md px-3 py-2 text-left text-sm font-medium text-emerald-100 hover:bg-[#0B5E2E]"
              >
                Available Subjects
              </button>
              <button
                type="button"
                onClick={() => go('/contact')}
                className="min-h-[44px] rounded-md px-3 py-2 text-left text-sm font-medium text-emerald-100 hover:bg-[#0B5E2E]"
              >
                Contact Support
              </button>
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/15 pt-3">
                <button
                  type="button"
                  onClick={() => go('/login')}
                  className="min-h-[44px] rounded-md border border-white/40 bg-[#0B5E2E] px-3 py-2 text-center text-sm font-semibold text-white"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => go('/register')}
                  className="min-h-[44px] rounded-md bg-white px-3 py-2 text-center text-sm font-bold text-[#0B5E2E]"
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
          <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
            {/* Institutional Hero Section */}
            <section className="overflow-hidden rounded-md border border-[#CBD5E1] bg-white">
              <div className="grid grid-cols-1 items-center lg:grid-cols-12">
                <div className="p-6 sm:p-8 lg:col-span-7">
                  <div className="flex items-center gap-3">
                    <BrandEmblem sizeClass="h-12 w-12" />
                    <div>
                      <p className="text-xs font-bold tracking-wider text-[#0B5E2E] uppercase">
                        JAMB UTME Computer-Based Examination Portal
                      </p>
                      <p className="text-xs text-[#4B5563]">
                        Official Simulation &amp; Candidate Preparation System
                      </p>
                    </div>
                  </div>

                  <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">
                    PREPARE FOR JAMB UTME WITH CONFIDENCE.
                  </h1>

                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#374151] sm:text-base">
                    Practise with realistic UTME-style questions, improve your examination speed, monitor your performance and prepare effectively for your upcoming JAMB examination.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => go('/register')}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-[#0B5E2E] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#084722]"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>Create Account</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => go('/login')}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-[#0B5E2E] bg-white px-5 py-2.5 text-sm font-bold text-[#0B5E2E] hover:bg-emerald-50"
                    >
                      <LogIn className="h-4 w-4" />
                      <span>Login</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSampleCbt(true)}
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-4 py-2.5 text-sm font-semibold text-[#111827] hover:bg-slate-100"
                    >
                      <Monitor className="h-4 w-4 text-[#0B5E2E]" />
                      <span>Try Sample CBT</span>
                    </button>
                  </div>

                  <div className="mt-5 border-t border-[#E5E7EB] pt-4 text-xs font-medium text-[#4B5563]">
                    <span>
                      {overview?.stats.subjectsCount ?? 25} Approved UTME Subjects ·{' '}
                      {overview?.stats.questionsCount ?? 100}+ Verified &amp; Practice Questions · Instant /400 Scoring
                    </span>
                  </div>
                </div>

                <div className="border-t border-[#CBD5E1] bg-[#F8FAFC] lg:col-span-5 lg:border-t-0 lg:border-l">
                  <div className="relative aspect-[16/10] w-full lg:aspect-[4/3]">
                    <img
                      src={cbtHallImg}
                      alt="Computer-based examination hall with students sitting at desktop workstations"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="border-t border-[#E5E7EB] bg-white px-4 py-2.5 text-xs text-[#4B5563]">
                    Standard CBT examination environment modelled after JAMB UTME test centres.
                  </div>
                </div>
              </div>
            </section>

            {/* Features Horizontal Strip */}
            <section className="rounded-md border border-[#CBD5E1] bg-white">
              <div className="border-b border-[#E5E7EB] bg-[#F9FAFB] px-5 py-3.5">
                <h2 className="font-display text-sm font-bold tracking-wide text-[#0B5E2E] uppercase">
                  Platform Examination Services
                </h2>
              </div>
              <div className="grid grid-cols-1 divide-y divide-[#E5E7EB] sm:grid-cols-2 sm:divide-x lg:grid-cols-3">
                {CORE_FEATURES.map((feat) => {
                  const Icon = feat.icon;
                  return (
                    <div key={feat.title} className="p-5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#CBD5E1] bg-[#F2F4F7] text-[#0B5E2E]">
                          <Icon className="h-4 w-4" />
                        </span>
                        <h3 className="text-sm font-bold text-[#111827]">{feat.title}</h3>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-[#4B5563]">{feat.desc}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* How It Works & Available Subjects */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <section className="rounded-md border border-[#CBD5E1] bg-white lg:col-span-5">
                <div className="border-b border-[#E5E7EB] bg-[#F9FAFB] px-5 py-3.5">
                  <h2 className="font-display text-sm font-bold tracking-wide text-[#0B5E2E] uppercase">
                    How It Works
                  </h2>
                </div>
                <div className="divide-y divide-[#E5E7EB]">
                  {[
                    ['1. Register Candidate Account', 'Create your student profile to generate your candidate registration number.'],
                    ['2. Select Four UTME Subjects', 'Use of English is compulsory alongside three subjects for your chosen course.'],
                    ['3. Sit Timed CBT Practice', 'Navigate with the question palette, flag items for review, and track your clock.'],
                    ['4. Review /400 Score & Corrections', 'Submit to receive instant UTME scaling and detailed question explanations.'],
                  ].map(([title, desc]) => (
                    <div key={title} className="px-5 py-3.5">
                      <h3 className="text-sm font-bold text-[#111827]">{title}</h3>
                      <p className="mt-0.5 text-xs leading-relaxed text-[#4B5563]">{desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-md border border-[#CBD5E1] bg-white lg:col-span-7">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F9FAFB] px-5 py-3.5">
                  <h2 className="font-display text-sm font-bold tracking-wide text-[#0B5E2E] uppercase">
                    Available Subjects ({overview?.subjects.length ?? 25})
                  </h2>
                  <button
                    type="button"
                    onClick={() => go('/subjects')}
                    className="text-xs font-bold text-[#0B5E2E] hover:underline"
                  >
                    View All Subjects
                  </button>
                </div>
                <div className="p-5">
                  {overviewLoading && (!overview || overview.subjects.length === 0) ? (
                    <p className="text-xs text-[#4B5563]">Loading available JAMB subjects...</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                      {(overview?.subjects || []).slice(0, 12).map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between rounded-md border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2"
                        >
                          <span className="truncate text-xs font-semibold text-[#111827]">{sub.name}</span>
                          <span className="ml-2 shrink-0 font-mono text-[11px] font-bold text-[#0B5E2E]">
                            {sub.code}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Compact FAQ & Contact Support */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <section className="rounded-md border border-[#CBD5E1] bg-white lg:col-span-7">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-[#F9FAFB] px-5 py-3.5">
                  <h2 className="font-display text-sm font-bold tracking-wide text-[#0B5E2E] uppercase">
                    Frequently Asked Questions
                  </h2>
                  <button
                    type="button"
                    onClick={() => go('/faq')}
                    className="text-xs font-bold text-[#0B5E2E] hover:underline"
                  >
                    All FAQs
                  </button>
                </div>
                <div className="divide-y divide-[#E5E7EB]">
                  {FAQ_ITEMS.slice(0, 3).map((item, idx) => (
                    <div key={item.q}>
                      <button
                        type="button"
                        onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                        className="flex min-h-[44px] w-full items-center justify-between gap-4 px-5 py-3 text-left text-xs font-bold text-[#111827] hover:bg-[#F9FAFB]"
                      >
                        <span>{item.q}</span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-[#4B5563] transition-transform ${
                            openFaq === idx ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {openFaq === idx && (
                        <div className="border-t border-[#E5E7EB] bg-[#F9FAFB] px-5 py-3 text-xs leading-relaxed text-[#374151]">
                          {item.a}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-md border border-[#CBD5E1] bg-white lg:col-span-5">
                <div className="border-b border-[#E5E7EB] bg-[#F9FAFB] px-5 py-3.5">
                  <h2 className="font-display text-sm font-bold tracking-wide text-[#0B5E2E] uppercase">
                    Contact and Support
                  </h2>
                </div>
                <div className="space-y-3 p-5 text-xs text-[#374151]">
                  <p className="leading-relaxed">
                    Need help with candidate registration, subject combination setup, or mock examination schedules? Contact our examination support desk.
                  </p>
                  <div className="space-y-1.5 rounded-md border border-[#E5E7EB] bg-[#F9FAFB] p-3.5">
                    <p>
                      <strong className="text-[#111827]">Support Email:</strong>{' '}
                      {overview?.settings.supportEmail || 'support@acadetjamb.com'}
                    </p>
                    <p>
                      <strong className="text-[#111827]">Helpdesk Phone:</strong>{' '}
                      {overview?.settings.supportPhone || '+234 800 222 3380'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => go('/contact')}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-md bg-[#0B5E2E] px-4 text-xs font-bold text-white hover:bg-[#084722]"
                  >
                    Send Support Message
                  </button>
                </div>
              </section>
            </div>
          </div>
        )}

        {route === '/about' && (
          <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
            <div className="rounded-md border border-[#CBD5E1] bg-white p-6 sm:p-8">
              <h1 className="font-display text-2xl font-bold text-[#0B5E2E]">About Pre-JAMB Academy CBT</h1>
              <p className="mt-3 text-sm leading-relaxed text-[#374151]">
                Pre-JAMB Academy CBT is an institutional computer-based testing portal designed to help UTME candidates practise under authentic JAMB examination conditions.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                  <h2 className="text-sm font-bold text-[#111827]">Authentic CBT Format</h2>
                  <p className="mt-1 text-sm text-[#4B5563]">
                    Practise with four subjects (Use of English plus three electives), a colour-coded question palette, question marking, and an on-screen calculator.
                  </p>
                </div>
                <div className="rounded-md border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                  <h2 className="text-sm font-bold text-[#111827]">Fair Grading &amp; Clear Sources</h2>
                  <p className="mt-1 text-sm text-[#4B5563]">
                    Answers remain locked on the server until submission. Every question clearly states whether it is a Practice Question or a Verified Past Question.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {route === '/how-it-works' && (
          <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
            <div className="rounded-md border border-[#CBD5E1] bg-white p-6 sm:p-8">
              <h1 className="font-display text-2xl font-bold text-[#0B5E2E]">How It Works</h1>
              <p className="mt-1 text-sm text-[#4B5563]">
                Follow these four steps to prepare for your UTME examination.
              </p>
              <div className="mt-6 divide-y divide-[#E5E7EB] rounded-md border border-[#E5E7EB]">
                {[
                  ['1. Create Your Account', 'Register with your name, email, target year, and intended course to receive your candidate registration number.'],
                  ['2. Select Your Four Subjects', 'Use of English is included automatically. Pick three other subjects or choose a course combination.'],
                  ['3. Take Your Practice Test', 'Answer questions, switch between subjects, mark difficult questions for later review, and watch your countdown timer.'],
                  ['4. Check Your Results', 'Submit to see your total score out of 400, your subject-by-subject scores, and answer explanations.'],
                ].map(([title, desc]) => (
                  <div key={title} className="p-4 sm:p-5">
                    <h2 className="text-sm font-bold text-[#111827]">{title}</h2>
                    <p className="mt-1 text-sm text-[#4B5563]">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {route === '/subjects' && (
          <section className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
            <div className="rounded-md border border-[#CBD5E1] bg-white p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-[#0B5E2E]">
                    Available JAMB Subjects ({overview?.subjects.length ?? 25})
                  </h1>
                  <p className="mt-1 text-sm text-[#4B5563]">
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
                          ? 'border-[#0B5E2E] bg-[#0B5E2E] text-white'
                          : 'border-[#CBD5E1] bg-white text-[#374151] hover:bg-[#F9FAFB]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {overviewLoading && (!overview || overview.subjects.length === 0) ? (
                <div className="mt-6 rounded-md border border-[#E5E7EB] bg-[#F9FAFB] p-6 text-center text-sm text-[#4B5563]">
                  Loading subjects...
                </div>
              ) : overviewError && (!overview || overview.subjects.length === 0) ? (
                <div className="mt-6 rounded-md border border-[#E5E7EB] bg-[#F9FAFB] p-6 text-center">
                  <p className="text-sm text-[#374151]">Unable to load subjects right now.</p>
                  <button
                    type="button"
                    onClick={() => loadOverview(2)}
                    className="mt-3 rounded-md bg-[#0B5E2E] px-4 py-2 text-xs font-semibold text-white"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(overview?.subjects || [])
                    .filter((s) => subjectCategory === 'All' || s.category === subjectCategory)
                    .map((s) => (
                      <div key={s.id} className="rounded-md border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                        <p className="font-mono text-xs font-semibold text-[#0B5E2E]">
                          {s.code} · {s.isCompulsory ? 'Compulsory' : s.category}
                        </p>
                        <h2 className="mt-1 text-base font-bold text-[#111827]">{s.name}</h2>
                        <p className="mt-1 text-xs leading-relaxed text-[#4B5563]">{s.description}</p>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="rounded-md border border-[#CBD5E1] bg-white p-6">
              <h2 className="font-display text-lg font-bold text-[#0B5E2E]">Common Course Combinations</h2>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {(overview?.combinations || []).map((c) => (
                  <div key={c.id} className="rounded-md border border-[#E5E7EB] p-4">
                    <p className="text-xs font-semibold text-[#0B5E2E]">{c.faculty}</p>
                    <h3 className="mt-0.5 text-sm font-bold text-[#111827]">{c.name}</h3>
                    <p className="mt-1 font-mono text-xs font-semibold text-[#374151]">
                      {c.subjectCodes.join(' · ')}
                    </p>
                    <p className="mt-1 text-xs text-[#4B5563]">{c.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {route === '/features' && (
          <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
            <div className="rounded-md border border-[#CBD5E1] bg-white p-6 sm:p-8">
              <h1 className="font-display text-2xl font-bold text-[#0B5E2E]">Portal Features</h1>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {CORE_FEATURES.map((feat) => (
                  <div key={feat.title} className="rounded-md border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                    <h2 className="text-sm font-bold text-[#111827]">{feat.title}</h2>
                    <p className="mt-1 text-sm text-[#4B5563]">{feat.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {route === '/faq' && (
          <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
            <div className="rounded-md border border-[#CBD5E1] bg-white p-6 sm:p-8">
              <h1 className="font-display text-2xl font-bold text-[#0B5E2E]">Frequently Asked Questions</h1>
              <div className="mt-6 divide-y divide-[#E5E7EB] rounded-md border border-[#E5E7EB]">
                {FAQ_ITEMS.map((item, idx) => (
                  <div key={item.q}>
                    <button
                      type="button"
                      onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                      className="flex min-h-[48px] w-full items-center justify-between gap-4 px-4 py-3.5 text-left text-sm font-semibold text-[#111827] hover:bg-[#F9FAFB]"
                    >
                      <span>{item.q}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-[#4B5563] transition-transform ${
                          openFaq === idx ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {openFaq === idx && (
                      <div className="border-t border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3.5 text-sm leading-relaxed text-[#374151]">
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
            <div className="grid grid-cols-1 gap-6 rounded-md border border-[#CBD5E1] bg-white p-6 sm:p-8 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <h1 className="font-display text-2xl font-bold text-[#0B5E2E]">Contact Support</h1>
                <p className="mt-2 text-sm text-[#4B5563]">
                  Send us a message if you need help with your account, subject setup, or mock examination schedule.
                </p>
                <div className="mt-5 space-y-2.5 border-t border-[#E5E7EB] pt-4 text-sm text-[#374151]">
                  <p>
                    <span className="font-semibold text-[#111827]">Email:</span>{' '}
                    {overview?.settings.supportEmail || 'support@acadetjamb.com'}
                  </p>
                  <p>
                    <span className="font-semibold text-[#111827]">Phone:</span>{' '}
                    {overview?.settings.supportPhone || '+234 800 222 3380'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleContactSubmit} className="space-y-4 lg:col-span-7">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#374151]">Full Name</label>
                    <input
                      required
                      value={contactForm.fullName}
                      onChange={(e) => setContactForm((f) => ({ ...f, fullName: e.target.value }))}
                      className="h-11 w-full rounded-md border border-[#CBD5E1] px-3 text-sm focus:border-[#0B5E2E] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#374151]">Email Address</label>
                    <input
                      type="email"
                      required
                      value={contactForm.email}
                      onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))}
                      className="h-11 w-full rounded-md border border-[#CBD5E1] px-3 text-sm focus:border-[#0B5E2E] focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#374151]">Subject</label>
                  <input
                    required
                    value={contactForm.subject}
                    onChange={(e) => setContactForm((f) => ({ ...f, subject: e.target.value }))}
                    className="h-11 w-full rounded-md border border-[#CBD5E1] px-3 text-sm focus:border-[#0B5E2E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#374151]">Message</label>
                  <textarea
                    required
                    rows={4}
                    value={contactForm.message}
                    onChange={(e) => setContactForm((f) => ({ ...f, message: e.target.value }))}
                    className="w-full rounded-md border border-[#CBD5E1] p-3 text-sm focus:border-[#0B5E2E] focus:outline-none"
                  />
                </div>
                {contactStatus && (
                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                    {contactStatus}
                  </p>
                )}
                <button
                  type="submit"
                  className="min-h-[44px] rounded-md bg-[#0B5E2E] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#084722]"
                >
                  Send Message
                </button>
              </form>
            </div>
          </section>
        )}

        {route === '/login' && (
          <section className="mx-auto max-w-md px-4 py-10">
            <div className="rounded-md border border-[#CBD5E1] bg-white p-6 sm:p-7">
              <div className="mb-5 grid grid-cols-2 gap-1 rounded-md border border-[#CBD5E1] bg-[#F2F4F7] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('student');
                    setAuthError(null);
                  }}
                  className={`min-h-[38px] rounded-sm text-xs font-bold ${
                    loginMode === 'student' ? 'bg-[#0B5E2E] text-white' : 'text-[#4B5563]'
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
                  className={`min-h-[38px] rounded-sm text-xs font-bold ${
                    loginMode === 'admin' ? 'bg-[#0B5E2E] text-white' : 'text-[#4B5563]'
                  }`}
                >
                  Administrator
                </button>
              </div>

              <h1 className="font-display text-xl font-bold text-[#111827]">
                {loginMode === 'admin' ? 'Administrator Login' : 'Candidate Login'}
              </h1>
              <p className="mt-1 text-sm text-[#4B5563]">
                {loginMode === 'admin'
                  ? 'Log in to manage questions, subjects, and student records.'
                  : 'Log in with your email, username, or registration number.'}
              </p>

              <form onSubmit={handleLoginSubmit} className="mt-5 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#374151]">
                    {loginMode === 'admin' ? 'Email or Username' : 'Email, Username, or Registration No.'}
                  </label>
                  <input
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={loginMode === 'admin' ? 'Enter admin email or username' : 'Enter email or registration number'}
                    className="h-11 w-full rounded-md border border-[#CBD5E1] px-3 text-sm focus:border-[#0B5E2E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#374151]">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="h-11 w-full rounded-md border border-[#CBD5E1] px-3 text-sm focus:border-[#0B5E2E] focus:outline-none"
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
                  className="min-h-[44px] w-full rounded-md bg-[#0B5E2E] py-2.5 text-sm font-bold text-white hover:bg-[#084722] disabled:opacity-60"
                >
                  {authLoading ? 'Logging in...' : 'Login'}
                </button>
              </form>

              {loginMode === 'student' && (
                <div className="mt-5 flex items-center justify-between border-t border-[#E5E7EB] pt-4 text-xs">
                  <button type="button" onClick={() => go('/forgot-password')} className="font-semibold text-[#0B5E2E] hover:underline">
                    Forgot password?
                  </button>
                  <button type="button" onClick={() => go('/register')} className="font-semibold text-[#111827] hover:underline">
                    Create Account
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {route === '/register' && (
          <section className="mx-auto max-w-2xl px-4 py-8">
            <div className="rounded-md border border-[#CBD5E1] bg-white p-6 sm:p-7">
              <h1 className="font-display text-xl font-bold text-[#0B5E2E]">Create Candidate Account</h1>
              <p className="mt-1 text-sm text-[#4B5563]">
                Complete your registration details below to open your Pre-JAMB Academy CBT portal.
              </p>

              <form onSubmit={handleRegisterSubmit} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#374151]">Full Name</label>
                  <input
                    required
                    value={regForm.fullName}
                    onChange={(e) => setRegForm((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="Enter your full name"
                    className="h-11 w-full rounded-md border border-[#CBD5E1] px-3 text-sm focus:border-[#0B5E2E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#374151]">Email Address</label>
                  <input
                    type="email"
                    required
                    value={regForm.email}
                    onChange={(e) => setRegForm((f) => ({ ...f, email: e.target.value }))}
                    className="h-11 w-full rounded-md border border-[#CBD5E1] px-3 text-sm focus:border-[#0B5E2E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#374151]">Username</label>
                  <input
                    required
                    value={regForm.username}
                    onChange={(e) => setRegForm((f) => ({ ...f, username: e.target.value }))}
                    placeholder="Choose a username"
                    className="h-11 w-full rounded-md border border-[#CBD5E1] px-3 text-sm focus:border-[#0B5E2E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#374151]">Phone Number</label>
                  <input
                    required
                    value={regForm.phoneNumber}
                    onChange={(e) => setRegForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                    placeholder="08012345678"
                    className="h-11 w-full rounded-md border border-[#CBD5E1] px-3 text-sm focus:border-[#0B5E2E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#374151]">JAMB Examination Year</label>
                  <select
                    value={regForm.jambYear}
                    onChange={(e) => setRegForm((f) => ({ ...f, jambYear: e.target.value }))}
                    className="h-11 w-full rounded-md border border-[#CBD5E1] bg-white px-3 text-sm focus:border-[#0B5E2E] focus:outline-none"
                  >
                    <option value="2026">2026 UTME</option>
                    <option value="2027">2027 UTME</option>
                    <option value="2028">2028 UTME</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#374151]">Intended Course</label>
                  <input
                    required
                    value={regForm.intendedCourse}
                    onChange={(e) => setRegForm((f) => ({ ...f, intendedCourse: e.target.value }))}
                    placeholder="e.g. Medicine & Surgery"
                    className="h-11 w-full rounded-md border border-[#CBD5E1] px-3 text-sm focus:border-[#0B5E2E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#374151]">Preferred Institution</label>
                  <input
                    required
                    value={regForm.preferredInstitution}
                    onChange={(e) => setRegForm((f) => ({ ...f, preferredInstitution: e.target.value }))}
                    placeholder="e.g. University of Ibadan"
                    className="h-11 w-full rounded-md border border-[#CBD5E1] px-3 text-sm focus:border-[#0B5E2E] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#374151]">Password (minimum 8 characters)</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={regForm.password}
                    onChange={(e) => setRegForm((f) => ({ ...f, password: e.target.value }))}
                    className="h-11 w-full rounded-md border border-[#CBD5E1] px-3 text-sm focus:border-[#0B5E2E] focus:outline-none"
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
                    className="min-h-[44px] w-full rounded-md bg-[#0B5E2E] py-2.5 text-sm font-bold text-white hover:bg-[#084722] disabled:opacity-60"
                  >
                    {authLoading ? 'Creating Account...' : 'Create Account'}
                  </button>
                </div>
              </form>

              <p className="mt-5 border-t border-[#E5E7EB] pt-4 text-center text-xs text-[#4B5563]">
                Already have an account?{' '}
                <button type="button" onClick={() => go('/login')} className="font-bold text-[#0B5E2E] hover:underline">
                  Login here
                </button>
              </p>
            </div>
          </section>
        )}

        {route === '/forgot-password' && (
          <section className="mx-auto max-w-md px-4 py-10">
            <div className="rounded-md border border-[#CBD5E1] bg-white p-6">
              <h1 className="font-display text-xl font-bold text-[#0B5E2E]">Reset Password</h1>
              <p className="mt-1 text-sm text-[#4B5563]">Enter your email address to receive a password reset link.</p>
              <form onSubmit={handleForgotSubmit} className="mt-5 space-y-4">
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="h-11 w-full rounded-md border border-[#CBD5E1] px-3 text-sm focus:border-[#0B5E2E] focus:outline-none"
                />
                {authSuccess && <p className="rounded-md bg-emerald-50 p-3 text-xs text-emerald-800">{authSuccess}</p>}
                {authError && <p className="rounded-md bg-rose-50 p-3 text-xs text-rose-800">{authError}</p>}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="min-h-[44px] w-full rounded-md bg-[#0B5E2E] py-2.5 text-sm font-bold text-white hover:bg-[#084722]"
                >
                  Send Reset Link
                </button>
              </form>
              <button type="button" onClick={() => go('/login')} className="mt-4 text-xs font-bold text-[#0B5E2E] hover:underline">
                Back to Login
              </button>
            </div>
          </section>
        )}

        {route === '/reset-password' && (
          <section className="mx-auto max-w-md px-4 py-10">
            <div className="rounded-md border border-[#CBD5E1] bg-white p-6">
              <h1 className="font-display text-xl font-bold text-[#0B5E2E]">Choose a New Password</h1>
              <form onSubmit={handleResetSubmit} className="mt-5 space-y-4">
                <input
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Reset code"
                  className="h-11 w-full rounded-md border border-[#CBD5E1] px-3 text-sm"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={resetNewPassword}
                  onChange={(e) => setResetNewPassword(e.target.value)}
                  placeholder="New password (minimum 8 characters)"
                  className="h-11 w-full rounded-md border border-[#CBD5E1] px-3 text-sm"
                />
                {authSuccess && <p className="rounded-md bg-emerald-50 p-3 text-xs text-emerald-800">{authSuccess}</p>}
                {authError && <p className="rounded-md bg-rose-50 p-3 text-xs text-rose-800">{authError}</p>}
                <button type="submit" className="min-h-[44px] w-full rounded-md bg-[#0B5E2E] py-2.5 text-sm font-bold text-white hover:bg-[#084722]">
                  Save New Password
                </button>
              </form>
            </div>
          </section>
        )}

        {route === '/verify-email' && (
          <section className="mx-auto max-w-md px-4 py-12 text-center">
            <div className="rounded-md border border-[#CBD5E1] bg-white p-6">
              <CheckCircle2 className="mx-auto h-9 w-9 text-[#0B5E2E]" />
              <h1 className="mt-3 font-display text-xl font-bold text-[#0B5E2E]">Email Verification</h1>
              <p className="mt-2 text-sm text-[#4B5563]">{verifyStatus || 'Checking verification link...'}</p>
              <button
                type="button"
                onClick={() => go('/login')}
                className="mt-5 min-h-[44px] rounded-md bg-[#0B5E2E] px-5 py-2 text-sm font-bold text-white hover:bg-[#084722]"
              >
                Continue to Login
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Deep Green Institutional Footer */}
      <footer className="border-t border-[#094D25] bg-[#0B5E2E] text-emerald-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 text-xs sm:px-6">
          <p className="font-semibold text-white">© {new Date().getFullYear()} Pre-JAMB Academy CBT. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => go('/about')} className="hover:text-white">About</button>
            <button type="button" onClick={() => go('/subjects')} className="hover:text-white">Subjects</button>
            <button type="button" onClick={() => go('/faq')} className="hover:text-white">FAQs</button>
            <button type="button" onClick={() => setPolicyModal('privacy')} className="hover:text-white">Privacy</button>
            <button type="button" onClick={() => setPolicyModal('terms')} className="hover:text-white">Terms</button>
            <button type="button" onClick={() => go('/contact')} className="hover:text-white">Contact</button>
          </div>
        </div>
      </footer>

      {policyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onClick={() => setPolicyModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-md border border-[#CBD5E1] bg-white p-6"
          >
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <h2 className="font-display text-base font-bold text-[#0B5E2E]">
                {policyModal === 'privacy' ? 'Candidate Privacy Notice' : 'Examination Portal Terms of Use'}
              </h2>
              <button
                type="button"
                onClick={() => setPolicyModal(null)}
                aria-label="Close policy window"
                className="flex h-9 w-9 items-center justify-center rounded-md text-[#4B5563] hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs leading-relaxed text-[#374151]">
              {policyModal === 'privacy' ? (
                <>
                  <p>
                    Pre-JAMB Academy CBT stores your registration profile, chosen UTME subjects, examination responses, and performance analytics solely to deliver realistic CBT practice and track your academic progress.
                  </p>
                  <p>
                    Candidate passwords are encrypted, and examination answers are graded securely on the server without sharing personal details with third parties.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Candidate accounts are intended for individual UTME practice and scheduled mock examinations. Automated scraping, answer tampering, or multi-account abuse is prohibited.
                  </p>
                  <p>
                    Timed UTME mock examinations enforce the active examination clock and automatically submit recorded responses when time expires.
                  </p>
                </>
              )}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setPolicyModal(null)}
                className="min-h-[40px] rounded-md bg-[#0B5E2E] px-4 text-xs font-bold text-white hover:bg-[#084722]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
