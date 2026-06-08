import React, { ReactNode } from 'react';
import { useMe } from '../hooks/useMe';

interface AuthInitializerProps {
  children: ReactNode;
}

export function AuthInitializer({ children }: AuthInitializerProps) {
  useMe();
  return <>{children}</>;
}
