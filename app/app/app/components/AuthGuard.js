'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import LoginScreen from './LoginScreen';

const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export default function AuthGuard({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  // Activity timer reference
  const logoutTimerRef = useState(null);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem('currentUser');
    setCurrentUser(null);
    window.location.href = '/';
  }, []);

  const resetTimer = useCallback(() => {
    if (!currentUser) return;
    
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
    }
    
    logoutTimerRef.current = setTimeout(() => {
      console.log('Session timed out due to inactivity');
      handleLogout();
    }, TIMEOUT_MS);
  }, [currentUser, handleLogout]);

  useEffect(() => {
    // Check session storage for logged-in user
    const stored = sessionStorage.getItem('currentUser');
    if (stored) {
      try {
        const user = JSON.parse(stored);
        setCurrentUser(user);
        enforceRoleRouting(user, pathname);
      } catch (e) {
        console.error('Invalid session data');
      }
    }
    setLoading(false);
  }, [pathname]);

  // Set up activity listeners when user is logged in
  useEffect(() => {
    if (!currentUser) return;

    resetTimer(); // Start timer initially

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    const handleActivity = () => resetTimer();

    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [currentUser, resetTimer]);

  const enforceRoleRouting = (user, path) => {
    if (!user) return;
    
    // Caretakers can ONLY access the caretaker dashboard
    if (user.role === 'caretaker' && path !== '/caretaker') {
      router.replace('/caretaker');
    }
    // Primary users don't need restricted access, they can go anywhere.
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
    if (user.role === 'caretaker') {
      router.push('/caretaker');
    } else {
      router.push('/');
    }
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // If a caretaker is trying to access a restricted page, don't render children while redirecting
  if (currentUser.role === 'caretaker' && pathname !== '/caretaker') {
    return <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }} />;
  }

  return <>{children}</>;
}

