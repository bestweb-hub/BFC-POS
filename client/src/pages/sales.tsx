import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useBranch } from "@/contexts/BranchContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye, Pencil, Printer, Trash2, Download, FileSpreadsheet, FileText, Search, Calendar as CalendarIcon, Trash, Upload, Plus, Filter, X } from "lucide-react";
import { generateReceiptHTML, type ReceiptTemplate } from "@/lib/receipt-templates";
import { Checkbox } from "@/components/ui/checkbox";
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { useDebounce } from "@/hooks/use-debounce";
import type { Order, Product } from "@shared/schema";
import { ProductSelect } from "@/components/product-select";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type DateFilterType = "all" | "today" | "yesterday" | "thisMonth" | "lastMonth" | "january" | "february" | "march" | "april" | "may" | "june" | "july" | "august" | "september" | "october" | "november" | "december" | "custom";

interface OrderItemWithProduct {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: string;
  total: string;
  productName: string;
}

interface SalesSummaryItem {
  product: string;
  quantity: number;
  revenue: number;
}

interface PaymentSplit {
  method: string;
  amount: number;
}

export default function SalesManage() {
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("detailed");
  const [viewSale, setViewSale] = useState<Order | null>(null);
  const [editSale, setEditSale] = useState<Order | null>(null);
  const [deleteSaleId, setDeleteSaleId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Check for orderId in URL query parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get("orderId");
    if (orderId) {
      setSearchTerm(orderId);
      // Set debounced search term immediately for URL parameter (no debounce needed)
      setDebouncedSearchTerm(orderId);
      // Clear the orderId from URL after setting search term
      urlParams.delete("orderId");
      const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, []);
  const [dateFilter, setDateFilter] = useState<DateFilterType>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [orderItems, setOrderItems] = useState<OrderItemWithProduct[]>([]);
  const [summaryDateFilter, setSummaryDateFilter] = useState<DateFilterType>("all");
  const [summaryStartDate, setSummaryStartDate] = useState<Date | undefined>(undefined);
  const [summaryEndDate, setSummaryEndDate] = useState<Date | undefined>(undefined);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  // New filter states
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [orderItemSearch, setOrderItemSearch] = useState<string>("");
  const debouncedOrderItemSearch = useDebounce(orderItemSearch, 300);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [allOrderItems, setAllOrderItems] = useState<Map<string, OrderItemWithProduct[]>>(new Map());
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
  const [newPaymentMethod, setNewPaymentMethod] = useState<string>("cash");
  const [newPaymentAmount, setNewPaymentAmount] = useState<string>("");
  const [selectedSales, setSelectedSales] = useState<Set<string>>(new Set());
  const [printSale, setPrintSale] = useState<Order | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ReceiptTemplate>("classic");
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [addSaleOpen, setAddSaleOpen] = useState(false);
  const [newSaleItems, setNewSaleItems] = useState<Array<{ productId: string; productName: string; quantity: number; price: string }>>([]);
  const [newSaleCustomerName, setNewSaleCustomerName] = useState("");
  const [newSaleCustomerPhone, setNewSaleCustomerPhone] = useState("");
  const [newSaleDiningOption, setNewSaleDiningOption] = useState("dine-in");
  const [newSalePaymentMethod, setNewSalePaymentMethod] = useState("cash");
  const [newSalePaymentStatus, setNewSalePaymentStatus] = useState("paid");
  const [newSaleDate, setNewSaleDate] = useState<Date>(new Date());
  const [newSaleDiscount, setNewSaleDiscount] = useState("0");
  const [newSaleDiscountType, setNewSaleDiscountType] = useState<'amount' | 'percentage'>('amount');
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedProductQuantity, setSelectedProductQuantity] = useState("1");
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const { selectedBranchId } = useBranch();

  // Pagination state
  const [salesPage, setSalesPage] = useState(1);
  const [salesPageSize, setSalesPageSize] = useState(10);
  const [summaryPage, setSummaryPage] = useState(1);
  const [summaryPageSize, setSummaryPageSize] = useState(10);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [debouncedProductSearchTerm, setDebouncedProductSearchTerm] = useState("");

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setSalesPage(1); // Reset to first page when search changes
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Debounce product search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedProductSearchTerm(productSearchTerm);
      setSummaryPage(1); // Reset to first page when search changes
    }, 500);
    return () => clearTimeout(timer);
  }, [productSearchTerm]);

  // Get date range from filters
  const getDateRangeFromFilter = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;

    if (dateFilter === "today") {
      dateFrom = startOfDay(now);
      dateTo = endOfDay(now);
    } else if (dateFilter === "yesterday") {
      const yesterday = subDays(now, 1);
      dateFrom = startOfDay(yesterday);
      dateTo = endOfDay(yesterday);
    } else if (dateFilter === "thisMonth") {
      dateFrom = new Date(currentYear, now.getMonth(), 1);
      dateTo = new Date(currentYear, now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (dateFilter === "lastMonth") {
      dateFrom = new Date(currentYear, now.getMonth() - 1, 1);
      dateTo = new Date(currentYear, now.getMonth(), 0, 23, 59, 59, 999);
    } else if (dateFilter === "custom" && startDate && endDate) {
      dateFrom = startOfDay(startDate);
      dateTo = endOfDay(endDate);
    } else if (dateFilter === "january") {
      dateFrom = new Date(currentYear, 0, 1);
      dateTo = new Date(currentYear, 1, 0, 23, 59, 59, 999);
    } else if (dateFilter === "february") {
      dateFrom = new Date(currentYear, 1, 1);
      dateTo = new Date(currentYear, 2, 0, 23, 59, 59, 999);
    } else if (dateFilter === "march") {
      dateFrom = new Date(currentYear, 2, 1);
      dateTo = new Date(currentYear, 3, 0, 23, 59, 59, 999);
    } else if (dateFilter === "april") {
      dateFrom = new Date(currentYear, 3, 1);
      dateTo = new Date(currentYear, 4, 0, 23, 59, 59, 999);
    } else if (dateFilter === "may") {
      dateFrom = new Date(currentYear, 4, 1);
      dateTo = new Date(currentYear, 5, 0, 23, 59, 59, 999);
    } else if (dateFilter === "june") {
      dateFrom = new Date(currentYear, 5, 1);
      dateTo = new Date(currentYear, 6, 0, 23, 59, 59, 999);
    } else if (dateFilter === "july") {
      dateFrom = new Date(currentYear, 6, 1);
      dateTo = new Date(currentYear, 7, 0, 23, 59, 59, 999);
    } else if (dateFilter === "august") {
      dateFrom = new Date(currentYear, 7, 1);
      dateTo = new Date(currentYear, 8, 0, 23, 59, 59, 999);
    } else if (dateFilter === "september") {
      dateFrom = new Date(currentYear, 8, 1);
      dateTo = new Date(currentYear, 9, 0, 23, 59, 59, 999);
    } else if (dateFilter === "october") {
      dateFrom = new Date(currentYear, 9, 1);
      dateTo = new Date(currentYear, 10, 0, 23, 59, 59, 999);
    } else if (dateFilter === "november") {
      dateFrom = new Date(currentYear, 10, 1);
      dateTo = new Date(currentYear, 11, 0, 23, 59, 59, 999);
    } else if (dateFilter === "december") {
      dateFrom = new Date(currentYear, 11, 1);
      dateTo = new Date(currentYear, 12, 0, 23, 59, 59, 999);
    }

    return { dateFrom, dateTo };
  }, [dateFilter, startDate, endDate]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setSalesPage(1);
  }, [debouncedSearchTerm, paymentMethodFilter, paymentStatusFilter, dateFilter, startDate, endDate, debouncedOrderItemSearch, selectedBranchId, selectedMonths]);

  // Build query params for sales list/export (shared).
  // When months are selected, use exact date-time range in user's local time (toISOString for API)
  // so filtering is by date+time and not affected by server timezone (fixes Jan export including Feb 1st sales).
  const getSalesQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedBranchId) params.append("branchId", selectedBranchId);
    if (debouncedSearchTerm?.trim()) params.append("search", debouncedSearchTerm);
    if (paymentMethodFilter !== "all") params.append("paymentMethod", paymentMethodFilter);
    if (paymentStatusFilter !== "all") params.append("paymentStatus", paymentStatusFilter);
    if (selectedMonths.length > 0) {
      const sorted = [...selectedMonths].sort();
      const [y1, m1] = sorted[0].split("-").map(Number);
      const [y2, m2] = sorted[sorted.length - 1].split("-").map(Number);
      const start = new Date(y1, m1 - 1, 1, 0, 0, 0, 0);
      const end = new Date(y2, m2, 0, 23, 59, 59, 999);
      params.append("dateFrom", start.toISOString());
      params.append("dateTo", end.toISOString());
    } else {
      if (getDateRangeFromFilter.dateFrom) params.append("dateFrom", getDateRangeFromFilter.dateFrom.toISOString());
      if (getDateRangeFromFilter.dateTo) params.append("dateTo", getDateRangeFromFilter.dateTo.toISOString());
    }
    if (debouncedOrderItemSearch?.trim()) params.append("productSearch", debouncedOrderItemSearch);
    return params;
  }, [selectedBranchId, debouncedSearchTerm, paymentMethodFilter, paymentStatusFilter, selectedMonths, getDateRangeFromFilter.dateFrom, getDateRangeFromFilter.dateTo, debouncedOrderItemSearch]);

  // Fetch paginated sales with backend filtering (key includes params string so month/list filters trigger refetch)
  const salesParamsString = getSalesQueryParams.toString();
  const { data: salesData, isLoading } = useQuery<{ orders: Order[]; total: number }>({
    queryKey: ["/api/orders/paginated", salesPage, salesPageSize, salesParamsString],
    queryFn: async () => {
      const params = new URLSearchParams(salesParamsString);
      params.set("page", salesPage.toString());
      params.set("limit", salesPageSize.toString());
      const response = await fetch(`/api/orders/paginated?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch sales");
      return response.json();
    },
  });

  const sales = salesData?.orders || [];
  const salesTotal = salesData?.total || 0;

  // Fetch sales stats (same filters as list so cards reflect filtered totals from backend)
  const { data: salesStats } = useQuery<{
    totalSales: number;
    totalRevenue: number;
    totalDue: number;
    totalPaid: number;
    averageOrderValue: number;
  }>({
    queryKey: ["/api/sales/stats", salesParamsString],
    queryFn: async () => {
      const response = await fetch(`/api/sales/stats?${salesParamsString}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch sales stats");
      return response.json();
    },
  });

  // Order items are now fetched by backend when productSearch is used
  // No need to fetch all order items client-side anymore

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: addSaleOpen,
  });

  // Get date range for sales summary - memoize to prevent infinite re-renders
  const summaryDateRange = useMemo(() => {
    const now = new Date();
    let start = new Date(0);
    let end = now;
    const currentYear = now.getFullYear();

    if (summaryDateFilter === "today") {
      start = startOfDay(now);
      end = endOfDay(now);
    } else if (summaryDateFilter === "yesterday") {
      const yesterday = subDays(now, 1);
      start = startOfDay(yesterday);
      end = endOfDay(yesterday);
    } else if (summaryDateFilter === "thisMonth") {
      start = new Date(currentYear, now.getMonth(), 1);
      end = new Date(currentYear, now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (summaryDateFilter === "lastMonth") {
      start = new Date(currentYear, now.getMonth() - 1, 1);
      end = new Date(currentYear, now.getMonth(), 0, 23, 59, 59, 999);
    } else if (summaryDateFilter === "january") {
      start = new Date(currentYear, 0, 1);
      end = new Date(currentYear, 1, 0, 23, 59, 59, 999);
    } else if (summaryDateFilter === "february") {
      start = new Date(currentYear, 1, 1);
      end = new Date(currentYear, 2, 0, 23, 59, 59, 999);
    } else if (summaryDateFilter === "march") {
      start = new Date(currentYear, 2, 1);
      end = new Date(currentYear, 3, 0, 23, 59, 59, 999);
    } else if (summaryDateFilter === "april") {
      start = new Date(currentYear, 3, 1);
      end = new Date(currentYear, 4, 0, 23, 59, 59, 999);
    } else if (summaryDateFilter === "may") {
      start = new Date(currentYear, 4, 1);
      end = new Date(currentYear, 5, 0, 23, 59, 59, 999);
    } else if (summaryDateFilter === "june") {
      start = new Date(currentYear, 5, 1);
      end = new Date(currentYear, 6, 0, 23, 59, 59, 999);
    } else if (summaryDateFilter === "july") {
      start = new Date(currentYear, 6, 1);
      end = new Date(currentYear, 7, 0, 23, 59, 59, 999);
    } else if (summaryDateFilter === "august") {
      start = new Date(currentYear, 7, 1);
      end = new Date(currentYear, 8, 0, 23, 59, 59, 999);
    } else if (summaryDateFilter === "september") {
      start = new Date(currentYear, 8, 1);
      end = new Date(currentYear, 9, 0, 23, 59, 59, 999);
    } else if (summaryDateFilter === "october") {
      start = new Date(currentYear, 9, 1);
      end = new Date(currentYear, 10, 0, 23, 59, 59, 999);
    } else if (summaryDateFilter === "november") {
      start = new Date(currentYear, 10, 1);
      end = new Date(currentYear, 11, 0, 23, 59, 59, 999);
    } else if (summaryDateFilter === "december") {
      start = new Date(currentYear, 11, 1);
      end = new Date(currentYear, 12, 0, 23, 59, 59, 999);
    } else if (summaryDateFilter === "custom" && summaryStartDate && summaryEndDate) {
      start = startOfDay(summaryStartDate);
      end = endOfDay(summaryEndDate);
    }

    return { start: start.toISOString(), end: end.toISOString() };
  }, [summaryDateFilter, summaryStartDate, summaryEndDate]);

  // Reset to page 1 when summary filters change
  useEffect(() => {
    setSummaryPage(1);
  }, [summaryDateFilter, summaryStartDate, summaryEndDate, debouncedProductSearchTerm, selectedBranchId]);

  // Fetch paginated sales summary with backend filtering
  const { data: salesSummaryData, isLoading: isSummaryLoading } = useQuery<{ items: SalesSummaryItem[]; total: number }>({
    queryKey: [
      "/api/sales/summary/paginated",
      {
        branchId: selectedBranchId,
        startDate: summaryDateRange.start,
        endDate: summaryDateRange.end,
        page: summaryPage,
        limit: summaryPageSize,
        search: debouncedProductSearchTerm,
      }
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: summaryDateRange.start,
        endDate: summaryDateRange.end,
        page: summaryPage.toString(),
        limit: summaryPageSize.toString(),
        ...(selectedBranchId && { branchId: selectedBranchId }),
        ...(debouncedProductSearchTerm && { search: debouncedProductSearchTerm }),
      });
      const url = `/api/sales/summary/paginated?${params}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }
      return res.json();
    },
  });

  const salesSummary = salesSummaryData?.items || [];
  const summaryTotal = salesSummaryData?.total || 0;

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Order> }) => {
      return apiRequest("PATCH", `/api/orders/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Success",
        description: "Sale updated successfully",
      });
      setEditSale(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update sale",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Success",
        description: "Sale deleted successfully",
      });
      setDeleteSaleId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete sale",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return Promise.all(ids.map(id => apiRequest("DELETE", `/api/orders/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Success",
        description: `${selectedSales.size} sale(s) deleted successfully`,
      });
      setSelectedSales(new Set());
      setShowBulkDeleteDialog(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete selected sales",
        variant: "destructive",
      });
    },
  });

  const createSaleMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/orders", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Success",
        description: "Sale created successfully",
      });
      setAddSaleOpen(false);
      // Reset form
      setNewSaleItems([]);
      setNewSaleCustomerName("");
      setNewSaleCustomerPhone("");
      setNewSaleDiningOption("dine-in");
      setNewSalePaymentMethod("cash");
      setNewSalePaymentStatus("paid");
      setNewSaleDiscount("0");
      setNewSaleDiscountType('amount');
      setSelectedProductId("");
      setSelectedProductQuantity("1");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create sale",
        variant: "destructive",
      });
    },
  });

  const toggleSelectAll = () => {
    if (selectedSales.size === filteredSales.length) {
      setSelectedSales(new Set());
    } else {
      setSelectedSales(new Set(filteredSales.map(sale => sale.id)));
    }
  };

  const toggleSelectSale = (id: string) => {
    const newSelected = new Set(selectedSales);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSales(newSelected);
  };

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedSales));
  };

  // Fetch order items when viewing or editing a sale
  useEffect(() => {
    const fetchOrderItems = async (orderId: string) => {
      try {
        const response = await fetch(`/api/orders/${orderId}/items`);
        if (!response.ok) throw new Error("Failed to fetch order items");
        const data = await response.json();
        setOrderItems(data);
      } catch (error) {
        console.error("Error fetching order items:", error);
        setOrderItems([]);
      }
    };

    if (viewSale) {
      fetchOrderItems(viewSale.id);
    } else if (editSale) {
      fetchOrderItems(editSale.id);
      // Load existing payment splits if any; otherwise derive one from paymentMethod so "Pay by" is editable
      if (editSale.paymentSplits) {
        try {
          const splits = JSON.parse(editSale.paymentSplits);
          setPaymentSplits(splits);
        } catch {
          setPaymentSplits([]);
        }
      } else if (editSale.paymentMethod && editSale.paymentMethod !== "split") {
        // Single payment method stored without splits: show as one editable split
        const method = (editSale.paymentMethod || "").toLowerCase().replace(/\s+/g, "_");
        const validMethods = ["aba", "acleda", "cash", "due", "card", "cash_aba", "cash_acleda"];
        const normalizedMethod = validMethods.includes(method) ? method : "cash";
        const amount = parseFloat(editSale.total) || 0;
        setPaymentSplits(amount > 0 ? [{ method: normalizedMethod, amount }] : []);
      } else {
        setPaymentSplits([]);
      }
    } else {
      setOrderItems([]);
      setPaymentSplits([]);
    }
  }, [viewSale, editSale]);

  const handlePrint = async (sale: Order, template?: ReceiptTemplate) => {
    try {
      // Fetch settings for receipt customization
      const settingsResponse = await fetch("/api/settings");
      const settings = settingsResponse.ok ? await settingsResponse.json() : null;

      // Validate company details are configured
      if (!settings || !settings.businessName || !settings.address) {
        toast({
          title: "Company Details Not Configured",
          description: "Please configure Company Name and Address in Settings > Receipt before printing receipts.",
          variant: "destructive",
          duration: 5000,
        });
        return;
      }

      // Fetch order items
      const response = await fetch(`/api/orders/${sale.id}/items`);
      if (!response.ok) throw new Error("Failed to fetch order items");
      const items: OrderItemWithProduct[] = await response.json();

      // Use provided template or default to classic
      const templateToUse = template || selectedTemplate;

      // Calculate total in KHR
      const totalUSD = parseFloat(sale.total);
      const totalKHRNum = totalUSD * 4100;
      const totalKHR = totalKHRNum.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

      // Parse payment splits if available
      let paymentDetails = `<p><strong>Pay by:</strong> ${sale.paymentMethod || "N/A"}</p>`;
      if (sale.paymentSplits) {
        try {
          const splits: PaymentSplit[] = JSON.parse(sale.paymentSplits);
          if (splits.length > 0) {
            const splitsHtml = splits.map(split => {
              const methodLabel = getPaymentMethodLabel(split.method);
              const amountKHR = (split.amount * 4100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
              return `
                <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <span>${methodLabel}:</span>
                  <span><strong>$${split.amount.toFixed(2)}</strong> (៛${amountKHR})</span>
                </div>
              `;
            }).join('');
            paymentDetails = `
              <div style="margin-top: 10px;">
                <p style="margin-bottom: 10px;"><strong>Payment Split:</strong></p>
                <div style="border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px; background-color: #f9fafb;">
                  ${splitsHtml}
                </div>
              </div>
            `;
          }
        } catch (error) {
          console.error("Failed to parse payment splits:", error);
        }
      }

      // Generate receipt HTML using template
      const receiptData = {
        sale,
        items: items.map(item => ({
          id: item.id,
          orderId: item.orderId,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
          productName: item.productName,
        })),
        settings,
        totalKHR: totalKHRNum,
        paymentDetails,
      };

      const content = generateReceiptHTML(templateToUse, receiptData);

      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast({
          title: "Error",
          description: "Please allow popups to print receipts",
          variant: "destructive",
        });
        return;
      }

      printWindow.document.write(content);
      printWindow.document.close();
      
      // Wait for content to load before printing
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch (error) {
      console.error("Error printing receipt:", error);
      toast({
        title: "Error",
        description: "Failed to print receipt",
        variant: "destructive",
      });
    }
  };

  const handlePrintClick = (sale: Order) => {
    // Show template selection dialog
    setPrintSale(sale);
  };

  const handleConfirmPrint = () => {
    if (printSale) {
      handlePrint(printSale, selectedTemplate);
      setPrintSale(null);
    }
  };

  const addPaymentSplit = () => {
    if (!newPaymentAmount || parseFloat(newPaymentAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(newPaymentAmount);
    const totalPaid = paymentSplits.reduce((sum, split) => sum + split.amount, 0);
    const orderTotal = editSale ? parseFloat(editSale.total) : 0;

    if (totalPaid + amount > orderTotal) {
      toast({
        title: "Amount Exceeds Total",
        description: `Payment amount cannot exceed order total of $${orderTotal.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    setPaymentSplits([...paymentSplits, { method: newPaymentMethod, amount }]);
    setNewPaymentAmount("");
    setNewPaymentMethod("cash");
  };

  const removePaymentSplit = (index: number) => {
    setPaymentSplits(paymentSplits.filter((_, i) => i !== index));
  };

  const updatePaymentSplitMethod = (index: number, method: string) => {
    setPaymentSplits(prev => prev.map((s, i) => i === index ? { ...s, method } : s));
  };

  const updatePaymentSplitAmount = (index: number, amount: number) => {
    setPaymentSplits(prev => prev.map((s, i) => i === index ? { ...s, amount } : s));
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      "aba": "ABA",
      "acleda": "Acleda",
      "cash": "Cash",
      "due": "Due",
      "card": "Card",
      "cash_aba": "Cash And ABA",
      "cash_acleda": "Cash And Acleda",
    };
    return labels[method] || method;
  };

  const handleUpdate = () => {
    if (!editSale) return;

    // Generate primary payment method from splits
    let primaryPaymentMethod = editSale.paymentMethod;
    if (paymentSplits.length > 0) {
      // Create a summary of payment methods used
      const methods = paymentSplits.map(s => getPaymentMethodLabel(s.method));
      primaryPaymentMethod = methods.length === 1 ? paymentSplits[0].method : "split";
    }

    const subtotalNum = parseFloat(editSale.subtotal) || 0;
    const discountNum = parseFloat(editSale.discount) || 0;
    const discountType = (editSale.discountType as "amount" | "percentage") || "amount";
    const discountAmount = discountType === "percentage" ? (subtotalNum * discountNum) / 100 : discountNum;
    const newTotal = Math.max(0, subtotalNum - discountAmount);

    const updateData: any = {
      customerName: editSale.customerName,
      paymentStatus: editSale.paymentStatus,
      paymentMethod: primaryPaymentMethod,
      paymentSplits: paymentSplits.length > 0 ? JSON.stringify(paymentSplits) : null,
      status: editSale.status,
      discount: String(discountNum),
      discountType: editSale.discountType || "amount",
      total: newTotal.toFixed(2),
    };

    // Add createdAt if it was modified
    if (editSale.createdAt) {
      const createdAtValue = typeof editSale.createdAt === 'string' 
        ? editSale.createdAt 
        : new Date(editSale.createdAt).toISOString();
      updateData.createdAt = createdAtValue;
    }

    updateMutation.mutate({
      id: editSale.id,
      data: updateData,
    });
  };

  const handleDelete = () => {
    if (!deleteSaleId) return;
    deleteMutation.mutate(deleteSaleId);
  };

  const getPaymentStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return colors[status] || colors.pending;
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const response = await fetch(`/api/orders/export?${getSalesQueryParams}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch export data");
      const { orders: exportOrders } = await response.json();
      const list = exportOrders || [];
      const exportData = list.map((sale: Order) => ({
        "Sale ID": sale.id,
        "Invoice No": `INV-${sale.orderNumber}`,
        "Date & Time": format(new Date(sale.createdAt), "PPpp"),
        "Customer Name": sale.customerName || "Walk-in Customer",
        "Dining Option": sale.diningOption,
        "Subtotal": `$${sale.subtotal}`,
        "Discount Amount": `$${sale.discount}`,
        "Total Amount": `$${sale.total}`,
        "Pay by": sale.paymentMethod || "N/A",
        "Payment Status": sale.paymentStatus,
        "Order Status": sale.status,
      }));
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sales");
      const fileName = `sales_report_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast({ title: "Success", description: `Exported ${list.length} sales to Excel` });
    } catch (e) {
      toast({ title: "Export Failed", description: e instanceof Error ? e.message : "Failed to export", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = async () => {
    setExporting(true);
    try {
      const response = await fetch(`/api/orders/export?${getSalesQueryParams}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch export data");
      const { orders: exportOrders } = await response.json();
      const list = exportOrders || [];
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("Sales Report", 14, 22);
      doc.setFontSize(11);
      doc.text(`Generated: ${format(new Date(), "PPpp")} (${list.length} records)`, 14, 32);
      const tableData = list.map((sale: Order) => [
        sale.id,
        `INV-${sale.orderNumber}`,
        format(new Date(sale.createdAt), "PPpp"),
        sale.customerName || "Walk-in Customer",
        `$${sale.discount}`,
        `$${sale.total}`,
        sale.paymentMethod || "N/A",
        sale.paymentStatus,
      ]);
      autoTable(doc, {
        startY: 40,
        head: [["Sale ID", "Invoice No", "Date & Time", "Customer", "Discount", "Total", "Pay by", "Payment"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [234, 88, 12] },
      });
      doc.save(`sales_report_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast({ title: "Success", description: `Exported ${list.length} sales to PDF` });
    } catch (e) {
      toast({ title: "Export Failed", description: e instanceof Error ? e.message : "Failed to export", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadSample = () => {
    const sampleData = [
      ["Invoice No", "Date & Time", "Customer Name", "Customer Phone", "Subtotal", "Discount", "Total", "Payment Method", "Payment Status", "Order Status", "Dining Option"],
      ["INV-001", "2025-11-07 10:00:00", "John Doe", "012345678", "100.00", "0.00", "100.00", "cash", "paid", "completed", "dine-in"],
      ["INV-002", "2025-11-07 11:30:00", "Jane Smith", "098765432", "250.50", "10.00", "240.50", "card", "paid", "completed", "takeaway"],
      ["INV-003", "2025-11-07 14:15:00", "Walk-in Customer", "", "75.25", "5.00", "70.25", "aba", "paid", "completed", "dine-in"],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales");

    const fileName = `sales_import_sample.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({
      title: "Success",
      description: "Sample file downloaded successfully",
    });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const isCSV = file.name.endsWith('.csv');

    if (!isExcel && !isCSV) {
      toast({
        title: "Invalid file",
        description: "Please upload a CSV or Excel file (.csv, .xlsx, .xls)",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        let rows: any[][] = [];
        
        if (isExcel) {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true, raw: false });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false }) as any[][];
          rows = jsonData.slice(1); // Skip header row
        } else {
          const text = event.target?.result as string;
          const lines = text.split('\n').slice(1); // Skip header row
          rows = lines.map(line => {
            if (!line.trim()) return [];
            // Simple CSV parsing - handle quoted fields
            const fields: string[] = [];
            let currentField = '';
            let insideQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              const nextChar = line[i + 1];
              
              if (char === '"') {
                if (insideQuotes && nextChar === '"') {
                  currentField += '"';
                  i++; // Skip next quote
                } else {
                  insideQuotes = !insideQuotes;
                }
              } else if (char === ',' && !insideQuotes) {
                fields.push(currentField.trim());
                currentField = '';
              } else {
                currentField += char;
              }
            }
            fields.push(currentField.trim());
            return fields;
          }).filter(row => row.length > 0);
        }

        // Prepare data for API
        const salesData = rows.map((row, index) => {
          try {
            // Expected columns: Invoice No, Date & Time, Customer Name, Customer Phone, Subtotal, Discount, Total, Payment Method, Payment Status, Order Status, Dining Option
            const invoiceNo = row[0]?.toString().trim() || '';
            const dateTime = row[1]?.toString().trim() || new Date().toISOString();
            const customerName = row[2]?.toString().trim() || 'Walk-in Customer';
            const customerPhone = row[3]?.toString().trim() || '';
            const subtotal = parseFloat(row[4]?.toString().replace(/[^0-9.-]/g, '') || '0');
            const discount = parseFloat(row[5]?.toString().replace(/[^0-9.-]/g, '') || '0');
            const total = parseFloat(row[6]?.toString().replace(/[^0-9.-]/g, '') || '0');
            const paymentMethod = row[7]?.toString().trim().toLowerCase() || 'cash';
            const paymentStatus = row[8]?.toString().trim().toLowerCase() || 'paid';
            const orderStatus = row[9]?.toString().trim().toLowerCase() || 'completed';
            const diningOption = row[10]?.toString().trim().toLowerCase() || 'dine-in';

            // Parse date - try multiple formats
            let parsedDate = new Date();
            if (dateTime) {
              const dateStr = dateTime.toString();
              // Try ISO format first
              parsedDate = new Date(dateStr);
              // If invalid, try common formats
              if (isNaN(parsedDate.getTime())) {
                parsedDate = new Date(dateStr.replace(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/, '$1-$2-$3T$4:$5:$6'));
              }
              if (isNaN(parsedDate.getTime())) {
                parsedDate = new Date(); // Fallback to current date
              }
            }

            return {
              orderNumber: invoiceNo.replace(/^INV-?/i, ''), // Remove INV- prefix if present
              createdAt: parsedDate.toISOString(),
              customerName,
              customerPhone: customerPhone || null,
              subtotal: subtotal.toString(),
              discount: discount.toString(),
              total: total.toString(),
              paymentMethod,
              paymentStatus,
              status: orderStatus,
              diningOption,
            };
          } catch (error) {
            console.error(`Error parsing row ${index + 2}:`, error);
            return null;
          }
        }).filter(sale => sale !== null);

        if (salesData.length === 0) {
          toast({
            title: "No valid data",
            description: "No valid sales records found in the file",
            variant: "destructive",
          });
          return;
        }

        // Send to API
        const response = await apiRequest("POST", "/api/sales/import", { sales: salesData });
        
        toast({
          title: "Success",
          description: `Successfully imported ${salesData.length} sales record(s)`,
        });

        // Refresh sales list
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      } catch (error: any) {
        console.error("Import error:", error);
        toast({
          title: "Import failed",
          description: error.message || "Failed to import sales data",
          variant: "destructive",
        });
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }

    // Reset input
    e.target.value = '';
  };

  // Backend handles all filtering, use sales directly (includes due-management orders)
  const filteredSales = sales;

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-sales-title">Sales Management</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Manage sales activities and records</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {hasPermission("sales.create") && (
              <Button
                onClick={() => setAddSaleOpen(true)}
                data-testid="button-add-sales"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Sales
              </Button>
            )}
            <input
              type="file"
              id="import-sales-file"
              accept=".csv,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleImport}
              data-testid="input-import-sales-file"
            />
            <Button
              variant="outline"
              onClick={() => document.getElementById('import-sales-file')?.click()}
              data-testid="button-import-sales"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import Sales
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadSample}
              data-testid="button-download-sample"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Download Sample
            </Button>
            {hasPermission("reports.export") && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button data-testid="button-export" disabled={exporting}>
                    <Download className="w-4 h-4 mr-2" />
                    {exporting ? "Exporting…" : "Export"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportToExcel} data-testid="button-export-excel">
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export to Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToPDF} data-testid="button-export-pdf">
                    <FileText className="w-4 h-4 mr-2" />
                    Export to PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{salesStats?.totalSales || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(salesStats?.totalRevenue || 0).toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Due</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(salesStats?.totalDue || 0).toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(salesStats?.totalPaid || 0).toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Average Order</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${(salesStats?.averageOrderValue || 0).toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="detailed" data-testid="tab-detailed-sales">Detailed Sales Report</TabsTrigger>
            <TabsTrigger value="summary" data-testid="tab-sales-summary">Sales Summary Report</TabsTrigger>
          </TabsList>

          <TabsContent value="detailed" className="space-y-4">
            <Card>
          <CardHeader>
            <CardTitle>Sales List</CardTitle>
            <CardDescription>Comprehensive list of all sales transactions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by invoice number, customer name, sale ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-sales"
                />
              </div>
              
              {selectedSales.size > 0 && hasPermission("sales.delete") && (
                <Button
                  variant="destructive"
                  onClick={() => setShowBulkDeleteDialog(true)}
                  data-testid="button-bulk-delete"
                >
                  <Trash className="w-4 h-4 mr-2" />
                  Delete Selected ({selectedSales.size})
                </Button>
              )}
              
              <div className="flex flex-wrap gap-2">
                <Select value={dateFilter} onValueChange={(value: DateFilterType) => setDateFilter(value)}>
                  <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-date-filter">
                    <SelectValue placeholder="Filter by date" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Dates</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="thisMonth">This Month</SelectItem>
                    <SelectItem value="lastMonth">Last Month</SelectItem>
                    <SelectItem value="january">January</SelectItem>
                    <SelectItem value="february">February</SelectItem>
                    <SelectItem value="march">March</SelectItem>
                    <SelectItem value="april">April</SelectItem>
                    <SelectItem value="may">May</SelectItem>
                    <SelectItem value="june">June</SelectItem>
                    <SelectItem value="july">July</SelectItem>
                    <SelectItem value="august">August</SelectItem>
                    <SelectItem value="september">September</SelectItem>
                    <SelectItem value="october">October</SelectItem>
                    <SelectItem value="november">November</SelectItem>
                    <SelectItem value="december">December</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>

                {dateFilter === "custom" && (
                  <>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full sm:w-[160px] justify-start" data-testid="button-start-date">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "PPP") : "Start Date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full sm:w-[160px] justify-start" data-testid="button-end-date">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "PPP") : "End Date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </>
                )}
              </div>
            </div>

            {/* Advanced Filters */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  <Label className="text-base font-semibold">Advanced Filters</Label>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPaymentMethodFilter("all");
                    setPaymentStatusFilter("all");
                    setOrderItemSearch("");
                    setSearchTerm("");
                    setDateFilter("all");
                    setStartDate(undefined);
                    setEndDate(undefined);
                    setSelectedMonths([]);
                  }}
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear All
                </Button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Payment Method Filter */}
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Methods" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="aba">ABA Bank</SelectItem>
                      <SelectItem value="acleda">Acleda Bank</SelectItem>
                      <SelectItem value="wing">Wing Bank</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                      <SelectItem value="due">Due</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment Status Filter */}
                <div className="space-y-2">
                  <Label>Payment Status</Label>
                  <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="due">Due</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Months (multi-select) */}
                <div className="space-y-2">
                  <Label>Months</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        {selectedMonths.length === 0
                          ? "All months"
                          : selectedMonths.length <= 2
                            ? selectedMonths.map((m) => {
                                const [y, mo] = m.split("-").map(Number);
                                return format(new Date(y, mo - 1, 1), "MMM yyyy");
                              }).join(", ")
                            : `${selectedMonths.length} months selected`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <div className="max-h-[300px] overflow-y-auto p-2">
                        {Array.from({ length: 24 }, (_, i) => {
                          const d = new Date();
                          d.setMonth(d.getMonth() - (23 - i));
                          const y = d.getFullYear();
                          const mo = String(d.getMonth() + 1).padStart(2, "0");
                          const value = `${y}-${mo}`;
                          const label = format(d, "MMMM yyyy");
                          const checked = selectedMonths.includes(value);
                          return (
                            <div
                              key={value}
                              className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer"
                              onClick={() => setSelectedMonths((prev) => (checked ? prev.filter((x) => x !== value) : [...prev, value].sort()))}
                            >
                              <Checkbox checked={checked} onCheckedChange={() => {}} />
                              <span className="text-sm">{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Order Items Filter (Optional) */}
              <div className="space-y-2">
                <Label>Search by Product/Item (Optional)</Label>
                <Input
                  placeholder="Enter product name to filter sales..."
                  value={orderItemSearch}
                  onChange={(e) => setOrderItemSearch(e.target.value)}
                  className="max-w-md"
                />
                {orderItemSearch && (
                  <p className="text-xs text-muted-foreground">
                    Searching for products in order items...
                  </p>
                )}
              </div>
            </div>

            {isLoading ? (
              <p className="text-muted-foreground">Loading sales...</p>
            ) : filteredSales.length === 0 ? (
              <p className="text-muted-foreground">No sales found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {hasPermission("sales.delete") && (
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedSales.size === filteredSales.length && filteredSales.length > 0}
                            onCheckedChange={toggleSelectAll}
                            data-testid="checkbox-select-all"
                          />
                        </TableHead>
                      )}
                      <TableHead data-testid="header-sale-id" className="hidden lg:table-cell">Sale ID</TableHead>
                      <TableHead data-testid="header-invoice-no">Invoice No</TableHead>
                      <TableHead data-testid="header-date-time" className="hidden md:table-cell">Date & Time</TableHead>
                      <TableHead data-testid="header-customer-name">Customer Name</TableHead>
                      <TableHead data-testid="header-discount-amount" className="hidden lg:table-cell">Discount</TableHead>
                      <TableHead data-testid="header-total-amount">Total Amount</TableHead>
                      <TableHead data-testid="header-pay-by" className="hidden sm:table-cell">Pay by</TableHead>
                      <TableHead data-testid="header-payment-status" className="hidden md:table-cell">Payment Status</TableHead>
                      <TableHead data-testid="header-actions">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map((sale) => (
                      <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`}>
                        {hasPermission("sales.delete") && (
                          <TableCell>
                            <Checkbox
                              checked={selectedSales.has(sale.id)}
                              onCheckedChange={() => toggleSelectSale(sale.id)}
                              data-testid={`checkbox-select-${sale.id}`}
                            />
                          </TableCell>
                        )}
                        <TableCell className="hidden lg:table-cell" data-testid={`text-sale-id-${sale.id}`}>{sale.id}</TableCell>
                        <TableCell data-testid={`text-invoice-no-${sale.id}`}>INV-{sale.orderNumber}</TableCell>
                        <TableCell className="hidden md:table-cell" data-testid={`text-date-${sale.id}`}>
                          {format(new Date(sale.createdAt), "PPpp")}
                        </TableCell>
                        <TableCell data-testid={`text-customer-${sale.id}`}>
                          {sale.customerName || "Walk-in Customer"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell" data-testid={`text-discount-${sale.id}`}>
                        {(sale.discountType as string) === "percentage"
                          ? `${sale.discount}%`
                          : `$${parseFloat(sale.discount || "0").toFixed(2)}`}
                      </TableCell>
                        <TableCell data-testid={`text-total-${sale.id}`}>${sale.total}</TableCell>
                        <TableCell className="hidden sm:table-cell" data-testid={`text-pay-by-${sale.id}`}>
                          {sale.paymentSplits ? (() => {
                            try {
                              const splits: { method: string; amount: number }[] = JSON.parse(sale.paymentSplits);
                              if (splits.length > 0) {
                                const paymentMethodLabels: Record<string, string> = {
                                  cash: "Cash",
                                  card: "Card",
                                  aba: "ABA",
                                  acleda: "Acleda",
                                  due: "Due",
                                  cash_aba: "Cash And ABA",
                                  cash_acleda: "Cash And Acleda",
                                };
                                return (
                                  <div className="flex flex-col gap-1">
                                    {splits.map((split, index) => (
                                      <div key={index} className="text-xs">
                                        <span className="font-medium">{paymentMethodLabels[split.method] || split.method}:</span>
                                        <span className="ml-1">${split.amount.toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                            } catch (error) {
                              console.error("Failed to parse payment splits:", error);
                            }
                            return <span className="capitalize">{sale.paymentMethod || "N/A"}</span>;
                          })() : <span className="capitalize">{sale.paymentMethod || "N/A"}</span>}
                        </TableCell>
                        <TableCell className="hidden md:table-cell" data-testid={`text-payment-status-${sale.id}`}>
                          <span
                            className={`px-2 py-1 rounded-md text-xs font-medium ${getPaymentStatusBadge(
                              sale.paymentStatus
                            )}`}
                          >
                            {sale.paymentStatus}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {hasPermission("sales.view") && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setViewSale(sale)}
                                    data-testid={`button-view-${sale.id}`}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>View Details</TooltipContent>
                              </Tooltip>
                            )}

                            {hasPermission("sales.edit") && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setEditSale(sale)}
                                    data-testid={`button-edit-${sale.id}`}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit Sale</TooltipContent>
                              </Tooltip>
                            )}

                            {hasPermission("sales.print") && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handlePrintClick(sale)}
                                    data-testid={`button-print-${sale.id}`}
                                  >
                                    <Printer className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Print Receipt</TooltipContent>
                              </Tooltip>
                            )}

                            {hasPermission("sales.delete") && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => setDeleteSaleId(sale.id)}
                                    data-testid={`button-delete-${sale.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete Sale</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            
            {/* Pagination */}
            {salesTotal > 0 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((salesPage - 1) * salesPageSize) + 1} to {Math.min(salesPage * salesPageSize, salesTotal)} of {salesTotal} sales
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Per page:</span>
                    <Select
                      value={salesPageSize.toString()}
                      onValueChange={(value) => {
                        setSalesPageSize(parseInt(value, 10));
                        setSalesPage(1); // Reset to first page when changing page size
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
                {salesTotal > salesPageSize && (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (salesPage > 1) setSalesPage(salesPage - 1);
                          }}
                          className={salesPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {Array.from({ length: Math.ceil(salesTotal / salesPageSize) }, (_, i) => i + 1)
                        .filter(page => {
                          // Show first page, last page, current page, and pages around current
                          return page === 1 || 
                                 page === Math.ceil(salesTotal / salesPageSize) ||
                                 (page >= salesPage - 1 && page <= salesPage + 1);
                        })
                        .map((page, index, array) => {
                          // Add ellipsis if there's a gap
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
                                    setSalesPage(page);
                                  }}
                                  isActive={salesPage === page}
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
                            if (salesPage < Math.ceil(salesTotal / salesPageSize)) {
                              setSalesPage(salesPage + 1);
                            }
                          }}
                          className={salesPage >= Math.ceil(salesTotal / salesPageSize) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="summary" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sales Summary Report</CardTitle>
                <CardDescription>Individual item sales summary</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Select value={summaryDateFilter} onValueChange={(value: DateFilterType) => setSummaryDateFilter(value)}>
                      <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-summary-date-filter">
                        <SelectValue placeholder="Filter by date" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="yesterday">Yesterday</SelectItem>
                        <SelectItem value="thisMonth">This Month</SelectItem>
                        <SelectItem value="lastMonth">Last Month</SelectItem>
                        <SelectItem value="january">January</SelectItem>
                        <SelectItem value="february">February</SelectItem>
                        <SelectItem value="march">March</SelectItem>
                        <SelectItem value="april">April</SelectItem>
                        <SelectItem value="may">May</SelectItem>
                        <SelectItem value="june">June</SelectItem>
                        <SelectItem value="july">July</SelectItem>
                        <SelectItem value="august">August</SelectItem>
                        <SelectItem value="september">September</SelectItem>
                        <SelectItem value="october">October</SelectItem>
                        <SelectItem value="november">November</SelectItem>
                        <SelectItem value="december">December</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>

                    {summaryDateFilter === "custom" && (
                      <>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full sm:w-[160px] justify-start" data-testid="button-summary-start-date">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {summaryStartDate ? format(summaryStartDate, "PPP") : "Start Date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={summaryStartDate}
                              onSelect={setSummaryStartDate}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>

                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full sm:w-[160px] justify-start" data-testid="button-summary-end-date">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {summaryEndDate ? format(summaryEndDate, "PPP") : "End Date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarComponent
                              mode="single"
                              selected={summaryEndDate}
                              onSelect={setSummaryEndDate}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </>
                    )}
                  </div>
                  
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by product name..."
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-product-search"
                    />
                  </div>
                </div>

                {isSummaryLoading ? (
                  <p className="text-muted-foreground">Loading sales summary...</p>
                ) : salesSummary.length === 0 ? (
                  <p className="text-muted-foreground">
                    {debouncedProductSearchTerm 
                      ? `No products found matching "${debouncedProductSearchTerm}"`
                      : "No sales data available for the selected period"}
                  </p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead data-testid="header-product-name">Product Name</TableHead>
                            <TableHead data-testid="header-quantity-sold">Quantity Sold</TableHead>
                            <TableHead data-testid="header-total-revenue">Total Revenue</TableHead>
                            <TableHead data-testid="header-actions">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {salesSummary.map((item, index) => (
                            <TableRow key={index} data-testid={`row-summary-${index}`}>
                              <TableCell data-testid={`text-product-${index}`} className="font-medium">{item.product}</TableCell>
                              <TableCell data-testid={`text-quantity-${index}`}>{item.quantity}</TableCell>
                              <TableCell data-testid={`text-revenue-${index}`}>${item.revenue.toFixed(2)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => {
                                          // Filter detailed report by product name
                                          setActiveTab("detailed");
                                          setOrderItemSearch(item.product);
                                        }}
                                        data-testid={`button-view-summary-${index}`}
                                      >
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>View Sales</TooltipContent>
                                  </Tooltip>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    
                    {/* Pagination for Summary */}
                    {summaryTotal > 0 && (
                      <div className="flex items-center justify-between pt-4 border-t">
                        <div className="flex items-center gap-4">
                          <div className="text-sm text-muted-foreground">
                            Showing {((summaryPage - 1) * summaryPageSize) + 1} to {Math.min(summaryPage * summaryPageSize, summaryTotal)} of {summaryTotal} products
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Per page:</span>
                            <Select
                              value={summaryPageSize.toString()}
                              onValueChange={(value) => {
                                setSummaryPageSize(parseInt(value, 10));
                                setSummaryPage(1); // Reset to first page when changing page size
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
                        {summaryTotal > summaryPageSize && (
                          <Pagination>
                            <PaginationContent>
                              <PaginationItem>
                                <PaginationPrevious 
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    if (summaryPage > 1) setSummaryPage(summaryPage - 1);
                                  }}
                                  className={summaryPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                />
                              </PaginationItem>
                              {Array.from({ length: Math.ceil(summaryTotal / summaryPageSize) }, (_, i) => i + 1)
                                .filter(page => {
                                  // Show first page, last page, current page, and pages around current
                                  return page === 1 || 
                                         page === Math.ceil(summaryTotal / summaryPageSize) ||
                                         (page >= summaryPage - 1 && page <= summaryPage + 1);
                                })
                                .map((page, index, array) => {
                                  // Add ellipsis if there's a gap
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
                                            setSummaryPage(page);
                                          }}
                                          isActive={summaryPage === page}
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
                                    if (summaryPage < Math.ceil(summaryTotal / summaryPageSize)) {
                                      setSummaryPage(summaryPage + 1);
                                    }
                                  }}
                                  className={summaryPage >= Math.ceil(summaryTotal / summaryPageSize) ? "pointer-events-none opacity-50" : "cursor-pointer"}
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

      {/* View Dialog */}
      <Dialog open={!!viewSale} onOpenChange={() => setViewSale(null)}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-view-sale">
          <DialogHeader>
            <DialogTitle>Sale Details</DialogTitle>
            <DialogDescription>View complete sale information</DialogDescription>
          </DialogHeader>
          {viewSale && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Sale ID</Label>
                  <p className="font-medium" data-testid="view-sale-id">{viewSale.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Invoice No</Label>
                  <p className="font-medium" data-testid="view-invoice-no">INV-{viewSale.orderNumber}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date & Time</Label>
                  <p className="font-medium" data-testid="view-date">
                    {format(new Date(viewSale.createdAt), "PPpp")}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Customer Name</Label>
                  <p className="font-medium" data-testid="view-customer">
                    {viewSale.customerName || "Walk-in Customer"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Dining Option</Label>
                  <p className="font-medium" data-testid="view-dining-option">{viewSale.diningOption}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payment Method</Label>
                  {viewSale.paymentSplits ? (() => {
                    try {
                      const splits: { method: string; amount: number }[] = JSON.parse(viewSale.paymentSplits);
                      if (splits.length > 0) {
                        const paymentMethodLabels: Record<string, string> = {
                          cash: "Cash",
                          card: "Card",
                          aba: "ABA",
                          acleda: "Acleda",
                          due: "Due",
                          cash_aba: "Cash And ABA",
                          cash_acleda: "Cash And Acleda",
                        };
                        return (
                          <div className="space-y-1" data-testid="view-pay-by">
                            {splits.map((split, index) => (
                              <div key={index} className="font-medium">
                                <span className="text-muted-foreground">{paymentMethodLabels[split.method] || split.method}:</span>
                                <span className="ml-2">${split.amount.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                    } catch (error) {
                      console.error("Failed to parse payment splits:", error);
                    }
                    return <p className="font-medium capitalize" data-testid="view-pay-by">{viewSale.paymentMethod || "N/A"}</p>;
                  })() : <p className="font-medium capitalize" data-testid="view-pay-by">{viewSale.paymentMethod || "N/A"}</p>}
                </div>
              </div>

              {/* Order Items Table */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Order Items</Label>
                {orderItems.length > 0 ? (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product Name</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderItems.map((item) => (
                          <TableRow key={item.id} data-testid={`view-item-${item.id}`}>
                            <TableCell data-testid={`view-item-name-${item.id}`}>{item.productName}</TableCell>
                            <TableCell className="text-right" data-testid={`view-item-qty-${item.id}`}>{item.quantity}</TableCell>
                            <TableCell className="text-right" data-testid={`view-item-price-${item.id}`}>${item.price}</TableCell>
                            <TableCell className="text-right" data-testid={`view-item-total-${item.id}`}>${item.total}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Loading items...</p>
                )}
              </div>

              {/* Order Summary */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <Label className="text-muted-foreground">Customer Name</Label>
                  <p className="font-medium" data-testid="view-summary-customer">
                    {viewSale.customerName || "Walk-in Customer"}
                  </p>
                </div>
                <div className="flex justify-between">
                  <Label className="text-muted-foreground">Subtotal</Label>
                  <p className="font-medium" data-testid="view-subtotal">${viewSale.subtotal}</p>
                </div>
                <div className="flex justify-between">
                  <Label className="text-muted-foreground">Discount</Label>
                  <p className="font-medium" data-testid="view-discount">
                    {(viewSale.discountType as string) === "percentage"
                      ? `${viewSale.discount}%`
                      : `$${parseFloat(viewSale.discount || "0").toFixed(2)}`}
                  </p>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <Label className="text-lg font-semibold">Total</Label>
                  <p className="font-bold text-lg" data-testid="view-total">${viewSale.total}</p>
                </div>
                <div className="flex justify-between">
                  <Label className="text-muted-foreground">Payment Status</Label>
                  <p className="font-medium" data-testid="view-payment-status">
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${getPaymentStatusBadge(viewSale.paymentStatus)}`}>
                      {viewSale.paymentStatus}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewSale(null)} data-testid="button-close-view">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editSale} onOpenChange={() => setEditSale(null)}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-sale">
          <DialogHeader>
            <DialogTitle>Edit Sale</DialogTitle>
            <DialogDescription>Modify sale details</DialogDescription>
          </DialogHeader>
          {editSale && (
            <div className="space-y-6">
              {/* Editable Fields */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="customer-name">Customer Name</Label>
                  <Input
                    id="customer-name"
                    data-testid="input-edit-customer-name"
                    value={editSale.customerName || ""}
                    onChange={(e) =>
                      setEditSale({ ...editSale, customerName: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="sale-date-time">Date & Time</Label>
                  <Input
                    id="sale-date-time"
                    type="datetime-local"
                    data-testid="input-edit-sale-datetime"
                    value={editSale.createdAt 
                      ? (typeof editSale.createdAt === 'string' 
                          ? new Date(editSale.createdAt).toISOString().slice(0, 16)
                          : new Date(editSale.createdAt).toISOString().slice(0, 16))
                      : ""}
                    onChange={(e) => {
                      const newDate = e.target.value ? new Date(e.target.value) : new Date();
                      setEditSale({ ...editSale, createdAt: newDate.toISOString() as any });
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="payment-status">Payment Status</Label>
                  <Select
                    value={editSale.paymentStatus}
                    onValueChange={(value) =>
                      setEditSale({ ...editSale, paymentStatus: value })
                    }
                  >
                    <SelectTrigger data-testid="select-edit-payment-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Order Status</Label>
                  <Select
                    value={editSale.status}
                    onValueChange={(value) =>
                      setEditSale({ ...editSale, status: value })
                    }
                  >
                    <SelectTrigger data-testid="select-edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-discount-type">Discount Type</Label>
                    <Select
                      value={(editSale.discountType as string) || "amount"}
                      onValueChange={(value: "amount" | "percentage") => {
                        setEditSale((prev) => {
                          if (!prev) return prev;
                          const next = { ...prev, discountType: value };
                          const sub = parseFloat(prev.subtotal);
                          const disc = parseFloat(prev.discount || "0") || 0;
                          const amount = value === "percentage" ? (sub * disc) / 100 : disc;
                          next.total = Math.max(0, sub - amount).toFixed(2);
                          return next;
                        });
                      }}
                    >
                      <SelectTrigger id="edit-discount-type" data-testid="select-edit-discount-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="amount">Amount ($)</SelectItem>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="edit-discount">Discount</Label>
                    <Input
                      id="edit-discount"
                      type="number"
                      step="0.01"
                      min="0"
                      data-testid="input-edit-discount"
                      value={editSale.discount ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditSale((prev) => {
                          if (!prev) return prev;
                          const next = { ...prev, discount: val };
                          const sub = parseFloat(prev.subtotal);
                          const disc = parseFloat(val) || 0;
                          const type = (prev.discountType as "amount" | "percentage") || "amount";
                          const amount = type === "percentage" ? (sub * disc) / 100 : disc;
                          next.total = Math.max(0, sub - amount).toFixed(2);
                          return next;
                        });
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Process Payment Section */}
              <div className="border-t pt-4 space-y-4">
                <Label className="text-base font-semibold">Process Payment - Split Payment</Label>
                
                {/* Payment Splits List */}
                {paymentSplits.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Current Payments (editable):</Label>
                    <div className="border rounded-md divide-y">
                      {paymentSplits.map((split, index) => (
                        <div
                          key={index}
                          className="flex flex-wrap items-center gap-2 p-3 bg-muted/30"
                          data-testid={`payment-split-${index}`}
                        >
                          <Select
                            value={split.method}
                            onValueChange={(value) => updatePaymentSplitMethod(index, value)}
                          >
                            <SelectTrigger className="w-[140px] h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="aba">ABA</SelectItem>
                              <SelectItem value="acleda">Acleda</SelectItem>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="due">Due</SelectItem>
                              <SelectItem value="card">Card</SelectItem>
                              <SelectItem value="cash_aba">Cash And ABA</SelectItem>
                              <SelectItem value="cash_acleda">Cash And Acleda</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-28 h-9 font-mono"
                            value={split.amount}
                            onChange={(e) => updatePaymentSplitAmount(index, parseFloat(e.target.value) || 0)}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removePaymentSplit(index)}
                            data-testid={`button-remove-split-${index}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add New Payment */}
                <div className="space-y-3 border rounded-md p-4 bg-muted/10">
                  <Label className="text-sm font-medium">Add Payment Method</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="new-payment-method" className="text-xs text-muted-foreground">
                        Payment Method
                      </Label>
                      <Select
                        value={newPaymentMethod}
                        onValueChange={setNewPaymentMethod}
                      >
                        <SelectTrigger data-testid="select-new-payment-method">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aba">ABA</SelectItem>
                          <SelectItem value="acleda">Acleda</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="due">Due</SelectItem>
                          <SelectItem value="card">Card</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="new-payment-amount" className="text-xs text-muted-foreground">
                        Amount Paid
                      </Label>
                      <Input
                        id="new-payment-amount"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={newPaymentAmount}
                        onChange={(e) => setNewPaymentAmount(e.target.value)}
                        data-testid="input-new-payment-amount"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={addPaymentSplit}
                    className="w-full"
                    variant="outline"
                    data-testid="button-add-payment-split"
                  >
                    Add Payment
                  </Button>
                </div>

                {/* Payment Summary */}
                {editSale && (
                  <div className="border rounded-md p-4 bg-accent/5 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Order Total:</span>
                      <span className="font-semibold">${parseFloat(editSale.total).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Paid:</span>
                      <span className="font-semibold text-green-600">
                        ${paymentSplits.reduce((sum, split) => sum + split.amount, 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="text-muted-foreground font-medium">Remaining:</span>
                      <span className={`font-bold ${
                        (parseFloat(editSale.total) - paymentSplits.reduce((sum, split) => sum + split.amount, 0)) > 0
                          ? "text-orange-600"
                          : "text-green-600"
                      }`}>
                        ${(parseFloat(editSale.total) - paymentSplits.reduce((sum, split) => sum + split.amount, 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Order Items (Read-only) */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Order Items</Label>
                {orderItems.length > 0 ? (
                  <div className="border rounded-md bg-muted/30">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product Name</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderItems.map((item) => (
                          <TableRow key={item.id} data-testid={`edit-item-${item.id}`}>
                            <TableCell data-testid={`edit-item-name-${item.id}`}>{item.productName}</TableCell>
                            <TableCell className="text-right" data-testid={`edit-item-qty-${item.id}`}>{item.quantity}</TableCell>
                            <TableCell className="text-right" data-testid={`edit-item-price-${item.id}`}>${item.price}</TableCell>
                            <TableCell className="text-right" data-testid={`edit-item-total-${item.id}`}>${item.total}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Loading items...</p>
                )}
              </div>

              {/* Order Summary (Read-only) */}
              <div className="border-t pt-4 space-y-2 bg-muted/20 p-4 rounded-md">
                <div className="flex justify-between">
                  <Label className="text-muted-foreground">Customer Name</Label>
                  <p className="font-medium" data-testid="edit-summary-customer">
                    {editSale.customerName || "Walk-in Customer"}
                  </p>
                </div>
                <div className="flex justify-between">
                  <Label className="text-muted-foreground">Subtotal</Label>
                  <p className="font-medium">${editSale.subtotal}</p>
                </div>
                <div className="flex justify-between">
                  <Label className="text-muted-foreground">Discount</Label>
                  <p className="font-medium">
                    {(editSale.discountType as string) === "percentage"
                      ? `${editSale.discount}%`
                      : `$${parseFloat(editSale.discount || "0").toFixed(2)}`}
                  </p>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <Label className="text-lg font-semibold">Total</Label>
                  <p className="font-bold text-lg">${editSale.total}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSale(null)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      {/* Template Selection Dialog for Printing */}
      <Dialog open={!!printSale} onOpenChange={() => setPrintSale(null)}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-print-template">
          <DialogHeader>
            <DialogTitle>Select Receipt Template</DialogTitle>
            <DialogDescription>
              Choose a template style for your receipt, preview it, then print
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="template-select">Receipt Template</Label>
              <Select
                value={selectedTemplate}
                onValueChange={(value: ReceiptTemplate) => setSelectedTemplate(value)}
              >
                <SelectTrigger id="template-select" data-testid="select-print-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>Classic - Traditional receipt style</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="modern">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>Modern - Clean and minimal design</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="compact">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>Compact - Small format for thermal printers</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="detailed">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>Detailed - Full information with borders</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="elegant">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>Elegant - Premium style with gradients</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                Select a template and click "Preview Receipt" to see how it will look
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  if (!printSale) return;
                  try {
                    const settingsResponse = await fetch("/api/settings");
                    const settings = settingsResponse.ok ? await settingsResponse.json() : null;

                    // Validate company details are configured
                    if (!settings || !settings.businessName || !settings.address) {
                      toast({
                        title: "Company Details Not Configured",
                        description: "Please configure Company Name and Address in Settings > Receipt before previewing receipts.",
                        variant: "destructive",
                        duration: 5000,
                      });
                      return;
                    }

                    const response = await fetch(`/api/orders/${printSale.id}/items`);
                    if (!response.ok) throw new Error("Failed to fetch order items");
                    const items: OrderItemWithProduct[] = await response.json();

                    const totalUSD = parseFloat(printSale.total);
                    const totalKHRNum = totalUSD * 4100;

                    let paymentDetails = `<p><strong>Pay by:</strong> ${printSale.paymentMethod || "N/A"}</p>`;
                    if (printSale.paymentSplits) {
                      try {
                        const splits: PaymentSplit[] = JSON.parse(printSale.paymentSplits);
                        if (splits.length > 0) {
                          const splitsHtml = splits.map(split => {
                            const methodLabel = getPaymentMethodLabel(split.method);
                            const amountKHR = (split.amount * 4100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
                            return `
                              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                                <span>${methodLabel}:</span>
                                <span><strong>$${split.amount.toFixed(2)}</strong> (៛${amountKHR})</span>
                              </div>
                            `;
                          }).join('');
                          paymentDetails = `
                            <div style="margin-top: 10px;">
                              <p style="margin-bottom: 10px;"><strong>Payment Split:</strong></p>
                              <div style="border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px; background-color: #f9fafb;">
                                ${splitsHtml}
                              </div>
                            </div>
                          `;
                        }
                      } catch (error) {
                        console.error("Failed to parse payment splits:", error);
                      }
                    }

                    const receiptData = {
                      sale: printSale,
                      items: items.map(item => ({
                        id: item.id,
                        orderId: item.orderId,
                        productId: item.productId,
                        quantity: item.quantity,
                        price: item.price,
                        total: item.total,
                        productName: item.productName,
                      })),
                      settings,
                      totalKHR: totalKHRNum,
                      paymentDetails,
                    };

                    const content = generateReceiptHTML(selectedTemplate, receiptData);
                    const previewWindow = window.open("", "_blank");
                    if (previewWindow) {
                      previewWindow.document.write(content);
                      previewWindow.document.close();
                    }
                  } catch (error) {
                    toast({
                      title: "Error",
                      description: "Failed to preview receipt",
                      variant: "destructive",
                    });
                  }
                }}
                data-testid="button-preview-receipt"
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview Receipt
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrintSale(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmPrint} data-testid="button-confirm-print">
              <Printer className="w-4 h-4 mr-2" />
              Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteSaleId} onOpenChange={() => setDeleteSaleId(null)}>
        <AlertDialogContent data-testid="dialog-delete-sale">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sale</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this sale? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent data-testid="dialog-bulk-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Sales</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedSales.size} selected sale(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover-elevate"
              data-testid="button-confirm-bulk-delete"
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Sales Dialog */}
      <Dialog open={addSaleOpen} onOpenChange={setAddSaleOpen}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-add-sale">
          <DialogHeader>
            <DialogTitle>Add New Sale</DialogTitle>
            <DialogDescription>Create a new sales transaction</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Customer Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customer-name">Customer Name</Label>
                <Input
                  id="customer-name"
                  value={newSaleCustomerName}
                  onChange={(e) => setNewSaleCustomerName(e.target.value)}
                  placeholder="Walk-in Customer"
                  data-testid="input-add-customer-name"
                />
              </div>
              <div>
                <Label htmlFor="customer-phone">Customer Phone (Optional)</Label>
                <Input
                  id="customer-phone"
                  value={newSaleCustomerPhone}
                  onChange={(e) => setNewSaleCustomerPhone(e.target.value)}
                  placeholder="012345678"
                  data-testid="input-add-customer-phone"
                />
              </div>
              <div>
                <Label htmlFor="dining-option">Dining Option</Label>
                <Select value={newSaleDiningOption} onValueChange={setNewSaleDiningOption}>
                  <SelectTrigger id="dining-option" data-testid="select-add-dining-option">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dine-in">Dine-In</SelectItem>
                    <SelectItem value="takeaway">Takeaway</SelectItem>
                    <SelectItem value="delivery">Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="payment-method">Payment Method</Label>
                <Select value={newSalePaymentMethod} onValueChange={setNewSalePaymentMethod}>
                  <SelectTrigger id="payment-method" data-testid="select-add-payment-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="aba">ABA</SelectItem>
                    <SelectItem value="acleda">Acleda</SelectItem>
                    <SelectItem value="due">Due</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="payment-status">Payment Status</Label>
                <Select value={newSalePaymentStatus} onValueChange={setNewSalePaymentStatus}>
                  <SelectTrigger id="payment-status" data-testid="select-add-payment-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="sale-date">Sale Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      id="sale-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newSaleDate ? format(newSaleDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={newSaleDate}
                      onSelect={(date) => date && setNewSaleDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Add Products */}
            <div className="space-y-4 border-t pt-4">
              <Label className="text-base font-semibold">Order Items</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <Label htmlFor="product-select">Product</Label>
                  <ProductSelect
                    value={selectedProductId}
                    onValueChange={setSelectedProductId}
                    placeholder="Select a product"
                    showPrice={true}
                    dataTestId="select-add-product"
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="product-quantity">Quantity</Label>
                  <Input
                    id="product-quantity"
                    type="number"
                    min="1"
                    value={selectedProductQuantity}
                    onChange={(e) => setSelectedProductQuantity(e.target.value)}
                    data-testid="input-add-product-quantity"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!selectedProductId) {
                    toast({
                      title: "Error",
                      description: "Please select a product",
                      variant: "destructive",
                    });
                    return;
                  }
                  const product = products.find(p => p.id === selectedProductId);
                  if (!product) return;
                  
                  const quantity = parseInt(selectedProductQuantity) || 1;
                  const existingIndex = newSaleItems.findIndex(item => item.productId === selectedProductId);
                  
                  if (existingIndex >= 0) {
                    const updated = [...newSaleItems];
                    updated[existingIndex].quantity += quantity;
                    setNewSaleItems(updated);
                  } else {
                    setNewSaleItems([...newSaleItems, {
                      productId: selectedProductId,
                      productName: product.name,
                      quantity,
                      price: product.price,
                    }]);
                  }
                  
                  setSelectedProductId("");
                  setSelectedProductQuantity("1");
                }}
                className="w-full"
                data-testid="button-add-product-to-sale"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>

              {/* Items List */}
              {newSaleItems.length > 0 && (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {newSaleItems.map((item, index) => {
                        const itemTotal = parseFloat(item.price) * item.quantity;
                        return (
                          <TableRow key={index}>
                            <TableCell>{item.productName}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">${item.price}</TableCell>
                            <TableCell className="text-right">${itemTotal.toFixed(2)}</TableCell>
                            <TableCell>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setNewSaleItems(newSaleItems.filter((_, i) => i !== index));
                                }}
                                data-testid={`button-remove-item-${index}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Discount and Summary */}
            <div className="space-y-4 border-t pt-4">
              <Label className="text-base font-semibold">Discount & Summary</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="discount-type">Discount Type</Label>
                  <Select value={newSaleDiscountType} onValueChange={(value: 'amount' | 'percentage') => setNewSaleDiscountType(value)}>
                    <SelectTrigger id="discount-type" data-testid="select-add-discount-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amount">Amount ($)</SelectItem>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="discount">Discount</Label>
                  <Input
                    id="discount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={newSaleDiscount}
                    onChange={(e) => setNewSaleDiscount(e.target.value)}
                    data-testid="input-add-discount"
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="border rounded-md p-4 bg-muted/20 space-y-2">
                {(() => {
                  const subtotal = newSaleItems.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);
                  const discountAmount = newSaleDiscountType === 'percentage'
                    ? (subtotal * parseFloat(newSaleDiscount || '0')) / 100
                    : parseFloat(newSaleDiscount || '0');
                  const total = Math.max(0, subtotal - discountAmount);
                  
                  return (
                    <>
                      <div className="flex justify-between">
                        <Label className="text-muted-foreground">Subtotal:</Label>
                        <p className="font-medium">${subtotal.toFixed(2)}</p>
                      </div>
                      {discountAmount > 0 && (
                        <div className="flex justify-between">
                          <Label className="text-muted-foreground">Discount:</Label>
                          <p className="font-medium text-accent">-${discountAmount.toFixed(2)}</p>
                        </div>
                      )}
                      <div className="flex justify-between border-t pt-2">
                        <Label className="text-lg font-semibold">Total:</Label>
                        <p className="font-bold text-lg">${total.toFixed(2)}</p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSaleOpen(false)} data-testid="button-cancel-add-sale">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newSaleItems.length === 0) {
                  toast({
                    title: "Error",
                    description: "Please add at least one product",
                    variant: "destructive",
                  });
                  return;
                }

                const subtotal = newSaleItems.reduce((sum, item) => sum + parseFloat(item.price) * item.quantity, 0);
                const discountAmount = newSaleDiscountType === 'percentage'
                  ? (subtotal * parseFloat(newSaleDiscount || '0')) / 100
                  : parseFloat(newSaleDiscount || '0');
                const total = Math.max(0, subtotal - discountAmount);

                const orderData = {
                  customerName: newSaleCustomerName || null,
                  customerPhone: newSaleCustomerPhone || null,
                  diningOption: newSaleDiningOption,
                  subtotal: subtotal.toString(),
                  discount: newSaleDiscount,
                  discountType: newSaleDiscountType,
                  total: total.toString(),
                  status: "completed",
                  paymentMethod: newSalePaymentMethod,
                  paymentStatus: newSalePaymentStatus,
                  createdAt: newSaleDate.toISOString(),
                  items: newSaleItems.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    price: item.price,
                    total: (parseFloat(item.price) * item.quantity).toString(),
                    itemDiscount: "0",
                    itemDiscountType: 'amount',
                  })),
                };

                createSaleMutation.mutate(orderData);
              }}
              disabled={createSaleMutation.isPending || newSaleItems.length === 0}
              data-testid="button-save-add-sale"
            >
              {createSaleMutation.isPending ? "Creating..." : "Create Sale"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
