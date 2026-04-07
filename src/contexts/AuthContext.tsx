import React, { createContext, useContext, useState } from 'react';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
  created_at: string;
}

interface AuthContextType {
  user: { id: string; email: string; name: string } | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isActive: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// TODO: SSO 연동 완료 후 MSAL 기반 AuthProvider로 교체
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider
      value={{
        user: { id: 'temp', email: '', name: '' },
        profile: null,
        loading: false,
        isAdmin: true,
        isActive: true,
        signIn: async () => {},
        signOut: async () => {},
        refreshProfile: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
