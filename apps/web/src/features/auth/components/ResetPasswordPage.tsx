import React from 'react';
import { ResetPasswordForm } from './ResetPasswordForm';

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base px-4">
      <div className="w-full max-w-sm">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
