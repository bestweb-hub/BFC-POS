import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Calendar as CalendarIcon,
  Download,
  Banknote,
  Plus,
  ArrowLeft,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import type { Order, PaymentAdjustment } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPaymentAdjustmentSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";

type DateFilter = "today" | "yesterday" | "thismonth" | "lastmonth" | "january" | "february" | "march" | "april" | "may" | "june" | "july" | "august" | "september" | "october" | "november" | "december" | "custom";

const adjustmentFormSchema = insertPaymentAdjustmentSchema.extend({
  amount: z.coerce.number().positive("Amount must be positive"),
});

export default function BankStatement() {
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const { toast } = useToast();
  const { hasPermission } = usePermissions();

  const { data: sales = [] } = useQuery<Order[]>({
    queryKey: ["/api/sales"],
  });

  const { data: paymentAdjustments = [] } = useQuery<PaymentAdjustment[]>({
    queryKey: ["/api/payment-adjustments"],
  });

  const form = useForm<z.infer<typeof adjustmentFormSchema>>({
    resolver: zodResolver(adjustmentFormSchema),
    defaultValues: {
      paymentMethod: "",
      amount: 0,
      adjustmentType: "add",
      description: "",
    },
  });

  const createAdjustmentMutation = useMutation({
    mutationFn: async (data: z.infer<typeof adjustmentFormSchema>) => {
      const payload = {
        ...data,
        amount: data.amount.toString(),
      };
      const response = await fetch("/api/payment-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to create adjustment");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-adjustments"] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Payment adjustment added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add payment adjustment",
        variant: "destructive",
      });
    },
  });

  const getFilteredSales = () => {
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
      case "january":
        startDate = new Date(currentYear, 0, 1);
        endDate = new Date(currentYear, 1, 0, 23, 59, 59, 999);
        break;
      case "february":
        startDate = new Date(currentYear, 1, 1);
        endDate = new Date(currentYear, 2, 0, 23, 59, 59, 999);
        break;
      case "march":
        startDate = new Date(currentYear, 2, 1);
        endDate = new Date(currentYear, 3, 0, 23, 59, 59, 999);
        break;
      case "april":
        startDate = new Date(currentYear, 3, 1);
        endDate = new Date(currentYear, 4, 0, 23, 59, 59, 999);
        break;
      case "may":
        startDate = new Date(currentYear, 4, 1);
        endDate = new Date(currentYear, 5, 0, 23, 59, 59, 999);
        break;
      case "june":
        startDate = new Date(currentYear, 5, 1);
        endDate = new Date(currentYear, 6, 0, 23, 59, 59, 999);
        break;
      case "july":
        startDate = new Date(currentYear, 6, 1);
        endDate = new Date(currentYear, 7, 0, 23, 59, 59, 999);
        break;
      case "august":
        startDate = new Date(currentYear, 7, 1);
        endDate = new Date(currentYear, 8, 0, 23, 59, 59, 999);
        break;
      case "september":
        startDate = new Date(currentYear, 8, 1);
        endDate = new Date(currentYear, 9, 0, 23, 59, 59, 999);
        break;
      case "october":
        startDate = new Date(currentYear, 9, 1);
        endDate = new Date(currentYear, 10, 0, 23, 59, 59, 999);
        break;
      case "november":
        startDate = new Date(currentYear, 10, 1);
        endDate = new Date(currentYear, 11, 0, 23, 59, 59, 999);
        break;
      case "december":
        startDate = new Date(currentYear, 11, 1);
        endDate = new Date(currentYear, 12, 0, 23, 59, 59, 999);
        break;
      case "custom":
        if (customStartDate) {
          startDate = customStartDate;
        }
        if (customEndDate) {
          endDate = customEndDate;
        }
        break;
    }

    return sales.filter((sale) => {
      const saleDate = new Date(sale.createdAt);
      let dateMatch = false;

      if (dateFilter === "custom" && customStartDate && customEndDate) {
        dateMatch = saleDate >= startDate && saleDate <= endDate;
      } else {
        dateMatch = saleDate >= startDate && saleDate <= endDate;
      }

      return dateMatch && sale.status === "completed";
    });
  };

  const filteredSales = getFilteredSales();

  // Helper function to normalize payment method names for consistent lookup
  const normalizePaymentMethod = (method: string): string => {
    // Convert underscore format to "and" format: cash_aba -> cash and aba
    return method.toLowerCase().replace(/_/g, ' and ').replace(/and and/g, 'and');
  };

  const paymentTotals = filteredSales.reduce(
    (acc, sale) => {
      // Check if this sale has split payments
      if (sale.paymentSplits) {
        try {
          const splits: { method: string; amount: number }[] = JSON.parse(sale.paymentSplits);
          if (splits.length > 0) {
            // Distribute amounts according to split payments
            // Track which methods were used in this order to count the transaction only once per method
            const methodsInOrder = new Set<string>();
            splits.forEach((split) => {
              const method = normalizePaymentMethod(split.method);
              if (!acc[method]) {
                acc[method] = { total: 0, count: 0, adjustments: 0 };
              }
              acc[method].total += split.amount;
              
              // Only count this transaction once per method per order
              if (!methodsInOrder.has(method)) {
                acc[method].count += 1;
                methodsInOrder.add(method);
              }
            });
            return acc;
          }
        } catch (error) {
          console.error("Failed to parse payment splits:", error);
        }
      }
      
      // Fallback to single payment method if no splits
      const method = normalizePaymentMethod(sale.paymentMethod || "unknown");
      const total = parseFloat(sale.total);
      if (!acc[method]) {
        acc[method] = { total: 0, count: 0, adjustments: 0 };
      }
      acc[method].total += total;
      acc[method].count += 1;
      return acc;
    },
    {} as Record<string, { total: number; count: number; adjustments: number }>
  );

  // Add payment adjustments to totals
  paymentAdjustments.forEach((adjustment) => {
    const method = normalizePaymentMethod(adjustment.paymentMethod);
    const amount = parseFloat(adjustment.amount);
    
    if (!paymentTotals[method]) {
      paymentTotals[method] = { total: 0, count: 0, adjustments: 0 };
    }
    
    if (adjustment.adjustmentType === "add") {
      paymentTotals[method].adjustments += amount;
    }
  });

  const totalAdjustments = paymentAdjustments.reduce(
    (sum, adj) => sum + (adj.adjustmentType === "add" ? parseFloat(adj.amount) : 0),
    0
  );
  
  const totalRevenue = filteredSales.reduce(
    (sum, sale) => sum + parseFloat(sale.total),
    0
  ) + totalAdjustments;
  
  const totalTransactions = filteredSales.length;

  const paymentMethodsData = [
    { name: "ABA", key: "aba", icon: CreditCard, color: "bg-blue-500" },
    { name: "Acleda", key: "acleda", icon: CreditCard, color: "bg-green-500" },
    { name: "Cash", key: "cash", icon: Banknote, color: "bg-yellow-500" },
    { name: "Due", key: "due", icon: DollarSign, color: "bg-orange-500" },
    { name: "Card", key: "card", icon: CreditCard, color: "bg-purple-500" },
    {
      name: "Cash And ABA",
      key: "cash and aba",
      icon: CreditCard,
      color: "bg-indigo-500",
    },
    {
      name: "Cash And Acleda",
      key: "cash and acleda",
      icon: CreditCard,
      color: "bg-teal-500",
    },
  ];

  // Get transactions for the selected payment method
  const getTransactionsByPaymentMethod = (paymentMethodKey: string) => {
    return filteredSales.filter((sale) => {
      // Check if this sale has split payments
      if (sale.paymentSplits) {
        try {
          const splits: { method: string; amount: number }[] = JSON.parse(sale.paymentSplits);
          // Check if any split uses the selected payment method
          return splits.some((split) => normalizePaymentMethod(split.method) === paymentMethodKey);
        } catch (error) {
          console.error("Failed to parse payment splits:", error);
        }
      }
      
      // Check single payment method
      return normalizePaymentMethod(sale.paymentMethod || "") === paymentMethodKey;
    });
  };

  const transactionsForSelectedMethod = selectedPaymentMethod 
    ? getTransactionsByPaymentMethod(selectedPaymentMethod)
    : [];

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-bank-statement-title">
            Bank Statement
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Payment dashboard and sales breakdown by payment method
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              {hasPermission("reports.create") && (
                <Button variant="default" data-testid="button-add-adjustment">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Manual Amount
                </Button>
              )}
            </DialogTrigger>
            <DialogContent className="w-[95vw] sm:max-w-[500px]" data-testid="dialog-add-adjustment">
              <DialogHeader>
                <DialogTitle>Add Manual Payment Adjustment</DialogTitle>
                <DialogDescription>
                  Add a manual amount to a payment method for business adjustments or fund additions
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => createAdjustmentMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-payment-method">
                              <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="aba">ABA</SelectItem>
                            <SelectItem value="acleda">Acleda</SelectItem>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                            <SelectItem value="due">Due</SelectItem>
                            <SelectItem value="cash and aba">Cash And ABA</SelectItem>
                            <SelectItem value="cash and acleda">Cash And Acleda</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount ($)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Enter amount"
                            data-testid="input-amount"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Reason for adjustment..."
                            data-testid="input-description"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDialogOpen(false)}
                      data-testid="button-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createAdjustmentMutation.isPending}
                      data-testid="button-submit-adjustment"
                    >
                      {createAdjustmentMutation.isPending ? "Adding..." : "Add Adjustment"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          {hasPermission("reports.export") && (
            <Button variant="outline" data-testid="button-export-statement">
              <Download className="w-4 h-4 mr-2" />
              Export Statement
            </Button>
          )}
        </div>
      </div>

      <Card className="border-2 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
          <CardTitle className="text-xl">Filter by Date Range</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Date Range
              </label>
              <Select value={dateFilter} onValueChange={(value: DateFilter) => setDateFilter(value)}>
                <SelectTrigger data-testid="select-date-range">
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

            {dateFilter === "custom" && (
              <>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Start Date
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full"
                        data-testid="button-start-date"
                      >
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {customStartDate
                          ? format(customStartDate, "MMM dd, yyyy")
                          : "Pick date"}
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
                  <label className="text-sm font-medium mb-2 block">
                    End Date
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full"
                        data-testid="button-end-date"
                      >
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {customEndDate
                          ? format(customEndDate, "MMM dd, yyyy")
                          : "Pick date"}
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-6 w-6 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700 dark:text-green-400" data-testid="text-total-revenue">
              ${totalRevenue.toFixed(2)}
            </div>
            <p className="text-sm text-muted-foreground mt-1 font-medium">
              ៛{(totalRevenue * 4100).toFixed(0)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {totalTransactions} completed transactions
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Transactions
            </CardTitle>
            <TrendingUp className="h-6 w-6 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-400" data-testid="text-total-transactions">
              {totalTransactions}
            </div>
            <p className="text-sm text-muted-foreground mt-1 font-medium">
              Completed orders
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Avg: ${totalTransactions > 0 ? (totalRevenue / totalTransactions).toFixed(2) : "0.00"} per transaction
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-2 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
          <CardTitle className="text-2xl">Payment Dashboard</CardTitle>
          <CardDescription>Sales breakdown by payment method</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paymentMethodsData.map((method) => {
              const data = paymentTotals[method.key] || { total: 0, count: 0, adjustments: 0 };
              const Icon = method.icon;
              const colorMap: Record<string, { border: string; bg: string; icon: string; iconBg: string }> = {
                'bg-blue-500': { border: 'border-blue-500', bg: 'bg-blue-50 dark:bg-blue-950', icon: 'text-blue-600', iconBg: 'bg-blue-100 dark:bg-blue-900' },
                'bg-green-500': { border: 'border-green-500', bg: 'bg-green-50 dark:bg-green-950', icon: 'text-green-600', iconBg: 'bg-green-100 dark:bg-green-900' },
                'bg-yellow-500': { border: 'border-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-950', icon: 'text-yellow-600', iconBg: 'bg-yellow-100 dark:bg-yellow-900' },
                'bg-orange-500': { border: 'border-orange-500', bg: 'bg-orange-50 dark:bg-orange-950', icon: 'text-orange-600', iconBg: 'bg-orange-100 dark:bg-orange-900' },
                'bg-purple-500': { border: 'border-purple-500', bg: 'bg-purple-50 dark:bg-purple-950', icon: 'text-purple-600', iconBg: 'bg-purple-100 dark:bg-purple-900' },
                'bg-indigo-500': { border: 'border-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-950', icon: 'text-indigo-600', iconBg: 'bg-indigo-100 dark:bg-indigo-900' },
                'bg-teal-500': { border: 'border-teal-500', bg: 'bg-teal-50 dark:bg-teal-950', icon: 'text-teal-600', iconBg: 'bg-teal-100 dark:bg-teal-900' },
              };
              const colorScheme = colorMap[method.color];
              const totalWithAdjustments = data.total + data.adjustments;
              return (
                <Card 
                  key={method.key} 
                  className={`p-4 ${colorScheme.border} border-l-4 ${colorScheme.bg} shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer ${selectedPaymentMethod === method.key ? 'ring-2 ring-primary' : ''}`} 
                  data-testid={`card-${method.key}`}
                  onClick={() => setSelectedPaymentMethod(method.key)}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="capitalize font-semibold">
                        {method.name}
                      </Badge>
                      <div className={`p-2 rounded-lg ${colorScheme.iconBg}`}>
                        <Icon className={`w-4 h-4 ${colorScheme.icon}`} />
                      </div>
                    </div>
                    <div>
                      <div className={`text-2xl font-bold ${colorScheme.icon}`} data-testid={`text-${method.key}-total`}>
                        ${totalWithAdjustments.toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground font-medium">
                        ៛{(totalWithAdjustments * 4100).toFixed(0)}
                      </div>
                      {data.adjustments > 0 && (
                        <div className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
                          +${data.adjustments.toFixed(2)} manual adjustment
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium">
                      {data.count} {data.count === 1 ? "transaction" : "transactions"}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          {Object.keys(paymentTotals).length === 0 && (
            <div className="text-center text-muted-foreground py-8 font-medium">
              No completed transactions found for the selected date range
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction History for Selected Payment Method */}
      {selectedPaymentMethod && (
        <Card className="border-2 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">
                  Transaction History - {paymentMethodsData.find(m => m.key === selectedPaymentMethod)?.name}
                </CardTitle>
                <CardDescription>
                  All transactions using this payment method
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => setSelectedPaymentMethod(null)}
                data-testid="button-clear-payment-filter"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {transactionsForSelectedMethod.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Dining</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead className="text-right">Amount Paid</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactionsForSelectedMethod.map((order) => {
                      // Calculate amount paid with this payment method
                      let amountPaid = parseFloat(order.total);
                      let paymentDisplay = order.paymentMethod || "Unknown";

                      if (order.paymentSplits) {
                        try {
                          const splits: { method: string; amount: number }[] = JSON.parse(order.paymentSplits);
                          const matchingSplit = splits.find(
                            split => normalizePaymentMethod(split.method) === selectedPaymentMethod
                          );
                          if (matchingSplit) {
                            amountPaid = matchingSplit.amount;
                            paymentDisplay = splits.map(s => `${s.method}: $${s.amount.toFixed(2)}`).join(', ');
                          }
                        } catch (error) {
                          console.error("Failed to parse payment splits:", error);
                        }
                      }

                      return (
                        <TableRow key={order.id} data-testid={`row-transaction-${order.id}`}>
                          <TableCell className="font-mono font-medium">
                            #{order.orderNumber}
                          </TableCell>
                          <TableCell>
                            {format(new Date(order.createdAt), "MMM dd, yyyy HH:mm")}
                          </TableCell>
                          <TableCell>
                            {order.customerName || "Walk-in"}
                          </TableCell>
                          <TableCell className="capitalize">
                            {order.diningOption}
                          </TableCell>
                          <TableCell className="text-sm">
                            {paymentDisplay}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-green-600 dark:text-green-400">
                            ${amountPaid.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            ${parseFloat(order.total).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  // Navigate to sales page to view this order
                                  window.location.href = `/sales?orderId=${order.id}`;
                                }}
                                data-testid={`button-view-${order.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {hasPermission("sales.edit") && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    // Navigate to sales page to edit this order
                                    window.location.href = `/sales?orderId=${order.id}&edit=true`;
                                  }}
                                  data-testid={`button-edit-${order.id}`}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              )}
                              {hasPermission("sales.delete") && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={async () => {
                                    if (confirm(`Are you sure you want to delete order #${order.orderNumber}? This action cannot be undone.`)) {
                                      try {
                                        const response = await fetch(`/api/orders/${order.id}`, {
                                          method: "DELETE",
                                          credentials: "include",
                                        });
                                        if (response.ok) {
                                          queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
                                          queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
                                          queryClient.invalidateQueries({ queryKey: ["/api/payment-adjustments"] });
                                          toast({
                                            title: "Success",
                                            description: `Order #${order.orderNumber} deleted successfully`,
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
                                  data-testid={`button-delete-${order.id}`}
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
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8 font-medium">
                No transactions found for this payment method
              </div>
            )}
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
