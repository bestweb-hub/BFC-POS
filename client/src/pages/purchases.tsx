import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPurchaseSchema, insertCategorySchema, type Purchase, type Category, type Product } from "@shared/schema";
import type { z } from "zod";
import { Plus, Search, Download, Upload, Edit, Trash2, FolderPlus, Calendar, ImagePlus, X, ShoppingCart, Eye, Printer, FileSpreadsheet, TrendingUp, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { useDebounce } from "@/hooks/use-debounce";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UnitSelect } from "@/components/unit-select";
import { ProductSelect } from "@/components/product-select";
import * as XLSX from 'xlsx';
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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

export default function PurchaseManage() {
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [imagePreview, setImagePreview] = useState<string>("");
  const { toast } = useToast();
  const { hasPermission } = usePermissions();

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: allPurchases = [] } = useQuery<Purchase[]>({
    queryKey: ["/api/purchases"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const filteredPurchases = allPurchases.filter((purchase) => {
    const matchesSearch = purchase.itemName.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || purchase.categoryId === selectedCategory;
    
    let matchesDate = true;
    const purchaseDate = new Date(purchase.purchaseDate);
    const now = new Date();
    const currentYear = now.getFullYear();
    
    if (dateFilter === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      purchaseDate.setHours(0, 0, 0, 0);
      matchesDate = purchaseDate.getTime() === today.getTime();
    } else if (dateFilter === "yesterday") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      purchaseDate.setHours(0, 0, 0, 0);
      matchesDate = purchaseDate.getTime() === yesterday.getTime();
    } else if (dateFilter === "thisMonth") {
      const start = new Date(currentYear, now.getMonth(), 1);
      const end = new Date(currentYear, now.getMonth() + 1, 0, 23, 59, 59, 999);
      matchesDate = purchaseDate >= start && purchaseDate <= end;
    } else if (dateFilter === "lastMonth") {
      const start = new Date(currentYear, now.getMonth() - 1, 1);
      const end = new Date(currentYear, now.getMonth(), 0, 23, 59, 59, 999);
      matchesDate = purchaseDate >= start && purchaseDate <= end;
    } else if (dateFilter === "january") {
      const start = new Date(currentYear, 0, 1);
      const end = new Date(currentYear, 1, 0, 23, 59, 59, 999);
      matchesDate = purchaseDate >= start && purchaseDate <= end;
    } else if (dateFilter === "february") {
      const start = new Date(currentYear, 1, 1);
      const end = new Date(currentYear, 2, 0, 23, 59, 59, 999);
      matchesDate = purchaseDate >= start && purchaseDate <= end;
    } else if (dateFilter === "march") {
      const start = new Date(currentYear, 2, 1);
      const end = new Date(currentYear, 3, 0, 23, 59, 59, 999);
      matchesDate = purchaseDate >= start && purchaseDate <= end;
    } else if (dateFilter === "april") {
      const start = new Date(currentYear, 3, 1);
      const end = new Date(currentYear, 4, 0, 23, 59, 59, 999);
      matchesDate = purchaseDate >= start && purchaseDate <= end;
    } else if (dateFilter === "may") {
      const start = new Date(currentYear, 4, 1);
      const end = new Date(currentYear, 5, 0, 23, 59, 59, 999);
      matchesDate = purchaseDate >= start && purchaseDate <= end;
    } else if (dateFilter === "june") {
      const start = new Date(currentYear, 5, 1);
      const end = new Date(currentYear, 6, 0, 23, 59, 59, 999);
      matchesDate = purchaseDate >= start && purchaseDate <= end;
    } else if (dateFilter === "july") {
      const start = new Date(currentYear, 6, 1);
      const end = new Date(currentYear, 7, 0, 23, 59, 59, 999);
      matchesDate = purchaseDate >= start && purchaseDate <= end;
    } else if (dateFilter === "august") {
      const start = new Date(currentYear, 7, 1);
      const end = new Date(currentYear, 8, 0, 23, 59, 59, 999);
      matchesDate = purchaseDate >= start && purchaseDate <= end;
    } else if (dateFilter === "september") {
      const start = new Date(currentYear, 8, 1);
      const end = new Date(currentYear, 9, 0, 23, 59, 59, 999);
      matchesDate = purchaseDate >= start && purchaseDate <= end;
    } else if (dateFilter === "october") {
      const start = new Date(currentYear, 9, 1);
      const end = new Date(currentYear, 10, 0, 23, 59, 59, 999);
      matchesDate = purchaseDate >= start && purchaseDate <= end;
    } else if (dateFilter === "november") {
      const start = new Date(currentYear, 10, 1);
      const end = new Date(currentYear, 11, 0, 23, 59, 59, 999);
      matchesDate = purchaseDate >= start && purchaseDate <= end;
    } else if (dateFilter === "december") {
      const start = new Date(currentYear, 11, 1);
      const end = new Date(currentYear, 12, 0, 23, 59, 59, 999);
      matchesDate = purchaseDate >= start && purchaseDate <= end;
    } else if (dateFilter === "custom" && customDate) {
      const selectedDate = new Date(customDate);
      selectedDate.setHours(0, 0, 0, 0);
      purchaseDate.setHours(0, 0, 0, 0);
      matchesDate = purchaseDate.getTime() === selectedDate.getTime();
    }

    return matchesSearch && matchesCategory && matchesDate;
  });

  const purchaseForm = useForm<z.infer<typeof insertPurchaseSchema>>({
    resolver: zodResolver(insertPurchaseSchema),
    defaultValues: {
      imageUrl: null,
      categoryId: "",
      productId: null,
      itemName: "",
      quantity: "",
      unit: "kg",
      price: "",
      piecesPerUnit: null,
      pricePerPiece: null,
      purchaseDate: new Date(),
    },
  });

  const selectedUnit = purchaseForm.watch("unit");
  const containerUnits = ["box", "packet", "bottle", "can", "bag"];
  const showPiecesFields = containerUnits.includes(selectedUnit);

  const handleProductSelect = (productId: string) => {
    if (!productId || productId === "none") {
      purchaseForm.setValue("productId", null);
      return;
    }
    
    const product = products.find(p => p.id === productId);
    if (product) {
      purchaseForm.setValue("productId", productId);
      purchaseForm.setValue("itemName", product.name);
      purchaseForm.setValue("unit", product.unit);
      purchaseForm.setValue("categoryId", product.categoryId);
    }
  };

  const categoryForm = useForm<z.infer<typeof insertCategorySchema>>({
    resolver: zodResolver(insertCategorySchema),
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  const createPurchaseMutation = useMutation({
    mutationFn: async (data: z.infer<typeof insertPurchaseSchema>) => {
      return await apiRequest("POST", "/api/purchases", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/adjustments"] });
      setPurchaseDialogOpen(false);
      purchaseForm.reset();
      setImagePreview("");
      toast({
        title: "Success",
        description: "Purchase created successfully. Inventory updated automatically.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create purchase",
        variant: "destructive",
      });
    },
  });

  const updatePurchaseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<z.infer<typeof insertPurchaseSchema>> }) => {
      return await apiRequest("PATCH", `/api/purchases/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/adjustments"] });
      setPurchaseDialogOpen(false);
      purchaseForm.reset();
      setImagePreview("");
      toast({
        title: "Success",
        description: "Purchase updated successfully. Inventory adjusted automatically.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update purchase",
        variant: "destructive",
      });
    },
  });

  const deletePurchaseMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/purchases/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/adjustments"] });
      toast({
        title: "Success",
        description: "Purchase deleted successfully. Inventory reversed automatically.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete purchase",
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

  const handlePurchaseSubmit = (data: z.infer<typeof insertPurchaseSchema>) => {
    if (editingPurchase) {
      updatePurchaseMutation.mutate({ id: editingPurchase.id, data });
    } else {
      createPurchaseMutation.mutate(data);
    }
  };

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

  const handleEditPurchase = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setImagePreview(purchase.imageUrl || "");
    purchaseForm.reset({
      imageUrl: purchase.imageUrl || null,
      categoryId: purchase.categoryId,
      itemName: purchase.itemName,
      quantity: purchase.quantity,
      unit: purchase.unit,
      price: purchase.price,
      piecesPerUnit: purchase.piecesPerUnit || null,
      pricePerPiece: purchase.pricePerPiece || null,
      purchaseDate: new Date(purchase.purchaseDate),
    });
    setPurchaseDialogOpen(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    categoryForm.reset({
      name: category.name,
      slug: category.slug,
    });
    setCategoryDialogOpen(true);
  };

  const handleAddPurchaseClick = () => {
    setEditingPurchase(null);
    setImagePreview("");
    purchaseForm.reset({
      imageUrl: null,
      categoryId: "",
      itemName: "",
      quantity: "",
      unit: "kg",
      price: "",
      piecesPerUnit: null,
      pricePerPiece: null,
      purchaseDate: new Date(),
    });
    setPurchaseDialogOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setImagePreview(base64String);
      purchaseForm.setValue('imageUrl', base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImagePreview("");
    purchaseForm.setValue('imageUrl', null);
  };

  const handleAddCategoryClick = () => {
    setEditingCategory(null);
    categoryForm.reset({
      name: "",
      slug: "",
    });
    setCategoryDialogOpen(true);
  };

  const handleExport = () => {
    const csvHeader = "Item Name,Category,Quantity,Unit,Price,Purchase Date\n";
    const csvRows = filteredPurchases.map(purchase => {
      const category = categories.find(c => c.id === purchase.categoryId);
      return `"${purchase.itemName}","${category?.name || 'N/A'}","${purchase.quantity}","${purchase.unit}","${purchase.price}","${format(new Date(purchase.purchaseDate), 'yyyy-MM-dd')}"`;
    }).join('\n');
    
    const csvContent = csvHeader + csvRows;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchases_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: `Exported ${filteredPurchases.length} purchases to CSV`,
    });
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
        const lines = text.split('\n').slice(1);
        rows = lines.map(line => {
          if (!line.trim()) return [];
          const matches = line.match(/(?:"([^"]*)"|([^,]*))/g);
          return matches ? matches.map(m => m.replace(/^"|"$/g, '').trim()) : [];
        });
      }
      
      let imported = 0;
      let skipped = 0;
      for (const row of rows) {
        if (!row || row.length < 6) continue;
        if (!row[0] || !String(row[0]).trim()) continue;
        
        const itemName = String(row[0] || '').trim();
        const categoryName = String(row[1] || '').trim();
        const quantity = String(row[2] || '').trim();
        const unit = String(row[3] || '').trim();
        const price = String(row[4] || '').trim();
        
        let purchaseDate: Date;
        if (row[5] instanceof Date) {
          purchaseDate = row[5];
        } else {
          const dateStr = String(row[5] || '').trim();
          purchaseDate = new Date(dateStr);
        }
        
        if (isNaN(purchaseDate.getTime())) {
          console.error('Invalid date for purchase:', itemName, row[5]);
          skipped++;
          continue;
        }
        
        const category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
        if (!category) {
          console.error('Category not found:', categoryName);
          skipped++;
          continue;
        }

        try {
          await apiRequest("POST", "/api/purchases", {
            itemName,
            categoryId: category.id,
            quantity,
            unit,
            price,
            purchaseDate,
            imageUrl: null,
          });
          imported++;
        } catch (error) {
          console.error('Failed to import purchase:', itemName, error);
          skipped++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      
      const message = skipped > 0 
        ? `Imported ${imported} purchases, ${skipped} skipped`
        : `Imported ${imported} purchases`;
      
      toast({
        title: skipped > 0 ? "Import completed with warnings" : "Success",
        description: message,
        variant: skipped > 0 ? "default" : "default",
      });
    };
    
    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleDownloadSample = () => {
    const sampleData = [
      ["Item Name", "Category", "Quantity", "Unit", "Price", "Purchase Date"],
      ["Tomatoes", "Vegetables", "10", "kg", "2.50", "2025-01-15"],
      ["Chicken Breast", "Meat", "5", "kg", "8.99", "2025-01-15"],
      ["Milk", "Dairy", "12", "litre", "3.50", "2025-01-16"],
      ["Rice", "Grains", "25", "kg", "1.20", "2025-01-16"],
    ];
    
    const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Purchases");
    
    const fileName = `purchase_sample_template.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    toast({
      title: "Success",
      description: "Sample Excel template downloaded",
    });
  };

  const handleViewPurchase = (purchase: Purchase) => {
    setViewingPurchase(purchase);
    setViewDialogOpen(true);
  };

  const handlePrintPurchase = (purchase: Purchase) => {
    const category = categories.find(c => c.id === purchase.categoryId);
    const printContent = `
      <html>
        <head>
          <title>Purchase Receipt - ${purchase.itemName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #EA580C; }
            .details { margin: 20px 0; }
            .details p { margin: 8px 0; }
            .label { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Purchase Receipt</h1>
          <div class="details">
            <p><span class="label">Item Name:</span> ${purchase.itemName}</p>
            <p><span class="label">Category:</span> ${category?.name || 'N/A'}</p>
            <p><span class="label">Quantity:</span> ${purchase.quantity} ${purchase.unit}</p>
            <p><span class="label">Price:</span> $${purchase.price}</p>
            <p><span class="label">Purchase Date:</span> ${format(new Date(purchase.purchaseDate), 'PPP')}</p>
            <p><span class="label">Total:</span> $${(parseFloat(purchase.quantity) * parseFloat(purchase.price)).toFixed(2)}</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 md:p-6 border-b gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-page-title">Purchase Management</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage purchase orders and inventory</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="space-y-4 md:space-y-6">
          <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-end">
            <div className="flex-1 w-full sm:min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Search Purchases</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by item name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>

            <div className="w-full sm:w-[200px]">
              <label className="text-sm font-medium mb-2 block">Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger data-testid="select-filter-category">
                  <SelectValue placeholder="All categories" />
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

            <div className="w-full sm:w-[200px]">
              <label className="text-sm font-medium mb-2 block">Date Filter</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger data-testid="select-date-filter">
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {dateFilter === "custom" && (
              <div>
                <label className="text-sm font-medium mb-2 block">Select Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" data-testid="button-custom-date">
                      <Calendar className="w-4 h-4 mr-2" />
                      {customDate ? format(customDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={customDate}
                      onSelect={setCustomDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={handleAddCategoryClick} data-testid="button-manage-categories">
                  <FolderPlus className="w-4 h-4 mr-2" />
                  Manage Categories
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:max-w-md" data-testid="dialog-category">
                <DialogHeader>
                  <DialogTitle>{editingCategory ? "Edit Category" : "Add New Category"}</DialogTitle>
                  <DialogDescription>
                    {editingCategory ? "Update category information" : "Create a new category for purchases"}
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
                            <Input {...field} placeholder="e.g., Vegetables" data-testid="input-category-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)} data-testid="button-cancel-category">
                        Cancel
                      </Button>
                      <Button type="submit" data-testid="button-submit-category">
                        {editingCategory ? "Update" : "Create"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>

                {categories.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-medium mb-3">Existing Categories</h3>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {categories.map((category) => (
                        <div key={category.id} className="flex items-center justify-between p-2 rounded-md hover-elevate">
                          <span className="text-sm">{category.name}</span>
                          <div className="flex gap-2">
                            {hasPermission("purchases.edit") && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditCategory(category)}
                                data-testid={`button-edit-category-${category.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                            {hasPermission("purchases.delete") && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteCategoryMutation.mutate(category.id)}
                                data-testid={`button-delete-category-${category.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <label htmlFor="import-file">
              <input
                id="import-file"
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleImport}
                data-testid="input-import-file"
              />
              <Button variant="outline" asChild data-testid="button-import">
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Import Purchases
                </span>
              </Button>
            </label>

            <Button variant="outline" onClick={handleDownloadSample} data-testid="button-download-sample">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Download Sample Excel
            </Button>

            {hasPermission("reports.export") && (
              <Button variant="outline" onClick={handleExport} data-testid="button-export">
                <Download className="w-4 h-4 mr-2" />
                Export Purchases
              </Button>
            )}

            {hasPermission("purchases.create") && (
              <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={handleAddPurchaseClick} data-testid="button-add-purchase">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Purchase
                  </Button>
                </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-purchase">
                <DialogHeader>
                  <DialogTitle>{editingPurchase ? "Edit Purchase" : "Add New Purchase"}</DialogTitle>
                  <DialogDescription>
                    {editingPurchase ? "Update purchase information" : "Create a new purchase record"}
                  </DialogDescription>
                </DialogHeader>
                <Form {...purchaseForm}>
                  <form onSubmit={purchaseForm.handleSubmit(handlePurchaseSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <FormLabel>Purchase Image (optional)</FormLabel>
                      
                      {imagePreview ? (
                        <div className="relative w-full h-48 rounded-md overflow-hidden border">
                          <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="absolute top-2 right-2"
                            onClick={handleRemoveImage}
                            data-testid="button-remove-image"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <label htmlFor="purchase-image-upload">
                            <input
                              id="purchase-image-upload"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleImageUpload}
                              data-testid="input-image-upload"
                            />
                            <div className="border-2 border-dashed rounded-md p-6 hover-elevate cursor-pointer transition-colors flex flex-col items-center gap-2">
                              <ImagePlus className="w-8 h-8 text-muted-foreground" />
                              <div className="text-center">
                                <p className="text-sm font-medium">Upload Image</p>
                                <p className="text-xs text-muted-foreground">Click to select an image file</p>
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
                            control={purchaseForm.control}
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
                      control={purchaseForm.control}
                      name="productId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Link to Existing Product (optional)</FormLabel>
                          <FormControl>
                            <ProductSelect
                              value={field.value || undefined}
                              onValueChange={handleProductSelect}
                              placeholder="Select product from inventory or leave blank"
                              showUnit={true}
                              includeNoneOption={true}
                              noneOptionLabel="None (Custom Purchase)"
                              dataTestId="select-product"
                            />
                          </FormControl>
                          <FormMessage />
                          <p className="text-xs text-muted-foreground">
                            Select a product to automatically update its inventory when purchase is created
                          </p>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={purchaseForm.control}
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

                    <FormField
                      control={purchaseForm.control}
                      name="itemName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Item Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g., Fresh Tomatoes" data-testid="input-item-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={purchaseForm.control}
                        name="quantity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantity</FormLabel>
                            <FormControl>
                              <Input {...field} type="number" step="0.01" placeholder="10" data-testid="input-quantity" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={purchaseForm.control}
                        name="unit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Unit</FormLabel>
                            <UnitSelect
                              value={field.value}
                              onValueChange={field.onChange}
                              placeholder="Select unit"
                              data-testid="select-unit"
                            />
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={purchaseForm.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price per Unit ($)</FormLabel>
                          <FormControl>
                            <Input {...field} type="number" step="0.01" placeholder="5.99" data-testid="input-price" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {showPiecesFields && (
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={purchaseForm.control}
                          name="piecesPerUnit"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Pieces per {selectedUnit} *</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number" 
                                  step="1" 
                                  placeholder="e.g., 12" 
                                  value={field.value || ""}
                                  onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                                  data-testid="input-pieces-per-unit" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={purchaseForm.control}
                          name="pricePerPiece"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Price per Piece ($) *</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  type="number" 
                                  step="0.01" 
                                  placeholder="e.g., 0.50" 
                                  value={field.value || ""}
                                  onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                                  data-testid="input-price-per-piece" 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    <FormField
                      control={purchaseForm.control}
                      name="purchaseDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Purchase Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className="justify-start text-left font-normal"
                                  data-testid="button-purchase-date"
                                >
                                  <Calendar className="mr-2 h-4 w-4" />
                                  {field.value ? format(field.value, "PPP") : "Pick a date"}
                                </Button>
                              </FormControl>
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
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setPurchaseDialogOpen(false)} data-testid="button-cancel">
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createPurchaseMutation.isPending || updatePurchaseMutation.isPending} data-testid="button-submit">
                        {editingPurchase ? "Update" : "Create"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
            )}
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Purchase Analytics
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={filteredPurchases.map(purchase => ({
                    name: purchase.itemName.length > 15 
                      ? purchase.itemName.substring(0, 15) + '...' 
                      : purchase.itemName,
                    unitPrice: parseFloat(purchase.price),
                    purchaseCost: parseFloat(purchase.quantity) * parseFloat(purchase.price),
                  }))}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="unitPrice" fill="hsl(var(--primary))" name="Unit Price" />
                  <Bar dataKey="purchaseCost" fill="hsl(var(--chart-2))" name="Purchase Cost" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-[100px] hidden sm:table-cell">Image</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead className="hidden md:table-cell">Category</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">Unit Price</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">Purchase Cost</TableHead>
                      <TableHead className="text-right">Total Price</TableHead>
                      <TableHead className="text-center w-[200px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPurchases.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12">
                          <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">No purchases found</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPurchases.map((purchase) => {
                        const category = categories.find(c => c.id === purchase.categoryId);
                        const purchaseCost = parseFloat(purchase.quantity) * parseFloat(purchase.price);
                        const totalPrice = purchaseCost;
                        const hasPiecesInfo = purchase.piecesPerUnit && purchase.pricePerPiece;
                        const containerUnits = ["box", "packet", "bottle", "can", "bag"];
                        const isContainerUnit = containerUnits.includes(purchase.unit);
                        
                        return (
                          <TableRow key={purchase.id} data-testid={`row-purchase-${purchase.id}`}>
                            <TableCell data-testid={`text-date-${purchase.id}`}>
                              {format(new Date(purchase.purchaseDate), 'PP')}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              {purchase.imageUrl ? (
                                <img
                                  src={purchase.imageUrl}
                                  alt={purchase.itemName}
                                  className="w-16 h-16 object-cover rounded-md"
                                  data-testid={`img-purchase-${purchase.id}`}
                                />
                              ) : (
                                <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center">
                                  <ShoppingCart className="w-6 h-6 text-muted-foreground" />
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="font-medium" data-testid={`text-item-name-${purchase.id}`}>
                              {purchase.itemName}
                            </TableCell>
                            <TableCell className="hidden md:table-cell" data-testid={`text-category-${purchase.id}`}>
                              {category?.name || 'N/A'}
                            </TableCell>
                            <TableCell className="text-right" data-testid={`text-quantity-${purchase.id}`}>
                              <div>
                                <div>{purchase.quantity} {purchase.unit}</div>
                                {purchase.piecesPerUnit && purchase.pricePerPiece && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {purchase.piecesPerUnit} pieces × ${purchase.pricePerPiece}/piece
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right hidden lg:table-cell" data-testid={`text-price-${purchase.id}`}>
                              <div>
                                <div>${purchase.price}</div>
                                {purchase.piecesPerUnit && purchase.pricePerPiece && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    ${(parseFloat(purchase.piecesPerUnit) * parseFloat(purchase.pricePerPiece)).toFixed(2)}/{purchase.unit}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right hidden lg:table-cell" data-testid={`text-purchase-cost-${purchase.id}`}>
                              ${purchaseCost.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-semibold" data-testid={`text-total-${purchase.id}`}>
                              ${totalPrice.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2 justify-center">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleViewPurchase(purchase)}
                                  data-testid={`button-view-${purchase.id}`}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleEditPurchase(purchase)}
                                  data-testid={`button-edit-${purchase.id}`}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handlePrintPurchase(purchase)}
                                  data-testid={`button-print-${purchase.id}`}
                                >
                                  <Printer className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => deletePurchaseMutation.mutate(purchase.id)}
                                  data-testid={`button-delete-${purchase.id}`}
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
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl" data-testid="dialog-view-purchase">
          <DialogHeader>
            <DialogTitle>Purchase Details</DialogTitle>
          </DialogHeader>
          {viewingPurchase && (
            <div className="space-y-4">
              {viewingPurchase.imageUrl && (
                <div className="w-full h-64 rounded-md overflow-hidden">
                  <img
                    src={viewingPurchase.imageUrl}
                    alt={viewingPurchase.itemName}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Item Name</p>
                  <p className="font-medium">{viewingPurchase.itemName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="font-medium">{categories.find(c => c.id === viewingPurchase.categoryId)?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Quantity</p>
                  <p className="font-medium">{viewingPurchase.quantity} {viewingPurchase.unit}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Price per Unit</p>
                  <p className="font-medium">${viewingPurchase.price}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="font-semibold text-primary text-lg">
                    ${(parseFloat(viewingPurchase.quantity) * parseFloat(viewingPurchase.price)).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Purchase Date</p>
                  <p className="font-medium">{format(new Date(viewingPurchase.purchaseDate), 'PPP')}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
