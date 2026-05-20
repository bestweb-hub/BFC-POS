import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { 
  CreditCard, 
  User, 
  DollarSign, 
  Eye, 
  UserPlus, 
  Search,
  Edit,
  Trash2,
  Plus,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Calendar,
  Filter,
  X,
  Upload
} from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { useDebounce } from "@/hooks/use-debounce";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useBranch } from "@/contexts/BranchContext";
import type { Customer, Order, DuePayment, OrderItem } from "@shared/schema";
import { z } from "zod";

/** Order with items (from GET /api/orders/:id); items include product and selectedSize for size-based pricing. */
interface OrderWithItems extends Order {
  items?: Array<(OrderItem & { product: { name: string }; productName?: string })>;
}
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomerSelect } from "@/components/customer-select";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface CustomerDueSummary {
  customer: Customer;
  totalDue: number;
  totalPaid: number;
  balance: number;
  credit: number;
  ordersCount: number;
}

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash by Hand" },
  { value: "aba", label: "ABA Bank" },
  { value: "acleda", label: "Acleda Bank" },
  { value: "wing", label: "Wing Bank" },
  { value: "card", label: "Card" },
  { value: "bank-transfer", label: "Bank Transfer" },
];

const DUE_CATEGORIES = [
  { value: "restaurant", label: "Restaurant Due" },
  { value: "bar-ktv", label: "Bar and KTV Due" },
  { value: "fast-food", label: "Fast Food Due" },
  { value: "other", label: "Other Due" },
];

const paymentFormSchema = z.object({
  transactionType: z.enum(["payment", "due"]),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  paymentMethod: z.string().optional(),
  dueCategory: z.string().optional(),
  description: z.string().optional(), // Keep for payment transactions
  dueNote: z.string().optional(), // New field for due notes
  paymentDate: z.coerce.date(),
  dateType: z.enum(["date", "month"]).optional(),
  customerName: z.string().optional(),
  customerId: z.string().optional(),
});

const editDuePaymentSchema = z.object({
  paymentMethod: z.string().min(1, "Payment method is required"),
  paymentDate: z.coerce.date(),
});

type PaymentFormData = z.infer<typeof paymentFormSchema>;
type EditDuePaymentData = z.infer<typeof editDuePaymentSchema>;

