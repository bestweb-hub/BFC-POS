import { useLocation } from "wouter";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, isLoading } = useAuth();

  // Public routes that do not require authentication (customer order/menu)
  const isPublicOrderOrMenu =
    location === "/order" || location.startsWith("/order?") ||
    location === "/menu" || location.startsWith("/menu?");

  // Redirect to login only if not authenticated AND not on login AND not on public customer page
  useEffect(() => {
    if (!isLoading && !user && location !== "/login" && !isPublicOrderOrMenu) {
      setLocation("/login");
    }
  }, [isLoading, user, location, setLocation, isPublicOrderOrMenu]);

  // Allow login and public order/menu page without authentication (authless)
  if (location === "/login" || isPublicOrderOrMenu) {
    return <>{children}</>;
  }

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Don't render anything if not authenticated (redirect will happen)
  if (!user) {
    return null;
  }

  // Render children if authenticated
  return <>{children}</>;
}
