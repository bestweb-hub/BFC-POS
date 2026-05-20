import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, ShoppingCart, TrendingUp, Package, Calendar as CalendarIcon, Receipt, Wallet, ShoppingBag, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface DashboardStats {
  todaySales: number;
  todayOrders: number;
  totalRevenue: number;
  totalOrders: number;
  totalExpenses: number;
  totalStaffSalary?: number;
  profitLoss: number;
  totalPurchase: number;
}

interface SalesByCategory {
  category: string;
  revenue: number;
}

interface SalesByPaymentMethod {
  paymentMethod: string;
  amount: number;
}

interface PopularProduct {
  product: string;
  quantity: number;
  revenue: number;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  total: string;
  status: string;
  createdAt: string;
  diningOption: string;
}

// Compute start/end of period in local time so "today" matches user's timezone (fixes dashboard showing 0 when sales are after midnight local)
function getLocalDateRange(filter: string, customDate: Date | undefined): { startDate: Date; endDate: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  switch (filter) {
    case "today":
      return { startDate: today, endDate: endOfToday };
    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        startDate: yesterday,
        endDate: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999),
      };
    }
    case "this-week": {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      return { startDate: startOfWeek, endDate: endOfToday };
    }
    case "this-month": {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: startOfMonth, endDate: endOfToday };
    }
    case "last-month": {
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { startDate: startOfLastMonth, endDate: endOfLastMonth };
    }
    case "custom":
      if (customDate) {
        const d = new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate());
        return {
          startDate: d,
          endDate: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999),
        };
      }
      return { startDate: today, endDate: endOfToday };
    case "all":
      return {
        startDate: new Date(2000, 0, 1),
        endDate: new Date(2099, 11, 31, 23, 59, 59, 999),
      };
    default:
      return { startDate: today, endDate: endOfToday };
  }
}

