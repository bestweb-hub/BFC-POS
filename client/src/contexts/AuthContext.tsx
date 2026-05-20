import { createContext, useContext, ReactNode } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
  permissions?: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isPublicCustomerRoute(path: string): boolean {
  return path === "/menu" || path.startsWith("/menu?") || path === "/order" || path.startsWith("/order?");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const skipSession = isPublicCustomerRoute(path);

  // Skip session fetch on public customer portal to avoid 401 in console; auth not required there
  const { data: user, isLoading } = useQuery<AuthUser>({
    queryKey: ["/api/auth/session"],
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 60 * 1000,
    enabled: !skipSession,
  });

  const isAuthenticated = !!user;
  const isLoadingResolved = skipSession ? false : isLoading;

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading: isLoadingResolved, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

