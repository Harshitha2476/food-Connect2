import { createContext, useContext, useState, useEffect } from 'react';
import { DEMO_USERS } from '../data/mockData';

const AuthContext = createContext(null);

const STORAGE_KEY = 'cfc_auth_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setUser(JSON.parse(saved));
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  const login = (email, password) => {
    const found = DEMO_USERS.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!found) return { ok: false, error: 'Invalid email or password' };
    const session = {
      id: found.id,
      name: found.name,
      email: found.email,
      role: found.role,
      organization: found.organization,
      phone: found.phone,
    };
    setUser(session);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return { ok: true, user: session };
  };

  const loginAsRole = (role) => {
    const found = DEMO_USERS.find((u) => u.role === role);
    if (!found) return { ok: false };
    const session = {
      id: found.id,
      name: found.name,
      email: found.email,
      role: found.role,
      organization: found.organization,
      phone: found.phone,
    };
    setUser(session);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return { ok: true, user: session };
  };

  const register = (form) => {
    // Demo-only: accept registration and log in as that role
    const session = {
      id: `u_${Date.now()}`,
      name: form.name,
      email: form.email,
      role: form.role,
      organization: form.organization,
      phone: form.phone,
    };
    setUser(session);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return { ok: true, user: session };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginAsRole, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
