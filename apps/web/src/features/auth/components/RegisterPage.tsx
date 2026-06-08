import React from 'react';
import { motion } from 'framer-motion';
import { RegisterForm } from './RegisterForm';

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-base px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary">
            <svg
              className="h-5 w-5 text-white"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span className="text-base font-semibold tracking-tight text-text-primary">Bract</span>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-border-subtle bg-bg-surface p-8 shadow-xl shadow-black/30">
          <RegisterForm />
        </div>
      </motion.div>
    </div>
  );
}
