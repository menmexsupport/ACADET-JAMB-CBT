import { useCallback, useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import ExamHall from './components/exam/ExamHall.tsx';
import { apiFetch, clearSessionToken } from './lib/api.ts';
import AdminWorkspace from './pages/admin/AdminWorkspace.tsx';
import PublicSite, { PublicRoute } from './pages/public/PublicSite.tsx';
import StudentWorkspace, { StudentTab } from './pages/student/StudentWorkspace.tsx';
import { AuthUser } from './types/index.ts';

const PUBLIC_ROUTES: PublicRoute[] = [
  '/',
  '/about',
  '/how-it-works',
  '/subjects',
  '/features',
  '/faq',
  '/contact',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
];

const STUDENT_PATH_TO_TAB: Record<string, StudentTab> = {
  '/dashboard': 'dashboard',
  '/start-cbt': 'start-cbt',
  '/practice': 'practice',
  '/mocks': 'mocks',
  '/past-questions': 'past-questions',
  '/subjects-portal': 'subjects',
  '/results': 'results',
  '/analytics': 'analytics',
  '/materials': 'materials',
  '/notifications': 'notifications',
  '/profile': 'profile',
  '/settings': 'settings',
};

function isPublicRoute(path: string): path is PublicRoute {
  return (PUBLIC_ROUTES as string[]).includes(path);
}

export default function App() {
  const [pathname, setPathname] = useState<string>(() => window.location.pathname || '/');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [resultSessionToOpen, setResultSessionToOpen] = useState<string | null>(null);

  const navigate = useCallback((nextPath: string, replace = false) => {
    const cleanTarget = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
    const targetUrl = new URL(cleanTarget, window.location.origin);
    if (replace) {
      window.history.replaceState({}, '', targetUrl.pathname + targetUrl.search);
    } else {
      window.history.pushState({}, '', targetUrl.pathname + targetUrl.search);
    }
    setPathname(targetUrl.pathname);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch<{ user: AuthUser | null }>('/api/auth/me')
      .then((res) => {
        if (!active) return;
        setUser(res.user);
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
      })
      .finally(() => {
        if (active) setAuthChecked(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const isDark = Boolean(user && user.actorType === 'student' && user.preferences?.theme === 'dark');
    document.documentElement.classList.toggle('dark', isDark);
  }, [user]);

  const handleAuthenticated = useCallback(
    (authedUser: AuthUser) => {
      setUser(authedUser);
      setResultSessionToOpen(null);
      if (authedUser.actorType === 'admin') {
        navigate('/admin', true);
      } else {
        navigate('/dashboard', true);
      }
    },
    [navigate]
  );

  const handleLogout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Clear local session regardless
    }
    clearSessionToken();
    document.documentElement.classList.remove('dark');
    setUser(null);
    setResultSessionToOpen(null);
    navigate('/login', true);
  }, [navigate]);

  const handleEnterExam = useCallback(
    (sessionId: string) => {
      setResultSessionToOpen(null);
      navigate(`/exam/${sessionId}`);
    },
    [navigate]
  );

  const handleExamCompleted = useCallback(
    (sessionId: string) => {
      setResultSessionToOpen(sessionId);
      navigate('/results', true);
    },
    [navigate]
  );

  if (!authChecked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 text-slate-900">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0F2447] text-white shadow-sm">
          <GraduationCap className="h-6 w-6" />
        </div>
        <p className="mt-4 text-sm font-semibold text-slate-600">Loading Acadet JAMB CBT...</p>
      </div>
    );
  }

  // Authenticated Admin Console
  if (user?.actorType === 'admin') {
    const isAuthEntry = pathname === '/login' || pathname === '/register' || pathname === '/forgot-password';
    if (!isPublicRoute(pathname) || isAuthEntry) {
      return <AdminWorkspace admin={user} onLogout={handleLogout} />;
    }
  }

  // Authenticated Student Exam Hall (/exam/:sessionId)
  if (user?.actorType === 'student' && pathname.startsWith('/exam/')) {
    const sessionId = pathname.replace('/exam/', '').split('/')[0]?.trim();
    if (sessionId) {
      return (
        <ExamHall
          sessionId={sessionId}
          candidate={user}
          preferences={user.preferences}
          onExitToDashboard={() => navigate('/dashboard', true)}
          onCompleted={handleExamCompleted}
        />
      );
    }
  }

  // Authenticated Student Workspace
  if (user?.actorType === 'student') {
    const isAuthEntry = pathname === '/login' || pathname === '/register' || pathname === '/forgot-password';
    if (isAuthEntry || pathname === '/admin' || !isPublicRoute(pathname)) {
      const resolvedTab: StudentTab = STUDENT_PATH_TO_TAB[pathname] || 'dashboard';
      return (
        <StudentWorkspace
          key={resultSessionToOpen ? `results-${resultSessionToOpen}` : 'student-workspace'}
          user={user}
          onUserUpdated={setUser}
          onEnterExam={handleEnterExam}
          onLogout={handleLogout}
          initialTab={resultSessionToOpen ? 'results' : resolvedTab}
          initialResultSessionId={resultSessionToOpen}
        />
      );
    }
  }

  // Public Website & Auth Pages (including unauthenticated fallback to /login)
  const resolvedPublicRoute: PublicRoute = isPublicRoute(pathname)
    ? pathname
    : pathname === '/'
    ? '/'
    : '/login';

  return (
    <PublicSite
      route={resolvedPublicRoute}
      onNavigate={(path) => navigate(path)}
      onAuthenticated={handleAuthenticated}
    />
  );
}
