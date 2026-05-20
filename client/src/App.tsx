import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import notificationSound from "@/assets/sound/notification.wav";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthWrapper } from "@/components/auth-wrapper";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { BranchProvider } from "@/contexts/BranchContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Grid3x3, LogOut, User, Key, ChevronDown, Globe, QrCode } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QRMenuOrdersModal } from "@/components/qr-menu-orders-modal";
import { WebOrdersModal } from "@/components/web-orders-modal";
import { NewWebOrderAlert } from "@/components/new-web-order-alert";
import { DraftListModal } from "@/components/draft-list-modal";
import { useWebOrderSocket } from "@/hooks/use-web-order-socket";
import { ReceiptPrintModal } from "@/components/receipt-print-modal";
import { useToast } from "@/hooks/use-toast";
import type { Order, Settings } from "@shared/schema";
import POS from "@/pages/pos";
import Dashboard from "@/pages/dashboard";
import Tables from "@/pages/tables";
import SalesManage from "@/pages/sales";
import ExpenseManage from "@/pages/expenses";
import StaffSalary from "@/pages/staff-salary";
import ItemManage from "@/pages/items";
import Inventory from "@/pages/inventory";
import Reports from "@/pages/reports";
import BankStatement from "@/pages/bank-statement";
import DueManagement from "@/pages/due-management";
import SubscriptionCards from "@/pages/subscription-cards";
import CustomerProfile from "@/pages/customer-profile";
import Settings from "@/pages/settings";
import Hardware from "@/pages/hardware";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import OrderPage from "@/pages/order";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/order" component={OrderPage} />
      <Route path="/menu" component={OrderPage} />
      <Route path="/" component={POS} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/tables" component={Tables} />
      <Route path="/sales" component={SalesManage} />
      <Route path="/orders" component={SalesManage} />
      <Route path="/expenses" component={ExpenseManage} />
      <Route path="/staff-salary" component={StaffSalary} />
      <Route path="/items" component={ItemManage} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/reports" component={Reports} />
      <Route path="/bank-statement" component={BankStatement} />
      <Route path="/due-management" component={DueManagement} />
      <Route path="/subscription-cards" component={SubscriptionCards} />
      <Route path="/customer-profile/:id" component={CustomerProfile} />
      <Route path="/hardware" component={Hardware} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppHeader() {
  const [location, setLocation] = useLocation();
  const isPOSPage = location === "/";
  const [qrOrdersOpen, setQrOrdersOpen] = useState(false);
  const [webOrdersOpen, setWebOrdersOpen] = useState(false);
  const [newWebOrder, setNewWebOrder] = useState<any>(null);
  const [draftListModalOpen, setDraftListModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { toast } = useToast();

  // Notification sound for new web orders
  const playNotificationSound = () => {
    try {
      const audio = new Audio(notificationSound);
      audio.volume = 0.6;
      audio.play().catch((error) => {
        console.error("Failed to play notification sound:", error);
      });
    } catch (error) {
      console.error("Failed to initialize notification sound:", error);
    }
  };

  // WebSocket listener for new web orders (single store; no branch filter)
  useWebOrderSocket((order) => {
    playNotificationSound();
    setNewWebOrder(order);
    toast({
      title: "New Web Order!",
      description: `Order #${order.orderNumber} from ${order.customerName || "a customer"}`,
    });
  });

  const { user } = useAuth();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/auth/logout", {});
    },
    onSuccess: () => {
      // Clear the session query cache
      queryClient.setQueryData(["/api/auth/session"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/session"] });
      setLocation("/login");
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
    },
  });

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: webOrders = [] } = useQuery<Order[]>({
    queryKey: ["/api/orders/web"],
  });

  const draftOrders = orders.filter((order) => order.status === "draft");

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return await apiRequest("DELETE", `/api/orders/${orderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Success",
        description: "Draft order deleted",
      });
    },
  });

  const handleEditDraft = async (orderId: string) => {
    // Dispatch custom event to notify POS page to load this draft
    if (location !== "/") {
      toast({
        title: "Navigate to POS",
        description: "Please go to the POS page to edit draft orders",
      });
      return;
    }
    window.dispatchEvent(new CustomEvent('loadDraft', { detail: { orderId } }));
    setDraftListModalOpen(false);
    toast({
      title: "Draft Loaded",
      description: "Draft order has been loaded to the cart for editing",
    });
  };

  const handlePrintDraft = async (orderId: string) => {
    // Dispatch custom event to notify POS page to show payment modal for this draft
    if (location !== "/") {
      toast({
        title: "Navigate to POS",
        description: "Please go to the POS page to print draft orders",
      });
      return;
    }
    window.dispatchEvent(new CustomEvent('printDraft', { detail: { orderId } }));
    setDraftListModalOpen(false);
  };

  const handleDeleteDraft = (orderId: string) => {
    deleteOrderMutation.mutate(orderId);
  };

  const handlePrintReceipt = () => {
    toast({
      title: "Receipt Printed",
      description: "Receipt has been sent to printer",
    });
  };

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      return await apiRequest("PUT", "/api/auth/change-password", data);
    },
    onSuccess: () => {
      toast({
        title: "Password changed",
        description: "Your password has been updated successfully",
      });
      setChangePasswordOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to change password",
        variant: "destructive",
      });
    },
  });

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Error",
        description: "All fields are required",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  return (
    <>
      <header className="min-h-16 border-b border-border bg-gradient-to-r from-primary via-secondary to-accent px-2 sm:px-4 md:px-6 py-2 md:py-0 flex flex-wrap items-center gap-2 sm:gap-4">
        <SidebarTrigger data-testid="button-sidebar-toggle" className="text-white hover:bg-white/20 shrink-0" />
        <div className="flex-1 min-w-0" />
        {isPOSPage && (
          <div className="flex gap-1 sm:gap-2 flex-wrap shrink-0">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1 sm:gap-2 bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30 shrink-0" 
              data-testid="button-new-order"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">New</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1 sm:gap-2 bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30 shrink-0" 
              onClick={() => setQrOrdersOpen(true)}
              data-testid="button-menu-orders"
            >
              <Grid3x3 className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">QR Menu Orders</span>
              <span className="md:hidden">QR Orders</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1 sm:gap-2 bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30 shrink-0 relative"
              onClick={() => setWebOrdersOpen(true)}
              data-testid="button-web-orders"
            >
              <Globe className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">Web Orders</span>
              <span className="md:hidden">Web</span>
              {webOrders.length > 0 && (
                <Badge variant="secondary" className="ml-1 bg-white text-primary shrink-0" data-testid="badge-web-orders-count">
                  {webOrders.length}
                </Badge>
              )}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1 sm:gap-2 bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30 shrink-0"
              onClick={async () => {
                try {
                  const { default: QRCode } = await import("qrcode");
                  const orderUrl = `${window.location.origin}/menu`;
                  const dataUrl = await QRCode.toDataURL(orderUrl, { width: 256, margin: 2 });
                  const a = document.createElement("a");
                  a.href = dataUrl;
                  a.download = "web-order-qr.png";
                  a.click();
                  toast({ title: "QR downloaded", description: "Customer can scan to open the order page" });
                } catch (e) {
                  toast({ title: "Error", description: "Failed to generate QR code", variant: "destructive" });
                }
              }}
              data-testid="button-download-web-qr"
              title="Download QR for customer web ordering"
            >
              <QrCode className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">QR</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setDraftListModalOpen(true)}
              data-testid="button-draft-list"
              className="gap-1 sm:gap-2 bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30 shrink-0 relative"
            >
              <span className="hidden sm:inline">Draft List</span>
              <span className="sm:hidden">Drafts</span>
              {draftOrders.length > 0 && (
                <Badge variant="secondary" className="ml-1 bg-white text-primary shrink-0" data-testid="badge-draft-count">
                  {draftOrders.length}
                </Badge>
              )}
            </Button>
          </div>
        )}
        {user && (
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 sm:gap-2 text-white hover:bg-white/20 shrink-0"
                  data-testid="button-user-menu"
                >
                  <User className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline truncate max-w-[120px] md:max-w-none">{user.fullName || user.username}</span>
                  <ChevronDown className="w-3 h-3 shrink-0 hidden sm:inline" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setChangePasswordOpen(true)} data-testid="button-change-password">
                  <Key className="mr-2 h-4 w-4" />
                  Change Password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => logoutMutation.mutate()} 
                  disabled={logoutMutation.isPending}
                  data-testid="button-logout"
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        <div className="shrink-0">
          <ThemeToggle />
        </div>
      </header>
      <QRMenuOrdersModal open={qrOrdersOpen} onOpenChange={setQrOrdersOpen} />
      <WebOrdersModal open={webOrdersOpen} onOpenChange={setWebOrdersOpen} />
      <NewWebOrderAlert order={newWebOrder} open={!!newWebOrder} onClose={() => setNewWebOrder(null)} />
      <DraftListModal
        open={draftListModalOpen}
        onClose={() => setDraftListModalOpen(false)}
        draftOrders={draftOrders}
        onEditDraft={handleEditDraft}
        onPrintDraft={handlePrintDraft}
        onDeleteDraft={handleDeleteDraft}
      />
      {receiptData && (
        <ReceiptPrintModal
          open={receiptModalOpen}
          onClose={() => setReceiptModalOpen(false)}
          order={receiptData}
          onPrint={handlePrintReceipt}
        />
      )}
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                data-testid="input-current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                data-testid="input-new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                data-testid="input-confirm-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setChangePasswordOpen(false);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={changePasswordMutation.isPending}
              data-testid="button-submit-change-password"
            >
              {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DocumentMetadata() {
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    if (settings) {
      // Update document title
      const title = settings.websiteTitle || settings.businessName || "BondPos - POS System";
      document.title = title;

      // Update meta description
      let metaDescription = document.querySelector('meta[name="description"]');
      if (!metaDescription) {
        metaDescription = document.createElement('meta');
        metaDescription.setAttribute('name', 'description');
        document.head.appendChild(metaDescription);
      }
      if (settings.websiteDescription) {
        metaDescription.setAttribute('content', settings.websiteDescription);
      }

      // Update favicon
      if (settings.favicon) {
        let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        if (!favicon) {
          favicon = document.createElement('link');
          favicon.rel = 'icon';
          document.head.appendChild(favicon);
        }
        favicon.href = settings.favicon;
      }
    }
  }, [settings]);

  return null;
}

function AuthenticatedApp() {
  const [location] = useLocation();
  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  // Login page: no sidebar/header
  if (location === "/login") {
    return <Router />;
  }

  // Customer portal (public menu/order): full-screen, no sidebar or branch header
  const isCustomerPortal = location === "/order" || location.startsWith("/order?") || location === "/menu" || location.startsWith("/menu?");
  if (isCustomerPortal) {
    return (
      <>
        <DocumentMetadata />
        <Router />
      </>
    );
  }

  // Staff POS: sidebar + header
  return (
    <SidebarProvider defaultOpen={true} style={style as React.CSSProperties}>
      <DocumentMetadata />
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1">
          <AppHeader />
          <main className="flex-1 overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AuthProvider>
            <BranchProvider>
              <AuthWrapper>
                <AuthenticatedApp />
              </AuthWrapper>
            </BranchProvider>
          </AuthProvider>
        </ThemeProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
