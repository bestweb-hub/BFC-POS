import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { useDebounce } from "@/hooks/use-debounce";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Eye, Edit, Trash2, Printer, Search, FolderOpen, Upload, X, Wallet, TrendingUp, Calendar as CalendarIcon, Package, Download } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UnitSelect } from "@/components/unit-select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";
import { useBranch } from "@/contexts/BranchContext";
import type { Expense, ExpenseCategory, Unit } from "@shared/schema";

export default function ExpenseManage() {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const { selectedBranchId } = useBranch();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState("expenses");
  
  const [viewExpense, setViewExpense] = useState<Expense | null>(null);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [showAddExpenseDialog, setShowAddExpenseDialog] = useState(false);
  const [printExpense, setPrintExpense] = useState<Expense | null>(null);
  
  const [editCategory, setEditCategory] = useState<ExpenseCategory | null>(null);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [showAddCategoryDialog, setShowAddCategoryDialog] = useState(false);
  
  const [editUnit, setEditUnit] = useState<Unit | null>(null);
  const [deleteUnitId, setDeleteUnitId] = useState<string | null>(null);
  const [showAddUnitDialog, setShowAddUnitDialog] = useState(false);
  
  const [expenseFormData, setExpenseFormData] = useState({
    expenseDate: new Date().toISOString().slice(0, 16),
    categoryId: "",
    description: "",
    amount: "",
    unit: "Kg",
    quantity: "1",
    total: "",
    slipImage: "",
  });
  
  const [categoryFormData, setCategoryFormData] = useState({
    name: "",
    description: "",
  });

  const [unitFormData, setUnitFormData] = useState({
    name: "",
    description: "",
  });

  // Build same date range and filters for list + stats (stats cards update with filtering, like sales page)
  const getExpensesQueryParams = () => {
    const params = new URLSearchParams();
    if (selectedBranchId) params.append("branchId", selectedBranchId);
    if (selectedCategory !== "all") params.append("categoryId", selectedCategory);
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;
    if (selectedMonths.length > 0) {
      const sorted = [...selectedMonths].sort();
      const [y1, m1] = sorted[0].split("-").map(Number);
      const [y2, m2] = sorted[sorted.length - 1].split("-").map(Number);
      dateFrom = new Date(y1, m1 - 1, 1, 0, 0, 0, 0);
      dateTo = new Date(y2, m2, 0, 23, 59, 59, 999);
    } else {
      const now = new Date();
      const currentYear = now.getFullYear();
      if (dateFilter === "today") {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      } else if (dateFilter === "yesterday") {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        dateFrom = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
        dateTo = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
      } else if (dateFilter === "thisMonth") {
        dateFrom = new Date(currentYear, now.getMonth(), 1);
        dateTo = new Date(currentYear, now.getMonth() + 1, 0, 23, 59, 59, 999);
      } else if (dateFilter === "lastMonth") {
        dateFrom = new Date(currentYear, now.getMonth() - 1, 1);
        dateTo = new Date(currentYear, now.getMonth(), 0, 23, 59, 59, 999);
      } else if (dateFilter === "custom" && customDate) {
        dateFrom = new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate(), 0, 0, 0, 0);
        dateTo = new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate(), 23, 59, 59, 999);
      } else if (["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"].includes(dateFilter)) {
        const monthMap: Record<string, number> = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
        const mo = monthMap[dateFilter] ?? 0;
        dateFrom = new Date(currentYear, mo, 1);
        dateTo = new Date(currentYear, mo + 1, 0, 23, 59, 59, 999);
      }
    }
    if (dateFrom) params.append("dateFrom", dateFrom.toISOString());
    if (dateTo) params.append("dateTo", dateTo.toISOString());
    return params.toString();
  };

  const expensesParamsString = getExpensesQueryParams();

  const { data: expenses = [], isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses", expensesParamsString],
    queryFn: async () => {
      const res = await fetch(`/api/expenses${expensesParamsString ? `?${expensesParamsString}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch expenses");
      return res.json();
    },
  });

  const { data: expenseStats } = useQuery<{ totalAmount: number; count: number; avgExpense: number; categoryCount: number }>({
    queryKey: ["/api/expenses/stats", expensesParamsString],
    queryFn: async () => {
      const res = await fetch(`/api/expenses/stats${expensesParamsString ? `?${expensesParamsString}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch expense stats");
      return res.json();
    },
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery<ExpenseCategory[]>({
    queryKey: ["/api/expense-categories"],
  });

  const { data: units = [], isLoading: unitsLoading } = useQuery<Unit[]>({
    queryKey: ["/api/units"],
  });

  const createExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/expenses", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/stats"] });
      setShowAddExpenseDialog(false);
      resetExpenseForm();
      toast({ title: "Success", description: "Expense added successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add expense", variant: "destructive" });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest("PATCH", `/api/expenses/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/stats"] });
      setEditExpense(null);
      toast({ title: "Success", description: "Expense updated successfully" });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || error?.error || "Failed to update expense";
      toast({ 
        title: "Error", 
        description: errorMessage, 
        variant: "destructive" 
      });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/expenses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses/stats"] });
      setDeleteExpenseId(null);
      toast({ title: "Success", description: "Expense deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete expense", variant: "destructive" });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/expense-categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      setShowAddCategoryDialog(false);
      resetCategoryForm();
      toast({ title: "Success", description: "Category added successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add category", variant: "destructive" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest("PATCH", `/api/expense-categories/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      setEditCategory(null);
      toast({ title: "Success", description: "Category updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update category", variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/expense-categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expense-categories"] });
      setDeleteCategoryId(null);
      toast({ title: "Success", description: "Category deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete category", variant: "destructive" });
    },
  });

  const createUnitMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/units", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/units"] });
      setShowAddUnitDialog(false);
      resetUnitForm();
      toast({ title: "Success", description: "Unit added successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add unit", variant: "destructive" });
    },
  });

  const updateUnitMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest("PATCH", `/api/units/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/units"] });
      setEditUnit(null);
      toast({ title: "Success", description: "Unit updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update unit", variant: "destructive" });
    },
  });

  const deleteUnitMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/units/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/units"] });
      setDeleteUnitId(null);
      toast({ title: "Success", description: "Unit deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete unit", variant: "destructive" });
    },
  });

  const resetExpenseForm = () => {
    setExpenseFormData({
      expenseDate: new Date().toISOString().slice(0, 16),
      categoryId: "",
      description: "",
      amount: "",
      unit: "Kg",
      quantity: "1",
      total: "",
      slipImage: "",
    });
  };

  const resetCategoryForm = () => {
    setCategoryFormData({
      name: "",
      description: "",
    });
  };

  const resetUnitForm = () => {
    setUnitFormData({
      name: "",
      description: "",
    });
  };

  const calculateTotal = (amount: string, quantity: string) => {
    const amt = parseFloat(amount) || 0;
    const qty = parseFloat(quantity) || 0;
    return (amt * qty).toFixed(2);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      if (isEdit && editExpense) {
        setEditExpense({ ...editExpense, slipImage: base64String });
      } else {
        setExpenseFormData({ ...expenseFormData, slipImage: base64String });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExpenseFormChange = (field: string, value: string) => {
    const updated = { ...expenseFormData, [field]: value };
    
    if (field === "amount" || field === "quantity") {
      updated.total = calculateTotal(updated.amount, updated.quantity);
    }
    
    setExpenseFormData(updated);
  };

  const handleAddExpense = () => {
    if (!expenseFormData.categoryId || !expenseFormData.description || !expenseFormData.amount) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    createExpenseMutation.mutate({
      expenseDate: new Date(expenseFormData.expenseDate).toISOString(),
      categoryId: expenseFormData.categoryId,
      description: expenseFormData.description,
      amount: expenseFormData.amount,
      unit: expenseFormData.unit,
      quantity: expenseFormData.quantity,
      total: expenseFormData.total || calculateTotal(expenseFormData.amount, expenseFormData.quantity),
      slipImage: expenseFormData.slipImage || undefined,
    });
  };

  const handleEditExpenseSave = () => {
    if (!editExpense) return;
    
    // Prepare the update data
    const updateData: any = {
      expenseDate: new Date(editExpense.expenseDate).toISOString(),
      categoryId: editExpense.categoryId,
      description: editExpense.description,
      amount: editExpense.amount,
      unit: editExpense.unit,
      quantity: editExpense.quantity,
      total: editExpense.total,
    };

    // Handle slipImage: only include it if it's been changed
    // If slipImage is an empty string, send empty string to clear it
    // If slipImage exists (either URL or base64), include it
    // If slipImage is undefined, don't include it (preserve existing)
    if (editExpense.slipImage !== undefined) {
      updateData.slipImage = editExpense.slipImage || null;
    }
    
    updateExpenseMutation.mutate({
      id: editExpense.id,
      data: updateData,
    });
  };

  const handlePrintExpense = (expense: Expense) => {
    const category = categories.find(c => c.id === expense.categoryId);
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Expense Receipt - ${expense.id}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; }
              h1 { color: #EA580C; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
              th { background-color: #f5f5f5; }
              .total { font-size: 1.2em; font-weight: bold; }
              .slip-image { margin-top: 20px; text-align: center; }
              .slip-image img { max-width: 500px; max-height: 400px; border: 1px solid #ddd; border-radius: 8px; }
            </style>
          </head>
          <body>
            <h1>Expense Receipt</h1>
            <table>
              <tr><th>Expense ID</th><td>${expense.id}</td></tr>
              <tr><th>Date & Time</th><td>${format(new Date(expense.expenseDate), "PPpp")}</td></tr>
              <tr><th>Category</th><td>${category?.name || "N/A"}</td></tr>
              <tr><th>Description</th><td>${expense.description}</td></tr>
              <tr><th>Amount</th><td>$${expense.amount}</td></tr>
              <tr><th>Unit</th><td>${expense.unit}</td></tr>
              <tr><th>Quantity</th><td>${expense.quantity}</td></tr>
              <tr><th class="total">Total</th><td class="total">$${expense.total}</td></tr>
            </table>
            ${expense.slipImage ? `
              <div class="slip-image">
                <h3>Slip/Invoice</h3>
                <img src="${expense.slipImage}" alt="Expense slip" />
              </div>
            ` : ''}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleAddCategory = () => {
    if (!categoryFormData.name) {
      toast({ title: "Error", description: "Category name is required", variant: "destructive" });
      return;
    }

    createCategoryMutation.mutate(categoryFormData);
  };

  const handleEditCategorySave = () => {
    if (!editCategory) return;
    
    updateCategoryMutation.mutate({
      id: editCategory.id,
      data: {
        name: editCategory.name,
        description: editCategory.description,
      },
    });
  };

  const handleAddUnit = () => {
    if (!unitFormData.name) {
      toast({ title: "Error", description: "Unit name is required", variant: "destructive" });
      return;
    }

    createUnitMutation.mutate(unitFormData);
  };

  const handleEditUnitSave = () => {
    if (!editUnit) return;
    
    updateUnitMutation.mutate({
      id: editUnit.id,
      data: {
        name: editUnit.name,
        description: editUnit.description,
      },
    });
  };

  const handleExportExpenses = async () => {
    setExporting(true);
    try {
      const q = getExpensesQueryParams();
      const res = await fetch(`/api/expenses/export${q ? `?${q}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to export");
      const { expenses: exportList } = await res.json();
      const exportData = (exportList || []).map((e: Expense) => {
        const cat = categories.find((c) => c.id === e.categoryId);
        return {
          "Expense ID": e.id,
          "Date": format(new Date(e.expenseDate), "yyyy-MM-dd HH:mm"),
          "Category": cat?.name ?? "",
          "Description": e.description,
          "Amount": e.amount,
          "Unit": e.unit,
          "Quantity": e.quantity,
          "Total": e.total,
        };
      });
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Expenses");
      XLSX.writeFile(wb, `expenses-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast({ title: "Success", description: `Exported ${exportData.length} expenses` });
    } catch (e) {
      toast({ title: "Export Failed", description: e instanceof Error ? e.message : "Failed to export", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  // List is already filtered by category + date from backend; only filter by search client-side
  const filteredExpenses = expenses.filter((expense) => {
    const category = categories.find((c) => c.id === expense.categoryId);
    const searchLower = debouncedSearchTerm.toLowerCase();
    return (
      expense.id.toLowerCase().includes(searchLower) ||
      (expense.description && expense.description.toLowerCase().includes(searchLower)) ||
      (category?.name && category.name.toLowerCase().includes(searchLower)) ||
      (expense.total && expense.total.includes(debouncedSearchTerm))
    );
  });

  const totalExpenses = expenseStats?.totalAmount ?? 0;
  const expenseCount = expenseStats?.count ?? 0;
  const avgExpense = expenseStats?.avgExpense ?? 0;
  const categoryCount = expenseStats?.categoryCount ?? 0;

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">Expense Management</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1 font-medium">Track and manage all business expenses</p>
          </div>
          <div className="flex gap-2">
            {hasPermission("reports.export") && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={exporting} data-testid="button-export-expenses">
                    <Download className="w-4 h-4 mr-2" />
                    {exporting ? "Exporting…" : "Export"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportExpenses}>Export to Excel</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {hasPermission("expenses.create") && (
              <Button onClick={() => setShowAddExpenseDialog(true)} className="bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 w-full sm:w-auto" data-testid="button-add-expense">
                <Plus className="w-4 h-4 mr-2" />
                Add Expense
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
              <Wallet className="h-5 w-5 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">${totalExpenses.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground font-medium">
                {expenseCount} total records
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Expense</CardTitle>
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">${avgExpense.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground font-medium">
                Per transaction
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <FolderOpen className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{categoryCount}</div>
              <p className="text-xs text-muted-foreground font-medium">
                Categories in filtered results
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-gradient-to-r from-orange-100 to-pink-100 dark:from-orange-900 dark:to-pink-900">
            <TabsTrigger value="expenses" data-testid="tab-expenses">Expenses</TabsTrigger>
            <TabsTrigger value="categories" data-testid="tab-categories">
              <FolderOpen className="w-4 h-4 mr-2" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="units" data-testid="tab-units">
              <Package className="w-4 h-4 mr-2" />
              Units
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="space-y-4">
            <Card className="border-2 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950">
                <CardTitle className="text-xl">Expense Records</CardTitle>
                <CardDescription>View and manage all expense records</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by ID, description, category, or amount..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-expenses"
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
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full sm:w-[180px] justify-start">
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

                {expensesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading expenses...</div>
                ) : filteredExpenses.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {debouncedSearchTerm ? "No expenses found matching your search" : "No expenses recorded yet"}
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="hidden lg:table-cell" data-testid="header-expense-id">Expense ID</TableHead>
                          <TableHead data-testid="header-date-time" className="hidden md:table-cell">Date & Time</TableHead>
                          <TableHead data-testid="header-category">Category</TableHead>
                          <TableHead data-testid="header-description" className="hidden sm:table-cell">Description</TableHead>
                          <TableHead className="hidden lg:table-cell" data-testid="header-amount">Amount</TableHead>
                          <TableHead className="hidden xl:table-cell" data-testid="header-unit">Unit</TableHead>
                          <TableHead className="hidden xl:table-cell" data-testid="header-quantity">Quantity</TableHead>
                          <TableHead data-testid="header-total">Total</TableHead>
                          <TableHead data-testid="header-actions">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredExpenses.map((expense) => {
                          const category = categories.find(c => c.id === expense.categoryId);
                          return (
                            <TableRow key={expense.id}>
                              <TableCell className="hidden lg:table-cell" data-testid={`text-expense-id-${expense.id}`}>{expense.id}</TableCell>
                              <TableCell className="hidden md:table-cell" data-testid={`text-date-${expense.id}`}>
                                {format(new Date(expense.expenseDate), "MMM dd, yyyy HH:mm")}
                              </TableCell>
                              <TableCell data-testid={`text-category-${expense.id}`}>
                                {category?.name || "Unknown"}
                              </TableCell>
                              <TableCell className="hidden sm:table-cell" data-testid={`text-description-${expense.id}`}>{expense.description}</TableCell>
                              <TableCell className="hidden lg:table-cell" data-testid={`text-amount-${expense.id}`}>${expense.amount}</TableCell>
                              <TableCell className="hidden xl:table-cell" data-testid={`text-unit-${expense.id}`}>{expense.unit}</TableCell>
                              <TableCell className="hidden xl:table-cell" data-testid={`text-quantity-${expense.id}`}>{expense.quantity}</TableCell>
                              <TableCell className="font-semibold" data-testid={`text-total-${expense.id}`}>
                                ${expense.total}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {hasPermission("expenses.view") && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => setViewExpense(expense)}
                                          data-testid={`button-view-${expense.id}`}
                                        >
                                          <Eye className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>View Details</TooltipContent>
                                    </Tooltip>
                                  )}

                                  {hasPermission("expenses.edit") && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => setEditExpense(expense)}
                                          data-testid={`button-edit-${expense.id}`}
                                        >
                                          <Edit className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Edit Expense</TooltipContent>
                                    </Tooltip>
                                  )}

                                  {hasPermission("expenses.view") && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => handlePrintExpense(expense)}
                                          data-testid={`button-print-${expense.id}`}
                                        >
                                          <Printer className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Print Receipt</TooltipContent>
                                    </Tooltip>
                                  )}

                                  {hasPermission("expenses.delete") && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => setDeleteExpenseId(expense.id)}
                                          data-testid={`button-delete-${expense.id}`}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Delete Expense</TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <Card className="border-2 shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
                <div>
                  <CardTitle className="text-xl">Expense Categories</CardTitle>
                  <CardDescription>Organize expenses by categories</CardDescription>
                </div>
                {hasPermission("expenses.create") && (
                  <Button onClick={() => setShowAddCategoryDialog(true)} className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600" data-testid="button-add-category">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Category
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {categoriesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading categories...</div>
                ) : categories.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No categories created yet</div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead data-testid="header-category-name">Category Name</TableHead>
                          <TableHead data-testid="header-category-description">Description</TableHead>
                          <TableHead data-testid="header-category-actions">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categories.map((category) => (
                          <TableRow key={category.id}>
                            <TableCell className="font-medium" data-testid={`text-category-name-${category.id}`}>
                              {category.name}
                            </TableCell>
                            <TableCell data-testid={`text-category-description-${category.id}`}>
                              {category.description || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {hasPermission("expenses.edit") && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => setEditCategory(category)}
                                        data-testid={`button-edit-category-${category.id}`}
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Edit Category</TooltipContent>
                                  </Tooltip>
                                )}

                                {hasPermission("expenses.delete") && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => setDeleteCategoryId(category.id)}
                                        data-testid={`button-delete-category-${category.id}`}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Delete Category</TooltipContent>
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="units" className="space-y-4">
            <Card className="border-2 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Units</CardTitle>
                    <CardDescription>Organize units for measurements</CardDescription>
                  </div>
                  {hasPermission("settings.edit") && (
                    <Button onClick={() => setShowAddUnitDialog(true)} className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600" data-testid="button-add-unit">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Unit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {unitsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading units...</div>
                ) : units.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No units found. Create a unit to get started.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Unit Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {units.map((unit) => (
                        <TableRow key={unit.id}>
                          <TableCell className="font-medium">{unit.name}</TableCell>
                          <TableCell className="text-muted-foreground">{unit.description || "-"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {hasPermission("settings.edit") && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditUnit(unit)}
                                    data-testid={`button-edit-unit-${unit.id}`}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeleteUnitId(unit.id)}
                                    data-testid={`button-delete-unit-${unit.id}`}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
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
        </Tabs>
      </div>

      {/* Add Expense Dialog */}
      <Dialog open={showAddExpenseDialog} onOpenChange={setShowAddExpenseDialog}>
        <DialogContent className="w-[95vw] sm:max-w-2xl" data-testid="dialog-add-expense">
          <DialogHeader>
            <DialogTitle>Add New Expense</DialogTitle>
            <DialogDescription>Record a new business expense</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="expense-date">Expense Date *</Label>
              <Input
                id="expense-date"
                type="datetime-local"
                value={expenseFormData.expenseDate}
                onChange={(e) => handleExpenseFormChange("expenseDate", e.target.value)}
                data-testid="input-expense-date"
              />
            </div>
            <div>
              <Label htmlFor="category">Category *</Label>
              <Select
                value={expenseFormData.categoryId}
                onValueChange={(value) => handleExpenseFormChange("categoryId", value)}
              >
                <SelectTrigger id="category" data-testid="select-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id} data-testid={`option-category-${cat.id}`}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                placeholder="Enter expense description"
                value={expenseFormData.description}
                onChange={(e) => handleExpenseFormChange("description", e.target.value)}
                data-testid="input-description"
              />
            </div>
            <div>
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={expenseFormData.amount}
                onChange={(e) => handleExpenseFormChange("amount", e.target.value)}
                data-testid="input-amount"
              />
            </div>
            <div>
              <Label htmlFor="unit">Unit *</Label>
              <UnitSelect
                value={expenseFormData.unit}
                onValueChange={(value) => handleExpenseFormChange("unit", value)}
                id="unit"
                data-testid="select-unit"
              />
            </div>
            <div>
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                placeholder="1"
                value={expenseFormData.quantity}
                onChange={(e) => handleExpenseFormChange("quantity", e.target.value)}
                data-testid="input-quantity"
              />
            </div>
            <div>
              <Label htmlFor="total">Total</Label>
              <Input
                id="total"
                type="number"
                step="0.01"
                placeholder="Auto-calculated"
                value={expenseFormData.total || calculateTotal(expenseFormData.amount, expenseFormData.quantity)}
                readOnly
                className="bg-muted"
                data-testid="input-total"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="slip-image">Upload Slip/Invoice (Optional)</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    id="slip-image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e)}
                    className="flex-1"
                    data-testid="input-slip-image"
                  />
                  {expenseFormData.slipImage && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setExpenseFormData({ ...expenseFormData, slipImage: "" })}
                      data-testid="button-remove-slip"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {expenseFormData.slipImage && (
                  <div className="border rounded-lg p-2">
                    <img 
                      src={expenseFormData.slipImage} 
                      alt="Slip preview" 
                      className="max-h-40 mx-auto rounded"
                      data-testid="img-slip-preview"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddExpenseDialog(false)} data-testid="button-cancel-expense">
              Cancel
            </Button>
            <Button onClick={handleAddExpense} disabled={createExpenseMutation.isPending} data-testid="button-save-expense">
              {createExpenseMutation.isPending ? "Saving..." : "Save Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Expense Dialog */}
      <Dialog open={!!viewExpense} onOpenChange={() => setViewExpense(null)}>
        <DialogContent data-testid="dialog-view-expense">
          <DialogHeader>
            <DialogTitle>Expense Details</DialogTitle>
            <DialogDescription>View complete expense information</DialogDescription>
          </DialogHeader>
          {viewExpense && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Expense ID</Label>
                  <p className="font-medium" data-testid="view-expense-id">{viewExpense.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date & Time</Label>
                  <p className="font-medium" data-testid="view-expense-date">
                    {format(new Date(viewExpense.expenseDate), "PPpp")}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Category</Label>
                  <p className="font-medium" data-testid="view-expense-category">
                    {categories.find(c => c.id === viewExpense.categoryId)?.name || "Unknown"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="font-medium" data-testid="view-expense-description">{viewExpense.description}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Amount</Label>
                  <p className="font-medium" data-testid="view-expense-amount">${viewExpense.amount}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Unit</Label>
                  <p className="font-medium" data-testid="view-expense-unit">{viewExpense.unit}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Quantity</Label>
                  <p className="font-medium" data-testid="view-expense-quantity">{viewExpense.quantity}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total</Label>
                  <p className="font-bold text-lg" data-testid="view-expense-total">${viewExpense.total}</p>
                </div>
              </div>
              {viewExpense.slipImage && (
                <div>
                  <Label className="text-muted-foreground">Slip/Invoice</Label>
                  <div className="border rounded-lg p-2 mt-2">
                    <img 
                      src={viewExpense.slipImage} 
                      alt="Expense slip" 
                      className="max-h-60 mx-auto rounded"
                      data-testid="img-view-slip"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewExpense(null)} data-testid="button-close-view">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog open={!!editExpense} onOpenChange={() => setEditExpense(null)}>
        <DialogContent className="w-[95vw] sm:max-w-2xl" data-testid="dialog-edit-expense">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
            <DialogDescription>Modify expense details</DialogDescription>
          </DialogHeader>
          {editExpense && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-expense-date">Expense Date</Label>
                <Input
                  id="edit-expense-date"
                  type="datetime-local"
                  value={new Date(editExpense.expenseDate).toISOString().slice(0, 16)}
                  onChange={(e) => setEditExpense({ ...editExpense, expenseDate: new Date(e.target.value) })}
                  data-testid="input-edit-expense-date"
                />
              </div>
              <div>
                <Label htmlFor="edit-category">Category</Label>
                <Select
                  value={editExpense.categoryId}
                  onValueChange={(value) => setEditExpense({ ...editExpense, categoryId: value })}
                >
                  <SelectTrigger id="edit-category" data-testid="select-edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={editExpense.description}
                  onChange={(e) => setEditExpense({ ...editExpense, description: e.target.value })}
                  data-testid="input-edit-description"
                />
              </div>
              <div>
                <Label htmlFor="edit-amount">Amount</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  value={editExpense.amount}
                  onChange={(e) => {
                    const newAmount = e.target.value;
                    const newTotal = calculateTotal(newAmount, editExpense.quantity);
                    setEditExpense({ ...editExpense, amount: newAmount, total: newTotal });
                  }}
                  data-testid="input-edit-amount"
                />
              </div>
              <div>
                <Label htmlFor="edit-unit">Unit</Label>
                <UnitSelect
                  value={editExpense.unit}
                  onValueChange={(value) => setEditExpense({ ...editExpense, unit: value })}
                  id="edit-unit"
                  data-testid="select-edit-unit"
                />
              </div>
              <div>
                <Label htmlFor="edit-quantity">Quantity</Label>
                <Input
                  id="edit-quantity"
                  type="number"
                  step="0.01"
                  value={editExpense.quantity}
                  onChange={(e) => {
                    const newQuantity = e.target.value;
                    const newTotal = calculateTotal(editExpense.amount, newQuantity);
                    setEditExpense({ ...editExpense, quantity: newQuantity, total: newTotal });
                  }}
                  data-testid="input-edit-quantity"
                />
              </div>
              <div>
                <Label htmlFor="edit-total">Total</Label>
                <Input
                  id="edit-total"
                  type="number"
                  step="0.01"
                  value={editExpense.total}
                  readOnly
                  className="bg-muted"
                  data-testid="input-edit-total"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="edit-slip-image">Upload Slip/Invoice (Optional)</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      id="edit-slip-image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, true)}
                      className="flex-1"
                      data-testid="input-edit-slip-image"
                    />
                    {editExpense.slipImage && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setEditExpense({ ...editExpense, slipImage: "" })}
                        data-testid="button-remove-edit-slip"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  {editExpense.slipImage && (
                    <div className="border rounded-lg p-2">
                      <img 
                        src={editExpense.slipImage} 
                        alt="Slip preview" 
                        className="max-h-40 mx-auto rounded"
                        data-testid="img-edit-slip-preview"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditExpense(null)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button onClick={handleEditExpenseSave} disabled={updateExpenseMutation.isPending} data-testid="button-save-edit">
              {updateExpenseMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Expense Confirmation */}
      <AlertDialog open={!!deleteExpenseId} onOpenChange={() => setDeleteExpenseId(null)}>
        <AlertDialogContent data-testid="dialog-delete-expense">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteExpenseId && deleteExpenseMutation.mutate(deleteExpenseId)}
              className="bg-destructive text-destructive-foreground hover-elevate"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Category Dialog */}
      <Dialog open={showAddCategoryDialog} onOpenChange={setShowAddCategoryDialog}>
        <DialogContent data-testid="dialog-add-category">
          <DialogHeader>
            <DialogTitle>Add Expense Category</DialogTitle>
            <DialogDescription>Create a new expense category</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="category-name">Category Name *</Label>
              <Input
                id="category-name"
                placeholder="e.g., Office Supplies"
                value={categoryFormData.name}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                data-testid="input-category-name"
              />
            </div>
            <div>
              <Label htmlFor="category-description">Description</Label>
              <Input
                id="category-description"
                placeholder="Optional description"
                value={categoryFormData.description}
                onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                data-testid="input-category-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCategoryDialog(false)} data-testid="button-cancel-category">
              Cancel
            </Button>
            <Button onClick={handleAddCategory} disabled={createCategoryMutation.isPending} data-testid="button-save-category">
              {createCategoryMutation.isPending ? "Saving..." : "Save Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={!!editCategory} onOpenChange={() => setEditCategory(null)}>
        <DialogContent data-testid="dialog-edit-category">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>Modify category details</DialogDescription>
          </DialogHeader>
          {editCategory && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-category-name">Category Name</Label>
                <Input
                  id="edit-category-name"
                  value={editCategory.name}
                  onChange={(e) => setEditCategory({ ...editCategory, name: e.target.value })}
                  data-testid="input-edit-category-name"
                />
              </div>
              <div>
                <Label htmlFor="edit-category-description">Description</Label>
                <Input
                  id="edit-category-description"
                  value={editCategory.description || ""}
                  onChange={(e) => setEditCategory({ ...editCategory, description: e.target.value })}
                  data-testid="input-edit-category-description"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCategory(null)} data-testid="button-cancel-edit-category">
              Cancel
            </Button>
            <Button onClick={handleEditCategorySave} disabled={updateCategoryMutation.isPending} data-testid="button-save-edit-category">
              {updateCategoryMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation */}
      <AlertDialog open={!!deleteCategoryId} onOpenChange={() => setDeleteCategoryId(null)}>
        <AlertDialogContent data-testid="dialog-delete-category">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this category? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-category">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCategoryId && deleteCategoryMutation.mutate(deleteCategoryId)}
              className="bg-destructive text-destructive-foreground hover-elevate"
              data-testid="button-confirm-delete-category"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Unit Dialog */}
      <Dialog open={showAddUnitDialog} onOpenChange={setShowAddUnitDialog}>
        <DialogContent data-testid="dialog-add-unit">
          <DialogHeader>
            <DialogTitle>Add Unit</DialogTitle>
            <DialogDescription>Create a new unit for measurements</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="unit-name">Unit Name *</Label>
              <Input
                id="unit-name"
                placeholder="e.g., Kg, ml, Piece"
                value={unitFormData.name}
                onChange={(e) => setUnitFormData({ ...unitFormData, name: e.target.value })}
                data-testid="input-unit-name"
              />
            </div>
            <div>
              <Label htmlFor="unit-description">Description</Label>
              <Input
                id="unit-description"
                placeholder="Optional description"
                value={unitFormData.description}
                onChange={(e) => setUnitFormData({ ...unitFormData, description: e.target.value })}
                data-testid="input-unit-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUnitDialog(false)} data-testid="button-cancel-unit">
              Cancel
            </Button>
            <Button onClick={handleAddUnit} disabled={createUnitMutation.isPending} data-testid="button-save-unit">
              {createUnitMutation.isPending ? "Saving..." : "Save Unit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Unit Dialog */}
      <Dialog open={!!editUnit} onOpenChange={() => setEditUnit(null)}>
        <DialogContent data-testid="dialog-edit-unit">
          <DialogHeader>
            <DialogTitle>Edit Unit</DialogTitle>
            <DialogDescription>Modify unit details</DialogDescription>
          </DialogHeader>
          {editUnit && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-unit-name">Unit Name</Label>
                <Input
                  id="edit-unit-name"
                  value={editUnit.name}
                  onChange={(e) => setEditUnit({ ...editUnit, name: e.target.value })}
                  data-testid="input-edit-unit-name"
                />
              </div>
              <div>
                <Label htmlFor="edit-unit-description">Description</Label>
                <Input
                  id="edit-unit-description"
                  value={editUnit.description || ""}
                  onChange={(e) => setEditUnit({ ...editUnit, description: e.target.value })}
                  data-testid="input-edit-unit-description"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUnit(null)} data-testid="button-cancel-edit-unit">
              Cancel
            </Button>
            <Button onClick={handleEditUnitSave} disabled={updateUnitMutation.isPending} data-testid="button-save-edit-unit">
              {updateUnitMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Unit Confirmation */}
      <AlertDialog open={!!deleteUnitId} onOpenChange={() => setDeleteUnitId(null)}>
        <AlertDialogContent data-testid="dialog-delete-unit">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Unit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this unit? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-unit">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUnitId && deleteUnitMutation.mutate(deleteUnitId)}
              className="bg-destructive text-destructive-foreground hover-elevate"
              data-testid="button-confirm-delete-unit"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
