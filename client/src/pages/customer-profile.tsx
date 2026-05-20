import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { 
  ArrowLeft, 
  Edit, 
  DollarSign, 
  ShoppingCart, 
  CreditCard,
  User,
  Phone,
  Mail,
  FileText,
  Calendar,
  Trash2,
  Save,
  X,
  Eye,
  Search,
  Filter,
  Printer
} from "lucide-react";
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Customer, Order, DuePayment } from "@shared/schema";
import { format } from "date-fns";
import { useBranch } from "@/contexts/BranchContext";

interface CustomerDueSummary {
  totalDue: number;
  totalPaid: number;
  balance: number;
  credit: number;
  ordersCount: number;
}

export default function CustomerProfile() {
  const [location, setLocation] = useLocation();
  const { selectedBranchId } = useBranch();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  
  // Extract customer ID from location
  const customerId = location.split("/customer-profile/")[1]?.split("?")[0] || location.split("/customer-profile/")[1];
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDueEditDialog, setShowDueEditDialog] = useState(false);
  const [selectedDuePayment, setSelectedDuePayment] = useState<DuePayment | null>(null);
  const [showOrderEditDialog, setShowOrderEditDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderEditForm, setOrderEditForm] = useState({ total: "", createdAt: "", note: "" });
  
  // Pagination and filter state for Orders tab
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(10);
  const [ordersSearchTerm, setOrdersSearchTerm] = useState("");
  const [debouncedOrdersSearchTerm, setDebouncedOrdersSearchTerm] = useState("");
  const [ordersPaymentStatusFilter, setOrdersPaymentStatusFilter] = useState<string>("all");
  const [ordersDateRange, setOrdersDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  
  // Pagination and filter state for Transactions tab
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionsPageSize, setTransactionsPageSize] = useState(10);
  const [transactionsSearchTerm, setTransactionsSearchTerm] = useState("");
  const [debouncedTransactionsSearchTerm, setDebouncedTransactionsSearchTerm] = useState("");
  const [transactionsDateRange, setTransactionsDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  
  // Debounce search terms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedOrdersSearchTerm(ordersSearchTerm);
      setOrdersPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [ordersSearchTerm]);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTransactionsSearchTerm(transactionsSearchTerm);
      setTransactionsPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [transactionsSearchTerm]);
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setOrdersPage(1);
  }, [debouncedOrdersSearchTerm, ordersPaymentStatusFilter, ordersDateRange.from, ordersDateRange.to, selectedBranchId]);
  
  useEffect(() => {
    setTransactionsPage(1);
  }, [debouncedTransactionsSearchTerm, transactionsDateRange.from, transactionsDateRange.to, selectedBranchId]);
  
  // Fetch customer summary
  const { data: customerSummary, isLoading: summaryLoading } = useQuery<CustomerDueSummary>({
    queryKey: [`/api/due/customers/${customerId}/summary`],
    enabled: !!customerId,
  });
  
  // Fetch customer details
  const { data: customer, isLoading: customerLoading } = useQuery<Customer>({
    queryKey: [`/api/customers/${customerId}`],
    enabled: !!customerId,
  });
  
  // Fetch paginated customer orders
  const { data: ordersData, isLoading: ordersLoading } = useQuery<{ orders: Order[]; total: number }>({
    queryKey: [
      `/api/customers/${customerId}/orders/paginated`,
      {
        branchId: selectedBranchId,
        page: ordersPage,
        limit: ordersPageSize,
        search: debouncedOrdersSearchTerm,
        paymentStatus: ordersPaymentStatusFilter !== "all" ? ordersPaymentStatusFilter : undefined,
        dateFrom: ordersDateRange.from?.toISOString(),
        dateTo: ordersDateRange.to?.toISOString(),
      }
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: ordersPage.toString(),
        limit: ordersPageSize.toString(),
        ...(selectedBranchId && { branchId: selectedBranchId }),
        ...(debouncedOrdersSearchTerm && { search: debouncedOrdersSearchTerm }),
        ...(ordersPaymentStatusFilter !== "all" && { paymentStatus: ordersPaymentStatusFilter }),
        ...(ordersDateRange.from && { dateFrom: ordersDateRange.from.toISOString() }),
        ...(ordersDateRange.to && { dateTo: ordersDateRange.to.toISOString() }),
      });
      const response = await apiRequest("GET", `/api/customers/${customerId}/orders/paginated?${params.toString()}`);
      return await response.json();
    },
    enabled: !!customerId,
  });
  
  const customerOrders = ordersData?.orders || [];
  const ordersTotal = ordersData?.total || 0;
  
  // Fetch paginated customer transactions
  type Transaction = {
    id: string;
    type: "due" | "payment";
    date: Date;
    amount: number;
    description: string;
    paymentMethod?: string;
    order?: Order;
    payment?: DuePayment;
  };
  
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery<{ transactions: Transaction[]; total: number }>({
    queryKey: [
      `/api/customers/${customerId}/transactions/paginated`,
      {
        branchId: selectedBranchId,
        page: transactionsPage,
        limit: transactionsPageSize,
        search: debouncedTransactionsSearchTerm,
        dateFrom: transactionsDateRange.from?.toISOString(),
        dateTo: transactionsDateRange.to?.toISOString(),
      }
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: transactionsPage.toString(),
        limit: transactionsPageSize.toString(),
        ...(selectedBranchId && { branchId: selectedBranchId }),
        ...(debouncedTransactionsSearchTerm && { search: debouncedTransactionsSearchTerm }),
        ...(transactionsDateRange.from && { dateFrom: transactionsDateRange.from.toISOString() }),
        ...(transactionsDateRange.to && { dateTo: transactionsDateRange.to.toISOString() }),
      });
      const response = await apiRequest("GET", `/api/customers/${customerId}/transactions/paginated?${params.toString()}`);
      const data = await response.json();
      // Ensure response has transactions array
      if (!data || !data.transactions || !Array.isArray(data.transactions)) {
        console.error("Invalid response structure:", data);
        return { transactions: [], total: 0 };
      }
      // Convert date strings back to Date objects and ensure order/payment objects are properly included
      const transactions = data.transactions.map((t: any) => ({
        ...t,
        date: new Date(t.date),
        order: t.order ? {
          ...t.order,
          createdAt: t.order.createdAt ? new Date(t.order.createdAt) : undefined,
        } : undefined,
        payment: t.payment ? {
          ...t.payment,
          paymentDate: t.payment.paymentDate ? new Date(t.payment.paymentDate) : undefined,
          createdAt: t.payment.createdAt ? new Date(t.payment.createdAt) : undefined,
        } : undefined,
      }));
      return { ...data, transactions };
    },
    enabled: !!customerId,
  });
  
  const transactions = transactionsData?.transactions || [];
  const transactionsTotal = transactionsData?.total || 0;
  
  // Update form when customer loads
  useEffect(() => {
    if (customer) {
      setEditForm({
        name: customer.name || "",
        phone: customer.phone || "",
        email: customer.email || "",
        notes: customer.notes || "",
      });
    }
  }, [customer]);
  
  // Update order edit form when order is selected
  useEffect(() => {
    if (selectedOrder) {
      setOrderEditForm({
        total: selectedOrder.total || "",
        createdAt: selectedOrder.createdAt ? format(new Date(selectedOrder.createdAt), "yyyy-MM-dd'T'HH:mm") : "",
        note: selectedOrder.paymentSplits || "",
      });
    }
  }, [selectedOrder]);
  
  // Update customer mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async (data: { name: string; phone?: string; email?: string; notes?: string }) => {
      return await apiRequest("PATCH", `/api/customers/${customerId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/due/customers/${customerId}/summary`] });
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Customer profile updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update customer",
        variant: "destructive",
      });
    },
  });
  
  // Delete customer mutation
  const deleteCustomerMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/customers/${customerId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Customer deleted successfully",
      });
      setLocation("/due-management");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete customer",
        variant: "destructive",
      });
    },
  });
  
  // Update due payment mutation
  const updateDuePaymentMutation = useMutation({
    mutationFn: async (data: { paymentMethod: string; paymentDate: Date }) => {
      return await apiRequest("PATCH", `/api/due/payments/${selectedDuePayment?.id}`, {
        paymentMethod: data.paymentMethod,
        paymentDate: data.paymentDate.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/due/payments"] });
      queryClient.invalidateQueries({ queryKey: [`/api/due/customers/${customerId}/summary`] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/transactions/paginated`] });
      setShowDueEditDialog(false);
      setSelectedDuePayment(null);
      toast({
        title: "Success",
        description: "Due payment updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update due payment",
        variant: "destructive",
      });
    },
  });
  
  const handleSave = () => {
    updateCustomerMutation.mutate(editForm);
  };
  
  const handleDelete = () => {
    deleteCustomerMutation.mutate();
  };
  
  const handleEditDue = (payment: DuePayment) => {
    setSelectedDuePayment(payment);
    setShowDueEditDialog(true);
  };
  
  // Update order mutation
  const updateOrderMutation = useMutation({
    mutationFn: async (data: { id: string; total: string; createdAt: string; note?: string }) => {
      const totalAmount = parseFloat(data.total);
      const updates: any = {
        subtotal: totalAmount.toString(), // Update subtotal to match total for due orders
        total: data.total,
        createdAt: new Date(data.createdAt).toISOString(),
      };
      if (data.note !== undefined) {
        updates.paymentSplits = data.note;
      }
      return await apiRequest("PATCH", `/api/orders/${data.id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: [`/api/due/customers/${customerId}/summary`] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/orders/paginated`] });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/transactions/paginated`] });
      setShowOrderEditDialog(false);
      setSelectedOrder(null);
      toast({
        title: "Success",
        description: "Due transaction updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update due transaction",
        variant: "destructive",
      });
    },
  });
  
  const handleEditOrder = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderEditDialog(true);
  };
  
  const handleSaveOrder = () => {
    if (!selectedOrder) return;
    updateOrderMutation.mutate({
      id: selectedOrder.id,
      total: orderEditForm.total,
      createdAt: orderEditForm.createdAt,
      note: orderEditForm.note,
    });
  };
  
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };
  
  if (!customerId) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Customer ID not found</p>
          <Button onClick={() => setLocation("/due-management")} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Due Management
          </Button>
        </div>
      </div>
    );
  }
  
  if (customerLoading || summaryLoading) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading customer profile...</p>
        </div>
      </div>
    );
  }
  
  if (!customer) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-8">
          <p className="text-muted-foreground">Customer not found</p>
          <Button onClick={() => setLocation("/due-management")} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Due Management
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/due-management")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Customer Profile</h1>
            <p className="text-sm text-muted-foreground">View and manage customer details and history</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateCustomerMutation.isPending}>
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            </>
          ) : (
            <>
              {hasPermission("customers.edit") && (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              )}
              {hasPermission("due.create") && (
                <Button onClick={() => setLocation(`/due-management?customerId=${customerId}`)}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Manage Due
                </Button>
              )}
              {hasPermission("customers.delete") && (
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Customer Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4 flex-wrap">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">
                {getInitials(customer.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <CardTitle className="text-xl">{customer.name}</CardTitle>
                  <CardDescription className="mt-2">
                    Added {customer.createdAt ? format(new Date(customer.createdAt), "MMM dd, yyyy") : "N/A"}
                  </CardDescription>
                  <div className="mt-4 space-y-2">
                    {customer.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{customer.phone}</span>
                      </div>
                    )}
                    {customer.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{customer.email}</span>
                      </div>
                    )}
                    {customer.notes && (
                      <div className="flex items-start gap-2 text-sm mt-2">
                        <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <span className="text-muted-foreground">{customer.notes}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>
      
      {/* Stats Cards */}
      {customerSummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Due</CardDescription>
              <CardTitle className="text-2xl">${customerSummary.totalDue.toFixed(2)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Paid</CardDescription>
              <CardTitle className="text-2xl text-green-600">${customerSummary.totalPaid.toFixed(2)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Balance</CardDescription>
              <CardTitle className={`text-2xl ${customerSummary.balance > 0 ? "text-red-600" : "text-green-600"}`}>
                ${Math.abs(customerSummary.balance).toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Orders</CardDescription>
              <CardTitle className="text-2xl">{customerSummary.ordersCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}
      
      {/* Tabs for Orders and Due Payments */}
      <Tabs defaultValue="orders" className="w-full">
        <TabsList>
          <TabsTrigger value="orders">
            <ShoppingCart className="w-4 h-4 mr-2" />
            Orders ({ordersTotal})
          </TabsTrigger>
          <TabsTrigger value="transactions">
            <CreditCard className="w-4 h-4 mr-2" />
            Transaction History ({transactionsTotal})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Order History</CardTitle>
              <CardDescription>All orders placed by this customer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by order number..."
                    value={ordersSearchTerm}
                    onChange={(e) => setOrdersSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={ordersPaymentStatusFilter} onValueChange={setOrdersPaymentStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Payment Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="due">Due</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                  </SelectContent>
                </Select>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-[240px] justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {ordersDateRange.from && ordersDateRange.to ? (
                        `${format(ordersDateRange.from, "MMM dd")} - ${format(ordersDateRange.to, "MMM dd")}`
                      ) : (
                        "Pick a date range"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="range"
                      selected={{ from: ordersDateRange.from, to: ordersDateRange.to }}
                      onSelect={(range) => setOrdersDateRange({ from: range?.from, to: range?.to })}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              {ordersLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading orders...</div>
              ) : customerOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No orders found</div>
              ) : (
                <>
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead>Order Number</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customerOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium">{order.orderNumber}</TableCell>
                            <TableCell>
                              {format(new Date(order.createdAt), "MMM dd, yyyy HH:mm")}
                            </TableCell>
                            <TableCell>
                              <Badge variant={order.status === "completed" ? "default" : "secondary"}>
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">${parseFloat(order.total).toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLocation(`/sales?orderId=${order.id}`)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Pagination for Orders */}
                  {ordersTotal > 0 && (
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-muted-foreground">
                          Showing {((ordersPage - 1) * ordersPageSize) + 1} to {Math.min(ordersPage * ordersPageSize, ordersTotal)} of {ordersTotal} orders
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Per page:</span>
                          <Select
                            value={ordersPageSize.toString()}
                            onValueChange={(value) => {
                              setOrdersPageSize(parseInt(value, 10));
                              setOrdersPage(1);
                            }}
                          >
                            <SelectTrigger className="w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="25">25</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                              <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {ordersTotal > ordersPageSize && (
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious 
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (ordersPage > 1) setOrdersPage(ordersPage - 1);
                                }}
                                className={ordersPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                              />
                            </PaginationItem>
                            {Array.from({ length: Math.ceil(ordersTotal / ordersPageSize) }, (_, i) => i + 1)
                              .filter(page => {
                                return page === 1 || 
                                       page === Math.ceil(ordersTotal / ordersPageSize) ||
                                       (page >= ordersPage - 1 && page <= ordersPage + 1);
                              })
                              .map((page, index, array) => {
                                const showEllipsisBefore = index > 0 && page - array[index - 1] > 1;
                                return (
                                  <div key={page} className="flex items-center">
                                    {showEllipsisBefore && (
                                      <PaginationEllipsis />
                                    )}
                                    <PaginationItem>
                                      <PaginationLink
                                        href="#"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          setOrdersPage(page);
                                        }}
                                        isActive={ordersPage === page}
                                        className="cursor-pointer"
                                      >
                                        {page}
                                      </PaginationLink>
                                    </PaginationItem>
                                  </div>
                                );
                              })}
                            <PaginationItem>
                              <PaginationNext 
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (ordersPage < Math.ceil(ordersTotal / ordersPageSize)) {
                                    setOrdersPage(ordersPage + 1);
                                  }
                                }}
                                className={ordersPage >= Math.ceil(ordersTotal / ordersPageSize) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Due Transaction History</CardTitle>
              <CardDescription>All due entries and payments in chronological order</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by description, order number..."
                    value={transactionsSearchTerm}
                    onChange={(e) => setTransactionsSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-[240px] justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {transactionsDateRange.from && transactionsDateRange.to ? (
                        `${format(transactionsDateRange.from, "MMM dd")} - ${format(transactionsDateRange.to, "MMM dd")}`
                      ) : (
                        "Pick a date range"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="range"
                      selected={{ from: transactionsDateRange.from, to: transactionsDateRange.to }}
                      onSelect={(range) => setTransactionsDateRange({ from: range?.from, to: range?.to })}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              {transactionsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading transactions...</div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No transactions found</div>
              ) : (
                <>
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                    <Table>
                      <TableHeader className="sticky top-0 bg-background z-10">
                        <TableRow>
                          <TableHead>Created Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Payment Method</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map((transaction) => (
                          <TableRow key={transaction.id}>
                            <TableCell>
                              {format(transaction.date, "MMM dd, yyyy HH:mm")}
                            </TableCell>
                            <TableCell>
                              <Badge variant={transaction.type === "payment" ? "default" : "secondary"}>
                                {transaction.type === "payment" ? "Payment" : "Due Entry"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div>{transaction.description}</div>
                                {transaction.type === "due" && transaction.order?.paymentSplits && (
                                  <div className="text-xs text-muted-foreground italic mt-1">
                                    Due Note: {transaction.order.paymentSplits}
                                  </div>
                                )}
                                {transaction.type === "payment" && transaction.payment?.paymentSlips && (() => {
                                  try {
                                    const slips = typeof transaction.payment.paymentSlips === 'string' 
                                      ? JSON.parse(transaction.payment.paymentSlips) 
                                      : transaction.payment.paymentSlips;
                                    if (Array.isArray(slips) && slips.length > 0) {
                                      return (
                                        <div className="mt-2 space-y-1">
                                          <div className="flex flex-wrap gap-1">
                                            {slips.map((slipUrl: string, idx: number) => (
                                              <a
                                                key={idx}
                                                href={slipUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-block"
                                              >
                                                <img
                                                  src={slipUrl}
                                                  alt={`Payment slip ${idx + 1}`}
                                                  className="w-12 h-12 object-cover rounded border cursor-pointer hover:opacity-80"
                                                />
                                              </a>
                                            ))}
                                          </div>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="text-xs h-6"
                                            onClick={() => {
                                              const slips = typeof transaction.payment?.paymentSlips === 'string' 
                                                ? JSON.parse(transaction.payment.paymentSlips) 
                                                : transaction.payment?.paymentSlips;
                                              if (Array.isArray(slips)) {
                                                const printWindow = window.open('', '_blank');
                                                if (printWindow) {
                                                  printWindow.document.write(`
                                                    <html>
                                                      <head><title>Payment Slips</title></head>
                                                      <body style="margin: 0; padding: 20px;">
                                                        ${slips.map((url: string) => `<img src="${url}" style="max-width: 100%; margin-bottom: 20px; page-break-after: always;" />`).join('')}
                                                      </body>
                                                    </html>
                                                  `);
                                                  printWindow.document.close();
                                                  printWindow.onload = () => printWindow.print();
                                                }
                                              }
                                            }}
                                          >
                                            <Printer className="w-3 h-3 mr-1" />
                                            Print
                                          </Button>
                                        </div>
                                      );
                                    }
                                  } catch (e) {
                                    return null;
                                  }
                                  return null;
                                })()}
                              </div>
                            </TableCell>
                            <TableCell>{transaction.paymentMethod || "N/A"}</TableCell>
                            <TableCell className={`text-right font-medium ${transaction.type === "payment" ? "text-green-600" : "text-red-600"}`}>
                              {transaction.type === "payment" ? "+" : "-"}${transaction.amount.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {transaction.type === "payment" ? (
                                hasPermission("due.edit") && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditDue(transaction.payment!)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                )
                              ) : (
                                hasPermission("sales.edit") && transaction.order && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditOrder(transaction.order!)}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                )
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Pagination for Transactions */}
                  {transactionsTotal > 0 && (
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-muted-foreground">
                          Showing {((transactionsPage - 1) * transactionsPageSize) + 1} to {Math.min(transactionsPage * transactionsPageSize, transactionsTotal)} of {transactionsTotal} transactions
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Per page:</span>
                          <Select
                            value={transactionsPageSize.toString()}
                            onValueChange={(value) => {
                              setTransactionsPageSize(parseInt(value, 10));
                              setTransactionsPage(1);
                            }}
                          >
                            <SelectTrigger className="w-20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="25">25</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                              <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {transactionsTotal > transactionsPageSize && (
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious 
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (transactionsPage > 1) setTransactionsPage(transactionsPage - 1);
                                }}
                                className={transactionsPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                              />
                            </PaginationItem>
                            {Array.from({ length: Math.ceil(transactionsTotal / transactionsPageSize) }, (_, i) => i + 1)
                              .filter(page => {
                                return page === 1 || 
                                       page === Math.ceil(transactionsTotal / transactionsPageSize) ||
                                       (page >= transactionsPage - 1 && page <= transactionsPage + 1);
                              })
                              .map((page, index, array) => {
                                const showEllipsisBefore = index > 0 && page - array[index - 1] > 1;
                                return (
                                  <div key={page} className="flex items-center">
                                    {showEllipsisBefore && (
                                      <PaginationEllipsis />
                                    )}
                                    <PaginationItem>
                                      <PaginationLink
                                        href="#"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          setTransactionsPage(page);
                                        }}
                                        isActive={transactionsPage === page}
                                        className="cursor-pointer"
                                      >
                                        {page}
                                      </PaginationLink>
                                    </PaginationItem>
                                  </div>
                                );
                              })}
                            <PaginationItem>
                              <PaginationNext 
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (transactionsPage < Math.ceil(transactionsTotal / transactionsPageSize)) {
                                    setTransactionsPage(transactionsPage + 1);
                                  }
                                }}
                                className={transactionsPage >= Math.ceil(transactionsTotal / transactionsPageSize) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Customer</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {customer.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteCustomerMutation.isPending}>
              {deleteCustomerMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Due Payment Dialog */}
      <Dialog open={showDueEditDialog} onOpenChange={setShowDueEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Due Payment</DialogTitle>
            <DialogDescription>
              Update the payment method and date for this transaction.
            </DialogDescription>
          </DialogHeader>
          {selectedDuePayment && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Payment Method</Label>
                <Input
                  value={selectedDuePayment.paymentMethod || ""}
                  onChange={(e) => setSelectedDuePayment({ ...selectedDuePayment, paymentMethod: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Payment Date</Label>
                <Input
                  type="datetime-local"
                  value={selectedDuePayment.paymentDate ? format(new Date(selectedDuePayment.paymentDate), "yyyy-MM-dd'T'HH:mm") : ""}
                  onChange={(e) => setSelectedDuePayment({ ...selectedDuePayment, paymentDate: new Date(e.target.value) })}
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDueEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedDuePayment) {
                  updateDuePaymentMutation.mutate({
                    paymentMethod: selectedDuePayment.paymentMethod || "",
                    paymentDate: new Date(selectedDuePayment.paymentDate),
                  });
                }
              }}
              disabled={updateDuePaymentMutation.isPending}
            >
              {updateDuePaymentMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Due Order Dialog */}
      <Dialog open={showOrderEditDialog} onOpenChange={setShowOrderEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Due Transaction</DialogTitle>
            <DialogDescription>
              Update the amount, date, and description for this due entry.
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={orderEditForm.total}
                  onChange={(e) => setOrderEditForm({ ...orderEditForm, total: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Date *</Label>
                <Input
                  type="datetime-local"
                  value={orderEditForm.createdAt}
                  onChange={(e) => setOrderEditForm({ ...orderEditForm, createdAt: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={orderEditForm.note}
                  onChange={(e) => setOrderEditForm({ ...orderEditForm, note: e.target.value })}
                  className="mt-1"
                  rows={3}
                  placeholder="Enter description or note"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrderEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveOrder}
              disabled={updateOrderMutation.isPending || !orderEditForm.total || !orderEditForm.createdAt}
            >
              {updateOrderMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