// Component for displaying customer transaction history in edit modal
function CustomerTransactionHistorySection({ customerId, branchId }: { customerId: string; branchId?: string | null }) {
  const { data: transactionsData, isLoading } = useQuery<{ transactions: Array<{ id: string; type: "due" | "payment"; date: Date; amount: number; description: string; paymentMethod?: string; order?: Order; payment?: DuePayment }>; total: number }>({
    queryKey: [`/api/customers/${customerId}/transactions/paginated`, { branchId, page: 1, limit: 20 }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        limit: "20",
        ...(branchId && { branchId }),
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
  
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Transaction History</Label>
        <div className="text-sm text-muted-foreground text-center py-4">Loading...</div>
      </div>
    );
  }
  
  if (transactions.length === 0) {
    return (
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Transaction History</Label>
        <div className="text-sm text-muted-foreground text-center py-4">No transactions found</div>
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Transaction History</Label>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {transactions.map((transaction) => (
          <div key={transaction.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-sm border">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={transaction.type === "payment" ? "default" : "secondary"} className="text-xs">
                  {transaction.type === "payment" ? "Payment" : "Due Entry"}
                </Badge>
                <span className="font-medium text-xs">{transaction.description}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {format(transaction.date, "MMM dd, yyyy HH:mm")}
                {transaction.paymentMethod && ` • ${transaction.paymentMethod}`}
                {transaction.type === "due" && transaction.order?.paymentSplits && (
                  <>
                    <br />
                    <span className="text-xs italic">Due Note: {transaction.order.paymentSplits}</span>
                  </>
                )}
              </div>
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
            <div className={`text-right font-semibold text-sm ${transaction.type === "payment" ? "text-green-600" : "text-red-600"}`}>
              {transaction.type === "payment" ? "+" : "-"}${transaction.amount.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DueManagement() {
  const [location, setLocation] = useLocation();
  const { selectedBranchId } = useBranch();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDueSummary | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [viewCustomerDialogOpen, setViewCustomerDialogOpen] = useState(false);
  const [selectedViewCustomer, setSelectedViewCustomer] = useState<CustomerDueSummary | null>(null);
  const [transactionType, setTransactionType] = useState<"payment" | "due">("payment");
  const [showCreateDueModal, setShowCreateDueModal] = useState(false);
  const [selectedDuePayments, setSelectedDuePayments] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [showBulkDeleteCustomersDialog, setShowBulkDeleteCustomersDialog] = useState(false);
  const [editDuePayment, setEditDuePayment] = useState<DuePayment | null>(null);
  const [showEditDueDialog, setShowEditDueDialog] = useState(false);
  const [editDueOrder, setEditDueOrder] = useState<Order | null>(null);
  const [showEditDueOrderDialog, setShowEditDueOrderDialog] = useState(false);
  const [editDueOrderDateType, setEditDueOrderDateType] = useState<"date" | "month">("date");
  const [deleteDueOrder, setDeleteDueOrder] = useState<Order | null>(null);
  const [showDeleteDueOrderDialog, setShowDeleteDueOrderDialog] = useState(false);
  const [viewOrderDetailId, setViewOrderDetailId] = useState<string | null>(null);
  const [showOrderDetailDialog, setShowOrderDetailDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<"customers" | "payments">("customers");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [exporting, setExporting] = useState(false);
  
  // Pagination state
  const [customersPage, setCustomersPage] = useState(1);
  const [customersPageSize, setCustomersPageSize] = useState(10);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsPageSize, setPaymentsPageSize] = useState(10);
  
  // Advanced filters - initially no date filter (show all date ranges)
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("pending");

  // When user selects months, set date range to first day of first month -> last day of last month
  // When no months selected, clear date range (show all dates)
  useEffect(() => {
    if (selectedMonths.length === 0) {
      setDateRange({ from: undefined, to: undefined });
      return;
    }
    const sorted = [...selectedMonths].sort();
    const [y1, m1] = sorted[0].split("-").map(Number);
    const [y2, m2] = sorted[sorted.length - 1].split("-").map(Number);
    setDateRange({
      from: new Date(y1, m1 - 1, 1),
      to: new Date(y2, m2, 0, 23, 59, 59, 999),
    });
  }, [selectedMonths.join(",")]);

  // Fetch data with pagination and server-side filtering
  const { data: customersSummaryData, isLoading: summaryLoading } = useQuery<{ summaries: CustomerDueSummary[]; total: number }>({
    queryKey: [
      "/api/due/customers-summary", 
      { 
        branchId: selectedBranchId, 
        page: customersPage, 
        limit: customersPageSize,
        search: debouncedSearchTerm,
        statusFilter,
        dateFrom: dateRange.from?.toISOString(),
        dateTo: dateRange.to?.toISOString(),
      }
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(selectedBranchId && { branchId: selectedBranchId }),
        page: customersPage.toString(),
        limit: customersPageSize.toString(),
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
        ...(statusFilter && statusFilter !== "all" && { statusFilter }),
        ...(dateRange.from && { dateFrom: dateRange.from.toISOString() }),
        ...(dateRange.to && { dateTo: dateRange.to.toISOString() }),
      });
      const response = await fetch(`/api/due/customers-summary?${params}`);
      if (!response.ok) throw new Error("Failed to fetch customers summary");
      return response.json();
    },
  });

  const customersSummary = customersSummaryData?.summaries || [];
  const customersTotal = customersSummaryData?.total || 0;

  // Fetch summary stats (same filters as list so cards reflect filtered results from backend)
  const dueStatsParamsString = (() => {
    const p = new URLSearchParams();
    if (selectedBranchId) p.append("branchId", selectedBranchId);
    if (dateRange.from) p.append("dateFrom", dateRange.from.toISOString());
    if (dateRange.to) p.append("dateTo", dateRange.to.toISOString());
    if (debouncedSearchTerm) p.append("search", debouncedSearchTerm);
    if (statusFilter && statusFilter !== "all") p.append("statusFilter", statusFilter);
    return p.toString();
  })();
  const { data: summaryStats } = useQuery<{
    totalCustomers: number;
    pendingDues: number;
    totalDue: number;
    totalOutstanding: number;
    totalCollected: number;
  }>({
    queryKey: ["/api/due/customers-summary/stats", dueStatsParamsString],
    queryFn: async () => {
      const response = await fetch(`/api/due/customers-summary/stats?${dueStatsParamsString}`);
      if (!response.ok) throw new Error("Failed to fetch summary stats");
      return response.json();
    },
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setCustomersPage(1);
  }, [debouncedSearchTerm, statusFilter, dateRange.from, dateRange.to, selectedBranchId]);

  const { data: customers = [], refetch: refetchCustomers } = useQuery<Customer[]>({
    queryKey: ["/api/customers", { branchId: selectedBranchId }],
  });

  const { data: allOrders = [], refetch: refetchOrders } = useQuery<Order[]>({
    queryKey: ["/api/orders", { branchId: selectedBranchId }],
  });

  const { data: viewOrderDetail, isLoading: viewOrderDetailLoading } = useQuery<OrderWithItems>({
    queryKey: ["/api/orders", viewOrderDetailId],
    queryFn: async () => {
      if (!viewOrderDetailId) return null as unknown as OrderWithItems;
      const res = await apiRequest("GET", `/api/orders/${viewOrderDetailId}`);
      return res.json();
    },
    enabled: !!viewOrderDetailId && showOrderDetailDialog,
  });

  const { data: duePaymentsData, refetch: refetchDuePayments } = useQuery<{ payments: DuePayment[]; total: number }>({
    queryKey: ["/api/due/payments", { branchId: selectedBranchId, page: paymentsPage, limit: paymentsPageSize }],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(selectedBranchId && { branchId: selectedBranchId }),
        page: paymentsPage.toString(),
        limit: paymentsPageSize.toString(),
      });
      const response = await fetch(`/api/due/payments?${params}`);
      if (!response.ok) throw new Error("Failed to fetch due payments");
      return response.json();
    },
  });

  const duePayments = duePaymentsData?.payments || [];
  const paymentsTotal = duePaymentsData?.total || 0;

  // Use stats from backend for ALL records
  const totalCustomers = summaryStats?.totalCustomers || 0;
  const pendingDues = summaryStats?.pendingDues || 0;
  const totalDue = summaryStats?.totalDue || 0;
  const totalOutstanding = summaryStats?.totalOutstanding || 0;
  const totalCollected = summaryStats?.totalCollected || 0;

  // Customers are already filtered on the server, no need for client-side filtering
  const filteredCustomers = customersSummary;

  // Payment form
  const paymentForm = useForm<PaymentFormData>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      transactionType: "payment",
      amount: 0,
      paymentMethod: "cash",
      dueCategory: "restaurant",
      description: "",
      paymentDate: new Date(),
      dateType: "date",
      customerName: "",
      customerId: "",
    },
  });

  // Edit due payment form
  const editDuePaymentForm = useForm<EditDuePaymentData>({
    resolver: zodResolver(editDuePaymentSchema),
    defaultValues: {
      paymentMethod: "cash",
      paymentDate: new Date(),
    },
  });

  // Customer form schema
  const customerFormSchema = z.object({
    name: z.string().min(1, "Name is required"),
    phone: z.string().optional(),
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    notes: z.string().optional(),
  });

  // Customer form
  const customerForm = useForm({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      notes: "",
    },
  });

  // State for payment slip images
  const [paymentSlipImages, setPaymentSlipImages] = useState<File[]>([]);
  const [paymentSlipPreviewUrls, setPaymentSlipPreviewUrls] = useState<string[]>([]);

  // Mutations
  const createPaymentMutation = useMutation({
    mutationFn: async (data: { 
      customerId: string;
      paymentDate: string;
      amount: string;
      paymentMethod: string;
      reference?: string;
      note?: string;
      branchId?: string | null;
      allocations: Array<{ orderId: string; amount: number }>;
      paymentSlips?: string[];
    }) => {
      // First upload payment slip images if any
      let slipUrls: string[] = [];
      if (paymentSlipImages.length > 0) {
        const formData = new FormData();
        paymentSlipImages.forEach((file) => {
          formData.append("slips", file);
        });
        
        const uploadResponse = await fetch("/api/due/payments/upload-slips", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        
        if (!uploadResponse.ok) {
          throw new Error("Failed to upload payment slips");
        }
        
        const uploadData = await uploadResponse.json();
        slipUrls = uploadData.urls || [];
      }
      
      // Then create payment with slip URLs
      return await apiRequest("POST", "/api/due/payments", {
        ...data,
        paymentSlips: slipUrls,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/due"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/due/customers-summary"] });
      if (variables.customerId) {
        queryClient.invalidateQueries({ queryKey: [`/api/customers/${variables.customerId}/transactions/paginated`] });
      }
      queryClient.refetchQueries({ queryKey: ["/api/due/customers-summary", { branchId: selectedBranchId }] });
      refetchOrders();
      setShowPaymentModal(false);
      paymentForm.reset();
      // Clear payment slip images
      setPaymentSlipImages([]);
      setPaymentSlipPreviewUrls([]);
      toast({
        title: "Success",
        description: "Payment recorded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to record payment",
        variant: "destructive",
      });
    },
  });

  const createDueOrderMutation = useMutation({
    mutationFn: async (data: { customerId: string; amount: number; category: string; dueNote?: string; customerName?: string; customerPhone?: string | null; dueDate?: string }) => {
      // Ensure dueDate is provided and valid
      if (!data.dueDate) {
        throw new Error("Due date is required");
      }
      
      const orderData = {
        customerId: data.customerId,
        customerName: data.customerName || selectedCustomer?.customer.name,
        customerPhone: data.customerPhone || selectedCustomer?.customer.phone,
        subtotal: data.amount.toString(),
        discount: "0",
        discountType: "amount",
        total: data.amount.toString(),
        status: "completed",
        paymentMethod: "due",
        paymentStatus: "due",
        dueAmount: data.amount.toString(),
        paidAmount: "0",
        branchId: selectedBranchId,
        items: [],
        orderSource: "due-management", // Mark as due-management order
        paymentSplits: data.dueNote || "",
        createdAt: data.dueDate, // Use the provided date, don't fall back to current date
      };
      
      return await apiRequest("POST", "/api/orders", orderData);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/due"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/due/customers-summary"] });
      if (variables.customerId) {
        queryClient.invalidateQueries({ queryKey: [`/api/customers/${variables.customerId}/transactions/paginated`] });
      }
      queryClient.refetchQueries({ queryKey: ["/api/due/customers-summary", { branchId: selectedBranchId }] });
      refetchOrders();
      setShowPaymentModal(false);
      setShowCreateDueModal(false);
      paymentForm.reset();
      toast({
        title: "Success",
        description: "Due amount added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add due amount",
        variant: "destructive",
      });
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/customers", data);
      return await response.json() as Customer;
    },
    onSuccess: async (customer: Customer) => {
      // Invalidate and refetch queries
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/due/customers-summary"] });
      queryClient.refetchQueries({ queryKey: ["/api/due/customers-summary", { branchId: selectedBranchId }] });
      queryClient.refetchQueries({ queryKey: ["/api/customers", { branchId: selectedBranchId }] });
      
      toast({
        title: "Success",
        description: "Customer created successfully",
      });
      
      setShowCustomerModal(false);
      setSelectedCustomer(null);
      customerForm.reset({
        name: "",
        phone: "",
        email: "",
        notes: "",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create customer",
        variant: "destructive",
      });
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/customers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/due/customers-summary"] });
      toast({
        title: "Success",
        description: "Customer deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete customer",
        variant: "destructive",
      });
    },
  });

  const updateDuePaymentMutation = useMutation({
    mutationFn: async (data: { id: string; paymentMethod: string; paymentDate: Date }) => {
      return await apiRequest("PATCH", `/api/due/payments/${data.id}`, {
        paymentMethod: data.paymentMethod,
        paymentDate: data.paymentDate.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/due/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/due/customers-summary"] });
      setShowEditDueDialog(false);
      setEditDuePayment(null);
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

  // Update due order mutation
  const updateDueOrderMutation = useMutation({
    mutationFn: async (data: { id: string; total: string; createdAt: string; dateType: "date" | "month"; note?: string }) => {
      let finalDate: Date;
      
      if (data.dateType === "month") {
        // For month type, createdAt should be in format "YYYY-MM-01T00:00" or "YYYY-MM"
        // Parse it correctly to get the 1st day of the month
        if (data.createdAt.includes("T")) {
          // Already formatted as datetime
          const tempDate = new Date(data.createdAt);
          const year = tempDate.getFullYear();
          const month = tempDate.getMonth();
          finalDate = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
        } else {
          // Format "YYYY-MM" from month input
          const [year, month] = data.createdAt.split("-");
          finalDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1, 0, 0, 0, 0));
        }
      } else {
        // For date type, createdAt is in datetime-local format "YYYY-MM-DDTHH:mm"
        finalDate = new Date(data.createdAt);
      }
      
      const totalAmount = parseFloat(data.total);
      const updates: any = {
        subtotal: totalAmount.toString(),
        total: data.total,
        createdAt: finalDate.toISOString(),
      };
      if (data.note !== undefined) {
        // If note is empty string, set to empty string to clear the field
        // If note is undefined, don't update the field
        updates.paymentSplits = data.note || "";
      }
      return await apiRequest("PATCH", `/api/orders/${data.id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/due/customers-summary"] });
      if (editDueOrder?.customerId) {
        queryClient.invalidateQueries({ queryKey: [`/api/customers/${editDueOrder.customerId}/transactions/paginated`] });
      }
      setShowEditDueOrderDialog(false);
      setEditDueOrder(null);
      toast({
        title: "Success",
        description: "Due order updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update due order",
        variant: "destructive",
      });
    },
  });
  
  // Delete due order mutation
  const deleteDueOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/orders/${id}`);
    },
    onSuccess: (_, orderId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/due/customers-summary"] });
      // Invalidate transaction history for the customer if we have the order info
      if (deleteDueOrder?.customerId) {
        queryClient.invalidateQueries({ queryKey: [`/api/customers/${deleteDueOrder.customerId}/transactions/paginated`] });
      }
      setShowDeleteDueOrderDialog(false);
      setDeleteDueOrder(null);
      toast({
        title: "Success",
        description: "Due order deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete due order",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteDuePaymentsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return await apiRequest("POST", "/api/due/payments/bulk-delete", { ids });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/due/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/due/customers-summary"] });
      setSelectedDuePayments(new Set());
      setShowBulkDeleteDialog(false);
      toast({
        title: "Success",
        description: `${data.deletedCount || selectedDuePayments.size} due payment(s) deleted successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete due payments",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteCustomersMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return await apiRequest("POST", "/api/customers/bulk-delete", { ids });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/due/customers-summary"] });
      setSelectedCustomers(new Set());
      setShowBulkDeleteCustomersDialog(false);
      toast({
        title: "Success",
        description: `${data.deletedCount || selectedCustomers.size} customer(s) deleted successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete customers",
        variant: "destructive",
      });
    },
  });

  // Handlers
  const handleRecordPayment = (customer: CustomerDueSummary) => {
    setSelectedCustomer(customer);
    setTransactionType("payment");
                    paymentForm.reset({
                      transactionType: "payment",
                      amount: customer.balance,
                      paymentMethod: "cash",
                      dueCategory: "restaurant",
                      description: "",
                      paymentDate: new Date(),
                      dateType: "date",
                    });
    setShowPaymentModal(true);
  };

  const handleAddDue = (customer: CustomerDueSummary) => {
    setSelectedCustomer(customer);
    setTransactionType("due");
    paymentForm.reset({
      transactionType: "due",
      amount: 0,
      paymentMethod: "cash",
      dueCategory: "restaurant",
      description: "",
      dueNote: "",
      paymentDate: new Date(),
      dateType: "date",
    });
    setShowPaymentModal(true);
  };

  const handleViewCustomer = (customer: CustomerDueSummary) => {
    // Navigate to customer profile page
    setLocation(`/customer-profile/${customer.customer.id}`);
  };

  const handleDeleteCustomer = (customer: CustomerDueSummary) => {
    if (confirm(`Are you sure you want to delete ${customer.customer.name}?`)) {
      deleteCustomerMutation.mutate(customer.customer.id);
    }
  };

  const onSubmitPayment = async (data: PaymentFormData) => {
    if (!selectedCustomer) return;

    // Handle "Add Due" transaction type
    if (data.transactionType === "due") {
      if (!data.dueCategory) {
        toast({
          title: "Error",
          description: "Please select a due category",
          variant: "destructive",
        });
        return;
      }
      // Use selected date - ensure it's properly formatted
      // If dateType is "month", the date should already be set to 1st of month
      let dueDate: Date;
      
      // Get the date from form data - check both paymentDate and watch the form value
      const formDate = data.paymentDate || paymentForm.getValues("paymentDate");
      
      if (formDate) {
        // Ensure it's a Date object
        let tempDate: Date;
        if (formDate instanceof Date) {
          tempDate = formDate;
        } else if (typeof formDate === 'string') {
          tempDate = new Date(formDate);
        } else {
          tempDate = new Date(formDate);
        }
        
        // Validate the date
        if (isNaN(tempDate.getTime())) {
          toast({
            title: "Error",
            description: "Invalid date selected",
            variant: "destructive",
          });
          return;
        }
        
        // Extract date components using local time methods BEFORE any timezone conversion
        // This ensures the date the user sees is the date that gets stored
        let year: number;
        let month: number;
        let day: number;
        
        if (data.dateType === "month") {
          // For month selection, use the 1st day of the selected month
          year = tempDate.getFullYear();
          month = tempDate.getMonth();
          day = 1;
        } else {
          // For date selection, use the exact date selected (using local time methods)
          year = tempDate.getFullYear();
          month = tempDate.getMonth();
          day = tempDate.getDate();
        }
        
        // Create date at midnight UTC using the local date components
        // This ensures the date selected by the user is the date stored, regardless of timezone
        dueDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
      } else {
        // Fallback to current date only if no date provided
        toast({
          title: "Error",
          description: "Please select a date",
          variant: "destructive",
        });
        return;
      }
      
      createDueOrderMutation.mutate({
        customerId: selectedCustomer.customer.id,
        amount: data.amount,
        category: data.dueCategory,
        description: data.description,
        dueDate: dueDate.toISOString(),
      });
      return;
    }

    // Handle "Record Payment" transaction type
    if (!data.paymentMethod) {
      toast({
        title: "Error",
        description: "Please select a payment method",
        variant: "destructive",
      });
      return;
    }

    // Get customer's due orders
    const customerOrders = allOrders.filter(o => 
      o.customerId === selectedCustomer.customer.id &&
      (o.paymentStatus === "due" || o.paymentStatus === "partial")
    );

    // Allocate payment to orders
    const allocations: Array<{ orderId: string; amount: number }> = [];
    let remainingAmount = data.amount;

    for (const order of customerOrders) {
      if (remainingAmount <= 0) break;
      const orderDue = parseFloat(order.total || "0") - parseFloat(order.paidAmount || "0");
      const allocationAmount = Math.min(remainingAmount, orderDue);
      if (allocationAmount > 0) {
        allocations.push({
          orderId: order.id,
          amount: allocationAmount,
        });
        remainingAmount -= allocationAmount;
      }
    }

    // Use selected date or current date - ensure it's a valid Date object
    let paymentDate: Date;
    if (data.paymentDate && data.paymentDate instanceof Date) {
      paymentDate = data.paymentDate;
    } else if (data.paymentDate) {
      paymentDate = new Date(data.paymentDate);
    } else {
      paymentDate = new Date();
    }
    
    // Validate paymentDate is valid
    if (isNaN(paymentDate.getTime())) {
      toast({
        title: "Error",
        description: "Invalid payment date",
        variant: "destructive",
      });
      return;
    }
    
    createPaymentMutation.mutate({
      customerId: selectedCustomer.customer.id,
      paymentDate: paymentDate.toISOString(),
      amount: data.amount.toString(),
      paymentMethod: data.paymentMethod,
      reference: data.description || undefined,
      note: data.description || undefined,
      branchId: selectedBranchId,
      allocations,
    });
  };

  // Get customer transactions
  const getCustomerTransactions = (customerId: string) => {
    return allOrders
      .filter(o => o.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  // Build export query params from current filters
  const getExportParams = () => {
    const params = new URLSearchParams({
      ...(selectedBranchId && { branchId: selectedBranchId }),
      ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
      ...(statusFilter && statusFilter !== "all" && { statusFilter }),
      ...(dateRange.from && { dateFrom: dateRange.from.toISOString() }),
      ...(dateRange.to && { dateTo: dateRange.to.toISOString() }),
    });
    return params.toString();
  };

  // Export functions: fetch ALL customers and due records from API, then build file
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = getExportParams();
      const response = await fetch(`/api/due/export?${params}`);
      if (!response.ok) throw new Error("Failed to fetch export data");
      const { summaries, transactionsByCustomer } = await response.json();

      // Sheet 1: All customers summary
      const customerRows = summaries.map((c: CustomerDueSummary) => ({
        "Customer Name": c.customer.name,
        "Phone": c.customer.phone || "",
        "Email": c.customer.email || "",
        "Total Due": c.totalDue.toFixed(2),
        "Total Paid": c.totalPaid.toFixed(2),
        "Pending": c.balance.toFixed(2),
        "Status": c.ordersCount === 0 && c.balance === 0 && c.totalPaid === 0 ? "No Record" : (c.balance > 0 ? "Pending" : "Cleared"),
      }));
      const wsCustomers = XLSX.utils.json_to_sheet(customerRows);

      // Sheet 2: All due records (one row per transaction) with customer name
      const dueRecordRows: Array<Record<string, string | number>> = [];
      for (const s of summaries) {
        const transactions = transactionsByCustomer[s.customer.id] || [];
        for (const t of transactions) {
          dueRecordRows.push({
            "Customer Name": s.customer.name,
            "Type": t.type === "due" ? "Due" : "Payment",
            "Date": format(new Date(t.date), "yyyy-MM-dd HH:mm"),
            "Amount": parseFloat(t.amount.toFixed(2)),
            "Description": t.description || "",
            "Order Number": t.order?.orderNumber || "",
            "Payment Method": t.paymentMethod || "",
          });
        }
      }
      const wsDueRecords = XLSX.utils.json_to_sheet(dueRecordRows.length ? dueRecordRows : [{ "Customer Name": "", Type: "", Date: "", Amount: "", Description: "", "Order Number": "", "Payment Method": "" }]);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsCustomers, "Customers");
      XLSX.utils.book_append_sheet(wb, wsDueRecords, "Due Records");
      XLSX.writeFile(wb, `due-management-${format(new Date(), "yyyy-MM-dd")}.xlsx`);

      toast({
        title: "Export Successful",
        description: `Exported ${summaries.length} customers and ${dueRecordRows.length} due records to Excel`,
      });
    } catch (e) {
      toast({
        title: "Export Failed",
        description: e instanceof Error ? e.message : "Failed to export",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const params = getExportParams();
      const response = await fetch(`/api/due/export?${params}`);
      if (!response.ok) throw new Error("Failed to fetch export data");
      const { summaries, transactionsByCustomer } = await response.json();

      // CSV 1: Customers summary
      const customerHeaders = ["Customer Name", "Phone", "Email", "Total Due", "Total Paid", "Pending", "Status"];
      const customerRows = summaries.map((c: CustomerDueSummary) => [
        c.customer.name,
        c.customer.phone || "",
        c.customer.email || "",
        c.totalDue.toFixed(2),
        c.totalPaid.toFixed(2),
        c.balance.toFixed(2),
        c.ordersCount === 0 && c.balance === 0 && c.totalPaid === 0 ? "No Record" : (c.balance > 0 ? "Pending" : "Cleared"),
      ]);
      const customerCsv = [customerHeaders, ...customerRows].map(row => row.join(",")).join("\n");
      const blob1 = new Blob([customerCsv], { type: "text/csv;charset=utf-8;" });
      const link1 = document.createElement("a");
      link1.href = URL.createObjectURL(blob1);
      link1.download = `due-customers-${format(new Date(), "yyyy-MM-dd")}.csv`;
      link1.click();
      URL.revokeObjectURL(link1.href);

      // CSV 2: Due records
      const recordHeaders = ["Customer Name", "Type", "Date", "Amount", "Description", "Order Number", "Payment Method"];
      const recordRows: (string | number)[][] = [];
      for (const s of summaries) {
        const transactions = transactionsByCustomer[s.customer.id] || [];
        for (const t of transactions) {
          recordRows.push([
            s.customer.name,
            t.type === "due" ? "Due" : "Payment",
            format(new Date(t.date), "yyyy-MM-dd HH:mm"),
            t.amount.toFixed(2),
            t.description || "",
            t.order?.orderNumber || "",
            t.paymentMethod || "",
          ]);
        }
      }
      const recordCsv = [recordHeaders, ...recordRows].map(row => row.join(",")).join("\n");
      const blob2 = new Blob([recordCsv], { type: "text/csv;charset=utf-8;" });
      const link2 = document.createElement("a");
      link2.href = URL.createObjectURL(blob2);
      link2.download = `due-records-${format(new Date(), "yyyy-MM-dd")}.csv`;
      link2.click();
      URL.revokeObjectURL(link2.href);

      toast({
        title: "Export Successful",
        description: `Exported ${summaries.length} customers and ${recordRows.length} due records to CSV`,
      });
    } catch (e) {
      toast({
        title: "Export Failed",
        description: e instanceof Error ? e.message : "Failed to export",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const params = getExportParams();
      const response = await fetch(`/api/due/export?${params}`);
      if (!response.ok) throw new Error("Failed to fetch export data");
      const { summaries } = await response.json();

      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("Due Management Report", 14, 22);
      doc.setFontSize(11);
      doc.text(`Generated: ${format(new Date(), "PPpp")}`, 14, 32);
      doc.text(`Total Customers: ${summaries.length}`, 14, 38);
      doc.text(`Total Outstanding: $${summaries.reduce((s: number, c: CustomerDueSummary) => s + c.balance, 0).toFixed(2)}`, 14, 44);

      const tableData = summaries.map((c: CustomerDueSummary) => [
        c.customer.name,
        c.customer.phone || "N/A",
        `$${c.balance.toFixed(2)}`,
        c.ordersCount === 0 && c.balance === 0 && c.totalPaid === 0 ? "No Record" : (c.balance > 0 ? "Pending" : "Cleared"),
      ]);

      autoTable(doc, {
        startY: 50,
        head: [["Customer", "Phone", "Pending", "Status"]],
        body: tableData,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] },
      });

      doc.save(`due-management-${format(new Date(), "yyyy-MM-dd")}.pdf`);

      toast({
        title: "Export Successful",
        description: `Exported ${summaries.length} customers to PDF`,
      });
    } catch (e) {
      toast({
        title: "Export Failed",
        description: e instanceof Error ? e.message : "Failed to export",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const getStatusBadge = (balance: number, ordersCount: number, totalPaid: number) => {
    if (ordersCount === 0 && balance === 0 && totalPaid === 0) {
      return <Badge variant="outline">No Record</Badge>;
    }
    if (balance > 0) {
      return <Badge variant="destructive">Pending</Badge>;
    }
    return <Badge variant="secondary" className="bg-green-500/20 text-green-600">Cleared</Badge>;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Customers</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Manage your customer records and their dues.
            </p>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={exporting}>
                  <Download className="w-4 h-4 mr-2" />
                  {exporting ? "Exporting…" : "Export"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={handleExportExcel}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export to Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV}>
                  <FileText className="w-4 h-4 mr-2" />
                  Export to CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPDF}>
                  <Printer className="w-4 h-4 mr-2" />
                  Export to PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {hasPermission("due.create") && (
              <>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setTransactionType("due");
                    paymentForm.reset({
                      transactionType: "due",
                      amount: 0,
                      paymentMethod: "cash",
                      dueCategory: "restaurant",
                      description: "",
                      dueNote: "",
                      paymentDate: new Date(),
                      dateType: "date",
                      customerName: "",
                      customerId: "",
                    });
                    // Ensure date is set after reset
                    setTimeout(() => {
                      paymentForm.setValue("paymentDate", new Date());
                    }, 0);
                    setShowCreateDueModal(true);
                  }}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Create Due
                </Button>
                <Button onClick={() => {
                  setSelectedCustomer(null);
                  customerForm.reset({
                    name: "",
                    phone: "",
                    email: "",
                    notes: "",
                  });
                  setShowCustomerModal(true);
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Customer
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Customers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCustomers}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Dues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingDues}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Due</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalDue.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Outstanding</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalOutstanding.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Collected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalCollected.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Customers and Due Payments */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "customers" | "payments")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="customers">Customers</TabsTrigger>
            <TabsTrigger value="payments">Due Payment Records</TabsTrigger>
          </TabsList>

          <TabsContent value="customers" className="space-y-4">
            {/* Search and Filter */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder="Search by name, email, phone, or invoice number (e.g., INV-44)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Customers</SelectItem>
                        <SelectItem value="pending">Pending Dues</SelectItem>
                        <SelectItem value="cleared">Cleared</SelectItem>
                        <SelectItem value="no-record">No Record</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Date Range</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            <Calendar className="mr-2 h-4 w-4" />
                            {dateRange.from && dateRange.to ? (
                              `${format(dateRange.from, "MMM dd")} - ${format(dateRange.to, "MMM dd")}`
                            ) : (
                              "All dates"
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="range"
                            selected={{ from: dateRange.from, to: dateRange.to }}
                            onSelect={(range) => {
                              setDateRange({ from: range?.from, to: range?.to });
                              if (range?.from || range?.to) setSelectedMonths([]); // Clear months when using date range
                            }}
                            numberOfMonths={2}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label>Months</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-left font-normal">
                            {selectedMonths.length === 0
                              ? "All months"
                              : selectedMonths.length <= 2
                                ? selectedMonths.map((m) => { const [y, mo] = m.split("-").map(Number); return format(new Date(y, mo - 1, 1), "MMM yyyy"); }).join(", ")
                                : `${selectedMonths.length} months`}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[280px] p-0" align="start">
                          <div className="max-h-[300px] overflow-y-auto p-2">
                            {Array.from({ length: 24 }, (_, i) => {
                              const d = new Date(); d.setMonth(d.getMonth() - (23 - i));
                              const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                              const checked = selectedMonths.includes(value);
                              return (
                                <div
                                  key={value}
                                  className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer"
                                  onClick={() => setSelectedMonths((prev) => (checked ? prev.filter((x) => x !== value) : [...prev, value].sort()))}
                                >
                                  <Checkbox checked={checked} onCheckedChange={() => {}} />
                                  <span className="text-sm">{format(d, "MMMM yyyy")}</span>
                                </div>
                              );
                            })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2 flex items-end">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setDateRange({ from: undefined, to: undefined });
                          setSelectedMonths([]);
                          setStatusFilter("pending");
                          setSearchTerm("");
                        }}
                        className="w-full"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Clear Filters
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer Table */}
        <Card>
          <CardContent className="pt-6">
            {summaryLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {customersSummary.length === 0 
                  ? "No customers found. Create a customer or make a sale with a due payment to see them here."
                  : "No customers match your search criteria."
                }
              </div>
            ) : (
              <>
                {selectedCustomers.size > 0 && (
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {selectedCustomers.size} customer(s) selected
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowBulkDeleteCustomersDialog(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Selected ({selectedCustomers.size})
                    </Button>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedCustomers.size === filteredCustomers.length && filteredCustomers.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCustomers(new Set(filteredCustomers.map(c => c.customer.id)));
                            } else {
                              setSelectedCustomers(new Set());
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Pending</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((summary) => (
                      <TableRow key={summary.customer.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedCustomers.has(summary.customer.id)}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedCustomers);
                              if (checked) {
                                newSelected.add(summary.customer.id);
                              } else {
                                newSelected.delete(summary.customer.id);
                              }
                              setSelectedCustomers(newSelected);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{getInitials(summary.customer.name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{summary.customer.name}</div>
                            <div className="text-sm text-muted-foreground">
                              Added {format(new Date(summary.customer.createdAt || new Date()), "dd/MM/yyyy")}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {summary.customer.phone || summary.customer.email ? (
                          <div className="text-sm">
                            {summary.customer.phone && <div>{summary.customer.phone}</div>}
                            {summary.customer.email && <div className="text-muted-foreground">{summary.customer.email}</div>}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No contact</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${summary.totalPaid.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        ${summary.balance.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(summary.balance, summary.ordersCount, summary.totalPaid)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewCustomer(summary)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {hasPermission("due.create") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRecordPayment(summary)}
                            >
                              <CreditCard className="w-4 h-4" />
                            </Button>
                          )}
                          {hasPermission("customers.edit") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedCustomer(summary);
                                customerForm.reset({
                                  name: summary.customer.name,
                                  phone: summary.customer.phone || "",
                                  email: summary.customer.email || "",
                                  notes: summary.customer.notes || "",
                                });
                                setShowCustomerModal(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          )}
                          {hasPermission("customers.delete") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteCustomer(summary)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </>
            )}
          </CardContent>
          {/* Pagination for Customers */}
          {customersTotal > 0 && (
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((customersPage - 1) * customersPageSize) + 1} to {Math.min(customersPage * customersPageSize, customersTotal)} of {customersTotal} customers
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Per page:</span>
                    <Select
                      value={customersPageSize.toString()}
                      onValueChange={(value) => {
                        setCustomersPageSize(parseInt(value, 10));
                        setCustomersPage(1); // Reset to first page when changing page size
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
                {customersTotal > customersPageSize && (
                  <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (customersPage > 1) setCustomersPage(customersPage - 1);
                        }}
                        className={customersPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    {Array.from({ length: Math.ceil(customersTotal / customersPageSize) }, (_, i) => i + 1)
                      .filter(page => {
                        const totalPages = Math.ceil(customersTotal / customersPageSize);
                        return page === 1 || page === totalPages || (page >= customersPage - 1 && page <= customersPage + 1);
                      })
                      .map((page, index, array) => {
                        const showEllipsis = index > 0 && array[index] - array[index - 1] > 1;
                        return (
                          <div key={page} className="flex items-center">
                            {showEllipsis && (
                              <PaginationItem>
                                <PaginationEllipsis />
                              </PaginationItem>
                            )}
                            <PaginationItem>
                              <PaginationLink
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setCustomersPage(page);
                                }}
                                isActive={customersPage === page}
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
                          if (customersPage < Math.ceil(customersTotal / customersPageSize)) setCustomersPage(customersPage + 1);
                        }}
                        className={customersPage >= Math.ceil(customersTotal / customersPageSize) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      </TabsContent>

      <TabsContent value="payments" className="space-y-4">
            {/* Due Payments Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Due Payment Records</CardTitle>
                    <CardDescription>Manage individual due payment records</CardDescription>
                  </div>
                  {selectedDuePayments.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowBulkDeleteDialog(true)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Selected ({selectedDuePayments.size})
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {duePayments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No due payment records found.</div>
                ) : (
                  <>
                    <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedDuePayments.size === duePayments.length && duePayments.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedDuePayments(new Set(duePayments.map(p => p.id)));
                            } else {
                              setSelectedDuePayments(new Set());
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {duePayments.map((payment) => {
                      const customer = customers.find(c => c.id === payment.customerId);
                      return (
                        <TableRow key={payment.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedDuePayments.has(payment.id)}
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(selectedDuePayments);
                                if (checked) {
                                  newSelected.add(payment.id);
                                } else {
                                  newSelected.delete(payment.id);
                                }
                                setSelectedDuePayments(newSelected);
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            {customer?.name || "Unknown Customer"}
                          </TableCell>
                          <TableCell>
                            {format(new Date(payment.paymentDate), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="font-mono">
                            ${parseFloat(payment.amount).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {PAYMENT_METHODS.find(m => m.value === payment.paymentMethod)?.label || payment.paymentMethod}
                          </TableCell>
                          <TableCell>
                            {payment.reference || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {hasPermission("due.edit") && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditDuePayment(payment);
                                    editDuePaymentForm.reset({
                                      paymentMethod: payment.paymentMethod,
                                      paymentDate: new Date(payment.paymentDate),
                                    });
                                    setShowEditDueDialog(true);
                                  }}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              )}
                              {hasPermission("due.delete") && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedDuePayments(new Set([payment.id]));
                                    setShowBulkDeleteDialog(true);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    </TableBody>
                  </Table>
                  {/* Pagination for Due Payments */}
                  {paymentsTotal > 0 && (
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-muted-foreground">
                          Showing {((paymentsPage - 1) * paymentsPageSize) + 1} to {Math.min(paymentsPage * paymentsPageSize, paymentsTotal)} of {paymentsTotal} payments
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Per page:</span>
                          <Select
                            value={paymentsPageSize.toString()}
                            onValueChange={(value) => {
                              setPaymentsPageSize(parseInt(value, 10));
                              setPaymentsPage(1); // Reset to first page when changing page size
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
                      {paymentsTotal > paymentsPageSize && (
                        <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious 
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                if (paymentsPage > 1) setPaymentsPage(paymentsPage - 1);
                              }}
                              className={paymentsPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                          {Array.from({ length: Math.ceil(paymentsTotal / paymentsPageSize) }, (_, i) => i + 1)
                            .filter(page => {
                              const totalPages = Math.ceil(paymentsTotal / paymentsPageSize);
                              return page === 1 || page === totalPages || (page >= paymentsPage - 1 && page <= paymentsPage + 1);
                            })
                            .map((page, index, array) => {
                              const showEllipsis = index > 0 && array[index] - array[index - 1] > 1;
                              return (
                                <div key={page} className="flex items-center">
                                  {showEllipsis && (
                                    <PaginationItem>
                                      <PaginationEllipsis />
                                    </PaginationItem>
                                  )}
                                  <PaginationItem>
                                    <PaginationLink
                                      href="#"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setPaymentsPage(page);
                                      }}
                                      isActive={paymentsPage === page}
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
                                if (paymentsPage < Math.ceil(paymentsTotal / paymentsPageSize)) setPaymentsPage(paymentsPage + 1);
                              }}
                              className={paymentsPage >= Math.ceil(paymentsTotal / paymentsPageSize) ? "pointer-events-none opacity-50" : "cursor-pointer"}
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
      </div>

      {/* Record Transaction Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Record Transaction</DialogTitle>
            <DialogDescription>
              {transactionType === "payment" 
                ? `Record payment for ${selectedCustomer?.customer.name}`
                : `Add due amount for ${selectedCustomer?.customer.name}`
              }
            </DialogDescription>
          </DialogHeader>
          {selectedCustomer && (
            <div className="bg-muted/50 p-3 rounded-md mb-4">
              <p className="text-sm font-medium">{selectedCustomer.customer.name}</p>
              <p className="text-sm text-muted-foreground">Current balance: ${selectedCustomer.balance.toFixed(2)}</p>
            </div>
          )}
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(onSubmitPayment)} className="space-y-4">
              <FormField
                control={paymentForm.control}
                name="transactionType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={(value) => {
                          field.onChange(value);
                          setTransactionType(value as "payment" | "due");
                        }}
                        value={field.value}
                        className="flex space-x-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="payment" id="payment" />
                          <Label htmlFor="payment">Record Payment</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="due" id="due" />
                          <Label htmlFor="due">Add Due</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {transactionType === "payment" && (
                <FormField
                  control={paymentForm.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PAYMENT_METHODS.map(method => (
                            <SelectItem key={method.value} value={method.value}>
                              {method.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {transactionType === "due" && (
                <FormField
                  control={paymentForm.control}
                  name="dueCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select due category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DUE_CATEGORIES.map(category => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={paymentForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={paymentForm.control}
                name="dateType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date Selection Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || "date"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select date type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="date">By Date</SelectItem>
                        <SelectItem value="month">By Month</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={paymentForm.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      {paymentForm.watch("dateType") === "month" ? (
                        <Input 
                          type="month"
                          value={field.value ? format(field.value, "yyyy-MM") : ""}
                          onChange={(e) => {
                            const monthValue = e.target.value;
                            if (monthValue) {
                              const [year, month] = monthValue.split("-");
                              field.onChange(new Date(parseInt(year), parseInt(month) - 1, 1));
                            }
                          }}
                        />
                      ) : (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "PPP") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={paymentForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field}
                        placeholder={transactionType === "payment" ? "e.g., Partial payment via bank transfer" : "e.g., Invoice #INV-005"}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {transactionType === "payment" && (
                <div className="space-y-2">
                  <Label>Payment Slips (Optional)</Label>
                  <div className="space-y-2">
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length > 0) {
                          // Validate file sizes (5MB each)
                          const invalidFiles = files.filter(f => f.size > 5 * 1024 * 1024);
                          if (invalidFiles.length > 0) {
                            toast({
                              title: "Error",
                              description: "Some files exceed 5MB limit",
                              variant: "destructive",
                            });
                            return;
                          }
                          
                          setPaymentSlipImages([...paymentSlipImages, ...files]);
                          // Create preview URLs
                          files.forEach((file) => {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                              setPaymentSlipPreviewUrls(prev => [...prev, e.target?.result as string]);
                            };
                            reader.readAsDataURL(file);
                          });
                        }
                      }}
                      className="cursor-pointer"
                    />
                    {paymentSlipPreviewUrls.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {paymentSlipPreviewUrls.map((url, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={url}
                              alt={`Payment slip ${index + 1}`}
                              className="w-full h-24 object-cover rounded border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                              onClick={() => {
                                setPaymentSlipImages(prev => prev.filter((_, i) => i !== index));
                                setPaymentSlipPreviewUrls(prev => prev.filter((_, i) => i !== index));
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      You can upload multiple images. Max 5MB per image.
                    </p>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowPaymentModal(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createPaymentMutation.isPending || createDueOrderMutation.isPending}
                >
                  {createPaymentMutation.isPending || createDueOrderMutation.isPending
                    ? (transactionType === "payment" ? "Recording..." : "Adding...")
                    : (transactionType === "payment" ? "Record Payment" : "Add Due")
                  }
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Customer View Modal */}
      <Dialog open={viewCustomerDialogOpen} onOpenChange={setViewCustomerDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{selectedViewCustomer?.customer.name}</DialogTitle>
            <DialogDescription>
              Customer since {selectedViewCustomer && format(new Date(selectedViewCustomer.customer.createdAt || new Date()), "dd/MM/yyyy")}
            </DialogDescription>
          </DialogHeader>
          {selectedViewCustomer && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Contact Information</h3>
                <div className="space-y-1 text-sm">
                  <p>Phone: {selectedViewCustomer.customer.phone || "Not provided"}</p>
                  <p>Email: {selectedViewCustomer.customer.email || "Not provided"}</p>
                  <p>Added On: {format(new Date(selectedViewCustomer.customer.createdAt || new Date()), "dd/MM/yyyy")}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Due</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${selectedViewCustomer.totalDue.toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${selectedViewCustomer.totalPaid.toFixed(2)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${selectedViewCustomer.balance.toFixed(2)}</div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Transaction History</h3>
                {getCustomerTransactions(selectedViewCustomer.customer.id).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No transactions yet.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {getCustomerTransactions(selectedViewCustomer.customer.id).slice(0, 10).map((order) => {
                      const orderTotal = parseFloat(order.total || "0");
                      const orderPaid = parseFloat(order.paidAmount || "0");
                      const orderDue = orderTotal - orderPaid;
                      const paymentMethod = order.paymentMethod || "N/A";
                      
                      return (
                        <div key={order.id} className="flex justify-between items-start p-3 bg-muted/50 rounded border">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-sm font-medium">Order #{order.orderNumber}</p>
                              <Badge variant={order.paymentStatus === "paid" ? "secondary" : order.paymentStatus === "partial" ? "default" : "destructive"}>
                                {order.paymentStatus}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">
                              {format(new Date(order.createdAt), "dd/MM/yyyy HH:mm")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Payment: {paymentMethod}
                            </p>
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto p-0 text-xs mt-1"
                              onClick={() => {
                                setViewOrderDetailId(order.id);
                                setShowOrderDetailDialog(true);
                              }}
                            >
                              View items
                            </Button>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-sm font-semibold">${orderTotal.toFixed(2)}</p>
                            {orderPaid > 0 && (
                              <p className="text-xs text-green-600">Paid: ${orderPaid.toFixed(2)}</p>
                            )}
                            {orderDue > 0 && (
                              <p className="text-xs text-orange-600">Due: ${orderDue.toFixed(2)}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setViewCustomerDialogOpen(false)}>
                  Close
                </Button>
                {hasPermission("customers.edit") && (
                  <Button onClick={() => {
                    setViewCustomerDialogOpen(false);
                    setSelectedCustomer(selectedViewCustomer);
                    customerForm.reset({
                      name: selectedViewCustomer.customer.name,
                      phone: selectedViewCustomer.customer.phone || "",
                      email: selectedViewCustomer.customer.email || "",
                      notes: selectedViewCustomer.customer.notes || "",
                    });
                    setShowCustomerModal(true);
                  }}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Customer
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Due Modal */}
      <Dialog open={showCreateDueModal} onOpenChange={setShowCreateDueModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Due</DialogTitle>
            <DialogDescription>
              Create a new due entry for a customer
            </DialogDescription>
          </DialogHeader>
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(async (data) => {
              if (transactionType === "due" && data.amount > 0) {
                // Get selected customer ID from form or create new one
                const selectedCustomerId = data.customerId;
                let customerId: string | null = null;
                let customerName = "";
                let customerPhone: string | null = null;
                
                if (!selectedCustomerId || selectedCustomerId === "") {
                  toast({
                    title: "Error",
                    description: "Please select a customer",
                    variant: "destructive",
                  });
                  return;
                }
                
                if (selectedCustomerId && selectedCustomerId !== "new") {
                  // Use existing customer
                  const customer = customers.find(c => c.id === selectedCustomerId);
                  if (customer) {
                    customerId = customer.id;
                    customerName = customer.name;
                    customerPhone = customer.phone;
                  } else {
                    toast({
                      title: "Error",
                      description: "Selected customer not found",
                      variant: "destructive",
                    });
                    return;
                  }
                } else {
                  // Create new customer from customerName field
                  const newCustomerName = (data.customerName || "").trim();
                  if (!newCustomerName) {
                    toast({
                      title: "Error",
                      description: "Please enter customer name",
                      variant: "destructive",
                    });
                    return;
                  }
                  try {
                    const newCustomer = await apiRequest("POST", "/api/customers", {
                      name: newCustomerName,
                      phone: null,
                      email: null,
                      branchId: selectedBranchId,
                      notes: null,
                    }).then(res => res.json());
                    customerId = newCustomer.id;
                    customerName = newCustomer.name;
                    customerPhone = newCustomer.phone;
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to create customer",
                      variant: "destructive",
                    });
                    return;
                  }
                }
                
                if (customerId) {
                  // Use selected date - ensure it's properly formatted
                  // If dateType is "month", the date should already be set to 1st of month
                  let dueDate: Date;
                  
                  // Get the date from form data - check both paymentDate and watch the form value
                  const formDate = data.paymentDate || paymentForm.getValues("paymentDate");
                  
                  if (formDate) {
                    // Ensure it's a Date object
                    let tempDate: Date;
                    if (formDate instanceof Date) {
                      tempDate = formDate;
                    } else if (typeof formDate === 'string') {
                      tempDate = new Date(formDate);
                    } else {
                      tempDate = new Date(formDate);
                    }
                    
                    // Validate the date
                    if (isNaN(tempDate.getTime())) {
                      toast({
                        title: "Error",
                        description: "Invalid date selected",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    // Extract date components using local time methods BEFORE any timezone conversion
                    // This ensures the date the user sees is the date that gets stored
                    let year: number;
                    let month: number;
                    let day: number;
                    
                    if (data.dateType === "month") {
                      // For month selection, use the 1st day of the selected month
                      year = tempDate.getFullYear();
                      month = tempDate.getMonth();
                      day = 1;
                    } else {
                      // For date selection, use the exact date selected (using local time methods)
                      year = tempDate.getFullYear();
                      month = tempDate.getMonth();
                      day = tempDate.getDate();
                    }
                    
                    // Create date at midnight UTC using the local date components
                    // This ensures the date selected by the user is the date stored, regardless of timezone
                    dueDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
                  } else {
                    // Fallback to current date only if no date provided
                    toast({
                      title: "Error",
                      description: "Please select a date",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  await createDueOrderMutation.mutateAsync({
                    customerId,
                    amount: data.amount,
                    category: data.dueCategory || "restaurant",
                    dueNote: data.dueNote || "",
                    customerName,
                    customerPhone,
                    dueDate: dueDate.toISOString(),
                  });
                  
                  setShowCreateDueModal(false);
                  paymentForm.reset({
                    transactionType: "due",
                    amount: 0,
                    paymentMethod: "cash",
                    dueCategory: "restaurant",
                    description: "",
                    dueNote: "",
                    paymentDate: new Date(),
                    dateType: "date",
                    customerName: "",
                    customerId: "",
                  });
                }
              }
            })} className="space-y-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <CustomerSelect
                  value={paymentForm.watch("customerId") || ""}
                  onValueChange={(value) => {
                    paymentForm.setValue("customerId", value);
                    if (value === "new") {
                      paymentForm.setValue("customerName", "");
                    } else {
                      paymentForm.setValue("customerName", "");
                      const customer = customers.find(c => c.id === value);
                      if (customer) {
                        paymentForm.setValue("dueNote", "");
                      }
                    }
                  }}
                  placeholder="Select customer or create new"
                  includeNewOption={true}
                  onNewCustomer={() => {
                    // This will be handled by the form logic
                  }}
                />
                {paymentForm.watch("customerId") === "new" && (
                  <FormField
                    control={paymentForm.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter customer name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
              
              <FormField
                control={paymentForm.control}
                name="dueCategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || "restaurant"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select due category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DUE_CATEGORIES.map(category => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={paymentForm.control}
                name="dateType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date Selection Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || "date"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select date type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="date">By Date</SelectItem>
                        <SelectItem value="month">By Month</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={paymentForm.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      {paymentForm.watch("dateType") === "month" ? (
                        <Input 
                          type="month"
                          value={field.value ? format(field.value, "yyyy-MM") : ""}
                          onChange={(e) => {
                            const monthValue = e.target.value;
                            if (monthValue) {
                              const [year, month] = monthValue.split("-");
                              field.onChange(new Date(parseInt(year), parseInt(month) - 1, 1));
                            }
                          }}
                        />
                      ) : (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "PPP") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={paymentForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0.01" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={paymentForm.control}
                name="dueNote"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Note (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Enter note for this due entry" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setShowCreateDueModal(false);
                  paymentForm.reset();
                }}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createDueOrderMutation.isPending}
                >
                  {createDueOrderMutation.isPending ? "Creating..." : "Create Due"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Customer Modal */}
      <Dialog open={showCustomerModal} onOpenChange={setShowCustomerModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedCustomer ? "Edit Customer" : "Add Customer"}</DialogTitle>
            <DialogDescription>
              {selectedCustomer ? "Update customer information" : "Create a new customer"}
            </DialogDescription>
          </DialogHeader>
          <Form {...customerForm}>
            <form onSubmit={customerForm.handleSubmit(async (data) => {
              const customerData = {
                ...data,
                branchId: selectedBranchId,
              };
              if (selectedCustomer) {
                try {
                  // Update customer
                  await apiRequest("PATCH", `/api/customers/${selectedCustomer.customer.id}`, customerData);
                  
                  // Check if balance was edited
                  const balanceInput = document.getElementById("balance-input") as HTMLInputElement;
                  if (balanceInput) {
                    const newBalance = parseFloat(balanceInput.value) || 0;
                    const currentBalance = selectedCustomer.balance;
                    const balanceDifference = newBalance - currentBalance;
                    
                    if (Math.abs(balanceDifference) > 0.01) {
                      // Balance was changed - create adjustment
                      if (balanceDifference > 0) {
                        // Balance increased - create a new due order for the difference
                        await createDueOrderMutation.mutateAsync({
                          customerId: selectedCustomer.customer.id,
                          amount: balanceDifference,
                          category: "other",
                          description: `Balance adjustment - Previous: $${currentBalance.toFixed(2)}, New: $${newBalance.toFixed(2)}`,
                          customerName: selectedCustomer.customer.name,
                          customerPhone: selectedCustomer.customer.phone,
                          dueDate: new Date().toISOString(),
                        });
                      } else {
                        // Balance decreased - record a payment/adjustment for the difference
                        const customerOrders = allOrders.filter(o => 
                          o.customerId === selectedCustomer.customer.id &&
                          (o.paymentStatus === "due" || o.paymentStatus === "partial")
                        );
                        
                        if (customerOrders.length > 0) {
                          const allocations: Array<{ orderId: string; amount: number }> = [];
                          let remainingAmount = Math.abs(balanceDifference);
                          
                          for (const order of customerOrders) {
                            if (remainingAmount <= 0) break;
                            const orderDue = parseFloat(order.total || "0") - parseFloat(order.paidAmount || "0");
                            const allocationAmount = Math.min(remainingAmount, orderDue);
                            if (allocationAmount > 0) {
                              allocations.push({
                                orderId: order.id,
                                amount: allocationAmount,
                              });
                              remainingAmount -= allocationAmount;
                            }
                          }
                          
                          if (allocations.length > 0) {
                            await createPaymentMutation.mutateAsync({
                              customerId: selectedCustomer.customer.id,
                              paymentDate: new Date().toISOString(),
                              amount: Math.abs(balanceDifference).toString(),
                              paymentMethod: "cash",
                              reference: `Balance adjustment - Previous: $${currentBalance.toFixed(2)}, New: $${newBalance.toFixed(2)}`,
                              note: `Balance adjustment`,
                              branchId: selectedBranchId,
                              allocations,
                            });
                          }
                        }
                      }
                    }
                  }
                  
                  queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/due/customers-summary"] });
                  queryClient.refetchQueries({ queryKey: ["/api/due/customers-summary", { branchId: selectedBranchId }] });
                  queryClient.refetchQueries({ queryKey: ["/api/customers", { branchId: selectedBranchId }] });
                  setShowCustomerModal(false);
                  setSelectedCustomer(null);
                  customerForm.reset({
                    name: "",
                    phone: "",
                    email: "",
                    notes: "",
                  });
                  toast({
                    title: "Success",
                    description: "Customer updated successfully",
                  });
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error.message || "Failed to update customer",
                    variant: "destructive",
                  });
                }
              } else {
                createCustomerMutation.mutate(customerData);
              }
            })} className="space-y-4">
              <FormField
                control={customerForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={customerForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={customerForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Optional)</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={customerForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {selectedCustomer && (
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">Due Management</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Label className="text-xs text-muted-foreground">Current balance:</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={selectedCustomer.balance.toFixed(2)}
                          className="w-24 h-7 text-sm"
                          id="balance-input"
                          onChange={(e) => {
                            const newBalance = parseFloat(e.target.value) || 0;
                            // Store the new balance in a state or ref for later use
                            (window as any).__editedBalance = newBalance;
                          }}
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowCustomerModal(false);
                        handleRecordPayment(selectedCustomer);
                      }}
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Record Payment
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Due Orders</Label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {allOrders
                        .filter(o => 
                          o.customerId === selectedCustomer.customer.id &&
                          (o.paymentStatus === "due" || o.paymentStatus === "partial")
                        )
                        .map(order => {
                          const orderTotal = parseFloat(order.total || "0");
                          const orderPaid = parseFloat(order.paidAmount || "0");
                          const orderBalance = orderTotal - orderPaid;
                          const dueNote = order.paymentSplits || "";
                          return (
                            <div key={order.id} className="flex items-center justify-between p-2 bg-muted rounded-md text-sm">
                              <div className="flex-1">
                                <div className="font-medium">Order #{order.orderNumber || order.id.slice(0, 8)}</div>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(order.createdAt), "MMM dd, yyyy")} • 
                                  Total: ${orderTotal.toFixed(2)} • 
                                  Paid: ${orderPaid.toFixed(2)}
                                  {dueNote && (
                                    <>
                                      <br />
                                      <span className="text-xs italic">Note: {dueNote}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="text-right mr-2">
                                <div className="font-semibold text-destructive">
                                  ${orderBalance.toFixed(2)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {order.paymentStatus}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => {
                                    setViewOrderDetailId(order.id);
                                    setShowOrderDetailDialog(true);
                                  }}
                                  title="View order items"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {hasPermission("sales.edit") && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => {
                                      setEditDueOrder(order);
                                      setShowEditDueOrderDialog(true);
                                    }}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                )}
                                {hasPermission("sales.delete") && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-destructive"
                                    onClick={() => {
                                      setDeleteDueOrder(order);
                                      setShowDeleteDueOrderDialog(true);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      {allOrders.filter(o => 
                        o.customerId === selectedCustomer.customer.id &&
                        (o.paymentStatus === "due" || o.paymentStatus === "partial")
                      ).length === 0 && (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          No due orders found
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Transaction History */}
                  <CustomerTransactionHistorySection 
                    customerId={selectedCustomer.customer.id} 
                    branchId={selectedBranchId}
                  />
                </div>
              )}
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setShowCustomerModal(false);
                  setSelectedCustomer(null);
                  customerForm.reset({
                    name: "",
                    phone: "",
                    email: "",
                    notes: "",
                  });
                }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createCustomerMutation.isPending}>
                  {createCustomerMutation.isPending ? "Saving..." : (selectedCustomer ? "Update Customer" : "Create Customer")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Due Order Dialog */}
      <Dialog open={showEditDueOrderDialog} onOpenChange={(open) => {
        setShowEditDueOrderDialog(open);
        if (!open) {
          setEditDueOrder(null);
          setEditDueOrderDateType("date");
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Due Order</DialogTitle>
            <DialogDescription>
              Update the amount, date, and description for this due entry
            </DialogDescription>
          </DialogHeader>
          {editDueOrder && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  id="edit-due-order-total"
                  defaultValue={editDueOrder.total || ""}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Date Selection Type</Label>
                <Select
                  value={editDueOrderDateType}
                  onValueChange={(value) => setEditDueOrderDateType(value as "date" | "month")}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">By Date</SelectItem>
                    <SelectItem value="month">By Month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date *</Label>
                {editDueOrderDateType === "month" ? (
                  <Input
                    type="month"
                    id="edit-due-order-date"
                    defaultValue={editDueOrder.createdAt ? format(new Date(editDueOrder.createdAt), "yyyy-MM") : ""}
                    className="mt-1"
                  />
                ) : (
                  <Input
                    type="datetime-local"
                    id="edit-due-order-date"
                    defaultValue={editDueOrder.createdAt ? format(new Date(editDueOrder.createdAt), "yyyy-MM-dd'T'HH:mm") : ""}
                    className="mt-1"
                  />
                )}
              </div>
              <div>
                <Label>Due Note (Optional)</Label>
                <Textarea
                  id="edit-due-order-note"
                  defaultValue={editDueOrder.paymentSplits || ""}
                  className="mt-1"
                  rows={3}
                  placeholder="Enter due note"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDueOrderDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!editDueOrder) return;
                const totalInput = document.getElementById("edit-due-order-total") as HTMLInputElement;
                const dateInput = document.getElementById("edit-due-order-date") as HTMLInputElement;
                const noteInput = document.getElementById("edit-due-order-note") as HTMLTextAreaElement;
                
                if (!totalInput?.value || !dateInput?.value) {
                  toast({
                    title: "Error",
                    description: "Please fill in all required fields",
                    variant: "destructive",
                  });
                  return;
                }
                
                // Format date based on date type
                let formattedDate = dateInput.value;
                // For month type, the input already returns "YYYY-MM" format
                // For date type, the input returns "YYYY-MM-DDTHH:mm" format
                // We'll pass it as-is and let the mutation handle the conversion
                
                updateDueOrderMutation.mutate({
                  id: editDueOrder.id,
                  total: totalInput.value,
                  createdAt: formattedDate,
                  dateType: editDueOrderDateType,
                  note: noteInput?.value || undefined,
                });
              }}
              disabled={updateDueOrderMutation.isPending}
            >
              {updateDueOrderMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Due Order Dialog */}
      <Dialog open={showDeleteDueOrderDialog} onOpenChange={setShowDeleteDueOrderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Due Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this due order? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteDueOrder && (
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                Order #{deleteDueOrder.orderNumber || deleteDueOrder.id.slice(0, 8)} - ${parseFloat(deleteDueOrder.total || "0").toFixed(2)}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDueOrderDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteDueOrder) {
                  deleteDueOrderMutation.mutate(deleteDueOrder.id);
                }
              }}
              disabled={deleteDueOrderMutation.isPending}
            >
              {deleteDueOrderMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Detail Dialog – shows line items with size and price (size-based pricing support) */}
      <Dialog
        open={showOrderDetailDialog}
        onOpenChange={(open) => {
          setShowOrderDetailDialog(open);
          if (!open) setViewOrderDetailId(null);
        }}
      >
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Order details</DialogTitle>
            <DialogDescription>
              {viewOrderDetail
                ? `Order #${viewOrderDetail.orderNumber || viewOrderDetail.id.slice(0, 8)} • ${format(new Date(viewOrderDetail.createdAt), "MMM dd, yyyy HH:mm")}`
                : "Loading…"}
            </DialogDescription>
          </DialogHeader>
          {viewOrderDetailLoading && (
            <div className="py-8 text-center text-muted-foreground">Loading order items…</div>
          )}
          {!viewOrderDetailLoading && viewOrderDetail && (
            <div className="overflow-auto flex-1 -mx-1 px-1">
              {(!viewOrderDetail.items || viewOrderDetail.items.length === 0) ? (
                <p className="text-sm text-muted-foreground py-4">No line items (e.g. manual due entry).</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="w-16">Size</TableHead>
                      <TableHead className="w-16 text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewOrderDetail.items.map((item: any) => {
                      const productName = item.productName ?? item.product?.name ?? "—";
                      const price = parseFloat(item.price ?? "0");
                      const total = parseFloat(item.total ?? "0");
                      const qty = Number(item.quantity) || 0;
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{productName}</TableCell>
                          <TableCell>
                            {item.selectedSize ? (
                              <Badge variant="secondary" className="text-xs">{item.selectedSize}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{qty}</TableCell>
                          <TableCell className="text-right">${price.toFixed(2)}</TableCell>
                          <TableCell className="text-right">${total.toFixed(2)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              <div className="flex justify-end gap-4 mt-4 pt-4 border-t text-sm">
                <span className="text-muted-foreground">Order total:</span>
                <span className="font-semibold">${parseFloat(viewOrderDetail.total || "0").toFixed(2)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Due Payment Dialog */}
      <Dialog open={showEditDueDialog} onOpenChange={setShowEditDueDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Due Payment</DialogTitle>
            <DialogDescription>
              Update payment method and date for this due payment record
            </DialogDescription>
          </DialogHeader>
          {editDuePayment && (
            <Form {...editDuePaymentForm}>
              <form onSubmit={editDuePaymentForm.handleSubmit((data) => {
                updateDuePaymentMutation.mutate({
                  id: editDuePayment.id,
                  paymentMethod: data.paymentMethod,
                  paymentDate: data.paymentDate,
                });
              })} className="space-y-4">
                <FormField
                  control={editDuePaymentForm.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Method</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select payment method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PAYMENT_METHODS.filter(m => ["cash", "aba", "acleda", "card"].includes(m.value)).map(method => (
                            <SelectItem key={method.value} value={method.value}>
                              {method.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editDuePaymentForm.control}
                  name="paymentDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "PPP") : "Pick a date"}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <CalendarComponent
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setShowEditDueDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateDuePaymentMutation.isPending}>
                    {updateDuePaymentMutation.isPending ? "Updating..." : "Update"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog for Due Payments */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Due Payments</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedDuePayments.size} due payment record(s)? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                bulkDeleteDuePaymentsMutation.mutate(Array.from(selectedDuePayments));
              }}
              disabled={bulkDeleteDuePaymentsMutation.isPending}
            >
              {bulkDeleteDuePaymentsMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Dialog for Customers */}
      <Dialog open={showBulkDeleteCustomersDialog} onOpenChange={setShowBulkDeleteCustomersDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Customers</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedCustomers.size} customer record(s)? This action cannot be undone and will also delete all associated orders and due payments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDeleteCustomersDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                bulkDeleteCustomersMutation.mutate(Array.from(selectedCustomers));
              }}
              disabled={bulkDeleteCustomersMutation.isPending}
            >
              {bulkDeleteCustomersMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Due Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Import Due Records</DialogTitle>
            <DialogDescription>
              Upload an Excel or CSV file to import due records. The file should have columns: Customer Name, Phone (optional), Amount, Date (optional), Description (optional)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select File</Label>
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImportFile(file);
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                Supported formats: Excel (.xlsx, .xls) or CSV (.csv)
              </p>
            </div>
            {importFile && (
              <div className="bg-muted/50 p-3 rounded-md">
                <p className="text-sm font-medium">Selected file: {importFile.name}</p>
                <p className="text-xs text-muted-foreground">Size: {(importFile.size / 1024).toFixed(2)} KB</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowImportDialog(false);
              setImportFile(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!importFile) {
                  toast({
                    title: "Error",
                    description: "Please select a file",
                    variant: "destructive",
                  });
                  return;
                }

                try {
                  const fileData = await importFile.arrayBuffer();
                  const workbook = XLSX.read(fileData, { type: "array" });
                  const sheetName = workbook.SheetNames[0];
                  const worksheet = workbook.Sheets[sheetName];
                  const data = XLSX.utils.sheet_to_json(worksheet) as any[];

                  let successCount = 0;
                  let errorCount = 0;
                  const errors: string[] = [];
                  
                  // Fetch latest customers list once at the start
                  let currentCustomers = await queryClient.fetchQuery<Customer[]>({
                    queryKey: ["/api/customers", { branchId: selectedBranchId }],
                  });

                  for (const row of data) {
                    try {
                      const customerName = (row["Customer Name"] || row["customer_name"] || row["Customer"] || "").toString().trim();
                      const phone = (row["Phone"] || row["phone"] || "").toString().trim() || null;
                      const amount = parseFloat(row["Amount"] || row["amount"] || "0");
                      const dateStr = row["Date"] || row["date"] || row["Due Date"] || row["due_date"];
                      const description = (row["Description"] || row["description"] || row["Note"] || row["note"] || "").toString().trim();

                      if (!customerName || isNaN(amount) || amount <= 0) {
                        errors.push(`Row ${data.indexOf(row) + 2}: Invalid customer name or amount`);
                        errorCount++;
                        continue;
                      }

                      // Find or create customer
                      let customerId: string;
                      const existingCustomer = phone
                        ? currentCustomers.find(c => c.name.toLowerCase() === customerName.toLowerCase() && c.phone === phone)
                        : currentCustomers.find(c => c.name.toLowerCase() === customerName.toLowerCase() && !c.phone);

                      if (existingCustomer) {
                        customerId = existingCustomer.id;
                      } else {
                        // Check if customer with same name but different contact exists
                        const sameNameCustomer = currentCustomers.find(c => c.name.toLowerCase() === customerName.toLowerCase());
                        if (sameNameCustomer && phone && sameNameCustomer.phone !== phone) {
                          // Create new customer with same name but different contact
                          const newCustomer = await apiRequest("POST", "/api/customers", {
                            name: customerName,
                            phone: phone,
                            email: null,
                            branchId: selectedBranchId,
                            notes: null,
                          }).then(res => res.json());
                          customerId = newCustomer.id;
                          // Add to current list to avoid duplicates
                          currentCustomers.push(newCustomer);
                        } else if (sameNameCustomer && !phone && sameNameCustomer.phone) {
                          // Create new customer with same name but no contact
                          const newCustomer = await apiRequest("POST", "/api/customers", {
                            name: customerName,
                            phone: null,
                            email: null,
                            branchId: selectedBranchId,
                            notes: null,
                          }).then(res => res.json());
                          customerId = newCustomer.id;
                          // Add to current list to avoid duplicates
                          currentCustomers.push(newCustomer);
                        } else {
                          // Create new customer
                          const newCustomer = await apiRequest("POST", "/api/customers", {
                            name: customerName,
                            phone: phone,
                            email: null,
                            branchId: selectedBranchId,
                            notes: null,
                          }).then(res => res.json());
                          customerId = newCustomer.id;
                          // Add to current list to avoid duplicates
                          currentCustomers.push(newCustomer);
                        }
                      }

                      // Parse date
                      let dueDate = new Date();
                      if (dateStr) {
                        const parsedDate = new Date(dateStr);
                        if (!isNaN(parsedDate.getTime())) {
                          dueDate = parsedDate;
                        }
                      }

                      // Create due order
                      await createDueOrderMutation.mutateAsync({
                        customerId,
                        amount,
                        category: "restaurant",
                        description: description || "",
                        customerName,
                        customerPhone: phone,
                        dueDate: dueDate.toISOString(),
                      });

                      successCount++;
                    } catch (error: any) {
                      errors.push(`Row ${data.indexOf(row) + 2}: ${error.message || "Unknown error"}`);
                      errorCount++;
                    }
                  }

                  toast({
                    title: "Import Complete",
                    description: `Successfully imported ${successCount} record(s). ${errorCount > 0 ? `${errorCount} error(s) occurred.` : ""}`,
                    variant: errorCount > 0 ? "destructive" : "default",
                  });

                  if (errors.length > 0) {
                    console.error("Import errors:", errors);
                  }

                  setShowImportDialog(false);
                  setImportFile(null);
                  queryClient.invalidateQueries({ queryKey: ["/api/due/customers-summary"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error.message || "Failed to import file",
                    variant: "destructive",
                  });
                }
              }}
              disabled={!importFile}
            >
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
