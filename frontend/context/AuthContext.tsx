'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@/lib/types';
import apiClient from '@/lib/apiClient';
import { getAccessToken, logout as removeTokens } from '@/lib/auth';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (token: string, refreshToken: string) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchUser = async () => {
    const token = getAccessToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data } = await apiClient.get<User>('/auth/me');
      setUser(data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      // If /me fails (e.g. 401), clear tokens
      removeTokens();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = (token: string, refreshToken: string) => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('access_token', token);
        localStorage.setItem('refresh_token', refreshToken);
    }
    // Fetch user immediately after setting tokens
    setIsLoading(true);
    fetchUser(); 
  };

  const logout = () => {
    removeTokens();
    setUser(null);
    router.push('/login');
  };

  const refreshUser = async () => {
      await fetchUser();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
