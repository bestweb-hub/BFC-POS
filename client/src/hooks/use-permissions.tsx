import { useQuery } from "@tanstack/react-query";

interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
  permissions?: string[];
}

/**
 * Hook to check user permissions
 * Returns the user object and a function to check if user has a specific permission
 */
export function usePermissions() {
  const { data: user } = useQuery<AuthUser>({
    queryKey: ["/api/auth/session"],
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  /**
   * Check if user has a specific permission
   * @param permission - The permission to check (e.g., "sales.delete")
   * @returns true if user has the permission, false otherwise
   */
  const hasPermission = (permission: string | undefined): boolean => {
    // If no permission required, allow access
    if (!permission) {
      return true;
    }

    // If user has no permissions, deny access
    if (!user?.permissions || user.permissions.length === 0) {
      return false;
    }

    // If user has "*" permission, they have all permissions
    if (user.permissions.includes("*")) {
      return true;
    }

    // Check if user has the specific permission
    return user.permissions.includes(permission);
  };

  return {
    user,
    hasPermission,
    permissions: user?.permissions || [],
  };
}

