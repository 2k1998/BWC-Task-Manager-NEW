'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/lib/apiClient';
import BrandingLogo from '@/components/BrandingLogo';

export default function LoginPage() {
  const tAuth = useTranslations('Auth');
  const tCommon = useTranslations('Common');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Call API to get tokens
      const response = await apiClient.post('/auth/login', {
        username_or_email: email,
        password,
      });

      const { access_token, refresh_token } = response.data;
      
      // 2. Use Context login (sets tokens & fetches user)
      login(access_token, refresh_token);
      
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || tAuth('invalidCredentials'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 gap-3 w-full text-center">
          <BrandingLogo height={260} className="mx-auto max-w-[min(100%,960px)]" alt="BWC Task Manager" />
          <p className="text-brand-silver/90 text-sm tracking-wide">{tAuth('login')}</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            {tAuth('login')}
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                {tAuth('email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 caret-gray-900 placeholder:text-gray-400 bg-white focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all"
                placeholder={tAuth('email')}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                {tAuth('password')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 caret-gray-900 placeholder:text-gray-400 bg-white focus:ring-2 focus:ring-primary-gold focus:border-transparent outline-none transition-all"
                placeholder={tAuth('password')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-gold text-black font-semibold py-3 rounded-lg hover:bg-opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? `${tCommon('loading')}...` : tAuth('signIn')}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-brand-silver/80 text-sm mt-6">
          BWC Task Manager © 2026
        </p>
      </div>
    </div>
  );
}