export default function Dashboard() {
  const [dateFilter, setDateFilter] = useState<string>("today");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);

  const getDateParams = () => {
    const params = new URLSearchParams();
    params.append("filter", dateFilter);
    if (dateFilter === "custom" && customDate) {
      params.append("date", customDate.toISOString());
    }
    const { startDate, endDate } = getLocalDateRange(dateFilter, customDate);
    params.append("startDate", startDate.toISOString());
    params.append("endDate", endDate.toISOString());
    return params.toString();
  };

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats", dateFilter, customDate],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/stats?${getDateParams()}`);
      return response.json();
    },
  });

  const { data: salesByCategory, isLoading: salesByCategoryLoading } = useQuery<SalesByCategory[]>({
    queryKey: ["/api/dashboard/sales-by-category", dateFilter, customDate],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/sales-by-category?${getDateParams()}`);
      return response.json();
    },
  });

  const { data: salesByPaymentMethod, isLoading: salesByPaymentMethodLoading } = useQuery<SalesByPaymentMethod[]>({
    queryKey: ["/api/dashboard/sales-by-payment-method", dateFilter, customDate],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/sales-by-payment-method?${getDateParams()}`);
      return response.json();
    },
  });

  const { data: popularProducts, isLoading: popularProductsLoading } = useQuery<PopularProduct[]>({
    queryKey: ["/api/dashboard/popular-products", dateFilter, customDate],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/popular-products?${getDateParams()}`);
      return response.json();
    },
  });

  const { data: recentOrders, isLoading: recentOrdersLoading } = useQuery<RecentOrder[]>({
    queryKey: ["/api/dashboard/recent-orders", dateFilter, customDate],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/recent-orders?${getDateParams()}`);
      return response.json();
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4 md:space-y-6 lg:space-y-8 overflow-auto h-full bg-background">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1.5">Overview of your restaurant's performance</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-date-filter">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="this-week">This Week</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
              <SelectItem value="last-month">Last Month</SelectItem>
              <SelectItem value="custom">Custom Date</SelectItem>
            </SelectContent>
          </Select>
          {dateFilter === "custom" && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" data-testid="button-custom-date">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {customDate ? format(customDate, "MMM dd, yyyy") : "Pick date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={customDate}
                  onSelect={setCustomDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-today-sales" className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Sales</CardTitle>
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-today-sales">
                  {formatCurrency(stats?.todaySales || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {stats?.todayOrders || 0} orders today
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-today-orders" className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Orders</CardTitle>
            <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center">
              <ShoppingCart className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-today-orders">
                  {stats?.todayOrders || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">Completed orders</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-total-revenue" className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <div className="w-8 h-8 rounded-md bg-green-500/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-total-revenue">
                  {formatCurrency(stats?.totalRevenue || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">All time revenue</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-total-orders" className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
            <div className="w-8 h-8 rounded-md bg-purple-500/10 flex items-center justify-center">
              <Package className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-total-orders">
                  {stats?.totalOrders || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">Completed orders</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-total-expenses" className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
            <div className="w-8 h-8 rounded-md bg-red-500/10 flex items-center justify-center">
              <Receipt className="h-4 w-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-total-expenses">
                  {formatCurrency(stats?.totalExpenses || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">For selected period</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-staff-salary" className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Staff Salary</CardTitle>
            <div className="w-8 h-8 rounded-md bg-orange-500/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-staff-salary">
                  {formatCurrency(stats?.totalStaffSalary || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">For selected period (included in Profit/Loss)</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-profit-loss" className="border-l-4 border-l-amber-500">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit/Loss</CardTitle>
            <div className="w-8 h-8 rounded-md bg-amber-500/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className={`text-2xl font-bold ${(stats?.profitLoss || 0) >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`} data-testid="text-profit-loss">
                  {formatCurrency(stats?.profitLoss || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">Revenue − Expenses − Staff Salary</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-total-purchase" className="border-l-4 border-l-cyan-500">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Purchase</CardTitle>
            <div className="w-8 h-8 rounded-md bg-cyan-500/10 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-cyan-500" />
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-total-purchase">
                  {formatCurrency(stats?.totalPurchase || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">For selected period</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-3">
        <Card data-testid="card-sales-by-category">
          <CardHeader>
            <CardTitle>Sales by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {salesByCategoryLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : salesByCategory && salesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={salesByCategory}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="category" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.375rem",
                    }}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No sales data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-sales-by-payment">
          <CardHeader>
            <CardTitle>Today's Sales by Payment</CardTitle>
          </CardHeader>
          <CardContent>
            {salesByPaymentMethodLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : salesByPaymentMethod && salesByPaymentMethod.length > 0 ? (
              <div className="space-y-2">
                {salesByPaymentMethod.map((method, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                    data-testid={`payment-method-${index}`}
                  >
                    <div>
                      <p className="font-medium text-sm capitalize" data-testid={`text-payment-method-${index}`}>
                        {method.paymentMethod}
                      </p>
                    </div>
                    <div className="text-sm font-semibold" data-testid={`text-payment-amount-${index}`}>
                      {formatCurrency(method.amount)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No payment data for today
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-popular-products">
          <CardHeader>
            <CardTitle>Popular Products</CardTitle>
          </CardHeader>
          <CardContent>
            {popularProductsLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : popularProducts && popularProducts.length > 0 ? (
              <div className="space-y-2">
                {popularProducts.map((product, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                    data-testid={`product-${index}`}
                  >
                    <div>
                      <p className="font-medium text-sm" data-testid={`text-product-name-${index}`}>
                        {product.product}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product.quantity} sold
                      </p>
                    </div>
                    <div className="text-sm font-semibold" data-testid={`text-product-revenue-${index}`}>
                      {formatCurrency(product.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No product data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-recent-orders">
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrdersLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : recentOrders && recentOrders.length > 0 ? (
            <div className="space-y-2">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                  data-testid={`order-${order.id}`}
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm" data-testid={`text-order-number-${order.id}`}>
                      Order #{order.orderNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(order.createdAt)} • {order.diningOption}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold" data-testid={`text-order-total-${order.id}`}>
                      {formatCurrency(parseFloat(order.total))}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{order.status}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              No recent orders
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
