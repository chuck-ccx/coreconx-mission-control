"use client";

import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import type { Role, UserProfile } from "@/lib/rbac";

const AUTH_KEY = "coreconx-auth";
const PROFILE_KEY = "coreconx-profile";

interface AuthContextType {
  logout: () => void;
  user: UserProfile | null;
  role: Role;
}

const AuthContext = createContext<AuthContextType>({
  logout: () => {},
  user: null,
  role: "viewer",
});

export const useAuth = () => useContext(AuthContext);

export function AuthGuard({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(AUTH_KEY) === "authenticated";
  });
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(PROFILE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://api.ccxmc.ca";
  const apiToken = process.env.NEXT_PUBLIC_API_TOKEN || "";

  // Fetch user profile from API
  const fetchProfile = async (email: string) => {
    try {
      const res = await fetch(`${apiBase}/api/users/me?email=${encodeURIComponent(email)}`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      if (res.ok) {
        const profile: UserProfile = await res.json();
        setUser(profile);
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
        return profile;
      }
    } catch {
      // Profile fetch failed — user continues with default role
    }
    return null;
  };

  // Re-fetch profile on mount if authenticated but no profile cached
  useEffect(() => {
    if (isAuthenticated && !user) {
      const stored = localStorage.getItem(PROFILE_KEY);
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring cached profile on mount
        try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
      }
    }
  }, [isAuthenticated, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) localStorage.setItem("mc-api-token", data.token);
        localStorage.setItem(AUTH_KEY, "authenticated");
        setIsAuthenticated(true);

        // Try to fetch the user's profile (username is typically the email)
        await fetchProfile(username);
      } else {
        setError("Invalid username or password");
      }
    } catch {
      setError("Cannot reach server — check your connection");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(PROFILE_KEY);
    setIsAuthenticated(false);
    setUser(null);
    setUsername("");
    setPassword("");
  };

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
    <AuthContext.Provider value={{ logout: handleLogout, user, role: user?.role || "admin" }}>
      {children}
    </AuthContext.Provider>
  );
}
