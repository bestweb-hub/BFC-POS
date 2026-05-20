import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useBranch } from "@/contexts/BranchContext";
import { useDebounce } from "@/hooks/use-debounce";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
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
import { 
  Download, 
  Printer, 
  Calendar as CalendarIcon, 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  BarChart3,
  Eye,
  FileText,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Edit,
  Trash2,
  Search,
  Package
} from "lucide-react";
import { format } from "date-fns";
import type { Order, Product, OrderItem } from "@shared/schema";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ReportType = "sales" | "inventory" | "payments" | "discounts" | "refunds" | "staff" | "aba" | "acleda" | "cash" | "due" | "card" | "items";
type DateFilter = "today" | "yesterday" | "thismonth" | "lastmonth" | "january" | "february" | "march" | "april" | "may" | "june" | "july" | "august" | "september" | "october" | "november" | "december" | "custom";

interface OrderItemWithProduct extends OrderItem {
  productName: string;
  discount: string;
}

interface OrderWithItems extends Order {
  items: OrderItemWithProduct[];
  tableNumber?: string;
}

export default function Reports() {
  const [reportType, setReportType] = useState<ReportType>("sales");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [paymentGatewayFilter, setPaymentGatewayFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [reportPage, setReportPage] = useState(1);
  const [reportPageSize, setReportPageSize] = useState(10);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const { selectedBranchId } = useBranch();
  const debouncedSearchFilter = useDebounce(searchFilter, 400);

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Build report query params for paginated orders and stats
  const getReportDateRange = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;
    switch (dateFilter) {
      case "today":
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        break;
      case "yesterday":
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        dateFrom = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
        dateTo = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
        break;
      case "thismonth":
        dateFrom = new Date(currentYear, now.getMonth(), 1);
        dateTo = new Date(currentYear, now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case "lastmonth":
        dateFrom = new Date(currentYear, now.getMonth() - 1, 1);
        dateTo = new Date(currentYear, now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case "custom":
        if (customStartDate) dateFrom = customStartDate;
        if (customEndDate) dateTo = customEndDate;
        break;
      default:
        const monthMap: Record<string, number> = {
          january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
          july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
        };
        if (monthMap[dateFilter] !== undefined) {
          dateFrom = new Date(currentYear, monthMap[dateFilter], 1);
          dateTo = new Date(currentYear, monthMap[dateFilter] + 1, 0, 23, 59, 59, 999);
        }
    }
    return { dateFrom, dateTo };
  }, [dateFilter, customStartDate, customEndDate]);

  const reportParamsString = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedBranchId) params.append("branchId", selectedBranchId);
    if (debouncedSearchFilter?.trim()) params.append("search", debouncedSearchFilter.trim());
    if (paymentStatusFilter !== "all") params.append("paymentStatus", paymentStatusFilter === "completed" ? "paid" : paymentStatusFilter);
    if (paymentGatewayFilter !== "all") params.append("paymentMethod", paymentGatewayFilter);
    if (getReportDateRange.dateFrom) params.append("dateFrom", getReportDateRange.dateFrom.toISOString());
    if (getReportDateRange.dateTo) params.append("dateTo", getReportDateRange.dateTo.toISOString());
    return params.toString();
  }, [selectedBranchId, debouncedSearchFilter, paymentStatusFilter, paymentGatewayFilter, getReportDateRange.dateFrom, getReportDateRange.dateTo]);

  useEffect(() => {
    setReportPage(1);
  }, [reportParamsString]);

  const { data: reportData, isLoading: reportLoading } = useQuery<{ orders: Order[]; total: number }>({
    queryKey: ["/api/orders/paginated", reportPage, reportPageSize, reportParamsString],
    queryFn: async () => {
      const params = new URLSearchParams(reportParamsString);
      params.set("page", reportPage.toString());
      params.set("limit", reportPageSize.toString());
      const response = await fetch(`/api/orders/paginated?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch report data");
      return response.json();
    },
    enabled: reportType === "sales",
  });

  const { data: salesStats } = useQuery<{
    totalSales: number;
    totalRevenue: number;
    totalDue: number;
    totalPaid: number;
    averageOrderValue: number;
    totalDiscounts: number;
    paymentMethodBreakdown: Record<string, { total: number; count: number; paid: number; pending: number; failed: number }>;
  }>({
    queryKey: ["/api/sales/stats", reportParamsString],
    queryFn: async () => {
      const response = await fetch(`/api/sales/stats?${reportParamsString}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch sales stats");
      return response.json();
    },
    enabled: reportType === "sales",
  });

  const filteredSales = reportType === "sales" ? (reportData?.orders || []) : [];
  const salesTotal = reportType === "sales" ? (reportData?.total ?? 0) : 0;
  const totalRevenue = salesStats?.totalRevenue ?? 0;
  const totalTransactions = salesStats?.totalSales ?? 0;
  const avgSaleValue = totalTransactions > 0 ? (salesStats?.averageOrderValue ?? 0) : 0;
  const totalDiscounts = salesStats?.totalDiscounts ?? 0;
  const paymentTotals = salesStats?.paymentMethodBreakdown ?? {};
  const paymentMethods = Object.fromEntries(Object.entries(paymentTotals).map(([method, data]) => [method, data.count]));

  // Get date range helper (for item sales report)
  const getDateRange = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    let startDate = new Date();
    let endDate = new Date();
    
    switch (dateFilter) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "yesterday":
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "thismonth":
        startDate = new Date(currentYear, now.getMonth(), 1);
        endDate = new Date(currentYear, now.getMonth() + 1, 0, 23, 59, 59, 999);
        break;
      case "lastmonth":
        startDate = new Date(currentYear, now.getMonth() - 1, 1);
        endDate = new Date(currentYear, now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case "custom":
        if (customStartDate) startDate = customStartDate;
        if (customEndDate) endDate = customEndDate;
        break;
      default:
        const monthMap: Record<string, number> = {
          january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
          july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
        };
        if (monthMap[dateFilter] !== undefined) {
          startDate = new Date(currentYear, monthMap[dateFilter], 1);
          endDate = new Date(currentYear, monthMap[dateFilter] + 1, 0, 23, 59, 59, 999);
        }
    }
    return { startDate, endDate };
  };

  // Get item-level sales data
  const { data: itemSales = [], isLoading: itemSalesLoading } = useQuery<Array<{ product: string; quantity: number; revenue: number }>>({
    queryKey: ["/api/reports/items", dateFilter, customStartDate, customEndDate],
    queryFn: async () => {
      const { startDate, endDate } = getDateRange();
      const response = await fetch(`/api/reports/items?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch item sales");
      return response.json();
    },
    enabled: reportType === "items",
  });

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" => {
    if (status === "completed" || status === "paid" || status === "successful") return "default";
    if (status === "pending") return "secondary";
    if (status === "failed" || status === "cancelled") return "destructive";
    return "secondary";
  };

  const getStatusIcon = (status: string) => {
    if (status === "completed" || status === "paid" || status === "successful") return CheckCircle;
    if (status === "pending") return Clock;
    if (status === "failed" || status === "cancelled") return XCircle;
    return Clock;
  };

  const handleExportCSV = async () => {
    try {
      if (reportType === "items") {
        const totalRevenueForPct = itemSales.reduce((sum, i) => sum + i.revenue, 0);
        const csvContent = [
          ["Product Name", "Quantity Sold", "Revenue (USD)", "Revenue (KHR)", "Avg Price", "% of Total"].join(","),
          ...itemSales
            .sort((a, b) => b.revenue - a.revenue)
            .map((item) => {
              const pct = totalRevenueForPct > 0 ? (item.revenue / totalRevenueForPct) * 100 : 0;
              const avgPrice = item.quantity > 0 ? item.revenue / item.quantity : 0;
              return [item.product, item.quantity, item.revenue.toFixed(2), (item.revenue * 4100).toFixed(0), avgPrice.toFixed(2), `${pct.toFixed(1)}%`].join(",");
            }),
        ].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `per-item-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const response = await fetch(`/api/orders/export?${reportParamsString}`, { credentials: "include" });
        if (!response.ok) throw new Error("Failed to fetch export data");
        const { orders: exportOrders = [] } = await response.json();
        const salesToExport = exportOrders;
        const csvContent = [
          ["Date", "Order Number", "Customer", "Total (USD)", "Total (KHR)", "Payment Method", "Payment Status", "Status"].join(","),
          ...salesToExport.map((sale: Order) => [
            format(new Date(sale.createdAt), "yyyy-MM-dd HH:mm"),
            sale.orderNumber,
            sale.customerName || "Walk-in",
            parseFloat(sale.total).toFixed(2),
            (parseFloat(sale.total) * 4100).toFixed(0),
            sale.paymentMethod || "N/A",
            sale.paymentStatus || "N/A",
            sale.status
          ].join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `sales-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to export CSV", variant: "destructive" });
    }
  };

  const handleExportExcel = async () => {
    try {
      if (reportType === "items") {
        const totalRevenueForPct = itemSales.reduce((sum, i) => sum + i.revenue, 0);
        const exportData = itemSales
          .sort((a, b) => b.revenue - a.revenue)
          .map((item) => {
            const percentage = totalRevenueForPct > 0 ? (item.revenue / totalRevenueForPct) * 100 : 0;
            const avgPrice = item.quantity > 0 ? item.revenue / item.quantity : 0;
            return {
              "Product Name": item.product,
              "Quantity Sold": item.quantity,
              "Revenue (USD)": item.revenue.toFixed(2),
              "Revenue (KHR)": (item.revenue * 4100).toFixed(0),
              "Avg Price (USD)": avgPrice.toFixed(2),
              "% of Total": `${percentage.toFixed(1)}%`,
            };
          });
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Per Item Sales");
        XLSX.writeFile(workbook, `per-item-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
        toast({ title: "Success", description: `Exported ${itemSales.length} items to Excel` });
      } else {
        const response = await fetch(`/api/orders/export?${reportParamsString}`, { credentials: "include" });
        if (!response.ok) throw new Error("Failed to fetch export data");
        const { orders: exportOrders = [] } = await response.json();
        const salesToExport = exportOrders;
        const exportData = salesToExport.map((sale: Order) => ({
          "Invoice No": `INV-${sale.orderNumber}`,
          "Date & Time": format(new Date(sale.createdAt), "PPpp"),
          "Customer Name": sale.customerName || "Walk-in Customer",
          "Subtotal": `$${sale.subtotal}`,
          "Discount Amount": `$${sale.discount}`,
          "Total Amount (USD)": `$${parseFloat(sale.total).toFixed(2)}`,
          "Total Amount (KHR)": `៛${(parseFloat(sale.total) * 4100).toFixed(0)}`,
          "Payment Method": sale.paymentMethod || "N/A",
          "Payment Status": sale.paymentStatus || "N/A",
          "Order Status": sale.status,
        }));
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Sales");
        XLSX.writeFile(workbook, `sales-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
        toast({ title: "Success", description: `Exported ${salesToExport.length} transactions to Excel` });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to export Excel", variant: "destructive" });
    }
  };

  const handleExportPDF = async () => {
    const doc = new jsPDF();
    
    // Get report title based on type
    const reportTitles: Record<string, string> = {
      sales: "Sales Report",
      items: "Per Item Sales Report",
      inventory: "Inventory Report",
      discounts: "Discounts Report",
      refunds: "Refunds Report",
      staff: "Staff Performance Report"
    };
    
    // Add header
    doc.setFontSize(18);
    doc.text(reportTitles[reportType] || "POS Report", 14, 20);
    
    doc.setFontSize(11);
    doc.text(`Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`, 14, 28);
    doc.text(`Period: ${dateFilter === "custom" && customStartDate && customEndDate 
      ? `${format(customStartDate, "MMM dd, yyyy")} - ${format(customEndDate, "MMM dd, yyyy")}`
      : dateFilter.charAt(0).toUpperCase() + dateFilter.slice(1)}`, 14, 34);
    
    if (reportType === "items") {
      // Add summary for items report
      const totalRevenue = itemSales.reduce((sum, item) => sum + item.revenue, 0);
      const totalQuantity = itemSales.reduce((sum, item) => sum + item.quantity, 0);
      doc.setFontSize(10);
      doc.text(`Total Items: ${itemSales.length}`, 14, 42);
      doc.text(`Total Quantity Sold: ${totalQuantity}`, 14, 48);
      doc.text(`Total Revenue: $${totalRevenue.toFixed(2)} USD (៛${(totalRevenue * 4100).toFixed(0)} KHR)`, 14, 54);
      
      // Prepare table data for items
      const totalRevenueForPct = itemSales.reduce((sum, item) => sum + item.revenue, 0);
      const tableData = itemSales
        .sort((a, b) => b.revenue - a.revenue)
        .map(item => {
          const percentage = totalRevenueForPct > 0 ? (item.revenue / totalRevenueForPct) * 100 : 0;
          const avgPrice = item.quantity > 0 ? item.revenue / item.quantity : 0;
          return [
            item.product,
            item.quantity.toString(),
            `$${item.revenue.toFixed(2)}`,
            `៛${(item.revenue * 4100).toFixed(0)}`,
            `$${avgPrice.toFixed(2)}`,
            `${percentage.toFixed(1)}%`
          ];
        });
      
      // Add table
      autoTable(doc, {
        startY: 60,
        head: [["Product Name", "Quantity", "Revenue (USD)", "Revenue (KHR)", "Avg Price", "% of Total"]],
        body: tableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 50 },
          1: { cellWidth: 20, halign: "right" },
          2: { cellWidth: 25, halign: "right" },
          3: { cellWidth: 30, halign: "right" },
          4: { cellWidth: 25, halign: "right" },
          5: { cellWidth: 20, halign: "right" }
        }
      });
    } else {
      // Add summary for sales report - fetch all matching orders for PDF export
      let salesForPdf = filteredSales;
      try {
        const response = await fetch(`/api/orders/export?${reportParamsString}`, { credentials: "include" });
        if (response.ok) {
          const { orders: exportOrders = [] } = await response.json();
          salesForPdf = exportOrders;
        }
      } catch {
        // Fall back to current page if fetch fails
      }
      doc.setFontSize(10);
      doc.text(`Total Transactions: ${totalTransactions}`, 14, 42);
      doc.text(`Total Revenue: $${totalRevenue.toFixed(2)} USD (៛${(totalRevenue * 4100).toFixed(0)} KHR)`, 14, 48);
      
      // Prepare table data
      const tableData = salesForPdf.map((sale: Order) => [
        sale.orderNumber,
        format(new Date(sale.createdAt), "MMM dd, HH:mm"),
        sale.paymentMethod || "N/A",
        `$${parseFloat(sale.total).toFixed(2)}`,
        `៛${(parseFloat(sale.total) * 4100).toFixed(0)}`,
        sale.paymentStatus || "N/A",
        sale.customerName || "Walk-in"
      ]);
      
      // Add table
      autoTable(doc, {
        startY: 55,
        head: [["Order #", "Date/Time", "Method", "USD", "KHR", "Payment Status", "Customer"]],
        body: tableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 25 },
          1: { cellWidth: 25 },
          2: { cellWidth: 20 },
          3: { cellWidth: 22, halign: "right" },
          4: { cellWidth: 28, halign: "right" },
          5: { cellWidth: 20 },
          6: { cellWidth: 30 }
        }
      });
    }
    
    doc.save(`${reportType}-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleViewOrder = async (order: Order) => {
    setLoadingOrderDetails(true);
    try {
      const response = await fetch(`/api/orders/${order.id}/items`);
      const items = await response.json();
      
      const itemsWithDetails: OrderItemWithProduct[] = items.map((item: any) => ({
        ...item,
        productName: item.product?.name || products.find(p => p.id === item.productId)?.name || 'Unknown Product',
        discount: item.discount || "0"
      }));

      const orderWithItems: OrderWithItems = {
        ...order,
        items: itemsWithDetails
      };

      setSelectedOrder(orderWithItems);
      setViewDialogOpen(true);
    } catch (error) {
      console.error("Failed to fetch order details:", error);
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  const handleEditOrder = (orderId: string) => {
    setLocation(`/sales`);
  };

  const handlePrintOrder = async (order: Order) => {
    try {
      const response = await fetch(`/api/orders/${order.id}/items`);
      const items = await response.json();
      
      const itemsWithDetails: OrderItemWithProduct[] = items.map((item: any) => ({
        ...item,
        productName: item.product?.name || products.find(p => p.id === item.productId)?.name || 'Unknown Product',
        discount: item.discount || "0"
      }));

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const subtotal = parseFloat(order.subtotal);
      const discount = parseFloat(order.discount);
      const total = parseFloat(order.total);
      const totalKHR = total * 4100;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Order Receipt #${order.orderNumber}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body {
                font-family: 'Courier New', monospace;
                padding: 20px;
                max-width: 400px;
                margin: 0 auto;
              }
              .header {
                text-align: center;
                margin-bottom: 20px;
                border-bottom: 2px dashed #000;
                padding-bottom: 10px;
              }
              .header h1 {
                font-size: 24px;
                margin-bottom: 5px;
              }
              .header p {
                font-size: 12px;
                margin: 2px 0;
              }
              .order-info {
                margin: 15px 0;
                font-size: 12px;
              }
              .order-info div {
                display: flex;
                justify-content: space-between;
                margin: 5px 0;
              }
              .items {
                margin: 15px 0;
                border-top: 2px dashed #000;
                border-bottom: 2px dashed #000;
                padding: 10px 0;
              }
              .item {
                margin: 8px 0;
                font-size: 12px;
              }
              .item-header {
                display: flex;
                justify-content: space-between;
                font-weight: bold;
              }
              .item-details {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                color: #555;
                margin-top: 2px;
              }
              .totals {
                margin: 15px 0;
                font-size: 13px;
              }
              .totals div {
                display: flex;
                justify-content: space-between;
                margin: 5px 0;
              }
              .totals .total-line {
                font-weight: bold;
                font-size: 16px;
                margin-top: 10px;
                padding-top: 10px;
                border-top: 2px solid #000;
              }
              .footer {
                text-align: center;
                margin-top: 20px;
                font-size: 11px;
                border-top: 2px dashed #000;
                padding-top: 10px;
              }
              @media print {
                body { padding: 10px; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>BondPos</h1>
              <p>Restaurant POS System</p>
              <p>Receipt</p>
            </div>

            <div class="order-info">
              <div><span>Order #:</span><span>${order.orderNumber}</span></div>
              <div><span>Date:</span><span>${format(new Date(order.createdAt), "MMM dd, yyyy HH:mm")}</span></div>
              ${order.customerName ? `<div><span>Customer:</span><span>${order.customerName}</span></div>` : ''}
              ${order.customerPhone ? `<div><span>Phone:</span><span>${order.customerPhone}</span></div>` : ''}
              <div><span>Payment:</span><span>${order.paymentMethod || 'N/A'}</span></div>
              <div><span>Status:</span><span>${order.status.toUpperCase()}</span></div>
            </div>

            <div class="items">
              <h3 style="margin-bottom: 10px; font-size: 14px;">Order Items</h3>
              ${itemsWithDetails.map(item => `
                <div class="item">
                  <div class="item-header">
                    <span>${item.productName}</span>
                    <span>$${(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
                  </div>
                  <div class="item-details">
                    <span>${item.quantity} x $${parseFloat(item.price).toFixed(2)}</span>
                    ${parseFloat(item.discount) > 0 ? `<span>Discount: $${parseFloat(item.discount).toFixed(2)}</span>` : '<span></span>'}
                  </div>
                </div>
              `).join('')}
            </div>

            <div class="totals">
              <div><span>Subtotal:</span><span>$${subtotal.toFixed(2)}</span></div>
              ${discount > 0 ? `<div><span>Discount:</span><span>-$${discount.toFixed(2)}</span></div>` : ''}
              <div class="total-line"><span>Total (USD):</span><span>$${total.toFixed(2)}</span></div>
              <div><span>Total (KHR):</span><span>៛${totalKHR.toFixed(0)}</span></div>
            </div>

            <div class="footer">
              <p>Thank you for your business!</p>
            </div>

            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (error) {
      console.error("Failed to print order:", error);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (orderIds: string[]) => {
      await Promise.all(
        orderIds.map(id => 
          fetch(`/api/orders/${id}`, { method: "DELETE" }).then(res => {
            if (!res.ok) throw new Error("Failed to delete order");
            return res;
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/paginated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/stats"] });
      toast({
        title: "Success",
        description: `${selectedOrders.length} order(s) deleted successfully`,
      });
      setSelectedOrders([]);
      setDeleteDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete orders",
        variant: "destructive",
      });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedOrders(filteredSales.map(sale => sale.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders([...selectedOrders, orderId]);
    } else {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedOrders.length > 0) {
      setDeleteDialogOpen(true);
    }
  };

  const confirmDelete = () => {
    deleteMutation.mutate(selectedOrders);
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">POS Reports Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Analyze performance, sales, and profitability</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {selectedOrders.length > 0 && reportType === "sales" && hasPermission("sales.delete") && (
              <Button 
                variant="destructive" 
                onClick={handleDeleteSelected}
                disabled={deleteMutation.isPending}
                data-testid="button-delete-selected"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected ({selectedOrders.length})
              </Button>
            )}
            <Button variant="outline" onClick={handlePrint} data-testid="button-print-report">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            {hasPermission("reports.export") && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" data-testid="button-export">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportCSV} data-testid="button-export-csv">
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportExcel} data-testid="button-export-excel">
                    <Download className="w-4 h-4 mr-2" />
                    Export Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPDF} data-testid="button-export-pdf">
                    <Download className="w-4 h-4 mr-2" />
                    Export PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700 dark:text-green-400" data-testid="text-total-revenue">${totalRevenue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground font-medium">
                {totalTransactions} transactions
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              <ShoppingCart className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400" data-testid="text-total-transactions">{totalTransactions}</div>
              <p className="text-xs text-muted-foreground font-medium">
                Total orders processed
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Sale Value</CardTitle>
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-400" data-testid="text-avg-sale">${avgSaleValue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground font-medium">
                Per transaction
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Discounts</CardTitle>
              <BarChart3 className="h-5 w-5 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-400" data-testid="text-total-discounts">${totalDiscounts.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground font-medium">
                Given to customers
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-2 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
            <CardTitle className="text-2xl">Account History</CardTitle>
            <CardDescription>Sales amount by payment method</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Object.entries(paymentTotals).map(([method, data], index) => {
                const colors = [
                  { border: 'border-blue-500', bg: 'bg-blue-50 dark:bg-blue-950', icon: 'text-blue-600' },
                  { border: 'border-green-500', bg: 'bg-green-50 dark:bg-green-950', icon: 'text-green-600' },
                  { border: 'border-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-950', icon: 'text-yellow-600' },
                  { border: 'border-orange-500', bg: 'bg-orange-50 dark:bg-orange-950', icon: 'text-orange-600' },
                  { border: 'border-purple-500', bg: 'bg-purple-50 dark:bg-purple-950', icon: 'text-purple-600' },
                  { border: 'border-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-950', icon: 'text-indigo-600' },
                  { border: 'border-teal-500', bg: 'bg-teal-50 dark:bg-teal-950', icon: 'text-teal-600' },
                ];
                const colorScheme = colors[index % colors.length];
                return (
                  <Card key={method} className={`p-4 ${colorScheme.border} border-l-4 ${colorScheme.bg} shadow-md hover:shadow-xl transition-shadow`}>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="capitalize font-semibold">{method}</Badge>
                      </div>
                      <div>
                        <div className={`text-2xl font-bold ${colorScheme.icon}`}>${data.total.toFixed(2)}</div>
                        <div className="text-sm text-muted-foreground font-medium">
                          ៛{(data.total * 4100).toFixed(0)}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground font-medium">
                        {data.count} {data.count === 1 ? 'transaction' : 'transactions'}
                      </div>
                    </div>
                  </Card>
                );
              })}
              {Object.keys(paymentTotals).length === 0 && (
                <div className="col-span-full text-center text-muted-foreground py-8">
                  No transactions found for the selected filters
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Report Filters</CardTitle>
            <CardDescription>Filter transactions before viewing the report table</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Date Range</label>
                <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as DateFilter)}>
                  <SelectTrigger data-testid="select-date-filter">
                    <SelectValue placeholder="Select date range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="thismonth">This Month</SelectItem>
                    <SelectItem value="lastmonth">Last Month</SelectItem>
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
                    <SelectItem value="custom">Custom Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Report Type</label>
                <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
                  <SelectTrigger data-testid="select-report-type">
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="items">Per Item Report</SelectItem>
                    <SelectItem value="inventory">Inventory</SelectItem>
                    <SelectItem value="discounts">Discounts</SelectItem>
                    <SelectItem value="refunds">Refunds</SelectItem>
                    <SelectItem value="staff">Staff Performance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Payment Status</label>
                <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                  <SelectTrigger data-testid="select-payment-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="due">Due</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Payment Gateway</label>
                <Select value={paymentGatewayFilter} onValueChange={setPaymentGatewayFilter}>
                  <SelectTrigger data-testid="select-payment-gateway">
                    <SelectValue placeholder="Select gateway" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="aba">ABA</SelectItem>
                    <SelectItem value="acleda">Acleda</SelectItem>
                    <SelectItem value="due">Due</SelectItem>
                    <SelectItem value="cash and aba">Cash And ABA</SelectItem>
                    <SelectItem value="cash and acleda">Cash And Acleda</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Invoice or customer..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {dateFilter === "custom" && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Start Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full" data-testid="button-start-date">
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {customStartDate ? format(customStartDate, "MMM dd, yyyy") : "Pick date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={customStartDate}
                          onSelect={setCustomStartDate}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">End Date</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full" data-testid="button-end-date">
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {customEndDate ? format(customEndDate, "MMM dd, yyyy") : "Pick date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={customEndDate}
                          onSelect={setCustomEndDate}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {reportType === "payments" && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods Breakdown</CardTitle>
              <CardDescription>Distribution of payment methods used</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(paymentMethods).map(([method, count]) => (
                  <div key={method} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="capitalize">{method}</Badge>
                      <span className="text-sm text-muted-foreground">{count} transactions</span>
                    </div>
                    <div className="text-sm font-medium">
                      {((count / totalTransactions) * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}


        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {reportType === "sales" ? "Sales Report" :
                   reportType === "inventory" ? "Inventory Report" :
                   reportType === "discounts" ? "Discounts Report" :
                   reportType === "refunds" ? "Refunds Report" :
                   reportType === "staff" ? "Staff Performance Report" :
                   "Transaction Report"}
                </CardTitle>
                <CardDescription>
                  View all transactions in the selected date range
                </CardDescription>
              </div>
              {reportType === "sales" && salesTotal > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="gap-1">
                    <CreditCard className="w-3 h-3" />
                    {salesTotal} Transactions
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {reportType === "items" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">Per Item Sales Report</h3>
                    <p className="text-sm text-muted-foreground">
                      Detailed sales statistics for each product
                    </p>
                  </div>
                  <Badge variant="outline" className="gap-1">
                    <Package className="w-3 h-3" />
                    {itemSales.length} Items
                  </Badge>
                </div>
                {itemSalesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading item sales data...</div>
                ) : itemSales.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No item sales found for the selected date range
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product Name</TableHead>
                        <TableHead className="text-right">Quantity Sold</TableHead>
                        <TableHead className="text-right">Total Revenue (USD)</TableHead>
                        <TableHead className="text-right">Total Revenue (KHR)</TableHead>
                        <TableHead className="text-right">Avg Price (USD)</TableHead>
                        <TableHead className="text-right">% of Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itemSales
                        .sort((a, b) => b.revenue - a.revenue)
                        .map((item, index) => {
                          const totalRevenue = itemSales.reduce((sum, i) => sum + i.revenue, 0);
                          const percentage = totalRevenue > 0 ? (item.revenue / totalRevenue) * 100 : 0;
                          const avgPrice = item.quantity > 0 ? item.revenue / item.quantity : 0;
                          
                          return (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{item.product}</TableCell>
                              <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                              <TableCell className="text-right font-mono font-medium">
                                ${item.revenue.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">
                                ៛{(item.revenue * 4100).toFixed(0)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                ${avgPrice.toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="outline">{percentage.toFixed(1)}%</Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                )}
              </div>
            ) : reportType === "sales" ? (
              <div className="space-y-4">
                {reportLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading transactions...</div>
                ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead className="text-right">Amount (USD)</TableHead>
                      <TableHead className="text-right">Amount (KHR)</TableHead>
                      <TableHead>Payment Status</TableHead>
                      <TableHead>Payer Info</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No transactions found for the selected filters
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSales.map((sale) => {
                        const StatusIcon = getStatusIcon(sale.paymentStatus);
                        const usdAmount = parseFloat(sale.total);
                        const khrAmount = usdAmount * 4100;
                        
                        return (
                          <TableRow key={sale.id} data-testid={`row-gateway-${sale.id}`}>
                            <TableCell className="font-mono font-medium">#{sale.orderNumber}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(sale.createdAt), "MMM dd, yyyy")}
                              <br />
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(sale.createdAt), "hh:mm a")}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="gap-1 capitalize">
                                <CreditCard className="w-3 h-3" />
                                {sale.paymentMethod || "N/A"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono font-medium">
                              ${usdAmount.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ៛{khrAmount.toFixed(0)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(sale.paymentStatus)} className="gap-1">
                                <StatusIcon className="w-3 h-3" />
                                {sale.paymentStatus}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <div className="font-medium">{sale.customerName || "Walk-in"}</div>
                                {sale.customerPhone && (
                                  <div className="text-xs text-muted-foreground">{sale.customerPhone}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {hasPermission("sales.view") && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        onClick={() => handleViewOrder(sale)}
                                        disabled={loadingOrderDetails}
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
                                        size="sm" 
                                        variant="ghost"
                                        onClick={() => handleEditOrder(sale.id)}
                                        data-testid={`button-edit-${sale.id}`}
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Edit Order</TooltipContent>
                                  </Tooltip>
                                )}
                                {hasPermission("sales.print") && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        onClick={() => handlePrintOrder(sale)}
                                        data-testid={`button-print-${sale.id}`}
                                      >
                                        <FileText className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Print Receipt</TooltipContent>
                                  </Tooltip>
                                )}
                                {hasPermission("sales.delete") && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        size="sm" 
                                        variant="ghost"
                                        onClick={async () => {
                                          if (confirm(`Are you sure you want to delete order #${sale.orderNumber}? This action cannot be undone.`)) {
                                            try {
                                              const response = await fetch(`/api/orders/${sale.id}`, {
                                                method: "DELETE",
                                                credentials: "include",
                                              });
                                              if (response.ok) {
                                                queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
                                                queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
                                                toast({
                                                  title: "Success",
                                                  description: `Order #${sale.orderNumber} deleted successfully`,
                                                });
                                              } else {
                                                throw new Error("Failed to delete order");
                                              }
                                            } catch (error) {
                                              toast({
                                                title: "Error",
                                                description: "Failed to delete order",
                                                variant: "destructive",
                                              });
                                            }
                                          }
                                        }}
                                        data-testid={`button-delete-${sale.id}`}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete Order</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
                )}
                {reportType === "sales" && salesTotal > 0 && (
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-muted-foreground">
                        Showing {((reportPage - 1) * reportPageSize) + 1} to {Math.min(reportPage * reportPageSize, salesTotal)} of {salesTotal} transactions
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Per page:</span>
                        <Select
                          value={reportPageSize.toString()}
                          onValueChange={(value) => {
                            setReportPageSize(parseInt(value, 10));
                            setReportPage(1);
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
                    {salesTotal > reportPageSize && (
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious 
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                if (reportPage > 1) setReportPage(reportPage - 1);
                              }}
                              className={reportPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                          {Array.from({ length: Math.ceil(salesTotal / reportPageSize) }, (_, i) => i + 1)
                            .filter(page => page === 1 || page === Math.ceil(salesTotal / reportPageSize) || (page >= reportPage - 1 && page <= reportPage + 1))
                            .map((page, index, array) => {
                              const showEllipsisBefore = index > 0 && page - array[index - 1] > 1;
                              return (
                                <div key={page} className="flex items-center">
                                  {showEllipsisBefore && <PaginationEllipsis />}
                                  <PaginationItem>
                                    <PaginationLink
                                      href="#"
                                      onClick={(e) => { e.preventDefault(); setReportPage(page); }}
                                      isActive={reportPage === page}
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
                                if (reportPage < Math.ceil(salesTotal / reportPageSize)) setReportPage(reportPage + 1);
                              }}
                              className={reportPage >= Math.ceil(salesTotal / reportPageSize) ? "pointer-events-none opacity-50" : "cursor-pointer"}
                            />
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date/Time</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No transactions found for the selected period
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSales.map((sale) => (
                      <TableRow key={sale.id} data-testid={`row-sale-${sale.id}`}>
                        <TableCell>{format(new Date(sale.createdAt), "MMM dd, yyyy HH:mm")}</TableCell>
                        <TableCell className="font-mono">#{sale.orderNumber}</TableCell>
                        <TableCell>{sale.customerName || "Walk-in"}</TableCell>
                        <TableCell className="font-mono">${sale.total}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {sale.paymentMethod || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            sale.paymentStatus === "paid" ? "default" : 
                            sale.paymentStatus === "pending" ? "secondary" : 
                            "destructive"
                          }>
                            {sale.paymentStatus || "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sale.status === "completed" ? "default" : "secondary"}>
                            {sale.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {hasPermission("sales.view") && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => handleViewOrder(sale)}
                                disabled={loadingOrderDetails}
                                data-testid={`button-view-${sale.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
                            {hasPermission("sales.edit") && (
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => handleEditOrder(sale.id)}
                                data-testid={`button-edit-${sale.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                            {hasPermission("sales.print") && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={() => handlePrintOrder(sale)}
                                data-testid={`button-print-${sale.id}`}
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Order Details</DialogTitle>
              <DialogDescription>Complete order information and items</DialogDescription>
            </DialogHeader>
            
            {selectedOrder && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Order Number</label>
                    <div className="font-mono font-bold text-lg">#{selectedOrder.orderNumber}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Date & Time</label>
                    <div className="font-medium">{format(new Date(selectedOrder.createdAt), "MMM dd, yyyy HH:mm")}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Customer Name</label>
                    <div className="font-medium">{selectedOrder.customerName || "Walk-in"}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phone</label>
                    <div className="font-medium">{selectedOrder.customerPhone || "N/A"}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Payment Method</label>
                    <div><Badge variant="outline" className="capitalize">{selectedOrder.paymentMethod || "N/A"}</Badge></div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <div><Badge variant={selectedOrder.status === "completed" ? "default" : "secondary"}>{selectedOrder.status}</Badge></div>
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="font-semibold text-lg mb-4">Order Items</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product Name</TableHead>
                        <TableHead className="text-center">Quantity</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Discount</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell className="text-center">{item.quantity}</TableCell>
                          <TableCell className="text-right font-mono">${parseFloat(item.price).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono">${parseFloat(item.discount).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            ${parseFloat(item.total).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-mono">${parseFloat(selectedOrder.subtotal).toFixed(2)}</span>
                  </div>
                  {parseFloat(selectedOrder.discount) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Discount:</span>
                      <span className="font-mono">-${parseFloat(selectedOrder.discount).toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total (USD):</span>
                    <span className="font-mono">${parseFloat(selectedOrder.total).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total (KHR):</span>
                    <span className="font-mono">៛{(parseFloat(selectedOrder.total) * 4100).toFixed(0)}</span>
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                    <X className="w-4 h-4 mr-2" />
                    Close
                  </Button>
                  {hasPermission("sales.edit") && (
                    <Button variant="outline" onClick={() => handleEditOrder(selectedOrder.id)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Order
                    </Button>
                  )}
                  {hasPermission("sales.print") && (
                    <Button onClick={() => handlePrintOrder(selectedOrder)}>
                      <Printer className="w-4 h-4 mr-2" />
                      Print Receipt
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedOrders.length} selected order(s)? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
