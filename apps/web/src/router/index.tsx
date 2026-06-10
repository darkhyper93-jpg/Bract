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
        handle: { title: 'Dashboard' },
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
        handle: { title: 'Planner', breadcrumb: [{ label: 'Planner' }] },
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
          title: 'Mi perfil',
          breadcrumb: [{ label: 'Mi perfil' }],
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
          title: 'Notificaciones',
          breadcrumb: [{ label: 'Notificaciones' }],
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
            handle: { title: 'Analytics' },
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
              title: 'Usuarios',
              breadcrumb: [{ label: 'Usuarios' }],
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
              title: 'Detalle de usuario',
              breadcrumb: [
                { label: 'Usuarios', href: '/users' },
                { label: 'Detalle' },
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
            handle: { title: 'Admin' },
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
