import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background gap-3.5">
        <div className="relative h-9 w-9">
          <div className="absolute inset-0 rounded-full border-[1.5px] border-primary/10" />
          <div className="absolute inset-0 rounded-full border-[1.5px] border-transparent border-t-primary animate-spin" />
        </div>
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary/35">
          Barber VIP
        </span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
