import { useState, useEffect, useCallback } from 'react';
import { User } from '../types';

declare global {
  interface Window {
    google: any;
  }
}

function decodeJwt(credential: string): any {
  try {
    const payload = credential.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleGoogleSignIn = useCallback(async (credential: string) => {
    try {
      if (!GOOGLE_CLIENT_ID) {
        throw new Error('Google Client ID missing. Set VITE_GOOGLE_CLIENT_ID and restart the dev server.');
      }
      setLoading(true);
      setError(null);

      const claims = decodeJwt(credential);
      if (!claims || !claims.email || !claims.sub) {
        throw new Error('Invalid Google credential.');
      }

      const userData: User = {
        id: claims.sub,
        googleId: claims.sub,
        email: claims.email,
        createdAt: new Date().toISOString(),
      } as User;

      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('google_id_token', credential);
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }, [GOOGLE_CLIENT_ID]);

  const signOut = useCallback(() => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('google_id_token');
    window.google?.accounts?.id?.disableAutoSelect();
    window.location.href = '/signin';
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!window.google) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  return {
    user,
    loading,
    error: !GOOGLE_CLIENT_ID ? 'Google Client ID missing. Set VITE_GOOGLE_CLIENT_ID.' : error,
    signIn: handleGoogleSignIn,
    signOut,
  };
};