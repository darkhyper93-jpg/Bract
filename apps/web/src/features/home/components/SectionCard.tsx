import React from 'react';

// Wrapper presentacional de cada sección del Home: card de tokens (§9.2) con header + acción opcional
// (típicamente un link "ver más"). Mantiene el look consistente entre secciones.
interface SectionCardProps {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function SectionCard({ title, action, children }: SectionCardProps) {
  return (
    <section className="rounded-xl border border-border-subtle bg-bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
