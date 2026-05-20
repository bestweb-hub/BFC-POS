import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductSchema, insertCategorySchema, type Product, type Category } from "@shared/schema";
import type { z } from "zod";
import { Plus, Search, Download, Upload, Edit, Trash2, PackagePlus, FolderPlus, Utensils, Calendar, ImagePlus, X, FileSpreadsheet, QrCode, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as XLSX from 'xlsx';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const UNIT_OPTIONS = ["piece", "kg", "gram", "ml", "litre", "plate", "serving", "bowl", "cup", "glass", "box"];

// Barcode Display Component
function BarcodeDisplay({ barcode, productName, price, settings }: { barcode: string; productName: string; price: string; settings?: any }) {
  const barcodeSvgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeSvgRef.current) {
      try {
        JsBarcode(barcodeSvgRef.current, barcode, {
          format: "CODE128",
          width: 2,
          height: 80,
          displayValue: true,
          fontSize: 14,
        });
      } catch (error) {
        console.error("Failed to generate barcode:", error);
      }
    }
  }, [barcode]);

  return (
    <>
      <svg ref={barcodeSvgRef} className="max-w-full h-auto"></svg>
      <p className="mt-4 text-sm font-mono text-muted-foreground">
        {barcode}
      </p>
      <p className="mt-2 text-xs text-muted-foreground text-center">
        {productName}
      </p>
      <div className="mt-3 text-center">
        <p className="text-sm font-semibold text-primary">
          ${parseFloat(price).toFixed(2)} USD
        </p>
        {settings?.exchangeRate && (
          <p className="text-xs text-muted-foreground">
            {(parseFloat(price) * parseFloat(settings.exchangeRate)).toLocaleString('en-US', { maximumFractionDigits: 0 })} {settings?.secondaryCurrencySymbol || "៛"}
          </p>
        )}
      </div>
    </>
  );
}

const DATE_FILTER_OPTIONS = [
  { label: "All Time", value: "all" },
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "This Month", value: "thisMonth" },
  { label: "Last Month", value: "lastMonth" },
  { label: "January", value: "january" },
  { label: "February", value: "february" },
  { label: "March", value: "march" },
  { label: "April", value: "april" },
  { label: "May", value: "may" },
  { label: "June", value: "june" },
  { label: "July", value: "july" },
  { label: "August", value: "august" },
  { label: "September", value: "september" },
  { label: "October", value: "october" },
  { label: "November", value: "november" },
  { label: "December", value: "december" },
  { label: "Custom Date", value: "custom" },
];

