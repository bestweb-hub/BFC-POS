import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { AlertTriangle, Plus, RefreshCw, TrendingUp, TrendingDown, Package, History, Eye, Edit, Trash2, Download, Upload, FileSpreadsheet, Search, Calendar as CalendarIcon, DollarSign, TrendingDown as TrendingDownIcon, Boxes } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { useDebounce } from "@/hooks/use-debounce";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Product, InventoryAdjustment, Settings, Category, MainProduct } from "@shared/schema";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UnitSelect } from "@/components/unit-select";
import { ProductSelect } from "@/components/product-select";
import { CategorySelect } from "@/components/category-select";
import * as XLSX from "xlsx";
import { useBranch } from "@/contexts/BranchContext";
import { withBranchId } from "@/lib/branchQuery";
import { ChevronDown, ChevronRight } from "lucide-react";

// MainProductCard component
function MainProductCard({ 
  mainProduct, 
  onEdit, 
  onAddProduct, 
  onDelete,
  onRemoveProduct,
  categories = []
}: { 
  mainProduct: MainProduct; 
  onEdit: (mp: MainProduct) => void;
  onAddProduct: (mp: MainProduct) => void;
  onDelete: (mp: MainProduct) => void;
  onRemoveProduct: (mainProductId: string, itemId: string, productName: string) => void;
  categories?: Category[];
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: itemsData, isLoading: itemsLoading } = useQuery<Array<{ id: string; product: Product }>>({
    queryKey: [`/api/main-products/${mainProduct.id}/items`],
    enabled: expanded,
  });
  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalStock: number;
    branchBreakdown: Array<{ branchName: string; quantity: number; sold: number; available: number }>;
    totalQuantity: number;
    totalSold: number;
    totalAvailable: number;
    available: number;
    subProducts: Array<{ product: Product; quantity: number; sold: number; available: number; branchName: string | null }>;
  }>({
    queryKey: [`/api/main-products/${mainProduct.id}/stats`],
    enabled: expanded,
  });
  
  // Create a map of productId to itemId from itemsData
  const productIdToItemIdMap = new Map<string, string>();
  itemsData?.forEach(item => {
    productIdToItemIdMap.set(item.product.id, item.id);
  });
  
  // Prioritize itemsData (which has itemId) over stats
  // If itemsData is available, use it; otherwise fall back to stats
  let items: Array<{ product: Product; itemId: string; quantity: number; sold: number; available: number; branchName: string | null }> = [];
  
  if (itemsData && itemsData.length > 0) {
    // Use itemsData which has the itemId
    items = itemsData.map(item => {
      const qty = parseFloat(item.product.quantity);
      const statsItem = stats?.subProducts?.find(sp => sp.product.id === item.product.id);
      return { 
        product: item.product, 
        itemId: item.id,
        quantity: statsItem?.quantity || qty, 
        sold: statsItem?.sold || 0,
        available: statsItem?.available || qty,
        branchName: statsItem?.branchName || null 
      };
    });
  } else if (stats?.subProducts) {
    // Fall back to stats, but try to find itemId from the map
    items = stats.subProducts.map(sp => ({
      product: sp.product,
      itemId: productIdToItemIdMap.get(sp.product.id) || '',
      quantity: sp.quantity,
      sold: sp.sold,
      available: sp.available,
      branchName: sp.branchName
    }));
  }
  
  const itemsWithIds = items;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-8 w-8 p-0"
            >
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <div>
              <CardTitle className="text-lg">{mainProduct.name}</CardTitle>
              {mainProduct.description && (
                <CardDescription>{mainProduct.description}</CardDescription>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onAddProduct(mainProduct)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
            <Button variant="outline" size="sm" onClick={() => onEdit(mainProduct)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => onDelete(mainProduct)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent>
          {statsLoading ? (
            <div className="text-center py-4">Loading stats...</div>
          ) : stats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Stock</p>
                  <p className="text-2xl font-bold">{stats.totalStock}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Supplied</p>
                  <p className="text-2xl font-bold">{stats.totalQuantity}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Available</p>
                  <p className="text-2xl font-bold">{stats.totalAvailable || stats.available}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Sold</p>
                  <p className="text-2xl font-bold">{stats.totalSold || 0}</p>
                </div>
              </div>
              {stats.branchBreakdown.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Branch Breakdown:</p>
                  <div className="space-y-1">
                    {stats.branchBreakdown.map((branch, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>* {branch.branchName} = {branch.quantity} pce (Sold: {branch.sold || 0}, Available: {branch.available || 0})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {itemsLoading || statsLoading ? (
                <div className="text-center py-4">Loading products...</div>
              ) : itemsWithIds && itemsWithIds.length > 0 ? (
                <div>
                  <p className="text-sm font-medium mb-2">Sub Products:</p>
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Branch</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Sold Out</TableHead>
                          <TableHead className="text-right">Available</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itemsWithIds.map((item) => (
                          <TableRow key={item.product.id}>
                            <TableCell>{item.product.name}</TableCell>
                            <TableCell>
                              {categories && categories.length > 0 ? (categories.find(c => c.id === item.product.categoryId)?.name || "Unknown") : "Unknown"}
                            </TableCell>
                            <TableCell>{item.branchName || "Main"}</TableCell>
                            <TableCell className="text-right">{item.quantity} {item.product.unit}</TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {item.sold || 0}/{item.quantity}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                              {item.available > 0 ? (
                                <span className="text-green-600 dark:text-green-400">{item.available}</span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.itemId && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onRemoveProduct(mainProduct.id, item.itemId, item.product.name)}
                                  className="text-destructive hover:text-destructive"
                                  title="Remove product from main product"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">No products linked yet. Click "Add Product" to link products.</div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">No stats available</div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function Inventory() {
  const { selectedBranchId } = useBranch();
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [viewProductDialogOpen, setViewProductDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [stockShortDialogOpen, setStockShortDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<"add" | "remove" | "set">("add");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [editingAdjustment, setEditingAdjustment] = useState<InventoryAdjustment | null>(null);
  const [editAdjustmentDialogOpen, setEditAdjustmentDialogOpen] = useState(false);
  const [deletingAdjustmentId, setDeletingAdjustmentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [shortageFilter, setShortageFilter] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // Tab-specific search and filter states
  const [activeTab, setActiveTab] = useState<string>("products");
  const [overviewSearchQuery, setOverviewSearchQuery] = useState("");
  const [overviewCategoryFilter, setOverviewCategoryFilter] = useState<string>("all");
  const [overviewStatusFilter, setOverviewStatusFilter] = useState<string>("all");
  const debouncedOverviewSearch = useDebounce(overviewSearchQuery, 300);
  
  const [lowStockSearchQuery, setLowStockSearchQuery] = useState("");
  const [lowStockCategoryFilter, setLowStockCategoryFilter] = useState<string>("all");
  const debouncedLowStockSearch = useDebounce(lowStockSearchQuery, 300);
  
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyAdjustmentTypeFilter, setHistoryAdjustmentTypeFilter] = useState<string>("all");
  const debouncedHistorySearch = useDebounce(historySearchQuery, 300);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [stockShortValue, setStockShortValue] = useState("");
  const [stockShortReason, setStockShortReason] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { hasPermission } = usePermissions();

  // Pagination state
  const [productsPage, setProductsPage] = useState(1);
  const [productsPageSize, setProductsPageSize] = useState(10);
  const [overviewPage, setOverviewPage] = useState(1);
  const [overviewPageSize, setOverviewPageSize] = useState(10);
  const [lowStockPage, setLowStockPage] = useState(1);
  const [lowStockPageSize, setLowStockPageSize] = useState(10);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  
  // Main Products state
  const [mainProductDialogOpen, setMainProductDialogOpen] = useState(false);
  const [addProductDialogOpen, setAddProductDialogOpen] = useState(false);
  const [deleteMainProductDialogOpen, setDeleteMainProductDialogOpen] = useState(false);
  const [selectedMainProduct, setSelectedMainProduct] = useState<MainProduct | null>(null);
  const [mainProductForm, setMainProductForm] = useState({ name: "", description: "", mainStockCount: "" });
  const [expandedMainProducts, setExpandedMainProducts] = useState<Set<string>>(new Set());

  // Reset to first page when search changes
  useEffect(() => {
    setProductsPage(1);
  }, [debouncedSearchQuery]);

  // Product form state
  const [productForm, setProductForm] = useState({
    name: "",
    purchaseCost: "",
    price: "",
    quantity: "",
    unit: "",
    categoryId: "",
    image: null as string | null,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });


  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const stockThreshold = settings?.stockThreshold || 10;


  const { data: soldQuantities = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/inventory/sold-quantities"],
  });

  // Inventory stats query
  const { data: inventoryStats } = useQuery<{
    totalProducts: number;
    totalStockValue: number;
    totalPurchaseCost: number;
    totalQuantity: number;
    lowStockCount: number;
    totalShortage: number;
  }>({
    queryKey: ["/api/inventory/stats"],
  });

  // Get date range helper
  const getDateRange = (filter: string): { startDate?: Date; endDate?: Date } | null => {
    const now = new Date();
    switch (filter) {
      case "today":
        return { startDate: startOfDay(now), endDate: endOfDay(now) };
      case "yesterday":
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return { startDate: startOfDay(yesterday), endDate: endOfDay(yesterday) };
      case "thisMonth":
        return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
      case "lastMonth":
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return { startDate: startOfMonth(lastMonth), endDate: endOfMonth(lastMonth) };
      case "thisYear":
        return { startDate: startOfYear(now), endDate: now };
      default:
        return null;
    }
  };

  // Products query with pagination
  const { data: productsData, isLoading: productsLoading } = useQuery<{ products: Product[]; total: number }>({
    queryKey: [
      "/api/products",
      {
        branchId: selectedBranchId,
        limit: productsPageSize,
        offset: (productsPage - 1) * productsPageSize,
        search: debouncedSearchQuery,
        categoryId: selectedCategory === "all" ? undefined : selectedCategory,
        startDate: dateFilter === "custom" && customDate ? startOfDay(customDate).toISOString() : getDateRange(dateFilter)?.startDate?.toISOString(),
        endDate: dateFilter === "custom" && customDate ? endOfDay(customDate).toISOString() : getDateRange(dateFilter)?.endDate?.toISOString(),
        hasShortage: shortageFilter ? true : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        threshold: stockThreshold,
      },
    ],
    enabled: activeTab === "products",
    queryFn: async ({ queryKey }) => {
      const [, filters] = queryKey as [string, any];
      const params = new URLSearchParams();
      for (const key in filters) {
        if (filters[key] !== undefined && filters[key] !== null) {
          params.append(key, String(filters[key]));
        }
      }
      const url = withBranchId(`/api/products?${params.toString()}`, selectedBranchId);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });
  const products = productsData?.products || [];
  const productsTotal = productsData?.total || 0;

  // Overview products query (all products for overview tab)
  const { data: overviewData, isLoading: overviewLoading } = useQuery<{ products: Product[]; total: number }>({
    queryKey: [
      "/api/products",
      {
        branchId: selectedBranchId,
        limit: overviewPageSize,
        offset: (overviewPage - 1) * overviewPageSize,
        search: debouncedOverviewSearch,
        categoryId: overviewCategoryFilter === "all" ? undefined : overviewCategoryFilter,
        status: overviewStatusFilter !== "all" ? overviewStatusFilter : undefined,
        threshold: stockThreshold,
      },
    ],
    enabled: activeTab === "overview",
    queryFn: async ({ queryKey }) => {
      const [, filters] = queryKey as [string, any];
      const params = new URLSearchParams();
      for (const key in filters) {
        if (filters[key] !== undefined && filters[key] !== null) {
          params.append(key, String(filters[key]));
        }
      }
      const url = withBranchId(`/api/products?${params.toString()}`, selectedBranchId);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });
  const overviewProducts = overviewData?.products || [];
  const overviewTotal = overviewData?.total || 0;

  // Low stock products query
  const { data: lowStockData, isLoading: lowStockLoading } = useQuery<{ products: Product[]; total: number }>({
    queryKey: [
      "/api/inventory/low-stock",
      {
        branchId: selectedBranchId,
        threshold: stockThreshold,
        limit: lowStockPageSize,
        offset: (lowStockPage - 1) * lowStockPageSize,
        search: debouncedLowStockSearch,
        categoryId: lowStockCategoryFilter === "all" ? undefined : lowStockCategoryFilter,
      },
    ],
    enabled: activeTab === "low-stock",
    queryFn: async ({ queryKey }) => {
      const [, filters] = queryKey as [string, any];
      const params = new URLSearchParams();
      for (const key in filters) {
        if (filters[key] !== undefined && filters[key] !== null) {
          params.append(key, String(filters[key]));
        }
      }
      const url = withBranchId(`/api/inventory/low-stock?${params.toString()}`, selectedBranchId);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch low stock products");
      const data = await res.json();
      // If API returns array directly, wrap it
      if (Array.isArray(data)) {
        return { products: data, total: data.length };
      }
      return data;
    },
  });
  const lowStockProducts = (Array.isArray(lowStockData) ? lowStockData : lowStockData?.products) || [];
  const lowStockTotal = Array.isArray(lowStockData) ? lowStockData.length : (lowStockData?.total || 0);

  // Adjustments query with pagination
  const { data: adjustmentsData, isLoading: adjustmentsLoading } = useQuery<{ adjustments: InventoryAdjustment[]; total: number }>({
    queryKey: [
      "/api/inventory/adjustments",
      {
        branchId: selectedBranchId,
        limit: historyPageSize,
        offset: (historyPage - 1) * historyPageSize,
        search: debouncedHistorySearch,
        adjustmentType: historyAdjustmentTypeFilter !== "all" ? historyAdjustmentTypeFilter : undefined,
      },
    ],
    enabled: activeTab === "history",
    queryFn: async ({ queryKey }) => {
      const [, filters] = queryKey as [string, any];
      const params = new URLSearchParams();
      for (const key in filters) {
        if (filters[key] !== undefined && filters[key] !== null) {
          params.append(key, String(filters[key]));
        }
      }
      const url = withBranchId(`/api/inventory/adjustments?${params.toString()}`, selectedBranchId);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch adjustments");
      const data = await res.json();
      // If API returns array directly, wrap it
      if (Array.isArray(data)) {
        return { adjustments: data, total: data.length };
      }
      return data;
    },
  });
  const adjustments = (Array.isArray(adjustmentsData) ? adjustmentsData : adjustmentsData?.adjustments) || [];
  const adjustmentsTotal = Array.isArray(adjustmentsData) ? adjustmentsData.length : (adjustmentsData?.total || 0);

  // Query for all products (for dropdowns that need all products)
  const { data: allProductsData, isLoading: allProductsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products", { branchId: selectedBranchId, limit: 10000 }],
    queryFn: async ({ queryKey }) => {
      const [, filters] = queryKey as [string, any];
      const params = new URLSearchParams();
      if (filters.limit) params.append("limit", String(filters.limit));
      const url = withBranchId(`/api/products?${params.toString()}`, selectedBranchId);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      return data.products || [];
    },
  });
  const allProducts = allProductsData || [];

  // Main Products queries
  const { data: mainProductsData, isLoading: mainProductsLoading, error: mainProductsError } = useQuery<MainProduct[]>({
    queryKey: ["/api/main-products"],
  });

  const createAdjustmentMutation = useMutation({
    mutationFn: async (data: { productId: string; adjustmentType: string; quantity: string; reason: string; notes?: string }) => {
      return await apiRequest("POST", "/api/inventory/adjustments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/adjustments"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/products');
        }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/stats"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/inventory/low-stock');
        }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/sold-quantities"] });
      setAdjustmentDialogOpen(false);
      setSelectedProduct(null);
      setQuantity("");
      setReason("");
      setNotes("");
      toast({
        title: "Success",
        description: "Stock adjusted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to adjust stock",
        variant: "destructive",
      });
    },
  });

  const updateAdjustmentMutation = useMutation({
    mutationFn: async (data: { id: string; adjustmentType?: string; quantity?: string; reason?: string; notes?: string }) => {
      const { id, ...updateData } = data;
      return await apiRequest("PUT", `/api/inventory/adjustments/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/adjustments"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/products');
        }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/sold-quantities"] });
      setEditAdjustmentDialogOpen(false);
      setEditingAdjustment(null);
      setQuantity("");
      setReason("");
      setNotes("");
      setAdjustmentType("add");
      toast({
        title: "Success",
        description: "Adjustment updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update adjustment",
        variant: "destructive",
      });
    },
  });

  const deleteAdjustmentMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/inventory/adjustments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/adjustments"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/products');
        }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/sold-quantities"] });
      setDeletingAdjustmentId(null);
      toast({
        title: "Success",
        description: "Adjustment deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete adjustment",
        variant: "destructive",
      });
    },
  });

  const createProductMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/products');
        }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/stats"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/inventory/low-stock');
        }
      });
      setProductDialogOpen(false);
      resetProductForm();
      toast({
        title: "Success",
        description: "Product created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create product",
        variant: "destructive",
      });
    },
  });

  const updateProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest("PATCH", `/api/products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/products');
        }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/stats"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/inventory/low-stock');
        }
      });
      setProductDialogOpen(false);
      resetProductForm();
      toast({
        title: "Success",
        description: "Product updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update product",
        variant: "destructive",
      });
    },
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/products');
        }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/stats"] });
      setDeleteDialogOpen(false);
      setSelectedProduct(null);
      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteProductsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => apiRequest("DELETE", `/api/products/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/products');
        }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/stats"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/inventory/low-stock');
        }
      });
      setSelectedProductIds([]);
      toast({
        title: "Success",
        description: `${selectedProductIds.length} product(s) deleted successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      });
    },
  });

  // Main Products mutations
  const createMainProductMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; mainStockCount?: string }) => {
      const payload: any = { name: data.name };
      if (data.description) payload.description = data.description;
      if (data.mainStockCount && data.mainStockCount.trim()) {
        // Keep as string for PostgreSQL decimal type
        payload.mainStockCount = data.mainStockCount.trim();
      }
      return await apiRequest("POST", "/api/main-products", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/main-products"] });
      setMainProductDialogOpen(false);
      setMainProductForm({ name: "", description: "", mainStockCount: "" });
      setSelectedMainProduct(null);
      toast({
        title: "Success",
        description: "Main product created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create main product",
        variant: "destructive",
      });
    },
  });

  const updateMainProductMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; description?: string; mainStockCount?: string } }) => {
      const payload: any = { name: data.name };
      if (data.description !== undefined) payload.description = data.description;
      if (data.mainStockCount !== undefined) {
        // Keep as string for PostgreSQL decimal type, or null if empty
        payload.mainStockCount = data.mainStockCount.trim() ? data.mainStockCount.trim() : null;
      }
      return await apiRequest("PUT", `/api/main-products/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/main-products"] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/main-products/');
        }
      });
      setMainProductDialogOpen(false);
      setMainProductForm({ name: "", description: "", mainStockCount: "" });
      setSelectedMainProduct(null);
      toast({
        title: "Success",
        description: "Main product updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update main product",
        variant: "destructive",
      });
    },
  });

  const deleteMainProductMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/main-products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/main-products"] });
      setDeleteMainProductDialogOpen(false);
      setSelectedMainProduct(null);
      toast({
        title: "Success",
        description: "Main product deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete main product",
        variant: "destructive",
      });
    },
  });

  const removeProductFromMainMutation = useMutation({
    mutationFn: async ({ mainProductId, itemId }: { mainProductId: string; itemId: string }) => {
      return await apiRequest("DELETE", `/api/main-products/${mainProductId}/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/main-products/');
        }
      });
      toast({
        title: "Success",
        description: "Product removed from main product successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove product from main product",
        variant: "destructive",
      });
    },
  });

  const addProductToMainMutation = useMutation({
    mutationFn: async ({ mainProductId, productId }: { mainProductId: string; productId: string }) => {
      return await apiRequest("POST", `/api/main-products/${mainProductId}/items`, { productId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/main-products/');
        }
      });
      setAddProductDialogOpen(false);
      setSelectedMainProduct(null);
      toast({
        title: "Success",
        description: "Product added to main product successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add product to main product",
        variant: "destructive",
      });
    },
  });

  const updateStockShortMutation = useMutation({
    mutationFn: async ({ id, stockShort, stockShortReason }: { id: string; stockShort: string; stockShortReason?: string }) => {
      const data: any = { stockShort };
      if (stockShortReason !== undefined) data.stockShortReason = stockShortReason;
      return await apiRequest("PATCH", `/api/products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/products');
        }
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/stats"] });
      setStockShortDialogOpen(false);
      setStockShortValue("");
      setStockShortReason("");
      setSelectedProduct(null);
      toast({
        title: "Success",
        description: "Stock shortage updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update stock shortage",
        variant: "destructive",
      });
    },
  });

  const handleOpenStockShortModal = (product: Product) => {
    setSelectedProduct(product);
    setStockShortValue(product.stockShort || "");
    setStockShortReason(product.stockShortReason || "");
    setStockShortDialogOpen(true);
  };

  const handleSaveStockShort = () => {
    if (!selectedProduct) return;
    
    const stockShortNum = parseFloat(stockShortValue);
    if (isNaN(stockShortNum) || stockShortNum < 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid positive number for stock shortage",
        variant: "destructive",
      });
      return;
    }

    updateStockShortMutation.mutate({
      id: selectedProduct.id,
      stockShort: stockShortValue,
      stockShortReason: stockShortReason || undefined,
    });
  };

  const handleAdjustStock = () => {
    if (!selectedProduct || !quantity || !reason) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const trimmedQuantity = quantity.trim();
    const numQuantity = parseFloat(trimmedQuantity);
    
    if (isNaN(numQuantity) || numQuantity <= 0 || !/^\d+(\.\d+)?$/.test(trimmedQuantity)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid positive number for quantity",
        variant: "destructive",
      });
      return;
    }

    createAdjustmentMutation.mutate({
      productId: selectedProduct.id,
      adjustmentType,
      quantity: trimmedQuantity,
      reason,
      notes: notes || undefined,
    });
  };

  const resetProductForm = () => {
    setProductForm({
      name: "",
      purchaseCost: "",
      price: "",
      quantity: "",
      unit: "",
      categoryId: "",
      image: null,
    });
    setIsEditMode(false);
    setSelectedProduct(null);
  };

  const handleAddProduct = () => {
    resetProductForm();
    setIsEditMode(false);
    setProductDialogOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setProductForm({
      name: product.name,
      purchaseCost: product.purchaseCost || "",
      price: product.price,
      quantity: product.quantity,
      unit: product.unit,
      categoryId: product.categoryId,
      image: product.imageUrl,
    });
    setSelectedProduct(product);
    setIsEditMode(true);
    setProductDialogOpen(true);
  };

  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setViewProductDialogOpen(true);
  };

  const handleDeleteProduct = (product: Product) => {
    setSelectedProduct(product);
    setDeleteDialogOpen(true);
  };

  const handleSelectProduct = (productId: string, checked: boolean) => {
    if (checked) {
      setSelectedProductIds([...selectedProductIds, productId]);
    } else {
      setSelectedProductIds(selectedProductIds.filter(id => id !== productId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProductIds(filteredProducts.map(p => p.id));
    } else {
      setSelectedProductIds([]);
    }
  };

  const handleBulkDelete = () => {
    if (selectedProductIds.length === 0) return;
    bulkDeleteProductsMutation.mutate(selectedProductIds);
  };

  const handleProductSubmit = () => {
    if (!productForm.name || !productForm.price || !productForm.quantity || !productForm.unit || !productForm.categoryId) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (isEditMode && selectedProduct) {
      updateProductMutation.mutate({
        id: selectedProduct.id,
        data: productForm,
      });
    } else {
      createProductMutation.mutate(productForm);
    }
  };

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedBranchId) params.append("branchId", selectedBranchId);
      if (selectedCategory !== "all") params.append("categoryId", selectedCategory);
      if (debouncedSearchQuery) params.append("search", debouncedSearchQuery);
      const dateRange = dateFilter === "custom" && customDate 
        ? { startDate: startOfDay(customDate), endDate: endOfDay(customDate) }
        : getDateRange(dateFilter);
      if (dateRange?.startDate) params.append("dateFrom", dateRange.startDate.toISOString());
      if (dateRange?.endDate) params.append("dateTo", dateRange.endDate.toISOString());
      if (shortageFilter) params.append("hasShortage", "true");
      params.append("limit", "50000");
      params.append("offset", "0");
      
      const res = await fetch(`/api/products?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products for export");
      const data = await res.json();
      const allProducts = Array.isArray(data) ? data : (data.products || []);

      const hasSizePrices = (p: Product) => p.sizePrices && Object.keys((p.sizePrices as Record<string, string>) || {}).length > 0;
      const exportData = allProducts.map((p: Product) => {
        const qty = parseFloat(p.quantity);
        const sold = soldQuantities[p.id] || 0;
        const available = qty - sold;
        return {
          "Product Name": p.name,
          "Category": categories.find(c => c.id === p.categoryId)?.name || p.categoryId,
          "Purchase Price (USD)": hasSizePrices(p) ? "Per size" : (p.purchaseCost ? parseFloat(p.purchaseCost) : 0),
          "Selling Price (USD)": hasSizePrices(p) ? "Per size" : parseFloat(p.price),
          "Quantity": qty,
          "Unit": p.unit,
          "Sold Out": `${sold}/${qty}`,
          "Available": available,
          "Status": qty === 0 ? "Out of Stock" : qty <= stockThreshold ? "Low Stock" : "In Stock",
          "Profit Margin": hasSizePrices(p) ? "N/A" : (p.purchaseCost && parseFloat(p.purchaseCost) > 0
            ? (parseFloat(p.price) - parseFloat(p.purchaseCost)).toFixed(2)
            : "N/A"),
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Inventory");
      XLSX.writeFile(wb, `inventory_${format(new Date(), "yyyy-MM-dd")}.xlsx`);

      toast({
        title: "Export Successful",
        description: "Inventory data exported to Excel",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export inventory data",
        variant: "destructive",
      });
    }
  };

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedBranchId) params.append("branchId", selectedBranchId);
      if (selectedCategory !== "all") params.append("categoryId", selectedCategory);
      if (debouncedSearchQuery) params.append("search", debouncedSearchQuery);
      const dateRange = dateFilter === "custom" && customDate 
        ? { startDate: startOfDay(customDate), endDate: endOfDay(customDate) }
        : getDateRange(dateFilter);
      if (dateRange?.startDate) params.append("dateFrom", dateRange.startDate.toISOString());
      if (dateRange?.endDate) params.append("dateTo", dateRange.endDate.toISOString());
      if (shortageFilter) params.append("hasShortage", "true");
      params.append("limit", "50000");
      params.append("offset", "0");
      
      const res = await fetch(`/api/products?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products for export");
      const data = await res.json();
      const allProducts = Array.isArray(data) ? data : (data.products || []);

      const hasSizePrices = (p: Product) => p.sizePrices && Object.keys((p.sizePrices as Record<string, string>) || {}).length > 0;
      const headers = ["Product Name", "Category", "Purchase Price (USD)", "Selling Price (USD)", "Quantity", "Unit", "Sold Out", "Available", "Status"];
      const rows = allProducts.map((p: Product) => {
        const qty = parseFloat(p.quantity);
        const sold = soldQuantities[p.id] || 0;
        const available = qty - sold;
        return [
          p.name,
          categories.find(c => c.id === p.categoryId)?.name || p.categoryId,
          hasSizePrices(p) ? "Per size" : (p.purchaseCost ? parseFloat(p.purchaseCost) : 0),
          hasSizePrices(p) ? "Per size" : parseFloat(p.price),
          qty,
          p.unit,
          `${sold}/${qty}`,
          available,
          qty === 0 ? "Out of Stock" : qty <= stockThreshold ? "Low Stock" : "In Stock",
        ];
      });

      const csvContent = [
        headers.join(","),
        ...rows.map((row: any[]) => row.map((cell: any) => `"${cell}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inventory_${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "Inventory data exported to CSV",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export inventory data",
        variant: "destructive",
      });
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          toast({
            title: "Import Failed",
            description: "No data found in file",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Import Started",
          description: `Processing ${jsonData.length} products...`,
        });

        // Collect all import operations
        const importPromises = jsonData.map(async (row: any) => {
          const category = categories.find(c => c.name === row["Category"]);
          if (!category) {
            throw new Error(`Category "${row["Category"]}" not found for product "${row["Product Name"]}"`);
          }
          if (!row["Product Name"]) {
            throw new Error("Product Name is required");
          }

          const productData = {
            name: row["Product Name"],
            price: row["Price (USD)"]?.toString() || "0",
            quantity: row["Quantity"]?.toString() || "0",
            unit: row["Unit"] || "Unit",
            categoryId: category.id,
            image: null,
          };

          return await apiRequest("POST", "/api/products", productData);
        });

        // Wait for all imports to complete
        const results = await Promise.allSettled(importPromises);
        
        // Count successes and failures
        const successful = results.filter(r => r.status === "fulfilled").length;
        const failed = results.filter(r => r.status === "rejected").length;

        // Invalidate cache after all operations complete
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });

        if (failed === 0) {
          toast({
            title: "Import Successful",
            description: `Successfully imported ${successful} products`,
          });
        } else if (successful > 0) {
          toast({
            title: "Partial Import",
            description: `Imported ${successful} products, ${failed} failed`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Import Failed",
            description: "Failed to import any products. Check category names match existing categories.",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Import Failed",
          description: error instanceof Error ? error.message : "Failed to import inventory data",
          variant: "destructive",
        });
      } finally {
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadSampleTemplate = () => {
    const sampleData = [
      {
        "Product Name": "Sample Product 1",
        "Category": "Rice",
        "Price (USD)": 10.50,
        "Quantity": 100,
        "Unit": "Kg",
      },
      {
        "Product Name": "Sample Product 2",
        "Category": "Soup",
        "Price (USD)": 8.00,
        "Quantity": 50,
        "Unit": "Bowl",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "inventory_import_template.xlsx");

    toast({
      title: "Download Complete",
      description: "Sample template downloaded",
    });
  };

  // Reset page when filters change
  useEffect(() => {
    setProductsPage(1);
  }, [debouncedSearchQuery, selectedCategory, dateFilter, customDate, shortageFilter, statusFilter]);
  
  useEffect(() => {
    setOverviewPage(1);
  }, [debouncedOverviewSearch, overviewCategoryFilter, overviewStatusFilter]);
  
  useEffect(() => {
    setLowStockPage(1);
  }, [debouncedLowStockSearch, lowStockCategoryFilter]);
  
  useEffect(() => {
    setHistoryPage(1);
  }, [debouncedHistorySearch, historyAdjustmentTypeFilter]);

  // Products are already filtered by backend, no need for client-side filtering
  const filteredProducts = products;

  const getStockStatus = (qty: number) => {
    if (qty === 0) return { label: "Out of Stock", variant: "destructive" as const, icon: AlertTriangle };
    if (qty <= stockThreshold) return { label: "Low Stock", variant: "secondary" as const, icon: AlertTriangle };
    return { label: "In Stock", variant: "default" as const, icon: Package };
  };

  const getAdjustmentIcon = (type: string) => {
    switch (type) {
      case "add":
        return <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case "remove":
        return <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />;
      default:
        return <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
  };

  // Calculate pagination info
  const productsTotalPages = Math.ceil(productsTotal / productsPageSize);
  const overviewTotalPages = Math.ceil(overviewTotal / overviewPageSize);
  const lowStockTotalPages = Math.ceil(lowStockTotal / lowStockPageSize);
  const historyTotalPages = Math.ceil(adjustmentsTotal / historyPageSize);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent" data-testid="text-inventory-title">
            Inventory Management
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Track and manage your stock levels and products</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={downloadSampleTemplate} className="gap-2" data-testid="button-download-template">
            <FileSpreadsheet className="w-4 h-4" />
            Sample Template
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2" data-testid="button-import">
            <Upload className="w-4 h-4" />
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImport}
            className="hidden"
          />
          <Button variant="outline" onClick={handleExportExcel} className="gap-2" data-testid="button-export-excel">
            <Download className="w-4 h-4" />
            Export Excel
          </Button>
          <Button variant="outline" onClick={handleExportCSV} className="gap-2" data-testid="button-export-csv">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          {hasPermission("inventory.adjust") && (
            <Button
              onClick={() => {
                setSelectedProduct(null);
                setQuantity("");
                setReason("");
                setNotes("");
                setAdjustmentType("add");
                setAdjustmentDialogOpen(true);
              }}
              className="gap-2"
              data-testid="button-adjust-stock"
            >
              <RefreshCw className="w-4 h-4" />
              Adjust Stock
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {inventoryStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Products</p>
                  <p className="text-2xl font-bold">{inventoryStats.totalProducts || 0}</p>
                </div>
                <Boxes className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Low Stock</p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{inventoryStats.lowStockCount || 0}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Out of Stock</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {((inventoryStats.totalProducts || 0) - (inventoryStats.totalQuantity || 0)) > 0 
                      ? (inventoryStats.totalProducts || 0) - (inventoryStats.totalQuantity || 0)
                      : 0}
                  </p>
                </div>
                <Package className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Stock Value</p>
                  <p className="text-2xl font-bold">${(inventoryStats.totalStockValue || 0).toFixed(2)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Purchase Cost</p>
                  <p className="text-2xl font-bold">${(inventoryStats.totalPurchaseCost || 0).toFixed(2)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Shortage Items</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {(inventoryStats.totalShortage || 0) > 0 ? Math.ceil(inventoryStats.totalShortage || 0) : 0}
                  </p>
                </div>
                <TrendingDownIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Shortage</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {(inventoryStats.totalShortage || 0).toFixed(2)}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="products" className="gap-2" data-testid="tab-products">
            <Package className="w-4 h-4" />
            All Products
          </TabsTrigger>
          <TabsTrigger value="main" className="gap-2" data-testid="tab-main">
            <Boxes className="w-4 h-4" />
            Main
          </TabsTrigger>
          <TabsTrigger value="overview" className="gap-2" data-testid="tab-overview">
            <Package className="w-4 h-4" />
            Stock Overview
          </TabsTrigger>
          <TabsTrigger value="low-stock" className="gap-2" data-testid="tab-low-stock">
            <AlertTriangle className="w-4 h-4" />
            Low Stock ({lowStockTotal})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2" data-testid="tab-history">
            <History className="w-4 h-4" />
            Adjustment History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Products</CardTitle>
                  <CardDescription>Manage your product catalog</CardDescription>
                </div>
                <div className="flex gap-2">
                  {selectedProductIds.length > 0 && (
                    <Button 
                      variant="destructive" 
                      onClick={handleBulkDelete} 
                      className="gap-2"
                      disabled={bulkDeleteProductsMutation.isPending}
                      data-testid="button-delete-selected"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Selected ({selectedProductIds.length})
                    </Button>
                  )}
                  {hasPermission("inventory.create") && (
                    <Button onClick={handleAddProduct} className="gap-2" data-testid="button-add-product">
                      <Plus className="w-4 h-4" />
                      Add Product
                    </Button>
                  )}
                </div>
              </div>
              <div className="pt-4">
                <div className="flex flex-col sm:flex-row gap-2 flex-1">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-products"
                    />
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="in_stock">In Stock</SelectItem>
                      <SelectItem value="low_stock">Low Stock</SelectItem>
                      <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
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
                      <SelectItem value="custom">Custom Date</SelectItem>
                    </SelectContent>
                  </Select>
                  {dateFilter === "custom" && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full sm:w-[160px] justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {customDate ? format(customDate, "PPP") : "Select Date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={customDate}
                          onSelect={setCustomDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                  <Button
                    variant={shortageFilter ? "default" : "outline"}
                    onClick={() => setShortageFilter(!shortageFilter)}
                    className="gap-2"
                    data-testid="button-filter-shortage"
                  >
                    <AlertTriangle className={`w-4 h-4 ${shortageFilter ? "text-white" : ""}`} />
                    {shortageFilter ? "Show All" : `Show Shortage`}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(155, 155, 155, 0.5) transparent' }}>
                <Table>
                  <TableHeader>
                    <TableRow style={{ position: 'sticky', top: 0, backgroundColor: 'hsl(var(--background))', zIndex: 10 }}>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={filteredProducts.length > 0 && selectedProductIds.length === filteredProducts.length}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all products"
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead className="hidden md:table-cell">Category</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">Purchase Price</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">Selling Price</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="hidden sm:table-cell">Unit</TableHead>
                      <TableHead className="text-center">Sold Out</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead className="text-right">Stock Short</TableHead>
                      <TableHead className="hidden md:table-cell">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-muted-foreground">
                        No products found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((product) => {
                      const qty = parseFloat(product.quantity);
                      const status = getStockStatus(qty);
                      return (
                        <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                          <TableCell>
                            <Checkbox
                              checked={selectedProductIds.includes(product.id)}
                              onCheckedChange={(checked) => handleSelectProduct(product.id, checked as boolean)}
                              aria-label={`Select ${product.name}`}
                              data-testid={`checkbox-product-${product.id}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell className="hidden md:table-cell">{categories.find(c => c.id === product.categoryId)?.name || product.categoryId}</TableCell>
                          <TableCell className="text-right font-mono hidden lg:table-cell">
                            {product.sizePrices && Object.keys(product.sizePrices as Record<string, string> || {}).length > 0 ? (
                              <span className="text-muted-foreground text-xs">Per size</span>
                            ) : (
                              product.purchaseCost ? `$${parseFloat(product.purchaseCost).toFixed(2)}` : "-"
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono hidden lg:table-cell">
                            {product.sizePrices && Object.keys(product.sizePrices as Record<string, string> || {}).length > 0 ? (
                              <span className="text-muted-foreground text-xs">Per size</span>
                            ) : (
                              `$${parseFloat(product.price).toFixed(2)}`
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">{qty}</TableCell>
                          <TableCell className="hidden sm:table-cell">{product.unit}</TableCell>
                          <TableCell className="text-center">
                            {(() => {
                              const sold = soldQuantities[product.id] || 0;
                              return (
                                <span className="font-mono text-sm">
                                  {sold}/{qty}
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {(() => {
                              const sold = soldQuantities[product.id] || 0;
                              const available = qty - sold;
                              return available > 0 ? (
                                <span className="text-green-600 dark:text-green-400">{available}</span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              );
                            })()}
                          </TableCell>
                          <TableCell 
                            className="text-right cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => handleOpenStockShortModal(product)}
                          >
                            <div className="flex items-center gap-2 justify-end flex-wrap">
                              <span className="font-mono text-sm">
                                {product.stockShort ? parseFloat(product.stockShort).toFixed(2) : "0.00"}
                              </span>
                              {(() => {
                                const stockShortNum = parseFloat(product.stockShort || "0") || 0;
                                
                                if (stockShortNum > 0) {
                                  return (
                                    <Badge 
                                      variant="destructive" 
                                      className="animate-pulse flex items-center gap-1.5 px-2 py-1 shadow-lg ring-2 ring-red-500/50"
                                      title={`Stock shortage: ${stockShortNum.toFixed(2)} ${product.unit}${product.stockShortReason ? ` - ${product.stockShortReason}` : ""}`}
                                    >
                                      <AlertTriangle className="w-3.5 h-3.5 animate-bounce" />
                                      <span className="font-semibold">Shortage</span>
                                    </Badge>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge variant={status.variant} className="gap-1">
                              <status.icon className="w-3 h-3" />
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewProduct(product)}
                                data-testid={`button-view-${product.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditProduct(product)}
                                data-testid={`button-edit-${product.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteProduct(product)}
                                data-testid={`button-delete-${product.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              </div>
              
              {/* Pagination for Products */}
              {productsLoading ? (
                <div className="mt-4 text-center text-sm text-muted-foreground">Loading...</div>
              ) : (
                <div className="mt-4 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {((productsPage - 1) * productsPageSize) + 1} to {Math.min(productsPage * productsPageSize, productsTotal)} of {productsTotal} products
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Per page:</span>
                      <Select
                        value={String(productsPageSize)}
                        onValueChange={(value) => {
                          setProductsPageSize(Number(value));
                          setProductsPage(1);
                        }}
                      >
                        <SelectTrigger className="w-[70px]">
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
                  {productsTotalPages > 1 && (
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setProductsPage(p => Math.max(1, p - 1))}
                            className={productsPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {Array.from({ length: Math.min(5, productsTotalPages) }, (_, i) => {
                          let pageNum: number;
                          if (productsTotalPages <= 5) {
                            pageNum = i + 1;
                          } else if (productsPage <= 3) {
                            pageNum = i + 1;
                          } else if (productsPage >= productsTotalPages - 2) {
                            pageNum = productsTotalPages - 4 + i;
                          } else {
                            pageNum = productsPage - 2 + i;
                          }
                          return (
                            <PaginationItem key={pageNum}>
                              <PaginationLink
                                onClick={() => setProductsPage(pageNum)}
                                isActive={productsPage === pageNum}
                                className="cursor-pointer"
                              >
                                {pageNum}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                        {productsTotalPages > 5 && productsPage < productsTotalPages - 2 && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setProductsPage(p => Math.min(productsTotalPages, p + 1))}
                            className={productsPage === productsTotalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
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

        <TabsContent value="main" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Main Products</CardTitle>
                  <CardDescription>Manage main products and their linked sub-products</CardDescription>
                </div>
                <Button onClick={() => {
                  setMainProductForm({ name: "", description: "", mainStockCount: "" });
                  setSelectedMainProduct(null);
                  setMainProductDialogOpen(true);
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Main Product
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {mainProductsLoading ? (
                <div className="text-center py-8">Loading...</div>
              ) : mainProductsError ? (
                <div className="text-center py-8 text-red-500">Failed to load main products</div>
              ) : mainProductsData && mainProductsData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No main products found. Create one to get started.</div>
              ) : (
                <div className="max-h-[600px] overflow-y-auto space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(155, 155, 155, 0.5) transparent' }}>
                  {mainProductsData?.map((mainProduct) => (
                    <MainProductCard 
                      key={mainProduct.id} 
                      mainProduct={mainProduct}
                      categories={categories}
                      onEdit={(mp) => {
                        setSelectedMainProduct(mp);
                        setMainProductForm({ 
                          name: mp.name, 
                          description: mp.description || "", 
                          mainStockCount: mp.mainStockCount ? String(mp.mainStockCount) : "" 
                        });
                        setMainProductDialogOpen(true);
                      }}
                      onAddProduct={(mp) => {
                        setSelectedMainProduct(mp);
                        setAddProductDialogOpen(true);
                      }}
                      onDelete={(mp) => {
                        setSelectedMainProduct(mp);
                        setDeleteMainProductDialogOpen(true);
                      }}
                      onRemoveProduct={(mainProductId, itemId, productName) => {
                        if (confirm(`Are you sure you want to remove "${productName}" from this main product?`)) {
                          removeProductFromMainMutation.mutate({ mainProductId, itemId });
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stock Overview</CardTitle>
              <CardDescription>Complete inventory with stock levels</CardDescription>
              <div className="pt-4">
                <div className="flex flex-col sm:flex-row gap-2 flex-1">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products..."
                      value={overviewSearchQuery}
                      onChange={(e) => setOverviewSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={overviewCategoryFilter} onValueChange={setOverviewCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={overviewStatusFilter} onValueChange={setOverviewStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="in_stock">In Stock</SelectItem>
                      <SelectItem value="low_stock">Low Stock</SelectItem>
                      <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(155, 155, 155, 0.5) transparent' }}>
                <Table>
                  <TableHeader>
                    <TableRow style={{ position: 'sticky', top: 0, backgroundColor: 'hsl(var(--background))', zIndex: 10 }}>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overviewLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : overviewProducts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No products found
                        </TableCell>
                      </TableRow>
                    ) : (
                      overviewProducts.map((product) => {
                        const qty = parseFloat(product.quantity);
                        const status = getStockStatus(qty);
                        return (
                          <TableRow key={product.id} data-testid={`row-overview-${product.id}`}>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell>{categories.find(c => c.id === product.categoryId)?.name || product.categoryId}</TableCell>
                            <TableCell>{product.unit}</TableCell>
                            <TableCell className="text-right font-mono">{qty}</TableCell>
                            <TableCell>
                              <Badge variant={status.variant} className="gap-1">
                                <status.icon className="w-3 h-3" />
                                {status.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {hasPermission("inventory.adjust") && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedProduct(product);
                                    setQuantity("");
                                    setReason("");
                                    setNotes("");
                                    setAdjustmentType("add");
                                    setAdjustmentDialogOpen(true);
                                  }}
                                  data-testid={`button-adjust-${product.id}`}
                                >
                                  Adjust
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination for Overview */}
              {overviewTotal > 0 && (
                <div className="mt-4 flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {((overviewPage - 1) * overviewPageSize) + 1} to {Math.min(overviewPage * overviewPageSize, overviewTotal)} of {overviewTotal} products
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Per page:</span>
                      <Select
                        value={overviewPageSize.toString()}
                        onValueChange={(value) => {
                          setOverviewPageSize(parseInt(value, 10));
                          setOverviewPage(1);
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
                  {overviewTotalPages > 1 && (
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setOverviewPage(p => Math.max(1, p - 1))}
                            className={overviewPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {Array.from({ length: Math.min(5, overviewTotalPages) }, (_, i) => {
                          let pageNum: number;
                          if (overviewTotalPages <= 5) {
                            pageNum = i + 1;
                          } else if (overviewPage <= 3) {
                            pageNum = i + 1;
                          } else if (overviewPage >= overviewTotalPages - 2) {
                            pageNum = overviewTotalPages - 4 + i;
                          } else {
                            pageNum = overviewPage - 2 + i;
                          }
                          return (
                            <PaginationItem key={pageNum}>
                              <PaginationLink
                                onClick={() => setOverviewPage(pageNum)}
                                isActive={overviewPage === pageNum}
                                className="cursor-pointer"
                              >
                                {pageNum}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        })}
                        {overviewTotalPages > 5 && overviewPage < overviewTotalPages - 2 && (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setOverviewPage(p => Math.min(overviewTotalPages, p + 1))}
                            className={overviewPage === overviewTotalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
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

        <TabsContent value="low-stock" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Low Stock Alerts
              </CardTitle>
              <CardDescription>
                Products with stock below {stockThreshold} units
              </CardDescription>
              <div className="pt-4">
                <div className="flex flex-col sm:flex-row gap-2 flex-1">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products..."
                      value={lowStockSearchQuery}
                      onChange={(e) => setLowStockSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={lowStockCategoryFilter} onValueChange={setLowStockCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {lowStockLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50 animate-pulse" />
                  <p>Loading...</p>
                </div>
              ) : lowStockProducts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No low stock products</p>
                  <p className="text-sm mt-1">All products are well stocked!</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(155, 155, 155, 0.5) transparent' }}>
                    <Table>
                      <TableHeader>
                        <TableRow style={{ position: 'sticky', top: 0, backgroundColor: 'hsl(var(--background))', zIndex: 10 }}>
                          <TableHead>Product Name</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead className="text-right">Current Stock</TableHead>
                          <TableHead className="text-right">Threshold</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lowStockProducts.map((product) => (
                          <TableRow key={product.id} data-testid={`row-low-stock-${product.id}`}>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell>{product.unit}</TableCell>
                            <TableCell className="text-right font-mono text-destructive font-bold">
                              {parseFloat(product.quantity)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {stockThreshold}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setQuantity("");
                                  setReason("");
                                  setNotes("");
                                  setAdjustmentType("add");
                                  setAdjustmentDialogOpen(true);
                                }}
                                data-testid={`button-restock-${product.id}`}
                              >
                                <Plus className="w-4 h-4 mr-1" />
                                Restock
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Pagination for Low Stock */}
                  {lowStockTotal > 0 && (
                    <div className="mt-4 flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-muted-foreground">
                          Showing {((lowStockPage - 1) * lowStockPageSize) + 1} to {Math.min(lowStockPage * lowStockPageSize, lowStockTotal)} of {lowStockTotal} products
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Per page:</span>
                          <Select
                            value={String(lowStockPageSize)}
                            onValueChange={(value) => {
                              setLowStockPageSize(Number(value));
                              setLowStockPage(1);
                            }}
                          >
                            <SelectTrigger className="w-[70px]">
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
                      {lowStockTotalPages > 1 && (
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                onClick={() => setLowStockPage(p => Math.max(1, p - 1))}
                                className={lowStockPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                              />
                            </PaginationItem>
                            {Array.from({ length: Math.min(5, lowStockTotalPages) }, (_, i) => {
                              let pageNum: number;
                              if (lowStockTotalPages <= 5) {
                                pageNum = i + 1;
                              } else if (lowStockPage <= 3) {
                                pageNum = i + 1;
                              } else if (lowStockPage >= lowStockTotalPages - 2) {
                                pageNum = lowStockTotalPages - 4 + i;
                              } else {
                                pageNum = lowStockPage - 2 + i;
                              }
                              return (
                                <PaginationItem key={pageNum}>
                                  <PaginationLink
                                    onClick={() => setLowStockPage(pageNum)}
                                    isActive={lowStockPage === pageNum}
                                    className="cursor-pointer"
                                  >
                                    {pageNum}
                                  </PaginationLink>
                                </PaginationItem>
                              );
                            })}
                            {lowStockTotalPages > 5 && lowStockPage < lowStockTotalPages - 2 && (
                              <PaginationItem>
                                <PaginationEllipsis />
                              </PaginationItem>
                            )}
                            <PaginationItem>
                              <PaginationNext
                                onClick={() => setLowStockPage(p => Math.min(lowStockTotalPages, p + 1))}
                                className={lowStockPage === lowStockTotalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
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

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Adjustment History</CardTitle>
              <CardDescription>All stock movements and adjustments</CardDescription>
              <div className="pt-4">
                <div className="flex flex-col sm:flex-row gap-2 flex-1">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by product name..."
                      value={historySearchQuery}
                      onChange={(e) => setHistorySearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={historyAdjustmentTypeFilter} onValueChange={setHistoryAdjustmentTypeFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="add">Add</SelectItem>
                      <SelectItem value="remove">Remove</SelectItem>
                      <SelectItem value="set">Set</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {adjustmentsLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-50 animate-pulse" />
                  <p>Loading...</p>
                </div>
              ) : adjustments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No adjustment history</p>
                  <p className="text-sm mt-1">Stock adjustments will appear here</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto max-h-[600px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(155, 155, 155, 0.5) transparent' }}>
                    <Table>
                      <TableHeader>
                        <TableRow style={{ position: 'sticky', top: 0, backgroundColor: 'hsl(var(--background))', zIndex: 10 }}>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Product</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Notes</TableHead>
                          {hasPermission("inventory.adjust") && <TableHead className="text-right">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adjustments.map((adjustment) => {
                          // Fetch product from all products or use a separate query
                          const product = [...products, ...overviewProducts, ...lowStockProducts].find(p => p.id === adjustment.productId);
                          return (
                            <TableRow key={adjustment.id} data-testid={`row-adjustment-${adjustment.id}`}>
                              <TableCell className="text-sm">
                                {format(new Date(adjustment.createdAt), "MMM dd, yyyy HH:mm")}
                              </TableCell>
                              <TableCell className="font-medium">
                                {product?.name || "Unknown Product"}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {getAdjustmentIcon(adjustment.adjustmentType)}
                                  <span className="capitalize">{adjustment.adjustmentType}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {parseFloat(adjustment.quantity)} {product?.unit}
                              </TableCell>
                              <TableCell className="capitalize">{adjustment.reason}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {adjustment.notes || "-"}
                              </TableCell>
                              {hasPermission("inventory.adjust") && (
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => {
                                        setEditingAdjustment(adjustment);
                                        setAdjustmentType(adjustment.adjustmentType as "add" | "remove" | "set");
                                        setQuantity(adjustment.quantity);
                                        setReason(adjustment.reason);
                                        setNotes(adjustment.notes || "");
                                        setEditAdjustmentDialogOpen(true);
                                      }}
                                      data-testid={`button-edit-adjustment-${adjustment.id}`}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      onClick={() => setDeletingAdjustmentId(adjustment.id)}
                                      data-testid={`button-delete-adjustment-${adjustment.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Pagination for History */}
                  {adjustmentsTotal > 0 && (
                    <div className="mt-4 flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <div className="text-sm text-muted-foreground">
                          Showing {((historyPage - 1) * historyPageSize) + 1} to {Math.min(historyPage * historyPageSize, adjustmentsTotal)} of {adjustmentsTotal} adjustments
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Per page:</span>
                          <Select
                            value={historyPageSize.toString()}
                            onValueChange={(value) => {
                              setHistoryPageSize(parseInt(value, 10));
                              setHistoryPage(1);
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
                      {historyTotalPages > 1 && (
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious
                                onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                className={historyPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                              />
                            </PaginationItem>
                            {Array.from({ length: Math.min(5, historyTotalPages) }, (_, i) => {
                              let pageNum: number;
                              if (historyTotalPages <= 5) {
                                pageNum = i + 1;
                              } else if (historyPage <= 3) {
                                pageNum = i + 1;
                              } else if (historyPage >= historyTotalPages - 2) {
                                pageNum = historyTotalPages - 4 + i;
                              } else {
                                pageNum = historyPage - 2 + i;
                              }
                              return (
                                <PaginationItem key={pageNum}>
                                  <PaginationLink
                                    onClick={() => setHistoryPage(pageNum)}
                                    isActive={historyPage === pageNum}
                                    className="cursor-pointer"
                                  >
                                    {pageNum}
                                  </PaginationLink>
                                </PaginationItem>
                              );
                            })}
                            {historyTotalPages > 5 && historyPage < historyTotalPages - 2 && (
                              <PaginationItem>
                                <PaginationEllipsis />
                              </PaginationItem>
                            )}
                            <PaginationItem>
                              <PaginationNext
                                onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))}
                                className={historyPage === historyTotalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
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

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustmentDialogOpen} onOpenChange={setAdjustmentDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg" data-testid="dialog-adjust-stock">
          <DialogHeader>
            <DialogTitle>Adjust Stock Level</DialogTitle>
            <DialogDescription>
              Add, remove, or set stock quantity for a product
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2 w-full">
              <Label htmlFor="product">Product *</Label>
              <div className="w-full min-w-0">
              <ProductSelect
                value={selectedProduct?.id}
                onValueChange={(value) => {
                  const product =
                    allProducts.find((p) => p.id === value) ??
                    overviewProducts.find((p) => p.id === value) ??
                    lowStockProducts.find((p) => p.id === value);
                  setSelectedProduct(product || null);
                }}
                placeholder="Select product"
                showUnit={true}
                dataTestId="select-product"
                products={
                  selectedProduct
                    ? [selectedProduct, ...allProducts.filter((p) => p.id !== selectedProduct.id)]
                    : allProducts
                }
                isLoading={!selectedProduct && allProductsLoading}
              />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjustment-type">Adjustment Type *</Label>
              <Select value={adjustmentType} onValueChange={(value: any) => setAdjustmentType(value)}>
                <SelectTrigger id="adjustment-type" data-testid="select-adjustment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add Stock</SelectItem>
                  <SelectItem value="remove">Remove Stock</SelectItem>
                  <SelectItem value="set">Set Stock Level</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                step="0.01"
                placeholder="Enter quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                data-testid="input-quantity"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="reason" data-testid="select-reason">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">New Purchase</SelectItem>
                  <SelectItem value="sale">Sale/Usage</SelectItem>
                  <SelectItem value="damage">Damage/Spoilage</SelectItem>
                  <SelectItem value="return">Return</SelectItem>
                  <SelectItem value="correction">Stock Correction</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                data-testid="input-notes"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustmentDialogOpen(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button onClick={handleAdjustStock} disabled={createAdjustmentMutation.isPending} data-testid="button-save-adjustment">
              {createAdjustmentMutation.isPending ? "Saving..." : "Save Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Adjustment Dialog */}
      <Dialog open={editAdjustmentDialogOpen} onOpenChange={setEditAdjustmentDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md" data-testid="dialog-edit-adjustment">
          <DialogHeader>
            <DialogTitle>Edit Stock Adjustment</DialogTitle>
            <DialogDescription>
              Update the adjustment details. This will recalculate the product quantity.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-adjustment-type">Adjustment Type *</Label>
              <Select 
                value={adjustmentType} 
                onValueChange={(value: any) => setAdjustmentType(value)}
                disabled={!!editingAdjustment}
              >
                <SelectTrigger id="edit-adjustment-type" data-testid="select-edit-adjustment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Add Stock</SelectItem>
                  <SelectItem value="remove">Remove Stock</SelectItem>
                  <SelectItem value="set">Set Stock Level</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-quantity">Quantity *</Label>
              <Input
                id="edit-quantity"
                type="number"
                min="0"
                step="0.01"
                placeholder="Enter quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                data-testid="input-edit-quantity"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-reason">Reason *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id="edit-reason" data-testid="select-edit-reason">
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">New Purchase</SelectItem>
                  <SelectItem value="sale">Sale/Usage</SelectItem>
                  <SelectItem value="damage">Damage/Spoilage</SelectItem>
                  <SelectItem value="return">Return</SelectItem>
                  <SelectItem value="correction">Stock Correction</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes (Optional)</Label>
              <Textarea
                id="edit-notes"
                placeholder="Additional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                data-testid="input-edit-notes"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditAdjustmentDialogOpen(false);
              setEditingAdjustment(null);
              setQuantity("");
              setReason("");
              setNotes("");
              setAdjustmentType("add");
            }} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (!editingAdjustment) return;
                if (!quantity || !reason) {
                  toast({
                    title: "Validation Error",
                    description: "Please fill in all required fields",
                    variant: "destructive",
                  });
                  return;
                }
                updateAdjustmentMutation.mutate({
                  id: editingAdjustment.id,
                  adjustmentType,
                  quantity,
                  reason,
                  notes: notes || undefined,
                });
              }} 
              disabled={updateAdjustmentMutation.isPending} 
              data-testid="button-save-edit-adjustment"
            >
              {updateAdjustmentMutation.isPending ? "Updating..." : "Update Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Adjustment Confirmation Dialog */}
      <Dialog open={!!deletingAdjustmentId} onOpenChange={(open) => !open && setDeletingAdjustmentId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Adjustment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this adjustment? This will reverse its effect on the product quantity.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingAdjustmentId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletingAdjustmentId) {
                  deleteAdjustmentMutation.mutate(deletingAdjustmentId);
                }
              }}
              disabled={deleteAdjustmentMutation.isPending}
            >
              {deleteAdjustmentMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Add/Edit Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md" data-testid="dialog-product">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Edit Product" : "Add New Product"}</DialogTitle>
            <DialogDescription>
              {isEditMode ? "Update product information" : "Create a new product"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">Product Name *</Label>
              <Input
                id="product-name"
                placeholder="Enter product name"
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                data-testid="input-product-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-category">Category *</Label>
              <CategorySelect
                value={productForm.categoryId}
                onValueChange={(value) => setProductForm({ ...productForm, categoryId: value })}
                placeholder="Select category"
                dataTestId="select-category"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product-purchase-cost">Purchase Price (USD)</Label>
                <Input
                  id="product-purchase-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={productForm.purchaseCost}
                  onChange={(e) => setProductForm({ ...productForm, purchaseCost: e.target.value })}
                  data-testid="input-product-purchase-cost"
                />
                <p className="text-xs text-muted-foreground">Cost at which you purchase this product</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-price">Selling Price (USD) *</Label>
                <Input
                  id="product-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={productForm.price}
                  onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                  data-testid="input-product-price"
                />
                <p className="text-xs text-muted-foreground">Price at which you sell this product</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="product-quantity">Quantity *</Label>
                <Input
                  id="product-quantity"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={productForm.quantity}
                  onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })}
                  data-testid="input-product-quantity"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="product-unit">Unit *</Label>
                <UnitSelect
                  value={productForm.unit}
                  onValueChange={(value) => setProductForm({ ...productForm, unit: value })}
                  placeholder="Select unit"
                  id="product-unit"
                  data-testid="input-product-unit"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductDialogOpen(false)} data-testid="button-product-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleProductSubmit}
              disabled={createProductMutation.isPending || updateProductMutation.isPending}
              data-testid="button-product-save"
            >
              {createProductMutation.isPending || updateProductMutation.isPending ? "Saving..." : isEditMode ? "Update Product" : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Product Dialog */}
      <Dialog open={viewProductDialogOpen} onOpenChange={setViewProductDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md" data-testid="dialog-view-product">
          <DialogHeader>
            <DialogTitle>Product Details</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-muted-foreground">Product Name</Label>
                <p className="text-lg font-medium">{selectedProduct.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Category</Label>
                <p>{categories.find(c => c.id === selectedProduct.categoryId)?.name || selectedProduct.categoryId}</p>
              </div>
              {selectedProduct.sizePrices && Object.keys(selectedProduct.sizePrices as Record<string, string> || {}).length > 0 ? (
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Size-based pricing</Label>
                  <div className="rounded border p-2 space-y-1 text-sm">
                    {Object.entries(selectedProduct.sizePrices as Record<string, string> || {}).map(([size, sellPrice]) => {
                      const purchasePrices = selectedProduct.sizePurchasePrices as Record<string, string> | null | undefined;
                      const purchasePrice = purchasePrices?.[size];
                      return (
                        <div key={size} className="flex justify-between gap-4">
                          <span className="font-medium">{size}</span>
                          <span className="font-mono">
                            Purchase: {purchasePrice ? `$${parseFloat(purchasePrice).toFixed(2)}` : "N/A"} → Sell: ${parseFloat(sellPrice).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Purchase Price</Label>
                      <p className="font-mono">
                        {selectedProduct.purchaseCost ? `$${parseFloat(selectedProduct.purchaseCost).toFixed(2)}` : "N/A"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Selling Price</Label>
                      <p className="font-mono">${parseFloat(selectedProduct.price).toFixed(2)}</p>
                    </div>
                  </div>
                  {selectedProduct.purchaseCost && parseFloat(selectedProduct.purchaseCost) > 0 && (
                    <div>
                      <Label className="text-muted-foreground">Profit Margin</Label>
                      <p className="font-mono text-green-600 font-semibold">
                        ${(parseFloat(selectedProduct.price) - parseFloat(selectedProduct.purchaseCost)).toFixed(2)}
                        ({(((parseFloat(selectedProduct.price) - parseFloat(selectedProduct.purchaseCost)) / parseFloat(selectedProduct.purchaseCost)) * 100).toFixed(1)}%)
                      </p>
                    </div>
                  )}
                </>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Quantity</Label>
                  <p className="font-mono">{parseFloat(selectedProduct.quantity)} {selectedProduct.unit}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Unit</Label>
                  <p>{selectedProduct.unit}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1">
                  {(() => {
                    const qty = parseFloat(selectedProduct.quantity);
                    const status = getStockStatus(qty);
                    return (
                      <Badge variant={status.variant} className="gap-1">
                        <status.icon className="w-3 h-3" />
                        {status.label}
                      </Badge>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewProductDialogOpen(false)} data-testid="button-close-view">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-sm" data-testid="dialog-delete-product">
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedProduct?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} data-testid="button-delete-cancel">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedProduct && deleteProductMutation.mutate(selectedProduct.id)}
              disabled={deleteProductMutation.isPending}
              data-testid="button-delete-confirm"
            >
              {deleteProductMutation.isPending ? "Deleting..." : "Delete Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Short Edit Dialog */}
      <Dialog open={stockShortDialogOpen} onOpenChange={setStockShortDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md" data-testid="dialog-stock-short">
          <DialogHeader>
            <DialogTitle>Edit Stock Shortage</DialogTitle>
            <DialogDescription>
              {selectedProduct && `Update stock shortage for "${selectedProduct.name}"`}
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="stock-short-amount">Stock Short Amount ({selectedProduct.unit}) *</Label>
                <Input
                  id="stock-short-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={stockShortValue}
                  onChange={(e) => setStockShortValue(e.target.value)}
                  data-testid="input-stock-short-amount"
                />
                <p className="text-xs text-muted-foreground">
                  Current available: {parseFloat(selectedProduct.quantity).toFixed(2)} {selectedProduct.unit}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stock-short-reason">Shortage Reason</Label>
                <Textarea
                  id="stock-short-reason"
                  placeholder="Enter the reason for the stock shortage (e.g., damaged items, theft, expired, etc.)"
                  value={stockShortReason}
                  onChange={(e) => setStockShortReason(e.target.value)}
                  rows={4}
                  data-testid="textarea-stock-short-reason"
                />
                <p className="text-xs text-muted-foreground">
                  Optional: Provide details about why there is a stock shortage
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockShortDialogOpen(false)} data-testid="button-stock-short-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleSaveStockShort}
              disabled={updateStockShortMutation.isPending}
              data-testid="button-stock-short-save"
            >
              {updateStockShortMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Product Dialog */}
      <Dialog open={mainProductDialogOpen} onOpenChange={setMainProductDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedMainProduct ? "Edit Main Product" : "Create Main Product"}</DialogTitle>
            <DialogDescription>
              {selectedMainProduct ? "Update the main product details" : "Create a new main product to group multiple products together"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="main-product-name">Name *</Label>
              <Input
                id="main-product-name"
                value={mainProductForm.name}
                onChange={(e) => setMainProductForm({ ...mainProductForm, name: e.target.value })}
                placeholder="e.g., Sting, Pepsi, Coca-Cola"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="main-product-description">Description (Optional)</Label>
              <Textarea
                id="main-product-description"
                value={mainProductForm.description}
                onChange={(e) => setMainProductForm({ ...mainProductForm, description: e.target.value })}
                placeholder="Description of the main product"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="main-product-stock-count">Main Stock Count (Optional)</Label>
              <Input
                id="main-product-stock-count"
                type="number"
                step="0.01"
                min="0"
                value={mainProductForm.mainStockCount}
                onChange={(e) => setMainProductForm({ ...mainProductForm, mainStockCount: e.target.value })}
                placeholder="e.g., 240"
              />
              <p className="text-xs text-muted-foreground">
                The main stock count for this product. This will be used in calculations.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setMainProductDialogOpen(false);
              setMainProductForm({ name: "", description: "", mainStockCount: "" });
              setSelectedMainProduct(null);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (!mainProductForm.name.trim()) {
                  toast({
                    title: "Validation Error",
                    description: "Name is required",
                    variant: "destructive",
                  });
                  return;
                }
                if (selectedMainProduct) {
                  updateMainProductMutation.mutate({ id: selectedMainProduct.id, data: mainProductForm });
                } else {
                  createMainProductMutation.mutate(mainProductForm);
                }
              }}
              disabled={createMainProductMutation.isPending || updateMainProductMutation.isPending}
            >
              {createMainProductMutation.isPending || updateMainProductMutation.isPending 
                ? "Saving..." 
                : selectedMainProduct 
                  ? "Update" 
                  : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Product to Main Product Dialog */}
      <Dialog open={addProductDialogOpen} onOpenChange={setAddProductDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Product to {selectedMainProduct?.name}</DialogTitle>
            <DialogDescription>
              Select a product to link to this main product
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product-select">Product *</Label>
              <ProductSelect
                value={selectedProduct?.id || ""}
                onValueChange={(value) => {
                  const product = allProducts.find(p => p.id === value);
                  setSelectedProduct(product || null);
                }}
                placeholder="Select a product"
                showUnit={true}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddProductDialogOpen(false);
              setSelectedProduct(null);
              setSelectedMainProduct(null);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (!selectedProduct || !selectedMainProduct) {
                  toast({
                    title: "Validation Error",
                    description: "Please select a product",
                    variant: "destructive",
                  });
                  return;
                }
                addProductToMainMutation.mutate({ 
                  mainProductId: selectedMainProduct.id, 
                  productId: selectedProduct.id 
                });
              }}
              disabled={addProductToMainMutation.isPending}
            >
              {addProductToMainMutation.isPending ? "Adding..." : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Main Product Confirmation Dialog */}
      {selectedMainProduct && (
        <Dialog open={deleteMainProductDialogOpen && !!selectedMainProduct} onOpenChange={(open) => {
          if (!open) {
            setDeleteMainProductDialogOpen(false);
            setSelectedMainProduct(null);
          }
        }}>
          <DialogContent className="w-[95vw] sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Main Product</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{selectedMainProduct?.name}"? This will unlink all associated products but won't delete the products themselves. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setDeleteMainProductDialogOpen(false);
                setSelectedMainProduct(null);
              }}>
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={() => {
                  if (selectedMainProduct) {
                    deleteMainProductMutation.mutate(selectedMainProduct.id);
                  }
                }}
                disabled={deleteMainProductMutation.isPending}
              >
                {deleteMainProductMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
