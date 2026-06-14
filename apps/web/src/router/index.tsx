import React, { Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { PublicRoute } from './PublicRoute';
import { RoleRoute } from './RoleRoute';
import { DashboardShell } from '../components/layout/DashboardShell';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { Role } from '@bract/shared';

const LoginPage = React.lazy(() => import('../features/auth/components/LoginPage'));
const RegisterPage = React.lazy(() => import('../features/auth/components/RegisterPage'));
const ForgotPasswordPage = React.lazy(() => import('../features/auth/components/ForgotPasswordPage'));
const ResetPasswordPage = React.lazy(() => import('../features/auth/components/ResetPasswordPage'));
const VerifyEmailPage = React.lazy(() => import('../features/auth/components/VerifyEmailPage'));
const DashboardPage = React.lazy(() => import('../pages/DashboardPage'));
const PlannerPage = React.lazy(() => import('../features/planner/components/PlannerPage'));
const SyllabusPage = React.lazy(() => import('../features/syllabus/components/SyllabusPage'));
const FlashcardsPage = React.lazy(() => import('../features/flashcards/components/FlashcardsPage'));
const ChatPage = React.lazy(() => import('../features/chat/components/ChatPage'));
const ImportPage = React.lazy(() => import('../features/import/components/ImportPage'));
const QuizPage = React.lazy(() => import('../features/quiz/components/QuizPage'));
const ProgressPage = React.lazy(() => import('../features/progress').then((m) => ({ default: m.ProgressPage })));
const UsersPage = React.lazy(() => import('../features/users/components/UsersPage'));
const UserDetailPage = React.lazy(() => import('../features/users/components/UserDetailPage'));
const ProfilePage = React.lazy(() => import('../features/profile/components/ProfilePage'));
const NotificationsPage = React.lazy(() => import('../features/notifications/components/NotificationsPage').then((m) => ({ default: m.NotificationsPage })));
const AnalyticsPage = React.lazy(() => import('../features/analytics').then((m) => ({ default: m.AnalyticsPage })));
const AdminPage = React.lazy(() => import('../features/admin').then((m) => ({ default: m.AdminPage })));
const NotFoundPage = React.lazy(() => import('../pages/NotFoundPage'));
const ForbiddenPage = React.lazy(() => import('../pages/ForbiddenPage'));

const PageFallback = () => (
  <div className="flex h-full items-center justify-center p-8">
    <Skeleton className="h-64 w-full max-w-2xl" />
  </div>
);

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard" replace />,
  },
  {
    element: <PublicRoute />,
    children: [
      {
        path: '/login',
        element: (
          <Suspense fallback={<PageFallback />}>
            <LoginPage />
          </Suspense>
        ),
      },
      {
        path: '/register',
        element: (
          <Suspense fallback={<PageFallback />}>
            <RegisterPage />
          </Suspense>
        ),
      },
      {
        path: '/forgot-password',
        element: (
          <Suspense fallback={<PageFallback />}>
            <ForgotPasswordPage />
          </Suspense>
        ),
      },
      {
        path: '/reset-password',
        element: (
          <Suspense fallback={<PageFallback />}>
            <ResetPasswordPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: '/verify-email',
    element: (
      <Suspense fallback={<PageFallback />}>
        <VerifyEmailPage />
      </Suspense>
    ),
  },
  {
    element: <DashboardShell />,
    children: [
      {
        path: '/dashboard',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <DashboardPage />
            </Suspense>
          </ErrorBoundary>
        ),
        handle: { titleKey: 'nav.dashboard' },
      },
      {
        path: '/planner',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <PlannerPage />
            </Suspense>
          </ErrorBoundary>
        ),
        handle: { titleKey: 'nav.planner', breadcrumb: [{ labelKey: 'nav.planner' }] },
      },
      {
        path: '/syllabus',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <SyllabusPage />
            </Suspense>
          </ErrorBoundary>
        ),
        handle: { titleKey: 'nav.syllabus', breadcrumb: [{ labelKey: 'nav.syllabus' }] },
      },
      {
        path: '/flashcards',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <FlashcardsPage />
            </Suspense>
          </ErrorBoundary>
        ),
        handle: { titleKey: 'nav.flashcards', breadcrumb: [{ labelKey: 'nav.flashcards' }] },
      },
      {
        path: '/chat',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <ChatPage />
            </Suspense>
          </ErrorBoundary>
        ),
        handle: { titleKey: 'nav.chat', breadcrumb: [{ labelKey: 'nav.chat' }] },
      },
      {
        path: '/import',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <ImportPage />
            </Suspense>
          </ErrorBoundary>
        ),
        handle: { titleKey: 'nav.import', breadcrumb: [{ labelKey: 'nav.import' }] },
      },
      {
        path: '/quiz',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <QuizPage />
            </Suspense>
          </ErrorBoundary>
        ),
        handle: { titleKey: 'nav.quiz', breadcrumb: [{ labelKey: 'nav.quiz' }] },
      },
      {
        path: '/progress',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <ProgressPage />
            </Suspense>
          </ErrorBoundary>
        ),
        handle: { titleKey: 'nav.progress', breadcrumb: [{ labelKey: 'nav.progress' }] },
      },
      {
        path: '/profile',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <ProfilePage />
            </Suspense>
          </ErrorBoundary>
        ),
        handle: {
          titleKey: 'nav.profile',
          breadcrumb: [{ labelKey: 'nav.profile' }],
        },
      },
      {
        path: '/notifications',
        element: (
          <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <NotificationsPage />
            </Suspense>
          </ErrorBoundary>
        ),
        handle: {
          titleKey: 'nav.notifications',
          breadcrumb: [{ labelKey: 'nav.notifications' }],
        },
      },
      {
        element: <RoleRoute role={Role.ADMIN} />,
        children: [
          {
            path: '/analytics',
            element: (
              <ErrorBoundary>
                <Suspense fallback={<PageFallback />}>
                  <AnalyticsPage />
                </Suspense>
              </ErrorBoundary>
            ),
            handle: { titleKey: 'nav.analytics' },
          },
          {
            path: '/users',
            element: (
              <ErrorBoundary>
                <Suspense fallback={<PageFallback />}>
                  <UsersPage />
                </Suspense>
              </ErrorBoundary>
            ),
            handle: {
              titleKey: 'nav.users',
              breadcrumb: [{ labelKey: 'nav.users' }],
            },
          },
          {
            path: '/users/:id',
            element: (
              <ErrorBoundary>
                <Suspense fallback={<PageFallback />}>
                  <UserDetailPage />
                </Suspense>
              </ErrorBoundary>
            ),
            handle: {
              titleKey: 'nav.userDetail',
              breadcrumb: [
                { labelKey: 'nav.users', href: '/users' },
                { labelKey: 'nav.userDetail' },
              ],
            },
          },
          {
            path: '/admin',
            element: (
              <ErrorBoundary>
                <Suspense fallback={<PageFallback />}>
                  <AdminPage />
                </Suspense>
              </ErrorBoundary>
            ),
            handle: { titleKey: 'nav.admin' },
          },
        ],
      },
    ],
  },
  {
    path: '/403',
    element: (
      <Suspense fallback={<PageFallback />}>
        <ForbiddenPage />
      </Suspense>
    ),
  },
  {
    path: '*',
    element: (
      <Suspense fallback={<PageFallback />}>
        <NotFoundPage />
      </Suspense>
    ),
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
