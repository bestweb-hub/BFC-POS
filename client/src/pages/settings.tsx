import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { AddEditUserDialog } from "@/components/add-edit-user-dialog";
import type { Settings, User, Role, Permission } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Save, 
  Building2, 
  CreditCard, 
  Receipt, 
  Users, 
  Printer, 
  DollarSign, 
  Database, 
  Bell,
  Palette,
  Percent,
  Trash2,
  Settings as SettingsIcon,
  UserCog,
  Plus,
  Edit,
  Eye,
  Globe,
  Image,
  Search,
  Calendar as CalendarIcon,
  Filter,
  RefreshCw
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import type { AuditLog } from "@shared/schema";
import { buildThemeFromSettings, applyThemeToDocument, COLOR_THEMES } from "@/contexts/ThemeContext";

// Stable empty array so disabled role-permissions query doesn't cause new reference every render (infinite loop)
const EMPTY_PERMISSIONS: Permission[] = [];

export default function SettingsPage() {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: roles = [], isLoading: rolesLoading, error: rolesError } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
    retry: 1,
  });

  const { data: permissions = [], isLoading: permissionsLoading, error: permissionsError } = useQuery<Permission[]>({
    queryKey: ["/api/permissions"],
    retry: 1,
  });

  const [formData, setFormData] = useState<Partial<Settings>>({});
  const [settingsTab, setSettingsTab] = useState("metadata");
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  
  // Roles management state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [deleteRoleDialogOpen, setDeleteRoleDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<string | null>(null);
  
  // Permissions management state
  const [selectedRoleForPermissions, setSelectedRoleForPermissions] = useState<string>("");
  const [rolePermissions, setRolePermissions] = useState<Set<string>>(new Set());
  
  // Activity Logs state
  const [activityLogsFilters, setActivityLogsFilters] = useState({
    userId: "all",
    entityType: "all",
    action: "all",
    startDate: undefined as Date | undefined,
    endDate: undefined as Date | undefined,
  });
  const activityLogsObserverTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  // Live theme preview: when on Theme tab apply formData; when on other tab apply saved settings
  useEffect(() => {
    if (settingsTab === "theme") {
      applyThemeToDocument(buildThemeFromSettings(formData));
    } else if (settings) {
      applyThemeToDocument(buildThemeFromSettings(settings));
    }
  }, [settingsTab, formData, settings]);

  // Load role permissions when role is selected (use stable default to avoid infinite effect loop when query is disabled)
  const { data: rolePermissionsData } = useQuery<Permission[]>({
    queryKey: [`/api/roles/${selectedRoleForPermissions}/permissions`],
    enabled: !!selectedRoleForPermissions,
    retry: 1,
  });
  const selectedRolePermissions = selectedRoleForPermissions ? (rolePermissionsData ?? EMPTY_PERMISSIONS) : EMPTY_PERMISSIONS;

  useEffect(() => {
    if (selectedRolePermissions.length > 0) {
      setRolePermissions(new Set(selectedRolePermissions.filter(p => p && p.id).map(p => p.id)));
    } else {
      setRolePermissions(new Set());
    }
  }, [selectedRolePermissions]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Settings>) => {
      return apiRequest("PUT", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings saved",
        description: "Your settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User deleted",
        description: "User has been removed successfully",
      });
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      return apiRequest("DELETE", `/api/roles/${roleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      toast({
        title: "Role deleted",
        description: "Role has been removed successfully",
      });
      setDeleteRoleDialogOpen(false);
      setRoleToDelete(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete role",
        variant: "destructive",
      });
    },
  });

  const setRolePermissionsMutation = useMutation({
    mutationFn: async ({ roleId, permissionIds }: { roleId: string; permissionIds: string[] }) => {
      return apiRequest("POST", `/api/roles/${roleId}/permissions`, { permissionIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      queryClient.invalidateQueries({ queryKey: [`/api/roles/${selectedRoleForPermissions}/permissions`] });
      toast({
        title: "Success",
        description: "Permissions updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update permissions",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const updateField = (field: keyof Settings, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddUser = () => {
    setSelectedUser(null);
    setUserDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setUserDialogOpen(true);
  };

  const handleDeleteUser = (userId: string) => {
    setUserToDelete(userId);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteUser = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete);
    }
  };

  const getRoleDescription = (role: string) => {
    const descriptions: Record<string, string> = {
      admin: "Full system access",
      manager: "Manage staff and operations",
      cashier: "POS and sales access",
      staff: "Limited access",
    };
    return descriptions[role] || "Standard access";
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <SettingsIcon className="w-6 h-6 md:w-8 md:h-8" />
              Application Settings
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Manage system configuration and preferences</p>
          </div>
        </div>

        <Tabs value={settingsTab} onValueChange={setSettingsTab} className="space-y-4 md:space-y-6">
          <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-8 gap-2 h-auto p-1">
            <TabsTrigger value="metadata" className="flex items-center gap-2" data-testid="tab-metadata">
              <Globe className="w-4 h-4" />
              <span>Metadata</span>
            </TabsTrigger>
            <TabsTrigger value="currency" className="flex items-center gap-2" data-testid="tab-currency">
              <DollarSign className="w-4 h-4" />
              <span>$ Currency</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2" data-testid="tab-users">
              <Users className="w-4 h-4" />
              <span>Users</span>
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-2" data-testid="tab-permissions">
              <UserCog className="w-4 h-4" />
              <span>Permissions</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="flex items-center gap-2" data-testid="tab-financial">
              <CreditCard className="w-4 h-4" />
              <span>Financial</span>
            </TabsTrigger>
            <TabsTrigger value="theme" className="flex items-center gap-2" data-testid="tab-theme">
              <Palette className="w-4 h-4" />
              <span>Theme</span>
            </TabsTrigger>
            <TabsTrigger value="receipt" className="flex items-center gap-2" data-testid="tab-receipt">
              <Receipt className="w-4 h-4" />
              <span>Receipt</span>
            </TabsTrigger>
            <TabsTrigger value="activity-logs" className="flex items-center gap-2" data-testid="tab-activity-logs">
              <Bell className="w-4 h-4" />
              <span>Activity Logs</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="metadata" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Application Metadata
                </CardTitle>
                <CardDescription>Configure website title, description, logo, and favicon</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="app-name">Application Name</Label>
                    <Input 
                      id="app-name" 
                      value={formData.appName || ""} 
                      onChange={(e) => updateField("appName", e.target.value)}
                      placeholder="BondPos"
                      data-testid="input-app-name" 
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This will appear in the sidebar header (e.g., "BondPos")
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="app-tagline">Application Tagline</Label>
                    <Input 
                      id="app-tagline" 
                      value={formData.appTagline || ""} 
                      onChange={(e) => updateField("appTagline", e.target.value)}
                      placeholder="Restaurant Management"
                      data-testid="input-app-tagline" 
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This will appear below the app name in the sidebar (e.g., "Restaurant Management")
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <Label htmlFor="website-title">Website Title</Label>
                    <Input 
                      id="website-title" 
                      value={formData.websiteTitle || formData.businessName || ""} 
                      onChange={(e) => updateField("websiteTitle", e.target.value)}
                      placeholder={formData.businessName || "Enter website title"}
                      data-testid="input-website-title" 
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This will appear in the browser tab title
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="website-description">Website Description</Label>
                    <Textarea 
                      id="website-description" 
                      value={formData.websiteDescription || ""} 
                      onChange={(e) => updateField("websiteDescription", e.target.value)}
                      rows={3}
                      placeholder="Enter website description for SEO"
                      data-testid="input-website-description" 
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Meta description for search engines
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <Label htmlFor="business-logo">Business Logo</Label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input 
                          id="business-logo-file" 
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const formData = new FormData();
                              formData.append("file", file);
                              try {
                                const response = await fetch("/api/upload", {
                                  method: "POST",
                                  body: formData,
                                });
                                if (response.ok) {
                                  const data = await response.json();
                                  updateField("businessLogo", data.url);
                                  toast({
                                    title: "Success",
                                    description: "Logo uploaded successfully",
                                  });
                                } else {
                                  throw new Error("Upload failed");
                                }
                              } catch (error) {
                                toast({
                                  title: "Error",
                                  description: "Failed to upload logo",
                                  variant: "destructive",
                                });
                              }
                            }
                          }}
                          className="cursor-pointer"
                          data-testid="input-business-logo-file" 
                        />
                        <span className="text-xs text-muted-foreground self-center">or</span>
                        <Input 
                          id="business-logo-url" 
                          type="url"
                          value={formData.businessLogo || ""} 
                          onChange={(e) => updateField("businessLogo", e.target.value)}
                          placeholder="https://example.com/logo.png"
                          className="flex-1"
                          data-testid="input-business-logo-url" 
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Upload an image file or enter a URL (PNG, JPG, or SVG, max 5MB)
                      </p>
                      {formData.businessLogo && (
                        <div className="mt-2">
                          <img 
                            src={formData.businessLogo} 
                            alt="Business Logo Preview" 
                            className="max-w-[200px] max-h-[100px] object-contain border rounded p-2"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="favicon">Favicon</Label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input 
                          id="favicon-file" 
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const formData = new FormData();
                              formData.append("file", file);
                              try {
                                const response = await fetch("/api/upload", {
                                  method: "POST",
                                  body: formData,
                                });
                                if (response.ok) {
                                  const data = await response.json();
                                  updateField("favicon", data.url);
                                  toast({
                                    title: "Success",
                                    description: "Favicon uploaded successfully",
                                  });
                                } else {
                                  throw new Error("Upload failed");
                                }
                              } catch (error) {
                                toast({
                                  title: "Error",
                                  description: "Failed to upload favicon",
                                  variant: "destructive",
                                });
                              }
                            }
                          }}
                          className="cursor-pointer"
                          data-testid="input-favicon-file" 
                        />
                        <span className="text-xs text-muted-foreground self-center">or</span>
                        <Input 
                          id="favicon-url" 
                          type="url"
                          value={formData.favicon || ""} 
                          onChange={(e) => updateField("favicon", e.target.value)}
                          placeholder="https://example.com/favicon.ico"
                          className="flex-1"
                          data-testid="input-favicon-url" 
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Upload an image file or enter a URL (typically .ico, .png, or .svg, 32x32 or 16x16 pixels, max 5MB)
                      </p>
                      {formData.favicon && (
                        <div className="mt-2 flex items-center gap-2">
                          <img 
                            src={formData.favicon} 
                            alt="Favicon Preview" 
                            className="w-8 h-8 object-contain border rounded p-1"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                          <span className="text-xs text-muted-foreground">Favicon preview</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-end">
                    <Button 
                      onClick={handleSave} 
                      disabled={updateMutation.isPending}
                      data-testid="button-save-metadata"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {updateMutation.isPending ? "Saving..." : "Save Metadata"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Configure business information and preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="business-name">Business Name</Label>
                    <Input 
                      id="business-name" 
                      value={formData.businessName || ""} 
                      onChange={(e) => updateField("businessName", e.target.value)}
                      data-testid="input-business-name" 
                    />
                  </div>

                  <div>
                    <Label htmlFor="business-logo">Business Logo</Label>
                    <Input 
                      id="business-logo" 
                      type="file" 
                      accept="image/*"
                      data-testid="input-business-logo" 
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload your business logo (PNG, JPG, or SVG)
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="address">Business Address</Label>
                    <Textarea 
                      id="address" 
                      value={formData.address || ""} 
                      onChange={(e) => updateField("address", e.target.value)}
                      rows={3} 
                      data-testid="input-address" 
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Contact Phone</Label>
                      <Input 
                        id="phone" 
                        value={formData.phone || ""} 
                        onChange={(e) => updateField("phone", e.target.value)}
                        data-testid="input-phone" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Contact Email</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        value={formData.email || ""} 
                        onChange={(e) => updateField("email", e.target.value)}
                        data-testid="input-email" 
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="date-format">Date Format</Label>
                      <Select 
                        value={formData.dateFormat || "dd-mm-yyyy"} 
                        onValueChange={(value) => updateField("dateFormat", value)}
                      >
                        <SelectTrigger id="date-format" data-testid="select-date-format">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dd-mm-yyyy">DD/MM/YYYY</SelectItem>
                          <SelectItem value="mm-dd-yyyy">MM/DD/YYYY</SelectItem>
                          <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="time-format">Time Format</Label>
                      <Select 
                        value={formData.timeFormat || "12h"} 
                        onValueChange={(value) => updateField("timeFormat", value)}
                      >
                        <SelectTrigger id="time-format" data-testid="select-time-format">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                          <SelectItem value="24h">24-hour</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="terminal-id">Terminal/Register ID</Label>
                    <Input 
                      id="terminal-id" 
                      value={formData.terminalId || ""} 
                      onChange={(e) => updateField("terminalId", e.target.value)}
                      data-testid="input-terminal-id" 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment Methods Configuration</CardTitle>
                <CardDescription>Enable or disable payment options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Cash Payment</Label>
                      <p className="text-sm text-muted-foreground">Accept cash payments</p>
                    </div>
                    <Switch 
                      checked={formData.paymentCash === "true"}
                      onCheckedChange={(checked) => updateField("paymentCash", checked ? "true" : "false")}
                      data-testid="switch-payment-cash"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Card Payment</Label>
                      <p className="text-sm text-muted-foreground">Accept credit/debit card payments</p>
                    </div>
                    <Switch 
                      checked={formData.paymentCard === "true"}
                      onCheckedChange={(checked) => updateField("paymentCard", checked ? "true" : "false")}
                      data-testid="switch-payment-card"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>ABA Bank Transfer</Label>
                      <p className="text-sm text-muted-foreground">Accept ABA bank transfers</p>
                    </div>
                    <Switch 
                      checked={formData.paymentAba === "true"}
                      onCheckedChange={(checked) => updateField("paymentAba", checked ? "true" : "false")}
                      data-testid="switch-payment-aba"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Acleda Bank Transfer</Label>
                      <p className="text-sm text-muted-foreground">Accept Acleda bank transfers</p>
                    </div>
                    <Switch 
                      checked={formData.paymentAcleda === "true"}
                      onCheckedChange={(checked) => updateField("paymentAcleda", checked ? "true" : "false")}
                      data-testid="switch-payment-acleda"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Credit/Due Payment</Label>
                      <p className="text-sm text-muted-foreground">Allow customers to pay later</p>
                    </div>
                    <Switch 
                      checked={formData.paymentCredit === "true"}
                      onCheckedChange={(checked) => updateField("paymentCredit", checked ? "true" : "false")}
                      data-testid="switch-payment-credit"
                    />
                  </div>

                  <Separator />

                  <div>
                    <Label htmlFor="default-payment">Default Payment Method</Label>
                    <Select 
                      value={formData.defaultPaymentMethod || "cash"} 
                      onValueChange={(value) => updateField("defaultPaymentMethod", value)}
                    >
                      <SelectTrigger id="default-payment" data-testid="select-default-payment">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="aba">ABA</SelectItem>
                        <SelectItem value="acleda">Acleda</SelectItem>
                        <SelectItem value="due">Due</SelectItem>
                        <SelectItem value="cash_aba">Cash And ABA</SelectItem>
                        <SelectItem value="cash_acleda">Cash And Acleda</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="min-amount">Minimum Transaction Amount</Label>
                      <Input 
                        id="min-amount" 
                        type="number" 
                        value={formData.minTransactionAmount || "0"} 
                        onChange={(e) => updateField("minTransactionAmount", e.target.value)}
                        data-testid="input-min-amount" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="max-amount">Maximum Transaction Amount</Label>
                      <Input 
                        id="max-amount" 
                        type="number" 
                        value={formData.maxTransactionAmount || ""} 
                        onChange={(e) => updateField("maxTransactionAmount", e.target.value)}
                        data-testid="input-max-amount" 
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subscription loyalty cards</CardTitle>
                <CardDescription>
                  Barcode cards for repeat customers. Eligibility uses completed POS orders only.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable program</Label>
                    <p className="text-sm text-muted-foreground">Allow scanning cards on the POS and issuing cards</p>
                  </div>
                  <Switch
                    checked={formData.subscriptionProgramEnabled === "true"}
                    onCheckedChange={(checked) =>
                      updateField("subscriptionProgramEnabled", checked ? "true" : "false")
                    }
                  />
                </div>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="sub-min-spend">Minimum lifetime POS spend ($)</Label>
                    <Input
                      id="sub-min-spend"
                      type="number"
                      min={0}
                      step="0.01"
                      value={formData.subscriptionMinSpend ?? "50"}
                      onChange={(e) => updateField("subscriptionMinSpend", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sub-discount-type">Discount type</Label>
                    <Select
                      value={formData.subscriptionDiscountType || "percentage"}
                      onValueChange={(v) => updateField("subscriptionDiscountType", v)}
                    >
                      <SelectTrigger id="sub-discount-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage off cart subtotal</SelectItem>
                        <SelectItem value="amount">Fixed amount off cart subtotal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="sub-discount-value">
                    {formData.subscriptionDiscountType === "amount" ? "Discount amount ($)" : "Discount percent (%)"}
                  </Label>
                  <Input
                    id="sub-discount-value"
                    type="number"
                    min={0}
                    step="0.01"
                    value={formData.subscriptionDiscountValue ?? "5"}
                    onChange={(e) => updateField("subscriptionDiscountValue", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tax" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tax & Discount Settings</CardTitle>
                <CardDescription>Configure tax rates and discount options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="vat-rate">VAT/Sales Tax Rate (%)</Label>
                    <Input 
                      id="vat-rate" 
                      type="number" 
                      value={formData.vatRate || "0"} 
                      onChange={(e) => updateField("vatRate", e.target.value)}
                      data-testid="input-vat-rate" 
                    />
                  </div>

                  <div>
                    <Label htmlFor="service-tax">Service Tax Rate (%)</Label>
                    <Input 
                      id="service-tax" 
                      type="number" 
                      value={formData.serviceTaxRate || "0"} 
                      onChange={(e) => updateField("serviceTaxRate", e.target.value)}
                      data-testid="input-service-tax" 
                    />
                  </div>

                  <Separator />

                  <div>
                    <Label htmlFor="default-discount">Default Discount (%)</Label>
                    <Input 
                      id="default-discount" 
                      type="number" 
                      value={formData.defaultDiscount || "0"} 
                      onChange={(e) => updateField("defaultDiscount", e.target.value)}
                      data-testid="input-default-discount" 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Percentage Discount</Label>
                      <p className="text-sm text-muted-foreground">Allow percentage-based discounts</p>
                    </div>
                    <Switch 
                      checked={formData.enablePercentageDiscount === "true"}
                      onCheckedChange={(checked) => updateField("enablePercentageDiscount", checked ? "true" : "false")}
                      data-testid="switch-percentage-discount" 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Fixed Amount Discount</Label>
                      <p className="text-sm text-muted-foreground">Allow fixed dollar discounts</p>
                    </div>
                    <Switch 
                      checked={formData.enableFixedDiscount === "true"}
                      onCheckedChange={(checked) => updateField("enableFixedDiscount", checked ? "true" : "false")}
                      data-testid="switch-fixed-discount" 
                    />
                  </div>

                  <div>
                    <Label htmlFor="max-discount">Maximum Discount (%)</Label>
                    <Input 
                      id="max-discount" 
                      type="number" 
                      value={formData.maxDiscount || "50"} 
                      onChange={(e) => updateField("maxDiscount", e.target.value)}
                      data-testid="input-max-discount" 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receipt" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Company Details for Receipts</CardTitle>
                <CardDescription>Configure company information to display on receipts. These fields are required for printing receipts.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="business-name-receipt">Company Name <span className="text-red-500">*</span></Label>
                    <Input 
                      id="business-name-receipt" 
                      value={formData.businessName || ""} 
                      onChange={(e) => updateField("businessName", e.target.value)}
                      placeholder="Enter company name"
                      data-testid="input-business-name-receipt" 
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This will appear at the top of all receipts
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="company-address-receipt">Company Address <span className="text-red-500">*</span></Label>
                    <Textarea 
                      id="company-address-receipt" 
                      value={formData.address || ""} 
                      onChange={(e) => updateField("address", e.target.value)}
                      rows={3}
                      placeholder="Enter company address"
                      data-testid="input-company-address-receipt" 
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Company address to display on receipts
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="receipt-logo-upload">Company Logo</Label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input 
                          id="receipt-logo-upload" 
                          type="file" 
                          accept="image/*"
                          data-testid="input-receipt-logo-upload" 
                          className="cursor-pointer"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const formData = new FormData();
                              formData.append("file", file);
                              try {
                                const response = await fetch("/api/upload", {
                                  method: "POST",
                                  body: formData,
                                });
                                if (response.ok) {
                                  const data = await response.json();
                                  updateField("receiptLogo", data.url);
                                  toast({
                                    title: "Success",
                                    description: "Logo uploaded successfully",
                                  });
                                } else {
                                  throw new Error("Upload failed");
                                }
                              } catch (error) {
                                toast({
                                  title: "Error",
                                  description: "Failed to upload logo",
                                  variant: "destructive",
                                });
                              }
                            }
                            e.target.value = "";
                          }}
                        />
                      </div>
                      {formData.receiptLogo && (
                        <div className="mt-2">
                          <img 
                            src={formData.receiptLogo} 
                            alt="Receipt Logo" 
                            className="max-w-[200px] max-h-[100px] object-contain border rounded"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => updateField("receiptLogo", "")}
                            className="mt-2"
                          >
                            Remove Logo
                          </Button>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Upload your company logo for receipts (PNG, JPG, or SVG). Recommended size: 200x100px
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label htmlFor="invoice-prefix">Invoice Number Prefix</Label>
                    <Input 
                      id="invoice-prefix" 
                      value={formData.invoicePrefix || "INV-"} 
                      onChange={(e) => updateField("invoicePrefix", e.target.value)}
                      data-testid="input-invoice-prefix" 
                    />
                  </div>

                  <div>
                    <Label htmlFor="receipt-header">Receipt Header Text</Label>
                    <Textarea 
                      id="receipt-header" 
                      value={formData.receiptHeader || ""} 
                      onChange={(e) => updateField("receiptHeader", e.target.value)}
                      rows={2} 
                      data-testid="input-receipt-header" 
                    />
                  </div>

                  <div>
                    <Label htmlFor="receipt-footer">Receipt Footer Text</Label>
                    <Textarea 
                      id="receipt-footer" 
                      value={formData.receiptFooter || ""} 
                      onChange={(e) => updateField("receiptFooter", e.target.value)}
                      rows={3} 
                      data-testid="input-receipt-footer" 
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto-Print Receipt</Label>
                      <p className="text-sm text-muted-foreground">Automatically print after payment</p>
                    </div>
                    <Switch 
                      checked={formData.autoPrintReceipt === "true"}
                      onCheckedChange={(checked) => updateField("autoPrintReceipt", checked ? "true" : "false")}
                      data-testid="switch-auto-print" 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Show Logo on Receipt</Label>
                      <p className="text-sm text-muted-foreground">Display business logo on printed receipts</p>
                    </div>
                    <Switch 
                      checked={formData.showLogoOnReceipt === "true"}
                      onCheckedChange={(checked) => updateField("showLogoOnReceipt", checked ? "true" : "false")}
                      data-testid="switch-show-logo" 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Include Tax Breakdown</Label>
                      <p className="text-sm text-muted-foreground">Show detailed tax information</p>
                    </div>
                    <Switch 
                      checked={formData.includeTaxBreakdown === "true"}
                      onCheckedChange={(checked) => updateField("includeTaxBreakdown", checked ? "true" : "false")}
                      data-testid="switch-tax-breakdown" 
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button 
                    onClick={handleSave} 
                    disabled={updateMutation.isPending}
                    data-testid="button-save-receipt"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {updateMutation.isPending ? "Saving..." : "Save Receipt Settings"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            {/* User Management Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>Manage users and assign roles</CardDescription>
                  </div>
                  {hasPermission("settings.users") && (
                    <Button onClick={handleAddUser} data-testid="button-create-user">
                      <Plus className="w-4 h-4 mr-2" />
                      Create User
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading users...</div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No users found. Create a user to get started.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => {
                        const userRole = (roles && roles.find(r => r && r.id === user.roleId)) || { name: user.role };
                        return (
                          <TableRow key={user.id}>
                            <TableCell>{user.email || user.username}</TableCell>
                            <TableCell>{user.fullName}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{userRole.name}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {hasPermission("settings.users") && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleEditUser(user)}
                                      data-testid={`button-edit-user-${user.id}`}
                                    >
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteUser(user.id)}
                                      data-testid={`button-delete-user-${user.id}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Roles Management Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Roles Management</CardTitle>
                    <CardDescription>Create and manage user roles</CardDescription>
                  </div>
                  {hasPermission("settings.roles") && (
                    <Button 
                      onClick={() => {
                        setSelectedRole(null);
                        setNewRoleName("");
                        setNewRoleDescription("");
                        setRoleDialogOpen(true);
                      }}
                      data-testid="button-add-role"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Role
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Create/Edit Role Form */}
                {roleDialogOpen && (
                  <Card>
                    <CardHeader>
                      <CardTitle>{selectedRole ? "Edit Role" : "Create New Role"}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="role-name">Role Name *</Label>
                        <Input
                          id="role-name"
                          value={selectedRole ? newRoleName : newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
                          placeholder="Enter role name"
                          data-testid="input-role-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="role-description">Description</Label>
                        <Textarea
                          id="role-description"
                          value={newRoleDescription}
                          onChange={(e) => setNewRoleDescription(e.target.value)}
                          placeholder="Enter role description"
                          data-testid="input-role-description"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setRoleDialogOpen(false);
                            setSelectedRole(null);
                            setNewRoleName("");
                            setNewRoleDescription("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={async () => {
                            if (selectedRole) {
                              // Update role
                              if (!newRoleName.trim()) {
                                toast({
                                  title: "Error",
                                  description: "Role name is required",
                                  variant: "destructive",
                                });
                                return;
                              }
                              try {
                                await apiRequest("PATCH", `/api/roles/${selectedRole.id}`, {
                                  name: newRoleName,
                                  description: newRoleDescription || null,
                                });
                                queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
                                toast({
                                  title: "Success",
                                  description: "Role updated successfully",
                                });
                                setRoleDialogOpen(false);
                                setSelectedRole(null);
                                setNewRoleName("");
                                setNewRoleDescription("");
                              } catch (error) {
                                toast({
                                  title: "Error",
                                  description: "Failed to update role",
                                  variant: "destructive",
                                });
                              }
                            } else {
                              // Create role
                              if (!newRoleName.trim()) {
                                toast({
                                  title: "Error",
                                  description: "Role name is required",
                                  variant: "destructive",
                                });
                                return;
                              }
                              try {
                                await apiRequest("POST", "/api/roles", {
                                  name: newRoleName,
                                  description: newRoleDescription || null,
                                });
                                queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
                                toast({
                                  title: "Success",
                                  description: "Role created successfully",
                                });
                                setRoleDialogOpen(false);
                                setNewRoleName("");
                                setNewRoleDescription("");
                              } catch (error) {
                                toast({
                                  title: "Error",
                                  description: "Failed to create role",
                                  variant: "destructive",
                                });
                              }
                            }
                          }}
                          data-testid="button-create-role"
                        >
                          {selectedRole ? "Update Role" : "Create Role"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Roles Table */}
                {rolesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading roles...</div>
                ) : rolesError ? (
                  <div className="text-center py-8 text-red-500">Error loading roles. Please refresh the page.</div>
                ) : !roles || roles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No roles found. Create a role to get started.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Role Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roles.filter(role => role && role.id).map((role) => (
                        <TableRow key={role.id}>
                          <TableCell className="font-medium">{role.name}</TableCell>
                          <TableCell>{role.description || "-"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {hasPermission("settings.roles") && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedRole(role);
                                      setNewRoleName(role.name);
                                      setNewRoleDescription(role.description || "");
                                      setRoleDialogOpen(true);
                                    }}
                                    data-testid={`button-edit-role-${role.id}`}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setRoleToDelete(role.id);
                                      setDeleteRoleDialogOpen(true);
                                    }}
                                    data-testid={`button-delete-role-${role.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="currency" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Currency & Localization</CardTitle>
                <CardDescription>Set currency and regional preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="currency">Default Currency</Label>
                    <Select 
                      value={formData.currency || "usd"} 
                      onValueChange={(value) => updateField("currency", value)}
                    >
                      <SelectTrigger id="currency" data-testid="select-currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="usd">USD ($)</SelectItem>
                        <SelectItem value="khr">KHR (៛)</SelectItem>
                        <SelectItem value="eur">EUR (€)</SelectItem>
                        <SelectItem value="gbp">GBP (£)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Secondary Currency for Receipts</Label>
                    <p className="text-sm text-muted-foreground">Configure dual currency display on receipts and invoices</p>
                  </div>

                  <div>
                    <Label htmlFor="secondary-currency">Secondary Currency</Label>
                    <Select 
                      value={formData.secondaryCurrency || "none"} 
                      onValueChange={(value) => updateField("secondaryCurrency", value === "none" ? null : value)}
                    >
                      <SelectTrigger id="secondary-currency" data-testid="select-secondary-currency">
                        <SelectValue placeholder="Select currency (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="khr">KHR (Cambodian Riel)</SelectItem>
                        <SelectItem value="rial">Rial (Iranian Rial)</SelectItem>
                        <SelectItem value="bdt">BDT (Bangladeshi Taka)</SelectItem>
                        <SelectItem value="inr">INR (Indian Rupee)</SelectItem>
                        <SelectItem value="pkr">PKR (Pakistani Rupee)</SelectItem>
                        <SelectItem value="thb">THB (Thai Baht)</SelectItem>
                        <SelectItem value="vnd">VND (Vietnamese Dong)</SelectItem>
                        <SelectItem value="myr">MYR (Malaysian Ringgit)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="secondary-currency-symbol">Currency Symbol</Label>
                    <Input 
                      id="secondary-currency-symbol" 
                      value={formData.secondaryCurrencySymbol || ""} 
                      onChange={(e) => updateField("secondaryCurrencySymbol", e.target.value)}
                      placeholder="e.g., ៛, Rial, BDT, ₹"
                      data-testid="input-currency-symbol" 
                    />
                  </div>

                  <div>
                    <Label htmlFor="exchange-rate">Exchange Rate (1 USD = ?)</Label>
                    <Input 
                      id="exchange-rate" 
                      type="number"
                      step="0.01"
                      value={formData.exchangeRate || ""} 
                      onChange={(e) => updateField("exchangeRate", e.target.value)}
                      placeholder="e.g., 4100, 4000, 125"
                      data-testid="input-exchange-rate" 
                    />
                    {formData.exchangeRate && formData.secondaryCurrencySymbol && (
                      <p className="text-sm text-muted-foreground mt-1">
                        1 USD = {formData.exchangeRate} {formData.secondaryCurrencySymbol}
                      </p>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <Label htmlFor="language">Language</Label>
                    <Select 
                      value={formData.language || "en"} 
                      onValueChange={(value) => updateField("language", value)}
                    >
                      <SelectTrigger id="language" data-testid="select-language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="km">Khmer</SelectItem>
                        <SelectItem value="zh">Chinese</SelectItem>
                        <SelectItem value="th">Thai</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="decimal-places">Decimal Places</Label>
                    <Select 
                      value={formData.decimalPlaces || "2"} 
                      onValueChange={(value) => updateField("decimalPlaces", value)}
                    >
                      <SelectTrigger id="decimal-places" data-testid="select-decimal-places">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0 (No decimals)</SelectItem>
                        <SelectItem value="2">2 (0.00)</SelectItem>
                        <SelectItem value="3">3 (0.000)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="rounding">Rounding Rule</Label>
                    <Select 
                      value={formData.roundingRule || "nearest"} 
                      onValueChange={(value) => updateField("roundingRule", value)}
                    >
                      <SelectTrigger id="rounding" data-testid="select-rounding">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nearest">Round to Nearest</SelectItem>
                        <SelectItem value="up">Round Up</SelectItem>
                        <SelectItem value="down">Round Down</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="currency-symbol">Currency Symbol Position</Label>
                    <Select 
                      value={formData.currencySymbolPosition || "before"} 
                      onValueChange={(value) => updateField("currencySymbolPosition", value)}
                    >
                      <SelectTrigger id="currency-symbol" data-testid="select-symbol-position">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="before">Before Amount ($100)</SelectItem>
                        <SelectItem value="after">After Amount (100$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backup" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Backup & Data Management</CardTitle>
                <CardDescription>Configure data backup and recovery options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Automatic Backups</Label>
                      <p className="text-sm text-muted-foreground">Backup data automatically</p>
                    </div>
                    <Switch 
                      checked={formData.autoBackup === "true"}
                      onCheckedChange={(checked) => updateField("autoBackup", checked ? "true" : "false")}
                      data-testid="switch-auto-backup" 
                    />
                  </div>

                  <div>
                    <Label htmlFor="backup-frequency">Backup Frequency</Label>
                    <Select 
                      value={formData.backupFrequency || "daily"} 
                      onValueChange={(value) => updateField("backupFrequency", value)}
                    >
                      <SelectTrigger id="backup-frequency" data-testid="select-backup-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="backup-storage">Backup Storage</Label>
                    <Select 
                      value={formData.backupStorage || "cloud"} 
                      onValueChange={(value) => updateField("backupStorage", value)}
                    >
                      <SelectTrigger id="backup-storage" data-testid="select-backup-storage">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">Local Storage</SelectItem>
                        <SelectItem value="cloud">Cloud Storage</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-3">Manual Backup & Recovery</h4>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" data-testid="button-backup-now">
                        <Database className="w-4 h-4 mr-2" />
                        Backup Now
                      </Button>
                      <Button variant="outline" className="flex-1" data-testid="button-restore">
                        <Database className="w-4 h-4 mr-2" />
                        Restore Data
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">
                      Last backup: Never
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Group Permissions</CardTitle>
                <CardDescription>Manage permissions for each role/position.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label htmlFor="select-role">Select Role:</Label>
                  <Select
                    value={selectedRoleForPermissions}
                    onValueChange={(value) => {
                      setSelectedRoleForPermissions(value);
                    }}
                  >
                    <SelectTrigger id="select-role" className="mt-2">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles && roles.length > 0 ? roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      )) : null}
                    </SelectContent>
                  </Select>
                </div>

                {selectedRoleForPermissions && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Permissions</h4>
                      <Button
                        size="sm"
                        onClick={() => {
                          const permissionIds = Array.from(rolePermissions);
                          setRolePermissionsMutation.mutate({
                            roleId: selectedRoleForPermissions,
                            permissionIds,
                          });
                        }}
                        disabled={setRolePermissionsMutation.isPending}
                      >
                        {setRolePermissionsMutation.isPending ? "Saving..." : "Save Permissions"}
                      </Button>
                    </div>

                    {permissionsLoading ? (
                      <div className="text-center py-8 text-muted-foreground">Loading permissions...</div>
                    ) : permissionsError ? (
                      <div className="text-center py-8 text-red-500">Error loading permissions. Please refresh the page.</div>
                    ) : !permissions || permissions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">No permissions found.</div>
                    ) : (
                      <div className="space-y-4">
                        {Array.from(new Set(permissions.filter(p => p && p.category).map(p => p.category))).map((category) => (
                          <div key={category} className="space-y-2">
                            <h5 className="font-medium text-sm text-muted-foreground uppercase">{category}</h5>
                            <div className="space-y-2 pl-4">
                              {permissions
                                .filter(p => p && p.category === category)
                                .map((permission) => (
                                  <div key={permission.id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`permission-${permission.id}`}
                                      checked={rolePermissions.has(permission.id)}
                                      onCheckedChange={(checked) => {
                                        const newPermissions = new Set(rolePermissions);
                                        if (checked) {
                                          newPermissions.add(permission.id);
                                        } else {
                                          newPermissions.delete(permission.id);
                                        }
                                        setRolePermissions(newPermissions);
                                      }}
                                    />
                                    <Label
                                      htmlFor={`permission-${permission.id}`}
                                      className="text-sm font-normal cursor-pointer"
                                    >
                                      {permission.name}
                                      {permission.description && (
                                        <span className="text-xs text-muted-foreground ml-2">
                                          - {permission.description}
                                        </span>
                                      )}
                                    </Label>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!selectedRoleForPermissions && (
                  <div className="text-center py-12 text-muted-foreground">
                    Select a role to manage its permissions
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial" className="space-y-6">
            {/* Payment Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Settings</CardTitle>
                <CardDescription>Configure payment methods and preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Cash Payment</Label>
                      <p className="text-sm text-muted-foreground">Allow cash transactions</p>
                    </div>
                    <Switch 
                      checked={(formData as any).enableCashPayment === "true"}
                      onCheckedChange={(checked) => updateField("enableCashPayment" as any, checked ? "true" : "false")}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Card Payment</Label>
                      <p className="text-sm text-muted-foreground">Allow card transactions</p>
                    </div>
                    <Switch 
                      checked={(formData as any).enableCardPayment === "true"}
                      onCheckedChange={(checked) => updateField("enableCardPayment" as any, checked ? "true" : "false")}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Mobile Payment</Label>
                      <p className="text-sm text-muted-foreground">Allow mobile payment methods</p>
                    </div>
                    <Switch 
                      checked={(formData as any).enableMobilePayment === "true"}
                      onCheckedChange={(checked) => updateField("enableMobilePayment" as any, checked ? "true" : "false")}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tax Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Tax Settings</CardTitle>
                <CardDescription>Configure tax rates and calculations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Tax</Label>
                      <p className="text-sm text-muted-foreground">Apply tax to transactions</p>
                    </div>
                    <Switch 
                      checked={(formData as any).enableTax === "true"}
                      onCheckedChange={(checked) => updateField("enableTax" as any, checked ? "true" : "false")}
                    />
                  </div>

                  <div>
                    <Label htmlFor="tax-rate">Tax Rate (%)</Label>
                    <Input 
                      id="tax-rate" 
                      type="number" 
                      value={(formData as any).taxRate || 0} 
                      onChange={(e) => updateField("taxRate" as any, parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity-logs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Activity Logs</CardTitle>
                <CardDescription>View system activity and user actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label>User</Label>
                    <Select value={activityLogsFilters.userId} onValueChange={(value) => setActivityLogsFilters(prev => ({ ...prev, userId: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Users" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        {users.map(user => (
                          <SelectItem key={user.id} value={user.id}>{user.fullName || user.username}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Entity Type</Label>
                    <Select value={activityLogsFilters.entityType} onValueChange={(value) => setActivityLogsFilters(prev => ({ ...prev, entityType: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="order">Orders</SelectItem>
                        <SelectItem value="product">Products</SelectItem>
                        <SelectItem value="expense">Expenses</SelectItem>
                        <SelectItem value="purchase">Purchases</SelectItem>
                        <SelectItem value="user">Users</SelectItem>
                        <SelectItem value="role">Roles</SelectItem>
                        <SelectItem value="employee">Employees</SelectItem>
                        <SelectItem value="table">Tables</SelectItem>
                        <SelectItem value="branch">Branches</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Action</Label>
                    <Select value={activityLogsFilters.action} onValueChange={(value) => setActivityLogsFilters(prev => ({ ...prev, action: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Actions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Actions</SelectItem>
                        <SelectItem value="create">Create</SelectItem>
                        <SelectItem value="update">Update</SelectItem>
                        <SelectItem value="delete">Delete</SelectItem>
                        <SelectItem value="view">View</SelectItem>
                        <SelectItem value="login">Login</SelectItem>
                        <SelectItem value="logout">Logout</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label>Date Range</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {activityLogsFilters.startDate && activityLogsFilters.endDate
                              ? `${format(activityLogsFilters.startDate, "MMM dd")} - ${format(activityLogsFilters.endDate, "MMM dd")}`
                              : "Select date range"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="range"
                            selected={{
                              from: activityLogsFilters.startDate,
                              to: activityLogsFilters.endDate,
                            }}
                            onSelect={(range) => {
                              setActivityLogsFilters(prev => ({
                                ...prev,
                                startDate: range?.from,
                                endDate: range?.to,
                              }));
                            }}
                            numberOfMonths={2}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setActivityLogsFilters({ userId: "all", entityType: "all", action: "all", startDate: undefined, endDate: undefined })}
                      className="mt-6"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Activity Logs List */}
                <ActivityLogsList filters={activityLogsFilters} observerTarget={activityLogsObserverTarget} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notifications & Alerts</CardTitle>
                <CardDescription>Configure system notifications and alerts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Low Stock Alerts</Label>
                      <p className="text-sm text-muted-foreground">Notify when inventory is low</p>
                    </div>
                    <Switch 
                      checked={formData.lowStockAlerts === "true"}
                      onCheckedChange={(checked) => updateField("lowStockAlerts", checked ? "true" : "false")}
                      data-testid="switch-low-stock-alerts" 
                    />
                  </div>

                  <div>
                    <Label htmlFor="stock-threshold">Low Stock Threshold</Label>
                    <Input 
                      id="stock-threshold" 
                      type="number" 
                      value={formData.stockThreshold || 10} 
                      onChange={(e) => updateField("stockThreshold", parseInt(e.target.value))}
                      data-testid="input-stock-threshold" 
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Sale Notifications</Label>
                      <p className="text-sm text-muted-foreground">Alert on new sales</p>
                    </div>
                    <Switch 
                      checked={formData.saleNotifications === "true"}
                      onCheckedChange={(checked) => updateField("saleNotifications", checked ? "true" : "false")}
                      data-testid="switch-sale-notifications" 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Discount Alerts</Label>
                      <p className="text-sm text-muted-foreground">Notify when discounts are applied</p>
                    </div>
                    <Switch 
                      checked={formData.discountAlerts === "true"}
                      onCheckedChange={(checked) => updateField("discountAlerts", checked ? "true" : "false")}
                      data-testid="switch-discount-alerts" 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>System Update Notifications</Label>
                      <p className="text-sm text-muted-foreground">Alert on system updates</p>
                    </div>
                    <Switch 
                      checked={formData.systemUpdateNotifications === "true"}
                      onCheckedChange={(checked) => updateField("systemUpdateNotifications", checked ? "true" : "false")}
                      data-testid="switch-system-updates" 
                    />
                  </div>

                  <Separator />

                  <div>
                    <Label htmlFor="notification-email">Notification Email</Label>
                    <Input 
                      id="notification-email" 
                      type="email" 
                      value={formData.notificationEmail || ""} 
                      onChange={(e) => updateField("notificationEmail", e.target.value)}
                      data-testid="input-notification-email" 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="theme" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Customization & Themes</CardTitle>
                <CardDescription>Customize the appearance of your POS system. Changes preview immediately; click Save theme to keep.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label className="block mb-3">Color Theme</Label>
                    <p className="text-sm text-muted-foreground mb-3">Click a theme to preview. Changes apply immediately on this page; save to keep.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3" data-testid="theme-preview-grid">
                      {Object.entries(COLOR_THEMES).map(([key, theme]) => {
                        const isSelected = (formData.colorTheme || "orange") === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              updateField("colorTheme", key);
                              updateField("primaryColor", ""); // use preset
                            }}
                            className={cn(
                              "flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all hover:bg-muted/50",
                              isSelected
                                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                : "border-border"
                            )}
                            data-testid={`theme-${key}`}
                          >
                            <span
                              className="h-10 w-10 rounded-full shrink-0 ring-2 ring-offset-2 ring-offset-background"
                              style={{
                                backgroundColor: `hsl(${theme.primary})`,
                                ringColor: isSelected ? "hsl(var(--primary))" : "transparent",
                              }}
                              aria-hidden
                            />
                            <span className="text-sm font-medium capitalize">{theme.name}</span>
                            {key === "orange" && (
                              <span className="text-xs text-muted-foreground">Default</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="primary-color">Custom Primary Color</Label>
                    <p className="text-sm text-muted-foreground mb-2">Override with a custom color (leave empty to use theme preset)</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        id="primary-color"
                        value={formData.primaryColor && /^#[0-9A-Fa-f]{6}$/.test(formData.primaryColor) ? formData.primaryColor : "#ea580c"}
                        onChange={(e) => updateField("primaryColor", e.target.value)}
                        className="h-10 w-14 cursor-pointer rounded border border-input bg-transparent p-1"
                        data-testid="input-primary-color"
                      />
                      <Input
                        value={formData.primaryColor || ""}
                        onChange={(e) => updateField("primaryColor", e.target.value)}
                        placeholder="#ea580c"
                        className="font-mono max-w-[140px]"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="component-size">Component / Element Size</Label>
                    <Select 
                      value={formData.componentSize || "medium"} 
                      onValueChange={(value) => updateField("componentSize", value)}
                    >
                      <SelectTrigger id="component-size" data-testid="select-component-size">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground mt-1">Affects buttons, inputs, and card spacing app-wide</p>
                  </div>

                  <div>
                    <Label htmlFor="layout">Layout Preference</Label>
                    <Select 
                      value={formData.layoutPreference || "grid"} 
                      onValueChange={(value) => updateField("layoutPreference", value)}
                    >
                      <SelectTrigger id="layout" data-testid="select-layout">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grid">Grid View</SelectItem>
                        <SelectItem value="list">List View</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="font-size">Font Size</Label>
                    <Select 
                      value={formData.fontSize || "medium"} 
                      onValueChange={(value) => updateField("fontSize", value)}
                    >
                      <SelectTrigger id="font-size" data-testid="select-font-size">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Compact Mode</Label>
                      <p className="text-sm text-muted-foreground">Reduce spacing for more content</p>
                    </div>
                    <Switch 
                      checked={formData.compactMode === "true"}
                      onCheckedChange={(checked) => updateField("compactMode", checked ? "true" : "false")}
                      data-testid="switch-compact-mode" 
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Show Animations</Label>
                      <p className="text-sm text-muted-foreground">Enable UI animations</p>
                    </div>
                    <Switch 
                      checked={formData.showAnimations === "true"}
                      onCheckedChange={(checked) => updateField("showAnimations", checked ? "true" : "false")}
                      data-testid="switch-animations" 
                    />
                  </div>

                  <Separator />

                  <Button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    data-testid="button-save-theme"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {updateMutation.isPending ? "Saving…" : "Save theme"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AddEditUserDialog
        open={userDialogOpen}
        onClose={() => {
          setUserDialogOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              disabled={deleteUserMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteRoleDialogOpen} onOpenChange={setDeleteRoleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this role? This action cannot be undone. Users with this role will have their role set to null.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (roleToDelete) {
                  deleteRoleMutation.mutate(roleToDelete);
                }
              }}
              disabled={deleteRoleMutation.isPending}
            >
              {deleteRoleMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Activity Logs List Component
function ActivityLogsList({ filters, observerTarget }: { filters: any; observerTarget: React.RefObject<HTMLDivElement> }) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery<{ logs: AuditLog[]; total: number }>({
    queryKey: ["/api/audit-logs", filters],
    queryFn: async ({ pageParam = 0 }) => {
      try {
        const params = new URLSearchParams();
        if (filters.userId && filters.userId !== "all") params.append("userId", filters.userId);
        if (filters.entityType && filters.entityType !== "all") params.append("entityType", filters.entityType);
        if (filters.action && filters.action !== "all") params.append("action", filters.action);
        if (filters.startDate) params.append("startDate", filters.startDate.toISOString());
        if (filters.endDate) params.append("endDate", filters.endDate.toISOString());
        params.append("limit", "50");
        params.append("offset", String(pageParam));
        const res = await fetch(`/api/audit-logs?${params.toString()}`, { credentials: "include" });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: "Failed to fetch audit logs" }));
          throw new Error(errorData.error || "Failed to fetch audit logs");
        }
        const result = await res.json();
        return {
          logs: result.logs || [],
          total: result.total || 0,
        };
      } catch (err) {
        console.error("Error fetching audit logs:", err);
        throw err;
      }
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || !lastPage.total) return undefined;
      const loaded = allPages.reduce((sum, page) => sum + (page.logs?.length || 0), 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    initialPageParam: 0,
    retry: 1,
  });

  const allLogs = data?.pages.flatMap(page => page.logs) || [];

  // Infinite scroll observer
  useEffect(() => {
    const target = observerTarget.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNextPage, isFetchingNextPage]);

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case "create": return "default";
      case "update": return "secondary";
      case "delete": return "destructive";
      case "view": return "outline";
      default: return "outline";
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading activity logs...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        <p>Error loading activity logs: {error instanceof Error ? error.message : "Unknown error"}</p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => window.location.reload()} 
          className="mt-4"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity Type</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No activity logs found
                </TableCell>
              </TableRow>
            ) : (
              allLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">
                    {log.createdAt ? format(new Date(log.createdAt), "PPpp") : "—"}
                  </TableCell>
                  <TableCell>{log.username || "System"}</TableCell>
                  <TableCell>
                    <Badge variant={getActionBadgeVariant(log.action || "")}>
                      {log.action || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>{log.entityType || "—"}</TableCell>
                  <TableCell>{log.entityName || log.entityId || "—"}</TableCell>
                  <TableCell className="max-w-md truncate">{log.description || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {isFetchingNextPage && (
        <div className="text-center py-4 text-muted-foreground">Loading more...</div>
      )}
      
      <div ref={observerTarget} className="h-4" />
    </div>
  );
}
