import { Suspense, lazy, useEffect, useState } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { useAuthStore } from '@/store';
import { getCurrentUser } from '@/services/authService';

const HomePage = lazy(() => import('@/components/pages/HomePage'));
const LoginPage = lazy(() => import('@/components/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/components/pages/RegisterPage'));
const TermsOfServicePage = lazy(() => import('@/components/pages/TermsOfServicePage'));
const PrivacyPolicyPage = lazy(() => import('@/components/pages/PrivacyPolicyPage'));
const ForgotPasswordPage = lazy(() => import('@/components/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/components/pages/ResetPasswordPage'));
const ChangePasswordPage = lazy(() => import('@/components/pages/ChangePasswordPage'));
const WaitingPage = lazy(() => import('@/components/pages/WaitingPage'));
const MatchSuccessPage = lazy(() => import('@/components/pages/MatchSuccessPage'));
const MatchFailPage = lazy(() => import('@/components/pages/MatchFailPage'));
const MatchReportPage = lazy(() => import('@/components/pages/MatchReportPage'));
const ChatRoomPage = lazy(() => import('@/components/pages/ChatRoomPage'));
const QuestionnairePage = lazy(() => import('@/components/pages/QuestionnaireWrapper'));
const ProfilePage = lazy(() => import('@/components/pages/ProfilePage'));
const NotificationSettingsPage = lazy(() => import('@/components/pages/NotificationSettingsPage'));
const QuestionnaireRequiredPage = lazy(() => import('@/components/pages/QuestionnaireRequiredPage'));
const SecurityPage = lazy(() => import('@/components/pages/SecurityPage'));
const BindInfoPage = lazy(() => import('@/components/pages/BindInfoPage'));
const DonatePage = lazy(() => import('@/components/pages/DonatePage'));
const FeedbackPage = lazy(() => import('@/components/pages/FeedbackPage'));
const ContactMethodsPage = lazy(() => import('@/components/pages/ContactMethodsPage'));
const ChatEntryPage = lazy(() => import('@/components/pages/ChatEntryPage'));

const renderLazy = (Component: LazyExoticComponent<ComponentType>) => (
  <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-on-surface-variant">加载中...</div>}>
    <Component />
  </Suspense>
);

const ScrollToTopOnNavigate = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, search]);

  return <Outlet />;
};

const AuthRecoveryListener = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      const { supabase, hasSupabaseConfig } = await import('@/lib/supabase');
      if (!hasSupabaseConfig || !supabase || cancelled) return;

      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY' && session) {
          navigate('/reset-password', { replace: true });
        }
      });

      if (cancelled) {
        data.subscription.unsubscribe();
      }
    };

    setup();
    return () => { cancelled = true; };
  }, [navigate]);

  return <Outlet />;
};

const RequireAuth = () => {
  const location = useLocation();
  const isStoreAuthed = useAuthStore((state) => state.isAuthenticated);
  const [checking, setChecking] = useState(!isStoreAuthed);
  const [isAuthed, setIsAuthed] = useState(isStoreAuthed);

  useEffect(() => {
    if (isStoreAuthed) {
      setIsAuthed(true);
      setChecking(false);
      return;
    }

    let active = true;

    const verifyAuth = async () => {
      const user = await getCurrentUser();
      if (!active) {
        return;
      }
      setIsAuthed(Boolean(user));
      setChecking(false);
    };

    void verifyAuth();

    return () => {
      active = false;
    };
  }, [isStoreAuthed]);

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center text-on-surface-variant">认证中...</div>;
  }

  if (!isAuthed) {
    return <Navigate to="/login" state={{ from: `${location.pathname}${location.search}` }} replace />;
  }

  return <Outlet />;
};

// 路由配置
export const router = createBrowserRouter([
  {
    element: <AuthRecoveryListener />,
    children: [{
    element: <ScrollToTopOnNavigate />,
    children: [
      {
        path: '/',
        element: <Layout />,
        children: [
          {
            index: true,
            element: renderLazy(HomePage),
          },
          {
            path: 'feedback',
            element: renderLazy(FeedbackPage),
          },
          {
            element: <RequireAuth />,
            children: [
              {
                path: 'questionnaire',
                element: renderLazy(QuestionnairePage),
              },
              {
                path: 'questionnaire/:moduleId',
                element: renderLazy(QuestionnairePage),
              },
              {
                path: 'waiting',
                element: renderLazy(WaitingPage),
              },
              {
                path: 'questionnaire-required',
                element: renderLazy(QuestionnaireRequiredPage),
              },
              {
                path: 'match-success',
                element: renderLazy(MatchSuccessPage),
              },
              {
                path: 'match-fail',
                element: renderLazy(MatchFailPage),
              },
              {
                path: 'match-report',
                element: renderLazy(MatchReportPage),
              },
              {
                path: 'chat',
                element: renderLazy(ChatRoomPage),
              },
              {
                path: 'chat-entry',
                element: renderLazy(ChatEntryPage),
              },
              {
                path: 'profile',
                element: renderLazy(ProfilePage),
              },
              {
                path: 'notifications',
                element: renderLazy(NotificationSettingsPage),
              },
              {
                path: 'security',
                element: renderLazy(SecurityPage),
              },
              {
                path: 'bind-info',
                element: renderLazy(BindInfoPage),
              },
              {
                path: 'donate',
                element: renderLazy(DonatePage),
              },
              {
                path: 'contact-methods',
                element: renderLazy(ContactMethodsPage),
              },
            ],
          },
        ],
      },
      {
        path: '/login',
        element: renderLazy(LoginPage),
      },
      {
        path: '/register',
        element: renderLazy(RegisterPage),
      },
      {
        path: '/terms',
        element: renderLazy(TermsOfServicePage),
      },
      {
        path: '/privacy',
        element: renderLazy(PrivacyPolicyPage),
      },
      {
        path: '/forgot-password',
        element: renderLazy(ForgotPasswordPage),
      },
      {
        path: '/change-password',
        element: renderLazy(ChangePasswordPage),
      },
      {
        path: '/reset-password',
        element: renderLazy(ResetPasswordPage),
      },
      {
        // 捕获所有未匹配路由，重定向到首页
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
  ],
},
]);

export default router;