import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('crms_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('crms_token');
    if (!token) {
      setInitializing(false);
      return;
    }
    authService
      .me()
      .then((res) => {
        setUser(res.data);
        localStorage.setItem('crms_user', JSON.stringify(res.data));
      })
      .catch(() => {
        localStorage.removeItem('crms_token');
        localStorage.removeItem('crms_user');
        setUser(null);
      })
      .finally(() => setInitializing(false));
  }, []);

  const login = async (email, password) => {
    const res = await authService.login(email, password);
    localStorage.setItem('crms_token', res.data.token);
    localStorage.setItem('crms_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('crms_token');
    localStorage.removeItem('crms_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        initializing,
        isAuthenticated: !!user,
        isSuperAdmin: user?.role === 'super_admin',
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
