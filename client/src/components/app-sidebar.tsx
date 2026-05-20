import {
  LayoutDashboard,
  ShoppingCart,
  Table2,
  TrendingUp,
  Wallet,
  Package,
  UserCog,
  BarChart3,
  Settings,
  ChevronRight,
  Store,
  Receipt,
  LogOut,
  PackageSearch,
  Landmark,
  Building2,
  CreditCard,
  Printer,
  Users,
  IdCard,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import type { Settings as SettingsType } from "@shared/schema";
import { useState, useEffect } from "react";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  permission?: string; // Required permission name (e.g., "sales.view")
}

const mainMenuItems: MenuItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    // Dashboard is accessible to all authenticated users
  },
  {
    title: "POS",
    url: "/",
    icon: ShoppingCart,
    permission: "sales.create", // POS requires ability to create sales
  },
  {
    title: "Tables",
    url: "/tables",
    icon: Table2,
    permission: "sales.view", // Tables are part of sales
  },
];

const operationsMenuItems: MenuItem[] = [
  {
    title: "Sales",
    url: "/sales",
    icon: TrendingUp,
    permission: "sales.view",
  },
  {
    title: "Expenses",
    url: "/expenses",
    icon: Wallet,
    permission: "expenses.view",
  },
  {
    title: "Staff Salary",
    url: "/staff-salary",
    icon: Users,
    permission: "hrm.view",
  },
  {
    title: "Items",
    url: "/items",
    icon: Package,
    permission: "items.view",
  },
  {
    title: "Inventory",
    url: "/inventory",
    icon: PackageSearch,
    permission: "inventory.view",
  },
];

const managementMenuItems: MenuItem[] = [
  {
    title: "Reports",
    url: "/reports",
    icon: BarChart3,
    permission: "reports.view",
  },
  {
    title: "Bank Statement",
    url: "/bank-statement",
    icon: Landmark,
    permission: "bank.view",
  },
  {
    title: "Due Management",
    url: "/due-management",
    icon: CreditCard,
    permission: "due.view",
  },
  {
    title: "Subscription cards",
    url: "/subscription-cards",
    icon: IdCard,
    permission: "subscription_cards.manage",
  },
  {
    title: "Hardware",
    url: "/hardware",
    icon: Printer,
    permission: "settings.view",
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    permission: "settings.view",
  },
];

// Helper function to check if user has permission
function hasPermission(userPermissions: string[] | undefined, requiredPermission: string | undefined): boolean {
  // If no permission required, allow access
  if (!requiredPermission) {
    return true;
  }
  
  // If user has no permissions, deny access
  if (!userPermissions || userPermissions.length === 0) {
    return false;
  }
  
  // If user has "*" permission, they have all permissions
  if (userPermissions.includes("*")) {
    return true;
  }
  
  // Check if user has the specific permission
  return userPermissions.includes(requiredPermission);
}

// Helper function to filter menu items based on permissions
function filterMenuItems(items: MenuItem[], userPermissions: string[] | undefined): MenuItem[] {
  return items.filter(item => hasPermission(userPermissions, item.permission));
}

export function AppSidebar() {
  const [location] = useLocation();
  
  // Get current user from auth context
  const { user } = useAuth();

  // Get settings for app name and tagline
  const { data: settings } = useQuery<SettingsType>({
    queryKey: ["/api/settings"],
  });

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { 
        method: "POST",
        credentials: "include",
      });
      // Clear the session query cache
      queryClient.setQueryData(["/api/auth/session"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
      window.location.href = "/login";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Filter menu items based on permissions
  const filteredMainMenuItems = filterMenuItems(mainMenuItems, user?.permissions);
  const filteredOperationsMenuItems = filterMenuItems(operationsMenuItems, user?.permissions);
  const filteredManagementMenuItems = filterMenuItems(managementMenuItems, user?.permissions);

  // Get app name and tagline from settings with fallbacks
  const appName = settings?.appName || "BondPos";
  const appTagline = settings?.appTagline || "Restaurant Management";
  const [logoError, setLogoError] = useState(false);

  // Reset logo error when settings change
  useEffect(() => {
    setLogoError(false);
  }, [settings?.businessLogo]);

  return (
    <Sidebar>
      <SidebarHeader className="border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground min-h-[3.5rem] sm:min-h-0">
              <Link href="/">
                {settings?.businessLogo && !logoError ? (
                  <img 
                    src={settings.businessLogo} 
                    alt={appName} 
                    className="flex aspect-square size-8 sm:size-9 object-contain shrink-0"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <div className="flex aspect-square size-8 sm:size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shrink-0">
                    <Store className="size-4 sm:size-5" />
                  </div>
                )}
                <div className="grid flex-1 text-left text-xs sm:text-sm leading-tight min-w-0">
                  <span className="truncate font-bold text-sm sm:text-base">{appName}</span>
                  <span className="truncate text-[10px] sm:text-xs opacity-80">{appTagline}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] sm:text-xs uppercase tracking-wider opacity-70 px-2">
            Main Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMainMenuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive} 
                      tooltip={item.title}
                      className="group text-xs sm:text-sm"
                    >
                      <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                        <item.icon className="size-4 sm:size-5 group-data-[active=true]:text-sidebar-primary-foreground shrink-0" />
                        <span className="group-data-[active=true]:font-semibold truncate">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] sm:text-xs uppercase tracking-wider opacity-70 px-2">
            Operations
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredOperationsMenuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive} 
                      tooltip={item.title}
                      className="group text-xs sm:text-sm"
                    >
                      <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                        <item.icon className="size-4 sm:size-5 group-data-[active=true]:text-sidebar-primary-foreground shrink-0" />
                        <span className="group-data-[active=true]:font-semibold truncate">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] sm:text-xs uppercase tracking-wider opacity-70 px-2">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredManagementMenuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive} 
                      tooltip={item.title}
                      className="group text-xs sm:text-sm"
                    >
                      <Link href={item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                        <item.icon className="size-4 sm:size-5 group-data-[active=true]:text-sidebar-primary-foreground shrink-0" />
                        <span className="group-data-[active=true]:font-semibold truncate">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground min-h-[3.5rem] sm:min-h-0" data-testid="sidebar-profile">
                  <div className="flex aspect-square size-8 sm:size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold shadow-sm shrink-0">
                    {user?.fullName 
                      ? user.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
                      : user?.username 
                        ? user.username.slice(0, 2).toUpperCase()
                        : "U"}
                  </div>
                  <div className="grid flex-1 text-left text-xs sm:text-sm leading-tight min-w-0">
                    <span className="truncate font-semibold text-xs sm:text-sm">{user?.fullName || "User"}</span>
                    <span className="truncate text-[10px] sm:text-xs opacity-80">{user?.email || user?.username || ""}</span>
                  </div>
                  <ChevronRight className="ml-auto size-3 sm:size-4 opacity-60 shrink-0" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem onClick={handleLogout} data-testid="button-logout">
                  <LogOut className="mr-2 size-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
