import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AppRouter } from './router';
import { ToastContainer } from './components/ui/Toast';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { AuthInitializer } from './features/auth';
import './lib/i18n';

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthInitializer>
          <AppRouter />
          <ToastContainer />
        </AuthInitializer>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
