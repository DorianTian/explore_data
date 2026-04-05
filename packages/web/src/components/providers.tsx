'use client';

import { LoginGate } from '@/components/layout/login-gate';

export function Providers({ children }: { children: React.ReactNode }) {
  return <LoginGate>{children}</LoginGate>;
}
