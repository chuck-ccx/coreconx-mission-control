"use client";

import { useState, useEffect, type ReactNode } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";

const AUTH_KEY = "coreconx-auth";

export function AuthGuard({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored === "authenticated") {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api.ccxmc.ca';
      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) localStorage.setItem('mc-api-token', data.token);
        localStorage.setItem(AUTH_KEY, "authenticated");
        setIsAuthenticated(true);
      } else {
        setError("Invalid username or password");
      }
    } catch {
      setError("Cannot reach server — check your connection");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
    setUsername("");
    setPassword("");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 rounded-lg bg-coreconx flex items-center justify-center animate-pulse">
          <span className="text-white font-bold text-lg">C</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm">
          <div className="bg-card border border-border rounded-2xl p-8">
            {/* Logo */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-xl bg-coreconx flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-2xl">C</span>
              </div>
              <h1 className="text-xl font-bold text-foreground">CoreConX</h1>
              <p className="text-muted text-sm mt-1">Mission Control</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs text-muted font-medium block mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-coreconx-light text-sm"
                  autoFocus
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="text-xs text-muted font-medium block mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-coreconx-light text-sm pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-danger text-xs text-center">{error}</p>
              )}

              <button
                type="submit"
                className="w-full px-4 py-3 bg-coreconx text-white rounded-lg font-medium hover:bg-coreconx-light transition-colors text-sm"
              >
                Sign In
              </button>
            </form>

            <div className="flex items-center justify-center gap-2 mt-6 text-xs text-muted">
              <Lock size={12} />
              <span>Secure access only</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ logout: handleLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

import { createContext, useContext } from "react";

interface AuthContextType {
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({ logout: () => {} });
export const useAuth = () => useContext(AuthContext);