export default function ItemManage() {
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  /** Multiple category filter: empty = all categories; otherwise show items in any of the selected categories. Use NONE_CATEGORY_ID for items without a category. */
  const NONE_CATEGORY_ID = "__none__";
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [qrCodeDialogOpen, setQrCodeDialogOpen] = useState(false);
  const [selectedProductForQR, setSelectedProductForQR] = useState<Product | null>(null);
  const [codeType, setCodeType] = useState<"qr" | "barcode">("qr");
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [sizePrices, setSizePrices] = useState<Record<string, string>>({}); // Store size prices: { "S": "100", "M": "150", "L": "200" }
  const [sizePurchasePrices, setSizePurchasePrices] = useState<Record<string, string>>({}); // Purchase cost per size when size pricing
  const [sizeInputs, setSizeInputs] = useState<string[]>([]); // Available sizes: ["S", "M", "L"]
  const [addSizeDialogOpen, setAddSizeDialogOpen] = useState(false);
  const [newSizeInput, setNewSizeInput] = useState("");
  const [enableSizePricing, setEnableSizePricing] = useState(false); // Toggle for size-based pricing
  const [createMissingCategoriesOnImport, setCreateMissingCategoriesOnImport] = useState(true); // Create categories from Excel if not found

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings"],
  });

  const observerTarget = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const getItemsDateRange = useCallback((): { dateFrom?: Date; dateTo?: Date } => {
    if (selectedMonths.length > 0) {
      const sorted = [...selectedMonths].sort();
      const [y1, m1] = sorted[0].split("-").map(Number);
      const [y2, m2] = sorted[sorted.length - 1].split("-").map(Number);
      return {
        dateFrom: new Date(y1, m1 - 1, 1),
        dateTo: new Date(y2, m2, 0, 23, 59, 59, 999),
      };
    }
    const now = new Date();
    const y = now.getFullYear();
    if (dateFilter === "today") {
      const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { dateFrom: t, dateTo: new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59, 999) };
    }
    if (dateFilter === "yesterday") {
      const t = new Date(now); t.setDate(t.getDate() - 1);
      return { dateFrom: t, dateTo: new Date(t.getFullYear(), t.getMonth(), t.getDate(), 23, 59, 59, 999) };
    }
    if (dateFilter === "thisMonth") return { dateFrom: new Date(y, now.getMonth(), 1), dateTo: new Date(y, now.getMonth() + 1, 0, 23, 59, 59, 999) };
    if (dateFilter === "lastMonth") return { dateFrom: new Date(y, now.getMonth() - 1, 1), dateTo: new Date(y, now.getMonth(), 0, 23, 59, 59, 999) };
    if (dateFilter === "custom" && customDate) {
      const d = new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate());
      return { dateFrom: d, dateTo: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999) };
    }
    if (["january","february","march","april","may","june","july","august","september","october","november","december"].includes(dateFilter)) {
      const m = ["january","february","march","april","may","june","july","august","september","october","november","december"].indexOf(dateFilter);
      return { dateFrom: new Date(y, m, 1), dateTo: new Date(y, m + 1, 0, 23, 59, 59, 999) };
    }
    return {};
  }, [dateFilter, customDate, selectedMonths]);

  const itemsListParamsString = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearchQuery) params.append("search", debouncedSearchQuery);
    if (selectedCategoryIds.length === 1) params.append("categoryId", selectedCategoryIds[0]);
    const dateRange = getItemsDateRange();
    if (dateRange.dateFrom) params.append("dateFrom", dateRange.dateFrom.toISOString());
    if (dateRange.dateTo) params.append("dateTo", dateRange.dateTo.toISOString());
    return params.toString();
  }, [debouncedSearchQuery, selectedCategoryIds, getItemsDateRange]);

  // Use infinite query for products with pagination (key includes params so month/date filter triggers refetch)
  const {
    data: productsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: productsLoading,
  } = useInfiniteQuery<{ products: Product[]; total: number }>({
    queryKey: ["/api/products", itemsListParamsString],
    queryFn: async ({ pageParam = 0 }) => {
      const params = new URLSearchParams(itemsListParamsString);
      params.append("limit", "50");
      params.append("offset", String(pageParam));
      const res = await fetch(`/api/products?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      // Handle both paginated and non-paginated responses
      if (Array.isArray(data)) {
        return { products: data, total: data.length };
      }
      return data;
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.products.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    initialPageParam: 0,
  });

  const allProducts = productsData?.pages.flatMap(page => page.products) || [];

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Reset scroll when filters change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [searchQuery, selectedCategoryIds, dateFilter]);

  const filteredProducts = allProducts.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const hasNoCategory = !product.categoryId || product.categoryId === "";
    const matchesCategory = selectedCategoryIds.length === 0
      || selectedCategoryIds.includes(product.categoryId)
      || (selectedCategoryIds.includes(NONE_CATEGORY_ID) && hasNoCategory);
    
    let matchesDate = true;
    const productDate = new Date(product.createdAt);
    const now = new Date();
    const currentYear = now.getFullYear();
    
    if (dateFilter === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      productDate.setHours(0, 0, 0, 0);
      matchesDate = productDate.getTime() === today.getTime();
    } else if (dateFilter === "yesterday") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      productDate.setHours(0, 0, 0, 0);
      matchesDate = productDate.getTime() === yesterday.getTime();
    } else if (dateFilter === "thisMonth") {
      const startOfMonth = new Date(currentYear, now.getMonth(), 1);
      const endOfMonth = new Date(currentYear, now.getMonth() + 1, 0, 23, 59, 59, 999);
      matchesDate = productDate >= startOfMonth && productDate <= endOfMonth;
    } else if (dateFilter === "lastMonth") {
      const startOfLastMonth = new Date(currentYear, now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(currentYear, now.getMonth(), 0, 23, 59, 59, 999);
      matchesDate = productDate >= startOfLastMonth && productDate <= endOfLastMonth;
    } else if (dateFilter === "january") {
      const start = new Date(currentYear, 0, 1);
      const end = new Date(currentYear, 1, 0, 23, 59, 59, 999);
      matchesDate = productDate >= start && productDate <= end;
    } else if (dateFilter === "february") {
      const start = new Date(currentYear, 1, 1);
      const end = new Date(currentYear, 2, 0, 23, 59, 59, 999);
      matchesDate = productDate >= start && productDate <= end;
    } else if (dateFilter === "march") {
      const start = new Date(currentYear, 2, 1);
      const end = new Date(currentYear, 3, 0, 23, 59, 59, 999);
      matchesDate = productDate >= start && productDate <= end;
    } else if (dateFilter === "april") {
      const start = new Date(currentYear, 3, 1);
      const end = new Date(currentYear, 4, 0, 23, 59, 59, 999);
      matchesDate = productDate >= start && productDate <= end;
    } else if (dateFilter === "may") {
      const start = new Date(currentYear, 4, 1);
      const end = new Date(currentYear, 5, 0, 23, 59, 59, 999);
      matchesDate = productDate >= start && productDate <= end;
    } else if (dateFilter === "june") {
      const start = new Date(currentYear, 5, 1);
      const end = new Date(currentYear, 6, 0, 23, 59, 59, 999);
      matchesDate = productDate >= start && productDate <= end;
    } else if (dateFilter === "july") {
      const start = new Date(currentYear, 6, 1);
      const end = new Date(currentYear, 7, 0, 23, 59, 59, 999);
      matchesDate = productDate >= start && productDate <= end;
    } else if (dateFilter === "august") {
      const start = new Date(currentYear, 7, 1);
      const end = new Date(currentYear, 8, 0, 23, 59, 59, 999);
      matchesDate = productDate >= start && productDate <= end;
    } else if (dateFilter === "september") {
      const start = new Date(currentYear, 8, 1);
      const end = new Date(currentYear, 9, 0, 23, 59, 59, 999);
      matchesDate = productDate >= start && productDate <= end;
    } else if (dateFilter === "october") {
      const start = new Date(currentYear, 9, 1);
      const end = new Date(currentYear, 10, 0, 23, 59, 59, 999);
      matchesDate = productDate >= start && productDate <= end;
    } else if (dateFilter === "november") {
      const start = new Date(currentYear, 10, 1);
      const end = new Date(currentYear, 11, 0, 23, 59, 59, 999);
      matchesDate = productDate >= start && productDate <= end;
    } else if (dateFilter === "december") {
      const start = new Date(currentYear, 11, 1);
      const end = new Date(currentYear, 12, 0, 23, 59, 59, 999);
      matchesDate = productDate >= start && productDate <= end;
    } else if (dateFilter === "custom" && customDate) {
      const selectedDate = new Date(customDate);
      selectedDate.setHours(0, 0, 0, 0);
      productDate.setHours(0, 0, 0, 0);
      matchesDate = productDate.getTime() === selectedDate.getTime();
    } else if (selectedMonths.length > 0) {
      matchesDate = selectedMonths.some((m) => {
        const [y, mo] = m.split("-").map(Number);
        return productDate.getFullYear() === y && productDate.getMonth() + 1 === mo;
      });
    }

    return matchesSearch && matchesCategory && matchesDate;
  });

  const itemForm = useForm<z.infer<typeof insertProductSchema>>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      name: "",
      price: "",
      purchaseCost: "",
      categoryId: "",
      imageUrl: "",
      unit: "piece",
      description: "",
      quantity: "0",
      sizePrices: undefined,
    },
  });

  // Watch unit field
  const selectedUnit = itemForm.watch("unit");

  const categoryForm = useForm<z.infer<typeof insertCategorySchema>>({
    resolver: zodResolver(insertCategorySchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertProductSchema>) => {
      return await apiRequest("POST", "/api/products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/products');
        }
      });
      setItemDialogOpen(false);
      itemForm.reset();
      toast({
        title: "Success",
        description: "Item created successfully",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to create item";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<z.infer<typeof insertProductSchema>> }) => {
      return await apiRequest("PATCH", `/api/products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/products');
        }
      });
      setItemDialogOpen(false);
      setEditingItem(null);
      itemForm.reset();
      toast({
        title: "Success",
        description: "Item updated successfully",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Failed to update item";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
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
      toast({
        title: "Success",
        description: "Item deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertCategorySchema>) => {
      return await apiRequest("POST", "/api/categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setCategoryDialogOpen(false);
      categoryForm.reset();
      toast({
        title: "Success",
        description: "Category created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create category",
        variant: "destructive",
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<z.infer<typeof insertCategorySchema>> }) => {
      return await apiRequest("PATCH", `/api/categories/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      categoryForm.reset();
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      });
    },
  });

  const handleItemSubmit = (data: z.infer<typeof insertProductSchema>) => {
    const submitData = {
      ...data,
      // When size pricing is on, ignore single price/cost and use per-size values
      ...(enableSizePricing && Object.keys(sizePrices).length > 0
        ? { price: "0", purchaseCost: "", sizePrices, sizePurchasePrices: Object.keys(sizePurchasePrices).length > 0 ? sizePurchasePrices : null }
        : { sizePrices: null, sizePurchasePrices: null }),
    };
    if (!submitData.sizePrices) (submitData as any).sizePurchasePrices = null;
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data: submitData });
    } else {
      createItemMutation.mutate(submitData);
    }
  };

  // Handle opening add size dialog
  const handleAddSize = () => {
    setNewSizeInput("");
    setAddSizeDialogOpen(true);
  };

  // Handle confirming size addition
  const handleConfirmAddSize = () => {
    if (newSizeInput && newSizeInput.trim()) {
      const trimmedSize = newSizeInput.trim().toUpperCase();
      if (!sizeInputs.includes(trimmedSize)) {
        setSizeInputs([...sizeInputs, trimmedSize]);
        setSizePrices({ ...sizePrices, [trimmedSize]: "" });
        setSizePurchasePrices({ ...sizePurchasePrices, [trimmedSize]: "" });
        setAddSizeDialogOpen(false);
        setNewSizeInput("");
      } else {
        toast({
          title: "Size already exists",
          description: `Size "${trimmedSize}" is already added`,
          variant: "destructive",
        });
      }
    }
  };

  // Handle removing a size
  const handleRemoveSize = (size: string) => {
    const newSizes = sizeInputs.filter(s => s !== size);
    const newPrices = { ...sizePrices };
    const newPurchasePrices = { ...sizePurchasePrices };
    delete newPrices[size];
    delete newPurchasePrices[size];
    setSizeInputs(newSizes);
    setSizePrices(newPrices);
    setSizePurchasePrices(newPurchasePrices);
  };

  // Handle size price change
  const handleSizePriceChange = (size: string, price: string) => {
    setSizePrices({ ...sizePrices, [size]: price });
  };

  const handleSizePurchasePriceChange = (size: string, cost: string) => {
    setSizePurchasePrices({ ...sizePurchasePrices, [size]: cost });
  };

  // Reset size prices when size pricing is disabled
  useEffect(() => {
    if (!enableSizePricing) {
      setSizePrices({});
      setSizePurchasePrices({});
      setSizeInputs([]);
      itemForm.setValue("sizePrices", undefined);
    }
  }, [enableSizePricing, itemForm]);

  const handleCategorySubmit = (data: z.infer<typeof insertCategorySchema>) => {
    const categoryData = {
      ...data,
      slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    };
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data: categoryData });
    } else {
      createCategoryMutation.mutate(categoryData);
    }
  };

  const handleEditItem = (item: Product) => {
    setEditingItem(item);
    setImagePreview(item.imageUrl || "");
    const sizePricesData = item.sizePrices as Record<string, string> | null | undefined;
    const sizePurchasePricesData = item.sizePurchasePrices as Record<string, string> | null | undefined;
    const sizes = sizePricesData ? Object.keys(sizePricesData) : [];
    const hasSizePricing = sizePricesData && Object.keys(sizePricesData).length > 0;
    setSizeInputs(sizes);
    setSizePrices(sizePricesData || {});
    setSizePurchasePrices(sizePurchasePricesData || {});
    setEnableSizePricing(hasSizePricing);
    itemForm.reset({
      name: item.name,
      price: item.price,
      purchaseCost: item.purchaseCost || "",
      categoryId: item.categoryId,
      imageUrl: item.imageUrl || "",
      unit: item.unit,
      description: item.description || "",
      quantity: item.quantity,
      sizePrices: sizePricesData || undefined,
    });
    setItemDialogOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    categoryForm.reset({
      name: category.name,
      slug: category.slug,
    });
    setCategoryDialogOpen(true);
  };

  const handleAddItemClick = () => {
    setEditingItem(null);
    setImagePreview("");
    setSizePrices({});
    setSizePurchasePrices({});
    setSizeInputs([]);
    setEnableSizePricing(false);
    itemForm.reset({
      name: "",
      price: "",
      purchaseCost: "",
      categoryId: "",
      imageUrl: "",
      unit: "piece",
      description: "",
      quantity: "0",
      sizePrices: undefined,
    });
    setItemDialogOpen(true);
  };

  const processImageFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setImagePreview(base64String);
      itemForm.setValue('imageUrl', base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    processImageFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingImage(false);
    const file = e.dataTransfer.files?.[0];
    processImageFile(file);
  };
  const handleImageDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingImage(true);
  };
  const handleImageDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingImage(false);
  };

  const handleRemoveImage = () => {
    setImagePreview("");
    itemForm.setValue('imageUrl', "");
  };

  const handleAddCategoryClick = () => {
    setEditingCategory(null);
    categoryForm.reset({
      name: "",
      slug: "",
    });
    setCategoryDialogOpen(true);
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems(prev => [...prev, itemId]);
    } else {
      setSelectedItems(prev => prev.filter(id => id !== itemId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(filteredProducts.map(p => p.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;

    const confirmMessage = `Are you sure you want to delete ${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''}?`;
    if (!confirm(confirmMessage)) return;

    try {
      await Promise.all(
        selectedItems.map(id => apiRequest("DELETE", `/api/products/${id}`))
      );

      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.includes('/api/products');
        }
      });

      toast({
        title: "Success",
        description: `${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''} deleted successfully`,
      });

      setSelectedItems([]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete some items",
        variant: "destructive",
      });
    }
  };

  const fetchProductsForExport = async (): Promise<Product[]> => {
    const params = new URLSearchParams();
    params.append("limit", "50000");
    params.append("offset", "0");
    if (debouncedSearchQuery) params.append("search", debouncedSearchQuery);
    if (selectedCategoryIds.length === 1) params.append("categoryId", selectedCategoryIds[0]);
    const dateRange = getItemsDateRange();
    if (dateRange.dateFrom) params.append("dateFrom", dateRange.dateFrom.toISOString());
    if (dateRange.dateTo) params.append("dateTo", dateRange.dateTo.toISOString());
    const res = await fetch(`/api/products?${params}`, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch products");
    const data = await res.json();
    return Array.isArray(data) ? data : (data.products || []);
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const productsToExport = await fetchProductsForExport();
      const csvHeaders = "Name,Category,Purchase Cost,Sales Price,Unit,Quantity,Description,Enable Size Pricing,Sizes,Sale S,Sale M,Sale L,Purchase S,Purchase M,Purchase L,Created At\n";
      const csvRows = productsToExport.map((product: Product) => {
        const category = categories.find(c => c.id === product.categoryId)?.name || "";
        const sizePrices = product.sizePrices as Record<string, string> | null | undefined;
        const sizePurchasePrices = product.sizePurchasePrices as Record<string, string> | null | undefined;
        const hasSizePrices = sizePrices && Object.keys(sizePrices).length > 0;
        const sizesStr = hasSizePrices ? Object.keys(sizePrices).join(",") : "";
        const saleS = hasSizePrices ? (sizePrices!.S ?? "") : "";
        const saleM = hasSizePrices ? (sizePrices!.M ?? "") : "";
        const saleL = hasSizePrices ? (sizePrices!.L ?? "") : "";
        const purchaseS = hasSizePrices && sizePurchasePrices ? (sizePurchasePrices.S ?? "") : "";
        const purchaseM = hasSizePrices && sizePurchasePrices ? (sizePurchasePrices.M ?? "") : "";
        const purchaseL = hasSizePrices && sizePurchasePrices ? (sizePurchasePrices.L ?? "") : "";
        const enableSizePricing = hasSizePrices ? "Y" : "";
        const purchaseCost = hasSizePrices ? "" : (product.purchaseCost || "");
        const price = hasSizePrices ? "" : product.price;
        return `"${product.name}","${category}","${purchaseCost}","${price}","${product.unit}","${product.quantity}","${product.description || ""}","${enableSizePricing}","${sizesStr}","${saleS}","${saleM}","${saleL}","${purchaseS}","${purchaseM}","${purchaseL}","${format(new Date(product.createdAt), "yyyy-MM-dd")}"`;
      }).join("\n");
      const csv = csvHeaders + csvRows;
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `items-${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Success", description: `Exported ${productsToExport.length} items to CSV` });
    } catch (e) {
      toast({ title: "Export Failed", description: e instanceof Error ? e.message : "Failed to export", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const productsToExport = await fetchProductsForExport();
      const sizePrices = (p: Product) => p.sizePrices as Record<string, string> | null | undefined;
      const sizePurchasePrices = (p: Product) => p.sizePurchasePrices as Record<string, string> | null | undefined;
      const hasSizePrices = (p: Product) => sizePrices(p) && Object.keys(sizePrices(p) || {}).length > 0;
      const exportData = productsToExport.map((product: Product) => {
        const category = categories.find(c => c.id === product.categoryId)?.name || "";
        const sp = sizePrices(product);
        const spp = sizePurchasePrices(product);
        const hasSize = hasSizePrices(product);
        return {
          "Name": product.name,
          "Category": category,
          "Purchase Cost": hasSize ? "" : (product.purchaseCost || ""),
          "Sales Price": hasSize ? "" : product.price,
          "Unit": product.unit,
          "Quantity": product.quantity,
          "Description": product.description || "",
          "Enable Size Pricing": hasSize ? "Y" : "",
          "Sizes": hasSize && sp ? Object.keys(sp).join(",") : "",
          "Sale S": hasSize && sp ? (sp.S ?? "") : "",
          "Sale M": hasSize && sp ? (sp.M ?? "") : "",
          "Sale L": hasSize && sp ? (sp.L ?? "") : "",
          "Purchase S": hasSize && spp ? (spp.S ?? "") : "",
          "Purchase M": hasSize && spp ? (spp.M ?? "") : "",
          "Purchase L": hasSize && spp ? (spp.L ?? "") : "",
          "Created At": format(new Date(product.createdAt), "yyyy-MM-dd"),
        };
      });
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Items");
      XLSX.writeFile(workbook, `items-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast({ title: "Success", description: `Exported ${productsToExport.length} items to Excel` });
    } catch (e) {
      toast({ title: "Export Failed", description: e instanceof Error ? e.message : "Failed to export", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const productsToExport = await fetchProductsForExport();
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text("Item Management Report", 14, 20);
      doc.setFontSize(11);
      doc.text(`Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`, 14, 28);
      doc.text(`Total Items: ${productsToExport.length}`, 14, 35);
      const tableData = productsToExport.map((p: Product) => {
        const category = categories.find(c => c.id === p.categoryId)?.name || "";
        return [p.name, category, p.price || "", p.unit || "", p.quantity || "", format(new Date(p.createdAt), "yyyy-MM-dd")];
      });
      autoTable(doc, {
        startY: 42,
        head: [["Name", "Category", "Price", "Unit", "Quantity", "Created At"]],
        body: tableData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });
      doc.save(`items-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast({ title: "Success", description: `Exported ${productsToExport.length} items to PDF` });
    } catch (e) {
      toast({ title: "Export Failed", description: e instanceof Error ? e.message : "Failed to export", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      let rows: any[][] = [];
      
      if (isExcel) {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true, raw: false });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false }) as any[][];
        rows = jsonData.slice(1);
      } else {
        const text = event.target?.result as string;
        const lines = text.split("\n").slice(1);
        rows = lines.map(line => {
          if (!line.trim()) return [];
          // Better CSV parsing that handles quoted fields correctly
          const fields: string[] = [];
          let currentField = '';
          let insideQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
              if (insideQuotes && nextChar === '"') {
                // Escaped quote
                currentField += '"';
                i++; // Skip next quote
              } else {
                // Toggle quote state
                insideQuotes = !insideQuotes;
              }
            } else if (char === ',' && !insideQuotes) {
              // Field separator
              fields.push(currentField.trim());
              currentField = '';
            } else {
              currentField += char;
            }
          }
          // Add last field
          fields.push(currentField.trim());
          return fields;
        });
      }

      const skipReasons: string[] = [];
      let skippedBeforeImport = 0;

      // Optionally create missing categories from the file
      let categoriesToUse = categories;
      const uniqueCategoryNamesFromRows = [...new Set(
        rows
          .map(r => (r && r[1] != null ? (r[1] || "").toString().trim() : ""))
          .filter(Boolean)
      )];
      const missingCategoryNames = uniqueCategoryNamesFromRows.filter(
        name => !categoriesToUse.some(c => c.name.toLowerCase() === name.toLowerCase())
      );
      if (createMissingCategoriesOnImport && missingCategoryNames.length > 0) {
        // Dedupe by slug so "Chicken" and "chicken" create one category
        const slugToName = new Map<string, string>();
        let fallbackIndex = 0;
        for (const name of missingCategoryNames) {
          let slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
          if (!slug) slug = `category-${fallbackIndex++}`;
          if (!slugToName.has(slug)) slugToName.set(slug, name);
        }
        for (const [slug, name] of slugToName) {
          try {
            await apiRequest("POST", "/api/categories", { name, slug });
          } catch (err: any) {
            if (err?.message?.includes("duplicate") || err?.message?.includes("unique")) {
              // Slug conflict (e.g. another category already has this slug), skip
            } else {
              skipReasons.push(`Could not create category "${name}": ${err?.message || "Unknown error"}`);
            }
          }
        }
        const fresh = await queryClient.fetchQuery<Category[]>({ queryKey: ["/api/categories"] });
        categoriesToUse = fresh || categories;
      }

      // Prepare items for bulk import
      const itemsToImport: any[] = [];

      for (const row of rows) {
        if (!row || row.length < 6) {
          if (row && row.length > 0) {
            skippedBeforeImport++;
            skipReasons.push(`Row with insufficient data (need at least 6 columns)`);
          }
          continue;
        }

        const name = (row[0] || "").toString().trim();
        const categoryName = (row[1] || "").toString().trim();
        const purchaseCost = (row[2] || "").toString().trim();
        const price = (row[3] || "").toString().trim();
        const unit = (row[4] || "").toString().trim();
        const quantity = (row[5] || "").toString().trim();
        const description = (row[6] || "").toString().trim();
        const enableSizePricing = (row[7] || "").toString().trim().toUpperCase();
        const sizesStr = (row[8] || "").toString().trim();
        const saleS = (row[9] != null && row[9] !== "") ? String(row[9]).trim() : "";
        const saleM = (row[10] != null && row[10] !== "") ? String(row[10]).trim() : "";
        const saleL = (row[11] != null && row[11] !== "") ? String(row[11]).trim() : "";
        const purchaseS = (row[12] != null && row[12] !== "") ? String(row[12]).trim() : "";
        const purchaseM = (row[13] != null && row[13] !== "") ? String(row[13]).trim() : "";
        const purchaseL = (row[14] != null && row[14] !== "") ? String(row[14]).trim() : "";

        const useSizePricing = (enableSizePricing === "Y" || enableSizePricing === "YES" || enableSizePricing === "TRUE") && sizesStr && (saleS || saleM || saleL);

        if (!name || !categoryName || !unit || !quantity) {
          skippedBeforeImport++;
          const missing = [];
          if (!name) missing.push('Name');
          if (!categoryName) missing.push('Category');
          if (!unit) missing.push('Unit');
          if (!quantity) missing.push('Quantity');
          skipReasons.push(`Row "${name || 'unnamed'}": Missing required fields: ${missing.join(', ')}`);
          continue;
        }
        if (!useSizePricing && !price) {
          skippedBeforeImport++;
          skipReasons.push(`Row "${name}": Sales Price is required (or enable size pricing with at least one Sale S/M/L).`);
          continue;
        }

        const category = categoriesToUse.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
        if (!category) {
          skippedBeforeImport++;
          skipReasons.push(`Row "${name}": Category "${categoryName}" not found. Create it in Manage Categories or enable "Create missing categories".`);
          continue;
        }

        let sizePrices: Record<string, string> | null = null;
        let sizePurchasePrices: Record<string, string> | null = null;
        let finalPrice = price;
        let finalPurchaseCost = purchaseCost || undefined;

        if (useSizePricing) {
          const sizeLabels = sizesStr.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
          sizePrices = {};
          sizePurchasePrices = {};
          const saleBySize: Record<string, string> = { S: saleS, M: saleM, L: saleL };
          const purchaseBySize: Record<string, string> = { S: purchaseS, M: purchaseM, L: purchaseL };
          for (const size of sizeLabels) {
            const saleVal = saleBySize[size] ?? (size === "S" ? saleS : size === "M" ? saleM : size === "L" ? saleL : "");
            const purchaseVal = purchaseBySize[size] ?? (size === "S" ? purchaseS : size === "M" ? purchaseM : size === "L" ? purchaseL : "");
            if (saleVal) sizePrices![size] = saleVal;
            if (purchaseVal) sizePurchasePrices![size] = purchaseVal;
          }
          if (Object.keys(sizePrices).length === 0) {
            skippedBeforeImport++;
            skipReasons.push(`Row "${name}": Size pricing enabled but no Sale S/M/L values.`);
            continue;
          }
          finalPrice = "0";
          finalPurchaseCost = undefined;
        }

        itemsToImport.push({
          name,
          categoryId: category.id,
          purchaseCost: finalPurchaseCost || undefined,
          price: finalPrice,
          unit,
          quantity,
          description,
          imageUrl: "",
          ...(sizePrices && Object.keys(sizePrices).length > 0 ? { sizePrices, sizePurchasePrices: (sizePurchasePrices && Object.keys(sizePurchasePrices).length > 0) ? sizePurchasePrices : null } : {}),
        });
      }

      // Bulk import all items
      if (itemsToImport.length > 0) {
        try {
          const result: any = await apiRequest("POST", "/api/products/bulk", { items: itemsToImport });
          
          queryClient.invalidateQueries({ 
            predicate: (query) => {
              const key = query.queryKey[0];
              return typeof key === 'string' && key.includes('/api/products');
            }
          });
          
          const totalSkipped = skippedBeforeImport + (result.failed || 0);
          
          if (result.errors && result.errors.length > 0) {
            console.log("Import errors:", result.errors);
            skipReasons.push(...result.errors.map((e: any) => `Row ${e.row} "${e.name}": ${e.error}`));
          }
          
          if (skipReasons.length > 0) {
            console.log("Import skip reasons:", skipReasons);
          }
          
          const imported = result.imported || 0;
          const updated = result.updated || 0;
          const parts = [];
          if (imported > 0) parts.push(`${imported} imported`);
          if (updated > 0) parts.push(`${updated} updated`);
          const summary = parts.length > 0 ? parts.join(", ") : "0 items processed";
          toast({
            title: "Import Complete",
            description: `${summary}${totalSkipped > 0 ? `. ${totalSkipped} failed or skipped. Check console for details.` : "."}`,
            variant: totalSkipped > 0 ? "default" : "default",
          });
        } catch (error) {
          console.error("Bulk import failed:", error);
          toast({
            title: "Import Failed",
            description: "Failed to import items. Please try again.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "No Items to Import",
          description: `${skippedBeforeImport} items skipped due to validation errors. Check console for details.`,
          variant: "destructive",
        });
        if (skipReasons.length > 0) {
          console.log("Import skip reasons:", skipReasons);
        }
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
    e.target.value = "";
  };

  const handleDownloadSample = () => {
    if (categories.length === 0) {
      toast({
        title: "No Categories",
        description: "Please create at least one category before downloading the template",
        variant: "destructive",
      });
      return;
    }

    // Use actual categories from the system. Size-based pricing columns: Enable Size Pricing (Y/N), Sizes (e.g. S,M,L), Sale S/M/L, Purchase S/M/L
    const sampleData = [
      [
        "Name", "Category", "Purchase Cost", "Sales Price", "Unit", "Quantity", "Description",
        "Enable Size Pricing", "Sizes", "Sale S", "Sale M", "Sale L", "Purchase S", "Purchase M", "Purchase L",
      ],
      ["Sample Item 1", categories[0].name, "6.00", "10.60", "plate", "50", "Example item description", "", "", "", "", "", "", "", ""],
      ["Sample Item 2", categories[0].name, "4.50", "8.50", "serving", "100", "Example item description", "", "", "", "", "", "", "", ""],
      // Example row with size-based pricing (leave Purchase Cost and Sales Price as 0 when using size pricing)
      ["Sample Drink", categories[0].name, "0", "0", "cup", "100", "Size-priced drink", "Y", "S,M,L", "2.50", "3.00", "3.50", "1.00", "1.20", "1.50"],
    ];

    if (categories.length > 1) {
      sampleData.push(["Sample Item 3", categories[1].name, "6.50", "10.50", "piece", "60", "Example item description", "", "", "", "", "", "", "", ""]);
    }
    if (categories.length > 2) {
      sampleData.push(["Sample Item 4", categories[2].name, "9.00", "15.00", "piece", "40", "Example item description", "", "", "", "", "", "", "", ""]);
    }
    
    const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Items");
    
    const fileName = `items_sample_template.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    toast({
      title: "Success",
      description: `Sample template downloaded with your categories: ${categories.map(c => c.name).join(', ')}`,
    });
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="w-full sm:w-auto">
            <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-page-title">Item Management</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Manage inventory and menu items</p>
            {filteredProducts.length > 0 && hasPermission("items.delete") && (
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedItems.length === filteredProducts.length && filteredProducts.length > 0}
                    onCheckedChange={handleSelectAll}
                    data-testid="checkbox-select-all"
                  />
                  <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                    Select All ({selectedItems.length}/{filteredProducts.length})
                  </label>
                </div>
                {selectedItems.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    data-testid="button-bulk-delete"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Selected ({selectedItems.length})
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={handleAddCategoryClick} data-testid="button-manage-categories">
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Manage Categories
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:max-w-md" data-testid="dialog-category">
                <DialogHeader>
                  <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
                  <DialogDescription>
                    {editingCategory ? "Update category information" : "Create a new category for items"}
                  </DialogDescription>
                </DialogHeader>
                <Form {...categoryForm}>
                  <form onSubmit={categoryForm.handleSubmit(handleCategorySubmit)} className="space-y-4">
                    <FormField
                      control={categoryForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Beverages" data-testid="input-category-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={categoryForm.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Slug</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., beverages" data-testid="input-category-slug" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending} data-testid="button-save-category">
                        {editingCategory ? "Update" : "Create"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>

                {categories.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h3 className="font-medium text-sm">Existing Categories</h3>
                    <div className="space-y-2">
                      {categories.map((category) => (
                        <div key={category.id} className="flex items-center justify-between p-2 rounded-md border" data-testid={`category-item-${category.id}`}>
                          <span className="text-sm">{category.name}</span>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditCategory(category)}
                              data-testid={`button-edit-category-${category.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteCategoryMutation.mutate(category.id)}
                              data-testid={`button-delete-category-${category.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <div className="flex items-center gap-3">
              <input
                id="import-file"
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleImport}
                data-testid="input-import-file"
              />
              <Button 
                variant="outline" 
                onClick={() => document.getElementById('import-file')?.click()}
                data-testid="button-import"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import Items
              </Button>
              <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                <Checkbox
                  checked={createMissingCategoriesOnImport}
                  onCheckedChange={(v) => setCreateMissingCategoriesOnImport(!!v)}
                />
                Create missing categories
              </label>
            </div>

            <Button variant="outline" onClick={handleDownloadSample} data-testid="button-download-sample">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Download Sample Excel
            </Button>

            {hasPermission("reports.export") && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={exporting} data-testid="button-export">
                    <Download className="w-4 h-4 mr-2" />
                    {exporting ? "Exporting…" : "Export Items"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportCSV} disabled={exporting}>
                    Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportExcel} disabled={exporting}>
                    Export Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportPDF} disabled={exporting}>
                    Export PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
              <DialogTrigger asChild>
                {hasPermission("items.create") && (
                  <Button onClick={handleAddItemClick} data-testid="button-add-item">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>
                )}
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-item">
                <DialogHeader>
                  <DialogTitle>{editingItem ? "Edit Item" : "Add New Item"}</DialogTitle>
                  <DialogDescription>
                    {editingItem ? "Update item information" : "Create a new inventory item"}
                  </DialogDescription>
                </DialogHeader>
                <Form {...itemForm}>
                  <form onSubmit={itemForm.handleSubmit(handleItemSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <FormLabel>Item Image (optional)</FormLabel>
                      
                      {imagePreview ? (
                        <div className="space-y-3">
                          <div className="relative w-full h-48 rounded-md overflow-hidden border">
                            <img
                              src={imagePreview}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex gap-2">
                            <input
                              id="item-image-change"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleImageUpload}
                              data-testid="input-image-change"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              className="flex-1"
                              onClick={() => document.getElementById('item-image-change')?.click()}
                              data-testid="button-change-image"
                            >
                              <ImagePlus className="w-4 h-4 mr-2" />
                              Change Image
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={handleRemoveImage}
                              data-testid="button-remove-image"
                            >
                              <X className="w-4 h-4 mr-2" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <label htmlFor="item-image-upload">
                            <input
                              id="item-image-upload"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleImageUpload}
                              data-testid="input-image-upload"
                            />
                            <div
                              className={cn(
                                "border-2 border-dashed rounded-md p-6 cursor-pointer transition-colors flex flex-col items-center gap-2",
                                isDraggingImage ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-muted/50"
                              )}
                              onDragOver={handleImageDragOver}
                              onDragLeave={handleImageDragLeave}
                              onDrop={handleImageDrop}
                              onClick={() => document.getElementById('item-image-upload')?.click()}
                            >
                              <ImagePlus className="w-8 h-8 text-muted-foreground" />
                              <div className="text-center">
                                <p className="text-sm font-medium">Upload Image</p>
                                <p className="text-xs text-muted-foreground">Drag and drop or click to select an image file</p>
                              </div>
                            </div>
                          </label>
                          
                          <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                              <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                              <span className="bg-background px-2 text-muted-foreground">Or use URL</span>
                            </div>
                          </div>

                          <FormField
                            control={itemForm.control}
                            name="imageUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    value={field.value || ""} 
                                    placeholder="https://example.com/image.jpg" 
                                    data-testid="input-image-url"
                                    onChange={(e) => {
                                      field.onChange(e);
                                      setImagePreview(e.target.value);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </div>

                    <FormField
                      control={itemForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Item Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Fresh Orange Juice" data-testid="input-item-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={itemForm.control}
                      name="categoryId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-category">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {!enableSizePricing && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={itemForm.control}
                          name="purchaseCost"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Purchase Cost</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ""} type="number" step="0.01" placeholder="0.00" data-testid="input-purchase-cost" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={itemForm.control}
                          name="price"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sales Price</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" step="0.01" placeholder="0.00" data-testid="input-sales-price" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={itemForm.control}
                        name="unit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-unit">
                                  <SelectValue placeholder="Select unit" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {UNIT_OPTIONS.map((unit) => (
                                  <SelectItem key={unit} value={unit}>
                                    {unit}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={itemForm.control}
                        name="quantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity/Stock</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.01" placeholder="0" data-testid="input-quantity" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Size-based pricing for all units */}
                    <div className="space-y-3 border rounded-lg p-4 bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="enable-size-pricing"
                            checked={enableSizePricing}
                            onCheckedChange={(checked) => {
                              setEnableSizePricing(checked as boolean);
                              if (!checked) {
                                setSizePrices({});
                                setSizeInputs([]);
                              }
                            }}
                            data-testid="checkbox-enable-size-pricing"
                          />
                          <FormLabel 
                            htmlFor="enable-size-pricing" 
                            className="text-base font-semibold cursor-pointer"
                          >
                            Enable Size-based Pricing
                          </FormLabel>
                        </div>
                        {enableSizePricing && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAddSize}
                            data-testid="button-add-size"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Size
                          </Button>
                        )}
                      </div>
                          {enableSizePricing && (
                        <>
                          <p className="text-sm text-muted-foreground">
                            Set purchase cost and selling price per size (e.g., S, M, L).
                          </p>
                          {sizeInputs.length > 0 && (
                            <div className="space-y-2">
                              {sizeInputs.map((size) => (
                                <div key={size} className="flex items-center gap-2 flex-wrap">
                                  <div className="w-14 font-medium shrink-0">{size}</div>
                                  <div className="flex gap-2 flex-1 min-w-0">
                                    <div className="flex-1 min-w-0">
                                      <label className="text-xs text-muted-foreground block mb-0.5">Purchase</label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={sizePurchasePrices[size] || ""}
                                        onChange={(e) => handleSizePurchasePriceChange(size, e.target.value)}
                                        className="w-full"
                                        data-testid={`input-size-purchase-${size}`}
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <label className="text-xs text-muted-foreground block mb-0.5">Selling</label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={sizePrices[size] || ""}
                                        onChange={(e) => handleSizePriceChange(size, e.target.value)}
                                        className="w-full"
                                        data-testid={`input-size-price-${size}`}
                                      />
                                    </div>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveSize(size)}
                                    data-testid={`button-remove-size-${size}`}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                          {sizeInputs.length === 0 && (
                            <p className="text-sm text-muted-foreground italic">
                              No sizes added. Click "Add Size" to set size-based pricing.
                            </p>
                          )}
                        </>
                      )}
                      {!enableSizePricing && (
                        <p className="text-sm text-muted-foreground italic">
                          Enable size-based pricing to set different prices for different sizes/variants.
                        </p>
                      )}
                    </div>

                    <FormField
                      control={itemForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (optional)</FormLabel>
                          <FormControl>
                            <Textarea {...field} value={field.value || ""} placeholder="Item description" rows={3} data-testid="input-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button type="submit" disabled={createItemMutation.isPending || updateItemMutation.isPending} data-testid="button-save-item">
                        {editingItem ? "Update Item" : "Create Item"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            {/* Add Size Dialog */}
            <Dialog open={addSizeDialogOpen} onOpenChange={setAddSizeDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Size</DialogTitle>
                  <DialogDescription>
                    Enter a size label (e.g., S, M, L, XL)
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label htmlFor="size-input" className="text-sm font-medium">
                      Size Label
                    </label>
                    <Input
                      id="size-input"
                      placeholder="e.g., S, M, L, XL"
                      value={newSizeInput}
                      onChange={(e) => setNewSizeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleConfirmAddSize();
                        }
                      }}
                      autoFocus
                      data-testid="input-size-label"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAddSizeDialogOpen(false);
                      setNewSizeInput("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirmAddSize}
                    disabled={!newSizeInput.trim()}
                    data-testid="button-confirm-add-size"
                  >
                    Add Size
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search & Filter</CardTitle>
            <CardDescription>Find items by name, category, or date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                    data-testid="select-filter-category"
                  >
                    {selectedCategoryIds.length === 0
                      ? "All Categories"
                      : selectedCategoryIds.length === 1
                        ? selectedCategoryIds[0] === NONE_CATEGORY_ID
                          ? "No category"
                          : categories.find((c) => c.id === selectedCategoryIds[0])?.name ?? "1 category"
                        : `${selectedCategoryIds.length} categories`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0" align="start">
                  <div className="max-h-[300px] overflow-y-auto p-2">
                    <div
                      className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/50 cursor-pointer"
                      onClick={() => setSelectedCategoryIds([])}
                    >
                      <Checkbox
                        checked={selectedCategoryIds.length === 0}
                        onCheckedChange={(checked) => checked && setSelectedCategoryIds([])}
                      />
                      <span className="text-sm font-medium">All Categories</span>
                    </div>
                    <div
                      className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/50 cursor-pointer"
                      onClick={() => {
                        setSelectedCategoryIds((prev) =>
                          prev.includes(NONE_CATEGORY_ID)
                            ? prev.filter((id) => id !== NONE_CATEGORY_ID)
                            : [...prev, NONE_CATEGORY_ID]
                        );
                      }}
                    >
                      <Checkbox
                        checked={selectedCategoryIds.includes(NONE_CATEGORY_ID)}
                        onCheckedChange={(checked) => {
                          setSelectedCategoryIds((prev) =>
                            checked ? [...prev, NONE_CATEGORY_ID] : prev.filter((id) => id !== NONE_CATEGORY_ID)
                          );
                        }}
                      />
                      <span className="text-sm">No category</span>
                    </div>
                    {categories.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/50 cursor-pointer"
                        onClick={() => {
                          setSelectedCategoryIds((prev) =>
                            prev.includes(category.id)
                              ? prev.filter((id) => id !== category.id)
                              : [...prev, category.id]
                          );
                        }}
                      >
                        <Checkbox
                          checked={selectedCategoryIds.includes(category.id)}
                          onCheckedChange={(checked) => {
                            setSelectedCategoryIds((prev) =>
                              checked
                                ? [...prev, category.id]
                                : prev.filter((id) => id !== category.id)
                            );
                          }}
                        />
                        <span className="text-sm">{category.name}</span>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <div className="flex gap-2">
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger data-testid="select-date-filter">
                    <SelectValue placeholder="Date Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FILTER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {dateFilter === "custom" && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" data-testid="button-custom-date">
                        <Calendar className="w-4 h-4 mr-2" />
                        {customDate ? format(customDate, "MMM dd, yyyy") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        mode="single"
                        selected={customDate}
                        onSelect={setCustomDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="min-w-[140px] justify-start">
                      {selectedMonths.length === 0 ? "All months" : selectedMonths.length <= 2 ? selectedMonths.map((m) => { const [y, mo] = m.split("-").map(Number); return format(new Date(y, mo - 1, 1), "MMM yyyy"); }).join(", ") : `${selectedMonths.length} months`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-0" align="start">
                    <div className="max-h-[300px] overflow-y-auto p-2">
                      {Array.from({ length: 24 }, (_, i) => {
                        const d = new Date(); d.setMonth(d.getMonth() - (23 - i));
                        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                        const checked = selectedMonths.includes(value);
                        return (
                          <div key={value} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer" onClick={() => setSelectedMonths((prev) => (checked ? prev.filter((x) => x !== value) : [...prev, value].sort()))}>
                            <Checkbox checked={checked} onCheckedChange={() => {}} />
                            <span className="text-sm">{format(d, "MMMM yyyy")}</span>
                          </div>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Items ({filteredProducts.length})</h2>
          </div>

          <div ref={scrollContainerRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            {filteredProducts.map((product) => {
              const category = categories.find(c => c.id === product.categoryId);
              return (
                <Card key={product.id} className="overflow-hidden" data-testid={`card-item-${product.id}`}>
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-accent">
                        <Utensils className="w-10 h-10 text-muted-foreground" />
                      </div>
                    )}
                    {hasPermission("items.delete") && (
                      <div className="absolute top-2 right-2 bg-background rounded-md p-1 shadow-md">
                        <Checkbox
                          checked={selectedItems.includes(product.id)}
                          onCheckedChange={(checked) => handleSelectItem(product.id, checked as boolean)}
                          data-testid={`checkbox-item-${product.id}`}
                        />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3 space-y-2">
                    <div>
                      <h3 className="font-semibold truncate" data-testid={`text-item-name-${product.id}`}>{product.name}</h3>
                      {category && (
                        <p className="text-xs text-muted-foreground" data-testid={`text-item-category-${product.id}`}>{category.name}</p>
                      )}
                    </div>
                    
                    {/* For size-priced items show only size labels; otherwise show main price */}
                    {product.sizePrices && (() => {
                      const sp = product.sizePrices as Record<string, string> | null | undefined;
                      if (sp && Object.keys(sp).length > 0) {
                        return (
                          <div className="flex flex-wrap gap-1">
                            {Object.keys(sp).map((size) => (
                              <Badge key={size} variant="secondary" className="text-xs">
                                {size}
                              </Badge>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    })()}
                    {(!product.sizePrices || Object.keys((product.sizePrices as Record<string, string>) || {}).length === 0) && (
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-primary font-mono" data-testid={`text-item-price-${product.id}`}>
                          ${parseFloat(product.price).toFixed(2)}
                        </span>
                        <span className="text-sm text-muted-foreground" data-testid={`text-item-unit-${product.id}`}>
                          per {product.unit}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Stock:</span>
                      <span className="font-medium" data-testid={`text-item-quantity-${product.id}`}>
                        {parseFloat(product.quantity)} {product.unit}
                      </span>
                    </div>

                    {product.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2" data-testid={`text-item-description-${product.id}`}>
                        {product.description}
                      </p>
                    )}

                    <div className="flex gap-1 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs"
                        onClick={() => {
                          setSelectedProductForQR(product);
                          setQrCodeDialogOpen(true);
                        }}
                        data-testid={`button-qr-${product.id}`}
                      >
                        <QrCode className="w-3 h-3 mr-1" />
                        QR
                      </Button>
                      {hasPermission("items.edit") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-xs"
                          onClick={() => handleEditItem(product)}
                          data-testid={`button-edit-item-${product.id}`}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                      )}
                      {hasPermission("items.delete") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteItemMutation.mutate(product.id)}
                          disabled={deleteItemMutation.isPending}
                          data-testid={`button-delete-item-${product.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {isFetchingNextPage && (
            <div className="text-center py-4 text-muted-foreground">Loading more items...</div>
          )}

          <div ref={observerTarget} className="h-4" />

          {filteredProducts.length === 0 && !productsLoading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <PackagePlus className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No items found</h3>
                <p className="text-muted-foreground text-center mb-4">
                  {searchQuery || selectedCategoryIds.length > 0 || dateFilter !== "all"
                    ? "Try adjusting your search filters"
                    : "Get started by adding your first item"}
                </p>
                {!searchQuery && selectedCategoryIds.length === 0 && dateFilter === "all" && (
                  <Button onClick={handleAddItemClick} data-testid="button-add-first-item">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Item
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* QR Code / Barcode Dialog */}
      <Dialog open={qrCodeDialogOpen} onOpenChange={setQrCodeDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md" data-testid="dialog-qr-code">
          <DialogHeader>
            <DialogTitle>{codeType === "qr" ? "QR Code" : "Barcode"} - {selectedProductForQR?.name}</DialogTitle>
            <DialogDescription>
              Scan this {codeType === "qr" ? "QR code" : "barcode"} to add product to cart in POS
            </DialogDescription>
          </DialogHeader>
          {selectedProductForQR && (
            <div className="space-y-4 py-4">
              {/* Code Type Toggle */}
              <div className="flex gap-2 justify-center">
                <Button
                  variant={codeType === "qr" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCodeType("qr")}
                >
                  QR Code
                </Button>
                <Button
                  variant={codeType === "barcode" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCodeType("barcode")}
                >
                  Barcode
                </Button>
              </div>

              <div className="flex flex-col items-center justify-center p-6 bg-muted/30 rounded-lg">
                {codeType === "qr" ? (
                  (() => {
                    const barcode = selectedProductForQR.barcode || selectedProductForQR.id;
                    return (
                      <>
                        <QRCodeSVG
                          value={barcode}
                          size={256}
                          level="H"
                          includeMargin={true}
                        />
                        <p className="mt-4 text-sm font-mono text-muted-foreground">
                          {barcode}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground text-center">
                          {selectedProductForQR.name}
                        </p>
                        <div className="mt-3 text-center">
                          <p className="text-sm font-semibold text-primary">
                            ${parseFloat(selectedProductForQR.price).toFixed(2)} USD
                          </p>
                          {settings?.exchangeRate && (
                            <p className="text-xs text-muted-foreground">
                              {(parseFloat(selectedProductForQR.price) * parseFloat(settings.exchangeRate)).toLocaleString('en-US', { maximumFractionDigits: 0 })} {settings?.secondaryCurrencySymbol || "៛"}
                            </p>
                          )}
                        </div>
                      </>
                    );
                  })()
                ) : (
                  <BarcodeDisplay 
                    barcode={selectedProductForQR.barcode || selectedProductForQR.id}
                    productName={selectedProductForQR.name}
                    price={selectedProductForQR.price}
                    settings={settings}
                  />
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={async () => {
                    const barcode = selectedProductForQR.barcode || selectedProductForQR.id;
                    const exchangeRate = settings?.exchangeRate ? parseFloat(settings.exchangeRate) : 4100;
                    const secondaryCurrencySymbol = settings?.secondaryCurrencySymbol || "៛";
                    const sellingPrice = parseFloat(selectedProductForQR.price);
                    const sellingPriceKHR = sellingPrice * exchangeRate;
                    
                    try {
                      const printWindow = window.open("", "_blank");
                      if (!printWindow) return;

                      if (codeType === "qr") {
                        const canvas = document.createElement('canvas');
                        await QRCode.toCanvas(canvas, barcode, { width: 300, margin: 2 });
                        const qrDataUrl = canvas.toDataURL();
                        
                        printWindow.document.write(`
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <title>QR Code - ${selectedProductForQR.name}</title>
                              <style>
                                @media print {
                                  body { margin: 0; padding: 20px; }
                                }
                                body {
                                  display: flex;
                                  flex-direction: column;
                                  align-items: center;
                                  justify-content: center;
                                  padding: 40px;
                                  font-family: Arial, sans-serif;
                                }
                                .product-name {
                                  font-size: 18px;
                                  font-weight: bold;
                                  margin-bottom: 10px;
                                  text-align: center;
                                }
                                .price-info {
                                  margin-top: 15px;
                                  text-align: center;
                                  font-size: 14px;
                                }
                                .price-usd {
                                  font-size: 16px;
                                  font-weight: bold;
                                  color: #2563eb;
                                }
                                .price-khr {
                                  font-size: 14px;
                                  color: #666;
                                  margin-top: 5px;
                                }
                                .barcode {
                                  font-size: 12px;
                                  color: #666;
                                  margin-top: 10px;
                                  font-family: monospace;
                                }
                                img {
                                  max-width: 100%;
                                  height: auto;
                                }
                              </style>
                            </head>
                            <body>
                              <div class="product-name">${selectedProductForQR.name}</div>
                              <img src="${qrDataUrl}" alt="QR Code" />
                              <div class="price-info">
                                <div class="price-usd">$${sellingPrice.toFixed(2)} USD</div>
                                <div class="price-khr">${sellingPriceKHR.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${secondaryCurrencySymbol}</div>
                              </div>
                              <div class="barcode">${barcode}</div>
                            </body>
                          </html>
                        `);
                      } else {
                        // Generate barcode SVG
                        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                        JsBarcode(svg, barcode, {
                          format: "CODE128",
                          width: 2,
                          height: 80,
                          displayValue: true,
                          fontSize: 14,
                        });
                        const svgString = new XMLSerializer().serializeToString(svg);
                        const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));
                        
                        printWindow.document.write(`
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <title>Barcode - ${selectedProductForQR.name}</title>
                              <style>
                                @media print {
                                  body { margin: 0; padding: 20px; }
                                }
                                body {
                                  display: flex;
                                  flex-direction: column;
                                  align-items: center;
                                  justify-content: center;
                                  padding: 40px;
                                  font-family: Arial, sans-serif;
                                }
                                .product-name {
                                  font-size: 18px;
                                  font-weight: bold;
                                  margin-bottom: 10px;
                                  text-align: center;
                                }
                                .price-info {
                                  margin-top: 15px;
                                  text-align: center;
                                  font-size: 14px;
                                }
                                .price-usd {
                                  font-size: 16px;
                                  font-weight: bold;
                                  color: #2563eb;
                                }
                                .price-khr {
                                  font-size: 14px;
                                  color: #666;
                                  margin-top: 5px;
                                }
                                .barcode {
                                  font-size: 12px;
                                  color: #666;
                                  margin-top: 10px;
                                  font-family: monospace;
                                }
                                img {
                                  max-width: 100%;
                                  height: auto;
                                }
                              </style>
                            </head>
                            <body>
                              <div class="product-name">${selectedProductForQR.name}</div>
                              <img src="${svgDataUrl}" alt="Barcode" />
                              <div class="price-info">
                                <div class="price-usd">$${sellingPrice.toFixed(2)} USD</div>
                                <div class="price-khr">${sellingPriceKHR.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${secondaryCurrencySymbol}</div>
                              </div>
                              <div class="barcode">${barcode}</div>
                            </body>
                          </html>
                        `);
                      }
                      
                      printWindow.document.close();
                      setTimeout(() => {
                        printWindow.print();
                      }, 500);
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: `Failed to generate ${codeType === "qr" ? "QR code" : "barcode"} for printing`,
                        variant: "destructive",
                      });
                    }
                  }}
                  data-testid="button-print-qr"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print {codeType === "qr" ? "QR Code" : "Barcode"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setQrCodeDialogOpen(false)}
                  data-testid="button-close-qr"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
