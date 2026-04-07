import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { loginRequest } from '../lib/msalConfig';

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

async function fetchProfileFromAPI(userId: string, email: string, name: string): Promise<UserProfile | null> {
  try {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, avatar_url: '' }),
    });
    if (res.ok) return await res.json();
  } catch (err: any) {
    console.error('프로필 조회 오류:', err.message);
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const account = accounts[0] ?? null;

  const user = account
    ? {
        id: account.localAccountId,
        email: account.username,
        name: account.name || account.username,
      }
    : null;

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const p = await fetchProfileFromAPI(user.id, user.email, user.name);
    if (p) setProfile(p);
  }, [user?.id, user?.email, user?.name]);

  useEffect(() => {
    if (inProgress !== InteractionStatus.None) return;

    if (isAuthenticated && user) {
      fetchProfileFromAPI(user.id, user.email, user.name).then((p) => {
        setProfile(p);
        setLoading(false);
      });
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [isAuthenticated, inProgress, user?.id]);

  const signIn = async () => {
    try {
      await instance.loginRedirect(loginRequest);
    } catch (err: any) {
      console.error('로그인 오류:', err.message);
    }
  };

  const signOut = async () => {
    setProfile(null);
    await instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin: profile?.role === 'admin',
        isActive: profile?.status === 'active',
        signIn,
        signOut,
        refreshProfile,
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
