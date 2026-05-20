import { useState, useRef, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/use-permissions";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Eye, Edit, Trash2, Search, Users, DollarSign, Upload, Download, User, Briefcase, Building2, ImagePlus } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import * as XLSX from "xlsx";
import type { Employee, StaffSalary, StaffDeduction, StaffAdvance, StaffPreviousDue, StaffLoan, StaffUnpaidLeave, Position, Department } from "@shared/schema";

const EMPTY_EMPLOYEES: Employee[] = [];
const EMPTY_POSITIONS: Position[] = [];
const EMPTY_DEPARTMENTS: Department[] = [];

export default function StaffSalaryPage() {
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState("staff");
  const [searchTerm, setSearchTerm] = useState("");
  const [staffPage, setStaffPage] = useState(1);
  const [staffLimit, setStaffLimit] = useState(10);
  const [staffStatusFilter, setStaffStatusFilter] = useState<string>("all");
  const [staffJoinDateFrom, setStaffJoinDateFrom] = useState<string>("");
  const [staffJoinDateTo, setStaffJoinDateTo] = useState<string>("");
  const [salaryPage, setSalaryPage] = useState(1);
  const [salaryLimit, setSalaryLimit] = useState(10);
  const [viewEmployee, setViewEmployee] = useState<Employee | null>(null);
  const [showAddDeduction, setShowAddDeduction] = useState(false);
  const [showAddAdvance, setShowAddAdvance] = useState(false);
  const [showAddPreviousDue, setShowAddPreviousDue] = useState(false);
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [showAddUnpaidLeave, setShowAddUnpaidLeave] = useState(false);
  const [deductionForm, setDeductionForm] = useState({ amount: "", reason: "" });
  const [advanceForm, setAdvanceForm] = useState({ amount: "", note: "" });
  const [previousDueForm, setPreviousDueForm] = useState({ amount: "", note: "" });
  const [loanForm, setLoanForm] = useState({ amount: "", note: "" });
  const [unpaidLeaveForm, setUnpaidLeaveForm] = useState({ amount: "", note: "" });
  const [editingDeduction, setEditingDeduction] = useState<StaffDeduction | null>(null);
  const [editingAdvance, setEditingAdvance] = useState<StaffAdvance | null>(null);
  const [editingPreviousDue, setEditingPreviousDue] = useState<StaffPreviousDue | null>(null);
  const [editingLoan, setEditingLoan] = useState<StaffLoan | null>(null);
  const [editingUnpaidLeave, setEditingUnpaidLeave] = useState<StaffUnpaidLeave | null>(null);
  const [editingSalary, setEditingSalary] = useState<StaffSalary | null>(null);
  const [deleteHistoryItem, setDeleteHistoryItem] = useState<{ type: "deduction" | "advance" | "previousDue" | "salary" | "loan" | "unpaidLeave"; id: string } | null>(null);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [salaryDate, setSalaryDate] = useState<Date>(new Date());
  const [showBulkReleaseConfirm, setShowBulkReleaseConfirm] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [exportingSalaries, setExportingSalaries] = useState(false);
  const [showAddPositionDialog, setShowAddPositionDialog] = useState(false);
  const [showAddDepartmentDialog, setShowAddDepartmentDialog] = useState(false);
  const [editPosition, setEditPosition] = useState<Position | null>(null);
  const [editDepartment, setEditDepartment] = useState<Department | null>(null);
  const [deletePositionId, setDeletePositionId] = useState<string | null>(null);
  const [deleteDepartmentId, setDeleteDepartmentId] = useState<string | null>(null);
  const [positionFormData, setPositionFormData] = useState({ name: "", description: "" });
  const [departmentFormData, setDepartmentFormData] = useState({ name: "", description: "" });
  const photoFileInputRef = useRef<HTMLInputElement>(null);
  const editPhotoFileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    employeeId: "",
    name: "",
    position: "",
    department: "",
    email: "",
    phone: "",
    joiningDate: new Date().toISOString().slice(0, 10),
    salary: "",
    photoUrl: "",
    status: "active",
  });

  const { data: employees = EMPTY_EMPLOYEES, isLoading: employeesLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const staffPaginatedParams = () => {
    const params = new URLSearchParams();
    params.set("page", String(staffPage));
    params.set("limit", String(staffLimit));
    if (searchTerm.trim()) params.set("search", searchTerm.trim());
    if (staffStatusFilter && staffStatusFilter !== "all") params.set("status", staffStatusFilter);
    if (staffJoinDateFrom) params.set("joinDateFrom", staffJoinDateFrom);
    if (staffJoinDateTo) params.set("joinDateTo", staffJoinDateTo);
    return params.toString();
  };

  const { data: staffPaginated, isLoading: staffPaginatedLoading } = useQuery<{ employees: (Employee & { payable?: number; totalDeduction?: number; advanceSalary?: number; loanAmount?: number; unpaidLeave?: number })[]; total: number; page: number; limit: number }>({
    queryKey: ["/api/employees/paginated", staffPaginatedParams()],
    queryFn: async () => {
      const res = await fetch(`/api/employees/paginated?${staffPaginatedParams()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch staff");
      return res.json();
    },
    enabled: activeTab === "staff",
  });

  const salaryTabPaginatedParams = () => {
    const params = new URLSearchParams();
    params.set("page", String(salaryPage));
    params.set("limit", String(salaryLimit));
    return params.toString();
  };

  const { data: salaryTabPaginated, isLoading: salaryTabPaginatedLoading } = useQuery<{ employees: (Employee & { payable?: number; totalDeduction?: number; advanceSalary?: number; loanAmount?: number; unpaidLeave?: number })[]; total: number; page: number; limit: number }>({
    queryKey: ["/api/employees/paginated", "salary-tab", salaryTabPaginatedParams()],
    queryFn: async () => {
      const res = await fetch(`/api/employees/paginated?${salaryTabPaginatedParams()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch staff");
      return res.json();
    },
    enabled: activeTab === "salary",
  });

  const salaryTabList = activeTab === "salary" ? (salaryTabPaginated?.employees ?? []) : [];
  const salaryTabTotal = activeTab === "salary" ? (salaryTabPaginated?.total ?? 0) : 0;
  const salaryTabPages = activeTab === "salary" ? Math.max(1, Math.ceil((salaryTabPaginated?.total ?? 0) / (salaryTabPaginated?.limit ?? salaryLimit))) : 1;

  // When months selected, use exact date-time range in local time (fixes timezone)
  const salaryListParams = () => {
    const params = new URLSearchParams();
    if (selectedMonths.length > 0) {
      const sorted = [...selectedMonths].sort();
      const [y1, m1] = sorted[0].split("-").map(Number);
      const [y2, m2] = sorted[sorted.length - 1].split("-").map(Number);
      params.append("startDate", new Date(y1, m1 - 1, 1, 0, 0, 0, 0).toISOString());
      params.append("endDate", new Date(y2, m2, 0, 23, 59, 59, 999).toISOString());
    }
    return params.toString();
  };

  const salaryParamsString = salaryListParams();

  const { data: salariesWithEmployees = [], isLoading: salariesLoading } = useQuery<(StaffSalary & { employee: Employee | null })[]>({
    queryKey: ["/api/staff-salaries/with-employees", salaryParamsString],
    queryFn: async () => {
      const res = await fetch(`/api/staff-salaries/with-employees${salaryParamsString ? `?${salaryParamsString}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch salaries");
      return res.json();
    },
  });

  const { data: salarySummary } = useQuery<{ totalSalaries: number; totalAmount: number; netTotal: number; employeeCount: number }>({
    queryKey: ["/api/staff-salaries/summary", salaryParamsString],
    queryFn: async () => {
      const res = await fetch(`/api/staff-salaries/summary${salaryParamsString ? `?${salaryParamsString}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch salary summary");
      return res.json();
    },
  });

  const { data: payableSummary } = useQuery<{ totalPayable: number; totalDeduction: number }>({
    queryKey: ["/api/employees/payable-summary"],
    queryFn: async () => {
      const res = await fetch("/api/employees/payable-summary", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payable summary");
      return res.json();
    },
  });

  const { data: positions = EMPTY_POSITIONS } = useQuery<Position[]>({
    queryKey: ["/api/positions"],
  });

  const { data: departments = EMPTY_DEPARTMENTS } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: nextEmployeeIdData } = useQuery<{ nextId: string }>({
    queryKey: ["/api/employees/next-employee-id"],
    queryFn: async () => {
      const res = await fetch("/api/employees/next-employee-id", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch next ID");
      return res.json();
    },
    enabled: showAddDialog,
  });

  useEffect(() => {
    if (showAddDialog && nextEmployeeIdData?.nextId) {
      setFormData((f) => ({ ...f, employeeId: nextEmployeeIdData.nextId }));
    }
  }, [showAddDialog, nextEmployeeIdData?.nextId]);

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: Partial<Employee>) => {
      return apiRequest("POST", "/api/employees", {
        ...data,
        joiningDate: new Date(data.joiningDate!).toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees/paginated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees/next-employee-id"] });
      setShowAddDialog(false);
      resetForm();
      toast({ title: "Success", description: "Staff added successfully" });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e?.message || "Failed to add staff", variant: "destructive" });
    },
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Employee> }) => {
      return apiRequest("PATCH", `/api/employees/${id}`, {
        ...data,
        joiningDate: data.joiningDate ? new Date(data.joiningDate).toISOString() : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees/paginated"] });
      setEditEmployee(null);
      toast({ title: "Success", description: "Staff updated successfully" });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e?.message || "Failed to update staff", variant: "destructive" });
    },
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees/paginated"] });
      setDeleteEmployeeId(null);
      toast({ title: "Success", description: "Staff deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete staff", variant: "destructive" });
    },
  });

  const createPositionMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => apiRequest("POST", "/api/positions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      setShowAddPositionDialog(false);
      setPositionFormData({ name: "", description: "" });
      toast({ title: "Success", description: "Position added" });
    },
    onError: () => toast({ title: "Error", description: "Failed to add position", variant: "destructive" }),
  });

  const updatePositionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Position> }) => apiRequest("PATCH", `/api/positions/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      setEditPosition(null);
      toast({ title: "Success", description: "Position updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update position", variant: "destructive" }),
  });

  const deletePositionMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/positions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/positions"] });
      setDeletePositionId(null);
      toast({ title: "Success", description: "Position deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete position", variant: "destructive" }),
  });

  const createDepartmentMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => apiRequest("POST", "/api/departments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setShowAddDepartmentDialog(false);
      setDepartmentFormData({ name: "", description: "" });
      toast({ title: "Success", description: "Department added" });
    },
    onError: () => toast({ title: "Error", description: "Failed to add department", variant: "destructive" }),
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Department> }) => apiRequest("PATCH", `/api/departments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setEditDepartment(null);
      toast({ title: "Success", description: "Department updated" });
    },
    onError: () => toast({ title: "Error", description: "Failed to update department", variant: "destructive" }),
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/departments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setDeleteDepartmentId(null);
      toast({ title: "Success", description: "Department deleted" });
    },
    onError: () => toast({ title: "Error", description: "Failed to delete department", variant: "destructive" }),
  });

  const bulkReleaseMutation = useMutation({
    mutationFn: async (payload: { employeeIds: string[]; salaryDate: string }) => {
      if (payload.employeeIds.length === 0) throw new Error("No employees selected");
      const resPayable = await fetch(`/api/employees/expected-salaries?ids=${payload.employeeIds.join(",")}`, { credentials: "include" });
      if (!resPayable.ok) throw new Error("Failed to fetch payable salaries");
      const payableList = (await resPayable.json()) as { employeeId: string; baseSalary: number; payable: number }[];
      const byId = Object.fromEntries(payableList.map((e) => [e.employeeId, e]));
      const salaries = payload.employeeIds.map((employeeId) => {
        const info = byId[employeeId];
        const base = info?.baseSalary ?? 0;
        const payable = info?.payable ?? base;
        const deduct = Math.max(0, base - payable);
        return {
          employeeId,
          salaryDate: payload.salaryDate,
          salaryAmount: base.toFixed(2),
          deductSalary: deduct.toFixed(2),
          totalSalary: payable.toFixed(2),
        };
      });
      const res = await apiRequest("POST", "/api/staff-salaries/bulk-release", { salaries });
      return (await res.json()) as { success: number; failed: number };
    },
    onSuccess: (data: { success: number; failed: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff-salaries/with-employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees/paginated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees/payable-summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setSelectedIds(new Set());
      setShowBulkReleaseConfirm(false);
      toast({ title: "Success", description: `Salary released for ${data.success} staff (payable amount used)` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to release salaries", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      employeeId: "",
      name: "",
      position: "",
      department: "",
      email: "",
      phone: "",
      joiningDate: new Date().toISOString().slice(0, 10),
      salary: "",
      photoUrl: "",
      status: "active",
    });
  };

  const filteredStaff = employees.filter((e) => {
    const term = searchTerm.toLowerCase();
    return (
      e.name.toLowerCase().includes(term) ||
      e.employeeId.toLowerCase().includes(term) ||
      (e.position && e.position.toLowerCase().includes(term)) ||
      (e.department && e.department.toLowerCase().includes(term)) ||
      (e.email && e.email.toLowerCase().includes(term))
    );
  });

  const staffList = activeTab === "staff" ? (staffPaginated?.employees ?? []) : filteredStaff;
  const staffTotal = activeTab === "staff" ? (staffPaginated?.total ?? 0) : filteredStaff.length;
  const staffPages = activeTab === "staff" ? Math.max(1, Math.ceil((staffPaginated?.total ?? 0) / (staffPaginated?.limit ?? staffLimit))) : 1;
  const staffLoading = activeTab === "staff" ? staffPaginatedLoading : employeesLoading;

  const { data: salaryDetails, isLoading: salaryDetailsLoading, isError: salaryDetailsError, refetch: refetchSalaryDetails } = useQuery<{
    employee: Employee;
    salaryHistory: StaffSalary[];
    deductions: StaffDeduction[];
    advances: StaffAdvance[];
    previousDue: StaffPreviousDue[];
    loans: StaffLoan[];
    unpaidLeave: StaffUnpaidLeave[];
    payable: number;
  }>({
    queryKey: ["/api/employees", viewEmployee?.id, "salary-details"],
    queryFn: async () => {
      if (!viewEmployee?.id) throw new Error("No employee");
      const res = await fetch(`/api/employees/${viewEmployee.id}/salary-details`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load details");
      return res.json();
    },
    enabled: !!viewEmployee?.id,
  });

  const createDeductionMutation = useMutation({
    mutationFn: async (data: { amount: string; reason: string }) => {
      if (!viewEmployee?.id) throw new Error("No employee");
      return apiRequest("POST", `/api/employees/${viewEmployee.id}/deductions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", viewEmployee?.id, "salary-details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees/paginated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees/payable-summary"] });
      setShowAddDeduction(false);
      setDeductionForm({ amount: "", reason: "" });
      toast({ title: "Deduction added", description: "It will be applied at next salary release." });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to add deduction", variant: "destructive" }),
  });

  const createAdvanceMutation = useMutation({
    mutationFn: async (data: { amount: string; note?: string }) => {
      if (!viewEmployee?.id) throw new Error("No employee");
      return apiRequest("POST", `/api/employees/${viewEmployee.id}/advances`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", viewEmployee?.id, "salary-details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees/paginated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees/payable-summary"] });
      setShowAddAdvance(false);
      setAdvanceForm({ amount: "", note: "" });
      toast({ title: "Advance added", description: "It will be deducted at next salary release." });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to add advance", variant: "destructive" }),
  });

  const createPreviousDueMutation = useMutation({
    mutationFn: async (data: { amount: string; note?: string }) => {
      if (!viewEmployee?.id) throw new Error("No employee");
      return apiRequest("POST", `/api/employees/${viewEmployee.id}/previous-due`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees", viewEmployee?.id, "salary-details"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees/paginated"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees/payable-summary"] });
      setShowAddPreviousDue(false);
      setPreviousDueForm({ amount: "", note: "" });
      toast({ title: "Previous due added", description: "It will be included in payable at next salary release." });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to add previous due", variant: "destructive" }),
  });

  const invalidationKeys = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/employees", viewEmployee?.id, "salary-details"] });
    queryClient.invalidateQueries({ queryKey: ["/api/employees/paginated"] });
    queryClient.invalidateQueries({ queryKey: ["/api/employees/payable-summary"] });
  };

  const updateDeductionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { amount: string; reason: string } }) => {
      if (!viewEmployee?.id) throw new Error("No employee");
      return apiRequest("PATCH", `/api/employees/${viewEmployee.id}/deductions/${id}`, data);
    },
    onSuccess: () => { invalidationKeys(); setEditingDeduction(null); toast({ title: "Deduction updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to update deduction", variant: "destructive" }),
  });

  const deleteDeductionMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!viewEmployee?.id) throw new Error("No employee");
      return apiRequest("DELETE", `/api/employees/${viewEmployee.id}/deductions/${id}`);
    },
    onSuccess: () => { invalidationKeys(); setDeleteHistoryItem(null); toast({ title: "Deduction deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to delete deduction", variant: "destructive" }),
  });

  const updateAdvanceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { amount: string; note?: string } }) => {
      if (!viewEmployee?.id) throw new Error("No employee");
      return apiRequest("PATCH", `/api/employees/${viewEmployee.id}/advances/${id}`, data);
    },
    onSuccess: () => { invalidationKeys(); setEditingAdvance(null); toast({ title: "Advance updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to update advance", variant: "destructive" }),
  });

  const deleteAdvanceMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!viewEmployee?.id) throw new Error("No employee");
      return apiRequest("DELETE", `/api/employees/${viewEmployee.id}/advances/${id}`);
    },
    onSuccess: () => { invalidationKeys(); setDeleteHistoryItem(null); toast({ title: "Advance deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to delete advance", variant: "destructive" }),
  });

  const updatePreviousDueMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { amount: string; note?: string } }) => {
      if (!viewEmployee?.id) throw new Error("No employee");
      return apiRequest("PATCH", `/api/employees/${viewEmployee.id}/previous-due/${id}`, data);
    },
    onSuccess: () => { invalidationKeys(); setEditingPreviousDue(null); toast({ title: "Previous due updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to update previous due", variant: "destructive" }),
  });

  const deletePreviousDueMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!viewEmployee?.id) throw new Error("No employee");
      return apiRequest("DELETE", `/api/employees/${viewEmployee.id}/previous-due/${id}`);
    },
    onSuccess: () => { invalidationKeys(); setDeleteHistoryItem(null); toast({ title: "Previous due deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to delete previous due", variant: "destructive" }),
  });

  const updateStaffSalaryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => apiRequest("PATCH", `/api/staff-salaries/${id}`, data),
    onSuccess: () => { invalidationKeys(); setEditingSalary(null); toast({ title: "Salary record updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to update salary record", variant: "destructive" }),
  });

  const deleteStaffSalaryMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/staff-salaries/${id}`),
    onSuccess: () => { invalidationKeys(); setDeleteHistoryItem(null); toast({ title: "Salary record deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to delete salary record", variant: "destructive" }),
  });

  const createLoanMutation = useMutation({
    mutationFn: async (data: { amount: string; note?: string }) => {
      if (!viewEmployee?.id) throw new Error("No employee");
      return apiRequest("POST", `/api/employees/${viewEmployee.id}/loans`, data);
    },
    onSuccess: () => {
      invalidationKeys();
      setShowAddLoan(false);
      setLoanForm({ amount: "", note: "" });
      toast({ title: "Loan added", description: "It will be deducted from payable at next salary release." });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to add loan", variant: "destructive" }),
  });

  const updateLoanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { amount: string; note?: string } }) => {
      if (!viewEmployee?.id) throw new Error("No employee");
      return apiRequest("PATCH", `/api/employees/${viewEmployee.id}/loans/${id}`, data);
    },
    onSuccess: () => { invalidationKeys(); setEditingLoan(null); toast({ title: "Loan updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to update loan", variant: "destructive" }),
  });

  const deleteLoanMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!viewEmployee?.id) throw new Error("No employee");
      return apiRequest("DELETE", `/api/employees/${viewEmployee.id}/loans/${id}`);
    },
    onSuccess: () => { invalidationKeys(); setDeleteHistoryItem(null); toast({ title: "Loan deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to delete loan", variant: "destructive" }),
  });

  const createUnpaidLeaveMutation = useMutation({
    mutationFn: async (data: { amount: string; note?: string }) => {
      if (!viewEmployee?.id) throw new Error("No employee");
      return apiRequest("POST", `/api/employees/${viewEmployee.id}/unpaid-leave`, data);
    },
    onSuccess: () => {
      invalidationKeys();
      setShowAddUnpaidLeave(false);
      setUnpaidLeaveForm({ amount: "", note: "" });
      toast({ title: "Unpaid leave added", description: "It will be deducted from payable at next salary release." });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to add unpaid leave", variant: "destructive" }),
  });

  const updateUnpaidLeaveMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { amount: string; note?: string } }) => {
      if (!viewEmployee?.id) throw new Error("No employee");
      return apiRequest("PATCH", `/api/employees/${viewEmployee.id}/unpaid-leave/${id}`, data);
    },
    onSuccess: () => { invalidationKeys(); setEditingUnpaidLeave(null); toast({ title: "Unpaid leave updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to update unpaid leave", variant: "destructive" }),
  });

  const deleteUnpaidLeaveMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!viewEmployee?.id) throw new Error("No employee");
      return apiRequest("DELETE", `/api/employees/${viewEmployee.id}/unpaid-leave/${id}`);
    },
    onSuccess: () => { invalidationKeys(); setDeleteHistoryItem(null); toast({ title: "Unpaid leave deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to delete unpaid leave", variant: "destructive" }),
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const listForSelectAll = activeTab === "salary" ? salaryTabList : filteredStaff;
    if (selectedIds.size === listForSelectAll.length && listForSelectAll.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(listForSelectAll.map((e) => e.id)));
    }
  };

  const addStaffEmployeeId = nextEmployeeIdData?.nextId ?? formData.employeeId;

  const handleAddStaff = () => {
    if (!addStaffEmployeeId || !formData.name || !formData.position || !formData.department || !formData.salary) {
      toast({ title: "Error", description: "Fill required fields: Name, Position, Department, Salary", variant: "destructive" });
      return;
    }
    createEmployeeMutation.mutate({
      employeeId: addStaffEmployeeId,
      name: formData.name,
      position: formData.position,
      department: formData.department,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      joiningDate: new Date(formData.joiningDate),
      salary: formData.salary,
      photoUrl: formData.photoUrl || undefined,
      status: formData.status as "active" | "inactive",
    });
  };

  const handleEditSave = () => {
    if (!editEmployee) return;
    updateEmployeeMutation.mutate({
      id: editEmployee.id,
      data: {
        employeeId: editEmployee.employeeId,
        name: editEmployee.name,
        position: editEmployee.position,
        department: editEmployee.department,
        email: editEmployee.email ?? undefined,
        phone: editEmployee.phone ?? undefined,
        joiningDate: editEmployee.joiningDate ? new Date(editEmployee.joiningDate) : undefined,
        salary: editEmployee.salary,
        photoUrl: editEmployee.photoUrl ?? undefined,
        status: editEmployee.status,
      },
    });
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importJson);
      const list = Array.isArray(parsed) ? parsed : parsed.employees || parsed.data || [];
      if (list.length === 0) {
        toast({ title: "Error", description: "No valid employee data", variant: "destructive" });
        return;
      }
      apiRequest("POST", "/api/employees/import", { employees: list })
        .then((res: any) => res.json?.() ?? res)
        .then((result: { success: number; failed: number }) => {
          queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
          queryClient.invalidateQueries({ queryKey: ["/api/employees/paginated"] });
          setImportJson("");
          toast({ title: "Import done", description: `Imported ${result.success}, failed ${result.failed}` });
        })
        .catch(() => toast({ title: "Error", description: "Import failed", variant: "destructive" }));
    } catch {
      toast({ title: "Error", description: "Invalid JSON", variant: "destructive" });
    }
  };

  const handleExport = () => {
    fetch("/api/employees/export", { credentials: "include" })
      .then((res) => res.json())
      .then((data: Employee[]) => {
        const headers = ["employeeId", "name", "position", "department", "email", "phone", "joiningDate", "salary", "status"];
        const csv = [headers.join(","), ...data.map((e) => headers.map((h) => JSON.stringify((e as any)[h] ?? "")).join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `staff-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Exported", description: `${data.length} staff exported` });
      })
      .catch(() => toast({ title: "Error", description: "Export failed", variant: "destructive" }));
  };

  const handleExportSalaries = async () => {
    setExportingSalaries(true);
    try {
      const q = salaryListParams();
      const res = await fetch(`/api/staff-salaries/export${q ? `?${q}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to export");
      const { salaries: list } = await res.json();
      const exportData = (list || []).map((s: StaffSalary & { employee: Employee | null }) => ({
        "Employee": s.employee?.name ?? "",
        "Salary Date": format(new Date(s.salaryDate), "yyyy-MM-dd"),
        "Salary Amount": s.salaryAmount,
        "Deductions": s.deductSalary,
        "Total": s.totalSalary,
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Salaries");
      XLSX.writeFile(wb, `staff-salaries-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast({ title: "Success", description: `Exported ${exportData.length} salary records` });
    } catch (e) {
      toast({ title: "Export Failed", description: e instanceof Error ? e.message : "Failed to export", variant: "destructive" });
    } finally {
      setExportingSalaries(false);
    }
  };

  const handleBulkRelease = () => {
    if (selectedIds.size === 0) {
      toast({ title: "Error", description: "Select at least one staff", variant: "destructive" });
      return;
    }
    setShowBulkReleaseConfirm(true);
  };

  const confirmBulkRelease = () => {
    bulkReleaseMutation.mutate({
      employeeIds: Array.from(selectedIds),
      salaryDate: salaryDate.toISOString(),
    });
  };

  const formatCurrency = (v: string | number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v));

  const expectedSalaryStyle = (value: number) =>
    value >= 0 ? "font-bold text-green-600" : "font-bold text-red-600";

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image", variant: "destructive" });
      return;
    }
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formDataUpload, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      const url = data.url ? `${window.location.origin}${data.url}` : data.url;
      if (isEdit && editEmployee) {
        setEditEmployee({ ...editEmployee, photoUrl: url });
      } else {
        setFormData((f) => ({ ...f, photoUrl: url }));
      }
      toast({ title: "Photo uploaded" });
    } catch {
      toast({ title: "Error", description: "Failed to upload photo", variant: "destructive" });
    }
    e.target.value = "";
  };

  const handleAddPosition = () => {
    if (!positionFormData.name.trim()) {
      toast({ title: "Error", description: "Position name required", variant: "destructive" });
      return;
    }
    createPositionMutation.mutate(positionFormData);
  };

  const handleAddDepartment = () => {
    if (!departmentFormData.name.trim()) {
      toast({ title: "Error", description: "Department name required", variant: "destructive" });
      return;
    }
    createDepartmentMutation.mutate(departmentFormData);
  };

  const STAFF_IMPORT_HEADERS = ["employeeId", "name", "position", "department", "email", "phone", "joiningDate", "salary", "status"];
  const sampleStaffRow: Record<string, string> = {
    employeeId: "E001",
    name: "John Doe",
    position: "Waiter",
    department: "F&B",
    email: "john@example.com",
    phone: "+1234567890",
    joiningDate: "2024-01-15",
    salary: "1200",
    status: "active",
  };

  const handleDownloadSampleExcel = () => {
    const headerLine = STAFF_IMPORT_HEADERS.join(",");
    const exampleLine = STAFF_IMPORT_HEADERS.map((h) => {
      const v = sampleStaffRow[h] ?? "";
      return v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(",");
    const csv = [headerLine, exampleLine].join("\r\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staff-import-sample-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "Sample CSV. Fill and import via CSV or Excel." });
  };

  const handleDownloadSampleExcelXlsx = () => {
    const wsData = [
      STAFF_IMPORT_HEADERS,
      STAFF_IMPORT_HEADERS.map((h) => sampleStaffRow[h] ?? ""),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Staff");
    const xlsxBuffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([xlsxBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `staff-import-sample-${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "Sample Excel (.xlsx). Fill and use Import from CSV or Excel." });
  };

  const parseCsvToStaffList = (text: string): Record<string, string>[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const parseCsvLine = (line: string): string[] => {
      const values: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let j = 0; j < line.length; j++) {
        const c = line[j];
        if (c === '"') {
          inQuotes = !inQuotes;
        } else if (c === "," && !inQuotes) {
          values.push(current.trim().replace(/^"|"$/g, ""));
          current = "";
        } else {
          current += c;
        }
      }
      values.push(current.trim().replace(/^"|"$/g, ""));
      return values;
    };
    const headers = parseCsvLine(lines[0]).map((h) => h.trim());
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] ?? "";
      });
      if (Object.values(row).some((v) => v.trim())) rows.push(row);
    }
    return rows;
  };

  const mapRowToEmployee = (row: Record<string, string | number | undefined>): Record<string, string> => {
    const get = (...keys: string[]) => {
      const val = keys.map((k) => row[k] ?? row[k.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "")]).find((v) => v != null && String(v).trim() !== "");
      return val != null ? String(val).trim() : "";
    };
    const joining = get("joiningDate", "joining_date") || new Date().toISOString().slice(0, 10);
    const emp: Record<string, string> = {
      employeeId: get("employeeId", "employee_id") || "E0",
      name: get("name") || "Unknown",
      position: get("position") || "Staff",
      department: get("department") || "General",
      joiningDate: joining,
      salary: get("salary") || "0",
      status: (get("status") as "active" | "inactive") || "active",
    };
    const email = get("email");
    if (email) emp.email = email;
    const phone = get("phone");
    if (phone) emp.phone = phone;
    return emp;
  };

  const submitImport = (employeesData: Record<string, string>[]) => {
    if (employeesData.length === 0) return;
    fetch("/api/employees/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employees: employeesData }),
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Import failed"))))
      .then((result: { success: number; failed: number }) => {
        queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
        queryClient.invalidateQueries({ queryKey: ["/api/employees/paginated"] });
        setImportJson("");
        toast({ title: "Import done", description: `Imported ${result.success}, failed ${result.failed}` });
      })
      .catch(() => toast({ title: "Error", description: "Import failed", variant: "destructive" }));
  };

  const handleCsvFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const list = parseCsvToStaffList(text);
        if (list.length === 0) {
          toast({ title: "Error", description: "No valid rows in file", variant: "destructive" });
          e.target.value = "";
          return;
        }
        const employeesData = list.map((row) => mapRowToEmployee(row));
        submitImport(employeesData);
      } catch {
        toast({ title: "Error", description: "Invalid CSV", variant: "destructive" });
      }
      e.target.value = "";
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleExcelFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array((event.target?.result as ArrayBuffer) ?? []);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          toast({ title: "Error", description: "No sheet in Excel file", variant: "destructive" });
          e.target.value = "";
          return;
        }
        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: "", raw: false });
        if (rows.length === 0) {
          toast({ title: "Error", description: "No data rows in Excel", variant: "destructive" });
          e.target.value = "";
          return;
        }
        const employeesData = rows.map((row) => mapRowToEmployee(row as Record<string, string | number | undefined>));
        submitImport(employeesData);
      } catch (err) {
        console.error(err);
        toast({ title: "Error", description: "Invalid Excel file", variant: "destructive" });
      }
      e.target.value = "";
    };
    reader.readAsArrayBuffer(file);
  };

  const handleCsvOrExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv")) {
      handleCsvFileImport(e);
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      handleExcelFileImport(e);
    } else {
      toast({ title: "Error", description: "Use a .csv or .xlsx file", variant: "destructive" });
      e.target.value = "";
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">Staff Salary</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Manage staff and release salaries</p>
          </div>
          {activeTab === "staff" && hasPermission("hrm.create") && (
            <Button onClick={() => { resetForm(); setShowAddDialog(true); }} className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600">
              <Plus className="w-4 h-4 mr-2" />
              Add Staff
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employees.length}</div>
              <p className="text-xs text-muted-foreground">Active staff</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Salary Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{salarySummary?.totalSalaries ?? salariesWithEmployees.length}</div>
              <p className="text-xs text-muted-foreground">Released payments</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Payable Salary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(payableSummary?.totalPayable ?? 0)}</div>
              <p className="text-xs text-muted-foreground">Sum of payable (all staff)</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Deduction</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(payableSummary?.totalDeduction ?? 0)}</div>
              <p className="text-xs text-muted-foreground">Pending deductions</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-slate-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Paid (period)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(salarySummary?.netTotal ?? salariesWithEmployees.reduce((s, r) => s + parseFloat(r.totalSalary || "0"), 0))}
              </div>
              <p className="text-xs text-muted-foreground">From salary history</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="staff">
              <Users className="w-4 h-4 mr-2" />
              Staff
            </TabsTrigger>
            <TabsTrigger value="salary">
              <DollarSign className="w-4 h-4 mr-2" />
              Salary Management
            </TabsTrigger>
            <TabsTrigger value="positions">
              <Briefcase className="w-4 h-4 mr-2" />
              Position Management
            </TabsTrigger>
            <TabsTrigger value="departments">
              <Building2 className="w-4 h-4 mr-2" />
              Department Management
            </TabsTrigger>
          </TabsList>

          <TabsContent value="staff" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Staff List</CardTitle>
                <CardDescription>Add, edit, import/export staff. Click view for profile.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search by name, ID, position, department..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); if (activeTab === "staff") setStaffPage(1); }} className="pl-9" />
                  </div>
                  {hasPermission("hrm.create") && (
                    <>
                      <Button variant="outline" onClick={handleExport}>
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                      <Button variant="outline" onClick={handleDownloadSampleExcel} title="Download sample CSV (opens in Excel)">
                        <Download className="w-4 h-4 mr-2" />
                        Download sample (CSV)
                      </Button>
                      <Button variant="outline" onClick={handleDownloadSampleExcelXlsx} title="Download sample Excel (.xlsx)">
                        <Download className="w-4 h-4 mr-2" />
                        Download sample (Excel)
                      </Button>
                      <Button variant="outline" onClick={() => setImportJson("[]")}>
                        <Upload className="w-4 h-4 mr-2" />
                        Import (paste JSON)
                      </Button>
                      <label className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 cursor-pointer">
                        <Upload className="w-4 h-4" />
                        Import from CSV or Excel
                        <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleCsvOrExcelImport} />
                      </label>
                    </>
                  )}
                </div>
                {activeTab === "staff" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={staffStatusFilter} onValueChange={(v) => { setStaffStatusFilter(v); setStaffPage(1); }}>
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1">
                      <Label className="text-muted-foreground text-xs whitespace-nowrap">Join from</Label>
                      <Input type="date" className="w-[140px]" value={staffJoinDateFrom} onChange={(e) => { setStaffJoinDateFrom(e.target.value); setStaffPage(1); }} />
                    </div>
                    <div className="flex items-center gap-1">
                      <Label className="text-muted-foreground text-xs whitespace-nowrap">Join to</Label>
                      <Input type="date" className="w-[140px]" value={staffJoinDateTo} onChange={(e) => { setStaffJoinDateTo(e.target.value); setStaffPage(1); }} />
                    </div>
                    {(staffJoinDateFrom || staffJoinDateTo || staffStatusFilter !== "all") && (
                      <Button variant="ghost" size="sm" onClick={() => { setStaffStatusFilter("all"); setStaffJoinDateFrom(""); setStaffJoinDateTo(""); setStaffPage(1); }}>Clear filters</Button>
                    )}
                  </div>
                )}
                </div>
                {importJson !== "" && (
                  <div className="space-y-2">
                    <Label>Paste JSON, or download sample CSV/Excel, fill in Excel, then use &quot;Import from CSV or Excel&quot; to upload .csv or .xlsx.</Label>
                    <textarea className="w-full min-h-[120px] rounded border bg-background px-3 py-2 text-sm" value={importJson} onChange={(e) => setImportJson(e.target.value)} placeholder='[{"employeeId":"E01","name":"...","position":"...","department":"...","joiningDate":"2024-01-01","salary":"1000"}]' />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleImport}>Import</Button>
                      <Button size="sm" variant="outline" onClick={() => setImportJson("")}>Cancel</Button>
                    </div>
                  </div>
                )}
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Basic Salary</TableHead>
                        <TableHead>Loan Amount</TableHead>
                        <TableHead>Advance Salary</TableHead>
                        <TableHead>UL</TableHead>
                        <TableHead>Payable Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staffLoading ? (
                        <TableRow><TableCell colSpan={11} className="text-center py-8">Loading...</TableCell></TableRow>
                      ) : staffList.length === 0 ? (
                        <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">No staff found</TableCell></TableRow>
                      ) : (
                        staffList.map((emp) => {
                          const row = emp as Employee & { payable?: number; advanceSalary?: number; loanAmount?: number; unpaidLeave?: number };
                          return (
                          <TableRow key={emp.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setViewEmployee(emp)}>
                            <TableCell className="font-mono text-xs" onClick={(e) => e.stopPropagation()}>{emp.employeeId}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border bg-muted flex items-center justify-center">
                                  {emp.photoUrl ? (
                                    <img src={emp.photoUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <span>{emp.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>{emp.position}</TableCell>
                            <TableCell>{emp.department}</TableCell>
                            <TableCell>{formatCurrency(emp.salary)}</TableCell>
                            <TableCell>{typeof row.loanAmount === "number" ? formatCurrency(row.loanAmount) : "—"}</TableCell>
                            <TableCell>{typeof row.advanceSalary === "number" ? formatCurrency(row.advanceSalary) : "—"}</TableCell>
                            <TableCell>{typeof row.unpaidLeave === "number" ? formatCurrency(row.unpaidLeave) : "—"}</TableCell>
                            <TableCell>
                              {typeof row.payable === "number" ? (
                                <span className={expectedSalaryStyle(row.payable)}>{formatCurrency(row.payable)}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>{emp.status}</TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" onClick={() => setViewEmployee(emp)} title="View profile">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {hasPermission("hrm.edit") && (
                                <Button variant="ghost" size="icon" onClick={() => setEditEmployee(emp)} title="Edit">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              {hasPermission("hrm.delete") && (
                                <Button variant="ghost" size="icon" onClick={() => setDeleteEmployeeId(emp.id)} title="Delete">
                                  <Trash2 className="h-4 w-4 text-destructive" />
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
                {activeTab === "staff" && staffTotal > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Per page</span>
                      <Select value={String(staffLimit)} onValueChange={(v) => { setStaffLimit(Number(v)); setStaffPage(1); }}>
                        <SelectTrigger className="w-[70px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                      <span>
                        Showing {((staffPage - 1) * (staffPaginated?.limit ?? staffLimit)) + 1}–{Math.min(staffPage * (staffPaginated?.limit ?? staffLimit), staffTotal)} of {staffTotal}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" disabled={staffPage <= 1} onClick={() => setStaffPage((p) => p - 1)}>Prev</Button>
                      <span className="px-2 text-sm">Page {staffPage} of {staffPages}</span>
                      <Button variant="outline" size="sm" disabled={staffPage >= staffPages} onClick={() => setStaffPage((p) => p + 1)}>Next</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="salary" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Release Salary</CardTitle>
                <CardDescription>Select staff and release salary for the chosen date. Payable = base + previous due + carried − deductions − advances − loans − unpaid leave.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-wrap">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline">
                        Salary date: {format(salaryDate, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent>
                      <Calendar mode="single" selected={salaryDate} onSelect={(d) => d && setSalaryDate(d)} />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[180px] justify-start">
                        {selectedMonths.length === 0 ? "All months" : selectedMonths.length <= 2 ? selectedMonths.map((m) => { const [y, mo] = m.split("-").map(Number); return format(new Date(y, mo - 1, 1), "MMM yyyy"); }).join(", ") : `${selectedMonths.length} months`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-0" align="start">
                      <div className="max-h-[300px] overflow-y-auto p-2">
                        {Array.from({ length: 24 }, (_, i) => {
                          const d = new Date();
                          d.setMonth(d.getMonth() - (23 - i));
                          const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                          const label = format(d, "MMMM yyyy");
                          const checked = selectedMonths.includes(value);
                          return (
                            <div key={value} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted cursor-pointer" onClick={() => setSelectedMonths((prev) => (checked ? prev.filter((x) => x !== value) : [...prev, value].sort()))}>
                              <Checkbox checked={checked} onCheckedChange={() => {}} />
                              <span className="text-sm">{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {hasPermission("reports.export") && (
                    <Button variant="outline" disabled={exportingSalaries} onClick={handleExportSalaries}>
                      <Download className="w-4 h-4 mr-2" />
                      {exportingSalaries ? "Exporting…" : "Export Salaries"}
                    </Button>
                  )}
                  {hasPermission("hrm.create") && (
                    <Button onClick={handleBulkRelease} disabled={selectedIds.size === 0}>
                      <DollarSign className="w-4 h-4 mr-2" />
                      Release salary ({selectedIds.size} selected)
                    </Button>
                  )}
                </div>
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={salaryTabList.length > 0 && selectedIds.size === salaryTabList.length}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Basic Salary</TableHead>
                        <TableHead>Loan Amount</TableHead>
                        <TableHead>Advance Salary</TableHead>
                        <TableHead>UL</TableHead>
                        <TableHead>Payable Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salaryTabPaginatedLoading ? (
                        <TableRow><TableCell colSpan={8} className="text-center py-8">Loading...</TableCell></TableRow>
                      ) : salaryTabList.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No staff</TableCell></TableRow>
                      ) : (
                        salaryTabList.map((emp) => {
                          const row = emp as Employee & { payable?: number; advanceSalary?: number; loanAmount?: number; unpaidLeave?: number };
                          return (
                            <TableRow key={emp.id}>
                              <TableCell>
                                <Checkbox checked={selectedIds.has(emp.id)} onCheckedChange={() => toggleSelect(emp.id)} />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border bg-muted flex items-center justify-center">
                                    {emp.photoUrl ? (
                                      <img src={emp.photoUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <User className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </div>
                                  <span>{emp.name}</span>
                                </div>
                              </TableCell>
                              <TableCell>{emp.position}</TableCell>
                              <TableCell>{formatCurrency(emp.salary)}</TableCell>
                              <TableCell>{typeof row.loanAmount === "number" ? formatCurrency(row.loanAmount) : "—"}</TableCell>
                              <TableCell>{typeof row.advanceSalary === "number" ? formatCurrency(row.advanceSalary) : "—"}</TableCell>
                              <TableCell>{typeof row.unpaidLeave === "number" ? formatCurrency(row.unpaidLeave) : "—"}</TableCell>
                              <TableCell>
                                {typeof row.payable === "number" ? (
                                  <span className={expectedSalaryStyle(row.payable)}>{formatCurrency(row.payable)}</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                {activeTab === "salary" && salaryTabTotal > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Per page</span>
                      <Select value={String(salaryLimit)} onValueChange={(v) => { setSalaryLimit(Number(v)); setSalaryPage(1); }}>
                        <SelectTrigger className="w-[70px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                        </SelectContent>
                      </Select>
                      <span>
                        Showing {((salaryPage - 1) * (salaryTabPaginated?.limit ?? salaryLimit)) + 1}–{Math.min(salaryPage * (salaryTabPaginated?.limit ?? salaryLimit), salaryTabTotal)} of {salaryTabTotal}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" disabled={salaryPage <= 1} onClick={() => setSalaryPage((p) => p - 1)}>Prev</Button>
                      <span className="px-2 text-sm">Page {salaryPage} of {salaryTabPages}</span>
                      <Button variant="outline" size="sm" disabled={salaryPage >= salaryTabPages} onClick={() => setSalaryPage((p) => p + 1)}>Next</Button>
                    </div>
                  </div>
                )}
                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-base">Recent salary releases</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-auto max-h-[280px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Staff</TableHead>
                            <TableHead>Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {salariesLoading ? (
                            <TableRow><TableCell colSpan={3}>Loading...</TableCell></TableRow>
                          ) : salariesWithEmployees.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-muted-foreground">No releases yet</TableCell></TableRow>
                          ) : (
                            salariesWithEmployees.slice(0, 20).map((s) => (
                              <TableRow key={s.id}>
                                <TableCell>{format(new Date(s.salaryDate), "PP")}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border bg-muted flex items-center justify-center">
                                      {s.employee?.photoUrl ? (
                                        <img src={s.employee.photoUrl} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                        <User className="h-4 w-4 text-muted-foreground" />
                                      )}
                                    </div>
                                    <span>{s.employee?.name ?? s.employeeId}</span>
                                  </div>
                                </TableCell>
                                <TableCell>{formatCurrency(s.totalSalary)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="positions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Positions</CardTitle>
                <CardDescription>Manage job positions for staff</CardDescription>
              </CardHeader>
              <CardContent>
                {hasPermission("hrm.create") && (
                  <Button className="mb-4" onClick={() => { setPositionFormData({ name: "", description: "" }); setShowAddPositionDialog(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Position
                  </Button>
                )}
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {positions.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No positions. Add one to use in staff.</TableCell></TableRow>
                      ) : (
                        positions.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{p.name}</TableCell>
                            <TableCell>{p.description ?? "—"}</TableCell>
                            <TableCell className="text-right">
                              {hasPermission("hrm.edit") && (
                                <Button variant="ghost" size="icon" onClick={() => setEditPosition(p)}><Edit className="h-4 w-4" /></Button>
                              )}
                              {hasPermission("hrm.delete") && (
                                <Button variant="ghost" size="icon" onClick={() => setDeletePositionId(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="departments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Departments</CardTitle>
                <CardDescription>Manage departments for staff</CardDescription>
              </CardHeader>
              <CardContent>
                {hasPermission("hrm.create") && (
                  <Button className="mb-4" onClick={() => { setDepartmentFormData({ name: "", description: "" }); setShowAddDepartmentDialog(true); }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Department
                  </Button>
                )}
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {departments.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No departments. Add one to use in staff.</TableCell></TableRow>
                      ) : (
                        departments.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell>{d.name}</TableCell>
                            <TableCell>{d.description ?? "—"}</TableCell>
                            <TableCell className="text-right">
                              {hasPermission("hrm.edit") && (
                                <Button variant="ghost" size="icon" onClick={() => setEditDepartment(d)}><Edit className="h-4 w-4" /></Button>
                              )}
                              {hasPermission("hrm.delete") && (
                                <Button variant="ghost" size="icon" onClick={() => setDeleteDepartmentId(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Profile view modal with salary history and actions */}
      <Dialog open={!!viewEmployee} onOpenChange={(open) => !open && setViewEmployee(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Staff Profile & Salary Details</DialogTitle>
            <DialogDescription>View staff details and history. Payable = (base + previous due) − deduction − advance − loan − unpaid leave.</DialogDescription>
          </DialogHeader>
          {viewEmployee && (
            <div className="space-y-4">
              {salaryDetailsLoading ? (
                <div className="py-8 text-center text-muted-foreground">Loading details…</div>
              ) : salaryDetailsError ? (
                <div className="py-8 text-center">
                  <p className="text-destructive mb-2">Failed to load salary details.</p>
                  <Button variant="outline" size="sm" onClick={() => refetchSalaryDetails()}>Retry</Button>
                </div>
              ) : (
                <>
                  <div className="flex gap-4 flex-wrap">
                    <div className="flex justify-center flex-shrink-0">
                      {(salaryDetails?.employee ?? viewEmployee).photoUrl ? (
                        <img src={(salaryDetails?.employee ?? viewEmployee).photoUrl!} alt={(salaryDetails?.employee ?? viewEmployee).name} className="w-24 h-24 rounded-full object-cover border-2" />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                          <User className="w-12 h-12 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="grid gap-1 text-sm flex-1 min-w-0">
                      <p><span className="font-medium">Name:</span> {(salaryDetails?.employee ?? viewEmployee).name}</p>
                      <p><span className="font-medium">Employee ID:</span> {(salaryDetails?.employee ?? viewEmployee).employeeId}</p>
                      <p><span className="font-medium">Position:</span> {(salaryDetails?.employee ?? viewEmployee).position}</p>
                      <p><span className="font-medium">Department:</span> {(salaryDetails?.employee ?? viewEmployee).department}</p>
                      {(salaryDetails?.employee ?? viewEmployee).email && <p><span className="font-medium">Email:</span> {(salaryDetails?.employee ?? viewEmployee).email}</p>}
                      {(salaryDetails?.employee ?? viewEmployee).phone && <p><span className="font-medium">Phone:</span> {(salaryDetails?.employee ?? viewEmployee).phone}</p>}
                      <p><span className="font-medium">Joining date:</span> {(salaryDetails?.employee ?? viewEmployee).joiningDate ? format(new Date((salaryDetails?.employee ?? viewEmployee).joiningDate!), "PPP") : "—"}</p>
                      <p><span className="font-medium">Base salary:</span> {formatCurrency((salaryDetails?.employee ?? viewEmployee).salary)}</p>
                      {typeof salaryDetails?.payable === "number" && (
                        <p>
                          <span className="font-medium">Payable:</span>{" "}
                          <span className={expectedSalaryStyle(salaryDetails.payable)}>{formatCurrency(salaryDetails.payable)}</span>
                        </p>
                      )}
                      <p><span className="font-medium">Status:</span> {(salaryDetails?.employee ?? viewEmployee).status}</p>
                    </div>
                  </div>
                  {hasPermission("hrm.create") && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowAddDeduction(true)}>
                        Add deduction
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowAddAdvance(true)}>
                        Add advance salary
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowAddPreviousDue(true)}>
                        Add previous due
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowAddLoan(true)}>
                        Add loan
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowAddUnpaidLeave(true)}>
                        Add unpaid leave (UL)
                      </Button>
                    </div>
                  )}
                  <Tabs defaultValue="salary-history" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1">
                      <TabsTrigger value="salary-history">Salary history</TabsTrigger>
                      <TabsTrigger value="advance-history">Advance</TabsTrigger>
                      <TabsTrigger value="deduction-history">Deduction</TabsTrigger>
                      <TabsTrigger value="previous-due-history">Previous due</TabsTrigger>
                      <TabsTrigger value="loan-history">Loan</TabsTrigger>
                      <TabsTrigger value="ul-history">UL</TabsTrigger>
                    </TabsList>
                    <TabsContent value="salary-history" className="mt-3">
                      <div className="border rounded-lg overflow-auto max-h-[280px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Base</TableHead>
                              <TableHead>Deduction</TableHead>
                              <TableHead>Reason</TableHead>
                              <TableHead>Advance</TableHead>
                              <TableHead>Carried</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead>Note</TableHead>
                              {hasPermission("hrm.edit") || hasPermission("hrm.delete") ? <TableHead className="text-right w-24">Actions</TableHead> : null}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {!salaryDetails?.salaryHistory?.length ? (
                              <TableRow><TableCell colSpan={9} className="text-center py-4 text-muted-foreground">No salary releases yet</TableCell></TableRow>
                            ) : (
                              salaryDetails.salaryHistory.map((s) => (
                                <TableRow key={s.id}>
                                  <TableCell>{format(new Date(s.salaryDate), "PP")}</TableCell>
                                  <TableCell>{formatCurrency(s.salaryAmount)}</TableCell>
                                  <TableCell>{formatCurrency(s.deductSalary ?? "0")}</TableCell>
                                  <TableCell className="max-w-[120px] truncate" title={s.deductReason ?? ""}>{s.deductReason ?? "—"}</TableCell>
                                  <TableCell>{formatCurrency(s.advanceAmount ?? "0")}</TableCell>
                                  <TableCell>{formatCurrency(s.carriedUnreleased ?? "0")}</TableCell>
                                  <TableCell>{formatCurrency(s.totalSalary)}</TableCell>
                                  <TableCell className="max-w-[100px] truncate" title={s.note ?? ""}>{s.note ?? "—"}</TableCell>
                                  {hasPermission("hrm.edit") || hasPermission("hrm.delete") ? (
                                    <TableCell className="text-right">
                                      {hasPermission("hrm.edit") && (
                                        <Button variant="ghost" size="icon" onClick={() => setEditingSalary(s)} title="Edit"><Edit className="h-4 w-4" /></Button>
                                      )}
                                      {hasPermission("hrm.delete") && (
                                        <Button variant="ghost" size="icon" onClick={() => setDeleteHistoryItem({ type: "salary", id: s.id })} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                      )}
                                    </TableCell>
                                  ) : null}
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                    <TabsContent value="advance-history" className="mt-3">
                      <div className="border rounded-lg overflow-auto max-h-[280px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Note</TableHead>
                            <TableHead>Status</TableHead>
                            {hasPermission("hrm.edit") || hasPermission("hrm.delete") ? <TableHead className="text-right w-24">Actions</TableHead> : null}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                            {!salaryDetails?.advances?.length ? (
                              <TableRow><TableCell colSpan={5} className="text-center py-3 text-muted-foreground text-sm">No advances</TableCell></TableRow>
                            ) : (
                              salaryDetails.advances.map((a) => (
                                <TableRow key={a.id}>
                                  <TableCell className="text-sm">{format(new Date(a.createdAt), "PP")}</TableCell>
                                  <TableCell>{formatCurrency(a.amount)}</TableCell>
                                  <TableCell className="max-w-[200px] truncate" title={a.note ?? ""}>{a.note ?? "—"}</TableCell>
                                  <TableCell>{a.status}</TableCell>
                                  {hasPermission("hrm.edit") || hasPermission("hrm.delete") ? (
                                    <TableCell className="text-right">
                                      {hasPermission("hrm.edit") && (
                                        <Button variant="ghost" size="icon" onClick={() => setEditingAdvance(a)} title="Edit"><Edit className="h-4 w-4" /></Button>
                                      )}
                                      {hasPermission("hrm.delete") && (
                                        <Button variant="ghost" size="icon" onClick={() => setDeleteHistoryItem({ type: "advance", id: a.id })} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                      )}
                                    </TableCell>
                                  ) : null}
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                    <TabsContent value="deduction-history" className="mt-3">
                      <div className="border rounded-lg overflow-auto max-h-[280px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Status</TableHead>
                            {hasPermission("hrm.edit") || hasPermission("hrm.delete") ? <TableHead className="text-right w-24">Actions</TableHead> : null}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                            {!salaryDetails?.deductions?.length ? (
                              <TableRow><TableCell colSpan={5} className="text-center py-3 text-muted-foreground text-sm">No deductions</TableCell></TableRow>
                            ) : (
                              salaryDetails.deductions.map((d) => (
                                <TableRow key={d.id}>
                                  <TableCell className="text-sm">{format(new Date(d.createdAt), "PP")}</TableCell>
                                  <TableCell>{formatCurrency(d.amount)}</TableCell>
                                  <TableCell className="max-w-[200px] truncate" title={d.reason}>{d.reason}</TableCell>
                                  <TableCell>{d.status}</TableCell>
                                  {hasPermission("hrm.edit") || hasPermission("hrm.delete") ? (
                                    <TableCell className="text-right">
                                      {hasPermission("hrm.edit") && (
                                        <Button variant="ghost" size="icon" onClick={() => setEditingDeduction(d)} title="Edit"><Edit className="h-4 w-4" /></Button>
                                      )}
                                      {hasPermission("hrm.delete") && (
                                        <Button variant="ghost" size="icon" onClick={() => setDeleteHistoryItem({ type: "deduction", id: d.id })} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                      )}
                                    </TableCell>
                                  ) : null}
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                    <TabsContent value="previous-due-history" className="mt-3">
                      <div className="border rounded-lg overflow-auto max-h-[280px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Note</TableHead>
                            <TableHead>Status</TableHead>
                            {hasPermission("hrm.edit") || hasPermission("hrm.delete") ? <TableHead className="text-right w-24">Actions</TableHead> : null}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                            {!(salaryDetails?.previousDue ?? []).length ? (
                              <TableRow><TableCell colSpan={5} className="text-center py-3 text-muted-foreground text-sm">No previous due entries</TableCell></TableRow>
                            ) : (
                              (salaryDetails?.previousDue ?? []).map((pd) => (
                                <TableRow key={pd.id}>
                                  <TableCell className="text-sm">{format(new Date(pd.createdAt), "PP")}</TableCell>
                                  <TableCell>{formatCurrency(pd.amount)}</TableCell>
                                  <TableCell className="max-w-[200px] truncate" title={pd.note ?? ""}>{pd.note ?? "—"}</TableCell>
                                  <TableCell>{pd.status}</TableCell>
                                  {hasPermission("hrm.edit") || hasPermission("hrm.delete") ? (
                                    <TableCell className="text-right">
                                      {hasPermission("hrm.edit") && (
                                        <Button variant="ghost" size="icon" onClick={() => setEditingPreviousDue(pd)} title="Edit"><Edit className="h-4 w-4" /></Button>
                                      )}
                                      {hasPermission("hrm.delete") && (
                                        <Button variant="ghost" size="icon" onClick={() => setDeleteHistoryItem({ type: "previousDue", id: pd.id })} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                      )}
                                    </TableCell>
                                  ) : null}
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                    <TabsContent value="loan-history" className="mt-3">
                      <div className="border rounded-lg overflow-auto max-h-[280px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Note</TableHead>
                              <TableHead>Status</TableHead>
                              {hasPermission("hrm.edit") || hasPermission("hrm.delete") ? <TableHead className="text-right w-24">Actions</TableHead> : null}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {!(salaryDetails?.loans ?? []).length ? (
                              <TableRow><TableCell colSpan={5} className="text-center py-3 text-muted-foreground text-sm">No loan entries</TableCell></TableRow>
                            ) : (
                              (salaryDetails?.loans ?? []).map((ln) => (
                                <TableRow key={ln.id}>
                                  <TableCell className="text-sm">{format(new Date(ln.createdAt), "PP")}</TableCell>
                                  <TableCell>{formatCurrency(ln.amount)}</TableCell>
                                  <TableCell className="max-w-[200px] truncate" title={ln.note ?? ""}>{ln.note ?? "—"}</TableCell>
                                  <TableCell>{ln.status}</TableCell>
                                  {hasPermission("hrm.edit") || hasPermission("hrm.delete") ? (
                                    <TableCell className="text-right">
                                      {hasPermission("hrm.edit") && (
                                        <Button variant="ghost" size="icon" onClick={() => setEditingLoan(ln)} title="Edit"><Edit className="h-4 w-4" /></Button>
                                      )}
                                      {hasPermission("hrm.delete") && (
                                        <Button variant="ghost" size="icon" onClick={() => setDeleteHistoryItem({ type: "loan", id: ln.id })} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                      )}
                                    </TableCell>
                                  ) : null}
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                    <TabsContent value="ul-history" className="mt-3">
                      <div className="border rounded-lg overflow-auto max-h-[280px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Note</TableHead>
                              <TableHead>Status</TableHead>
                              {hasPermission("hrm.edit") || hasPermission("hrm.delete") ? <TableHead className="text-right w-24">Actions</TableHead> : null}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {!(salaryDetails?.unpaidLeave ?? []).length ? (
                              <TableRow><TableCell colSpan={5} className="text-center py-3 text-muted-foreground text-sm">No unpaid leave entries</TableCell></TableRow>
                            ) : (
                              (salaryDetails?.unpaidLeave ?? []).map((ul) => (
                                <TableRow key={ul.id}>
                                  <TableCell className="text-sm">{format(new Date(ul.createdAt), "PP")}</TableCell>
                                  <TableCell>{formatCurrency(ul.amount)}</TableCell>
                                  <TableCell className="max-w-[200px] truncate" title={ul.note ?? ""}>{ul.note ?? "—"}</TableCell>
                                  <TableCell>{ul.status}</TableCell>
                                  {hasPermission("hrm.edit") || hasPermission("hrm.delete") ? (
                                    <TableCell className="text-right">
                                      {hasPermission("hrm.edit") && (
                                        <Button variant="ghost" size="icon" onClick={() => setEditingUnpaidLeave(ul)} title="Edit"><Edit className="h-4 w-4" /></Button>
                                      )}
                                      {hasPermission("hrm.delete") && (
                                        <Button variant="ghost" size="icon" onClick={() => setDeleteHistoryItem({ type: "unpaidLeave", id: ul.id })} title="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                      )}
                                    </TableCell>
                                  ) : null}
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                  </Tabs>
                  <DialogFooter className="flex flex-wrap gap-2 sm:gap-0">
                    {hasPermission("hrm.edit") && (
                      <Button variant="outline" onClick={() => { setEditEmployee(salaryDetails?.employee ?? viewEmployee); setViewEmployee(null); }}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit staff
                      </Button>
                    )}
                    {hasPermission("hrm.create") && (
                      <Button onClick={() => { setViewEmployee(null); setActiveTab("salary"); setSelectedIds(new Set([viewEmployee.id])); }}>
                        <DollarSign className="h-4 w-4 mr-2" />
                        Release salary
                      </Button>
                    )}
                    <Button variant="secondary" onClick={() => setViewEmployee(null)}>Close</Button>
                  </DialogFooter>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add deduction dialog */}
      <Dialog open={showAddDeduction} onOpenChange={setShowAddDeduction}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add deduction</DialogTitle>
            <DialogDescription>Deduction will be applied at next salary release. Reason e.g. late, absent.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Amount</Label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" value={deductionForm.amount} onChange={(e) => setDeductionForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Reason</Label>
              <Input placeholder="e.g. Late, Absent" value={deductionForm.reason} onChange={(e) => setDeductionForm((f) => ({ ...f, reason: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDeduction(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!deductionForm.amount || !deductionForm.reason.trim()) {
                toast({ title: "Error", description: "Enter amount and reason", variant: "destructive" });
                return;
              }
              createDeductionMutation.mutate({ amount: deductionForm.amount, reason: deductionForm.reason.trim() });
            }} disabled={createDeductionMutation.isPending}>
              Add deduction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add advance salary dialog */}
      <Dialog open={showAddAdvance} onOpenChange={setShowAddAdvance}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add advance salary</DialogTitle>
            <DialogDescription>Advance will be deducted at next salary release.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Amount</Label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" value={advanceForm.amount} onChange={(e) => setAdvanceForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input placeholder="Optional note" value={advanceForm.note} onChange={(e) => setAdvanceForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAdvance(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!advanceForm.amount) {
                toast({ title: "Error", description: "Enter amount", variant: "destructive" });
                return;
              }
              createAdvanceMutation.mutate({ amount: advanceForm.amount, note: advanceForm.note || undefined });
            }} disabled={createAdvanceMutation.isPending}>
              Add advance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add previous due dialog */}
      <Dialog open={showAddPreviousDue} onOpenChange={setShowAddPreviousDue}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add previous due</DialogTitle>
            <DialogDescription>Previous due will be included in payable at next salary release (e.g. carried from last month).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Amount</Label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" value={previousDueForm.amount} onChange={(e) => setPreviousDueForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input placeholder="Optional note" value={previousDueForm.note} onChange={(e) => setPreviousDueForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPreviousDue(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!previousDueForm.amount) {
                toast({ title: "Error", description: "Enter amount", variant: "destructive" });
                return;
              }
              createPreviousDueMutation.mutate({ amount: previousDueForm.amount, note: previousDueForm.note || undefined });
            }} disabled={createPreviousDueMutation.isPending}>
              Add previous due
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add loan dialog */}
      <Dialog open={showAddLoan} onOpenChange={setShowAddLoan}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add loan</DialogTitle>
            <DialogDescription>Loan will be deducted from payable at next salary release.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Amount</Label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" value={loanForm.amount} onChange={(e) => setLoanForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input placeholder="Optional note" value={loanForm.note} onChange={(e) => setLoanForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLoan(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!loanForm.amount) {
                toast({ title: "Error", description: "Enter amount", variant: "destructive" });
                return;
              }
              createLoanMutation.mutate({ amount: loanForm.amount, note: loanForm.note || undefined });
            }} disabled={createLoanMutation.isPending}>
              Add loan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add unpaid leave (UL) dialog */}
      <Dialog open={showAddUnpaidLeave} onOpenChange={setShowAddUnpaidLeave}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add unpaid leave (UL)</DialogTitle>
            <DialogDescription>Unpaid leave amount will be deducted from payable at next salary release.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Amount</Label>
              <Input type="number" step="0.01" min="0" placeholder="0.00" value={unpaidLeaveForm.amount} onChange={(e) => setUnpaidLeaveForm((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Note (optional)</Label>
              <Input placeholder="Optional note" value={unpaidLeaveForm.note} onChange={(e) => setUnpaidLeaveForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUnpaidLeave(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!unpaidLeaveForm.amount) {
                toast({ title: "Error", description: "Enter amount", variant: "destructive" });
                return;
              }
              createUnpaidLeaveMutation.mutate({ amount: unpaidLeaveForm.amount, note: unpaidLeaveForm.note || undefined });
            }} disabled={createUnpaidLeaveMutation.isPending}>
              Add unpaid leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit deduction dialog */}
      <Dialog open={!!editingDeduction} onOpenChange={(open) => !open && setEditingDeduction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit deduction</DialogTitle>
          </DialogHeader>
          {editingDeduction && (
            <div className="grid gap-4 py-4">
              <div>
                <Label>Amount</Label>
                <Input type="number" step="0.01" min="0" value={editingDeduction.amount} onChange={(e) => setEditingDeduction((d) => d ? { ...d, amount: e.target.value } : null)} />
              </div>
              <div>
                <Label>Reason</Label>
                <Input value={editingDeduction.reason} onChange={(e) => setEditingDeduction((d) => d ? { ...d, reason: e.target.value } : null)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingDeduction(null)}>Cancel</Button>
                <Button onClick={() => {
                  if (!editingDeduction?.amount || !editingDeduction.reason.trim()) {
                    toast({ title: "Error", description: "Enter amount and reason", variant: "destructive" });
                    return;
                  }
                  updateDeductionMutation.mutate({ id: editingDeduction.id, data: { amount: String(editingDeduction.amount), reason: editingDeduction.reason.trim() } });
                }} disabled={updateDeductionMutation.isPending}>Save</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit advance dialog */}
      <Dialog open={!!editingAdvance} onOpenChange={(open) => !open && setEditingAdvance(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit advance</DialogTitle>
          </DialogHeader>
          {editingAdvance && (
            <div className="grid gap-4 py-4">
              <div>
                <Label>Amount</Label>
                <Input type="number" step="0.01" min="0" value={editingAdvance.amount} onChange={(e) => setEditingAdvance((a) => a ? { ...a, amount: e.target.value } : null)} />
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Input value={editingAdvance.note ?? ""} onChange={(e) => setEditingAdvance((a) => a ? { ...a, note: e.target.value } : null)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingAdvance(null)}>Cancel</Button>
                <Button onClick={() => {
                  if (!editingAdvance?.amount) {
                    toast({ title: "Error", description: "Enter amount", variant: "destructive" });
                    return;
                  }
                  updateAdvanceMutation.mutate({ id: editingAdvance.id, data: { amount: String(editingAdvance.amount), note: editingAdvance.note ?? undefined } });
                }} disabled={updateAdvanceMutation.isPending}>Save</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit previous due dialog */}
      <Dialog open={!!editingPreviousDue} onOpenChange={(open) => !open && setEditingPreviousDue(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit previous due</DialogTitle>
          </DialogHeader>
          {editingPreviousDue && (
            <div className="grid gap-4 py-4">
              <div>
                <Label>Amount</Label>
                <Input type="number" step="0.01" min="0" value={editingPreviousDue.amount} onChange={(e) => setEditingPreviousDue((p) => p ? { ...p, amount: e.target.value } : null)} />
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Input value={editingPreviousDue.note ?? ""} onChange={(e) => setEditingPreviousDue((p) => p ? { ...p, note: e.target.value } : null)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingPreviousDue(null)}>Cancel</Button>
                <Button onClick={() => {
                  if (!editingPreviousDue?.amount) {
                    toast({ title: "Error", description: "Enter amount", variant: "destructive" });
                    return;
                  }
                  updatePreviousDueMutation.mutate({ id: editingPreviousDue.id, data: { amount: String(editingPreviousDue.amount), note: editingPreviousDue.note ?? undefined } });
                }} disabled={updatePreviousDueMutation.isPending}>Save</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit loan dialog */}
      <Dialog open={!!editingLoan} onOpenChange={(open) => !open && setEditingLoan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit loan</DialogTitle>
          </DialogHeader>
          {editingLoan && (
            <div className="grid gap-4 py-4">
              <div>
                <Label>Amount</Label>
                <Input type="number" step="0.01" min="0" value={editingLoan.amount ?? ""} onChange={(e) => setEditingLoan((l) => l ? { ...l, amount: e.target.value } : null)} />
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Input value={editingLoan.note ?? ""} onChange={(e) => setEditingLoan((l) => l ? { ...l, note: e.target.value } : null)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingLoan(null)}>Cancel</Button>
                <Button onClick={() => {
                  const amt = editingLoan.amount;
                  if (amt === undefined || amt === null || amt === "") {
                    toast({ title: "Error", description: "Enter amount", variant: "destructive" });
                    return;
                  }
                  updateLoanMutation.mutate({ id: editingLoan.id, data: { amount: String(amt), note: editingLoan.note ?? undefined } });
                }} disabled={updateLoanMutation.isPending}>Save</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit unpaid leave dialog */}
      <Dialog open={!!editingUnpaidLeave} onOpenChange={(open) => !open && setEditingUnpaidLeave(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit unpaid leave (UL)</DialogTitle>
          </DialogHeader>
          {editingUnpaidLeave && (
            <div className="grid gap-4 py-4">
              <div>
                <Label>Amount</Label>
                <Input type="number" step="0.01" min="0" value={editingUnpaidLeave.amount ?? ""} onChange={(e) => setEditingUnpaidLeave((u) => u ? { ...u, amount: e.target.value } : null)} />
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Input value={editingUnpaidLeave.note ?? ""} onChange={(e) => setEditingUnpaidLeave((u) => u ? { ...u, note: e.target.value } : null)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingUnpaidLeave(null)}>Cancel</Button>
                <Button onClick={() => {
                  const amt = editingUnpaidLeave.amount;
                  if (amt === undefined || amt === null || amt === "") {
                    toast({ title: "Error", description: "Enter amount", variant: "destructive" });
                    return;
                  }
                  updateUnpaidLeaveMutation.mutate({ id: editingUnpaidLeave.id, data: { amount: String(amt), note: editingUnpaidLeave.note ?? undefined } });
                }} disabled={updateUnpaidLeaveMutation.isPending}>Save</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit salary record dialog */}
      <Dialog open={!!editingSalary} onOpenChange={(open) => !open && setEditingSalary(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit salary record</DialogTitle>
            <DialogDescription>Update total paid and note. Use with care.</DialogDescription>
          </DialogHeader>
          {editingSalary && (
            <div className="grid gap-4 py-4">
              <div>
                <Label>Total salary (amount paid)</Label>
                <Input type="number" step="0.01" min="0" value={editingSalary.totalSalary} onChange={(e) => setEditingSalary((s) => s ? { ...s, totalSalary: e.target.value } : null)} />
              </div>
              <div>
                <Label>Note (optional)</Label>
                <Input value={editingSalary.note ?? ""} onChange={(e) => setEditingSalary((s) => s ? { ...s, note: e.target.value } : null)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingSalary(null)}>Cancel</Button>
                <Button onClick={() => {
                  if (!editingSalary?.totalSalary) {
                    toast({ title: "Error", description: "Enter total salary", variant: "destructive" });
                    return;
                  }
                  updateStaffSalaryMutation.mutate({ id: editingSalary.id, data: { totalSalary: String(editingSalary.totalSalary), note: editingSalary.note ?? undefined } });
                }} disabled={updateStaffSalaryMutation.isPending}>Save</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete history item confirmation */}
      <AlertDialog open={!!deleteHistoryItem} onOpenChange={(open) => !open && setDeleteHistoryItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!deleteHistoryItem) return;
                if (deleteHistoryItem.type === "deduction") deleteDeductionMutation.mutate(deleteHistoryItem.id);
                else if (deleteHistoryItem.type === "advance") deleteAdvanceMutation.mutate(deleteHistoryItem.id);
                else if (deleteHistoryItem.type === "previousDue") deletePreviousDueMutation.mutate(deleteHistoryItem.id);
                else if (deleteHistoryItem.type === "salary") deleteStaffSalaryMutation.mutate(deleteHistoryItem.id);
                else if (deleteHistoryItem.type === "loan") deleteLoanMutation.mutate(deleteHistoryItem.id);
                else if (deleteHistoryItem.type === "unpaidLeave") deleteUnpaidLeaveMutation.mutate(deleteHistoryItem.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add staff dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) setShowAddDialog(false); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Add Staff</DialogTitle>
            <DialogDescription>Enter staff details. Employee ID is auto-generated.</DialogDescription>
          </DialogHeader>
            <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Employee ID</Label>
                <Input value={addStaffEmployeeId} readOnly placeholder="Auto-generated" className="bg-muted" />
              </div>
              <div>
                <Label>Name *</Label>
                <Input value={formData.name} onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))} placeholder="Full name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Position *</Label>
                <div className="flex gap-1">
                  <Select value={formData.position} onValueChange={(v) => setFormData((f) => ({ ...f, position: v }))}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select position" /></SelectTrigger>
                    <SelectContent>
                      {formData.position && !positions.some((p) => p.name === formData.position) && (
                        <SelectItem value={formData.position}>{formData.position}</SelectItem>
                      )}
                      {positions.map((p) => (
                        <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasPermission("hrm.create") && (
                    <Button type="button" variant="outline" size="icon" onClick={() => { setPositionFormData({ name: "", description: "" }); setShowAddPositionDialog(true); }} title="Add position">
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <Label>Department *</Label>
                <div className="flex gap-1">
                  <Select value={formData.department} onValueChange={(v) => setFormData((f) => ({ ...f, department: v }))}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {formData.department && !departments.some((d) => d.name === formData.department) && (
                        <SelectItem value={formData.department}>{formData.department}</SelectItem>
                      )}
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasPermission("hrm.create") && (
                    <Button type="button" variant="outline" size="icon" onClick={() => { setDepartmentFormData({ name: "", description: "" }); setShowAddDepartmentDialog(true); }} title="Add department">
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Joining date *</Label>
                <Input type="date" value={formData.joiningDate} onChange={(e) => setFormData((f) => ({ ...f, joiningDate: e.target.value }))} />
              </div>
              <div>
                <Label>Salary *</Label>
                <Input type="number" step="0.01" value={formData.salary} onChange={(e) => setFormData((f) => ({ ...f, salary: e.target.value }))} placeholder="0.00" />
              </div>
            </div>
            <div>
              <Label>Photo (optional)</Label>
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-20 h-20 rounded-full overflow-hidden border-2 bg-muted flex items-center justify-center relative">
                  {formData.photoUrl && (
                    <img
                      src={formData.photoUrl}
                      alt="Preview"
                      className="w-full h-full object-cover absolute inset-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                  )}
                  <div className={`w-full h-full flex items-center justify-center ${formData.photoUrl ? "hidden" : ""}`}>
                    <User className="h-10 w-10 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex gap-2 items-center">
                    <Input value={formData.photoUrl} onChange={(e) => setFormData((f) => ({ ...f, photoUrl: e.target.value }))} placeholder="Enter image URL" className="flex-1 min-w-0" />
                    <input type="file" accept="image/*" className="hidden" ref={photoFileInputRef} onChange={(e) => handlePhotoUpload(e, false)} />
                    <Button type="button" variant="outline" size="sm" onClick={() => photoFileInputRef.current?.click()} title="Upload photo">
                      <Upload className="h-4 w-4 mr-1" />
                      Upload
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Paste a URL or click Upload to choose an image</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddStaff}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit staff dialog */}
      <Dialog open={!!editEmployee} onOpenChange={(open) => !open && setEditEmployee(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Edit Staff</DialogTitle>
          </DialogHeader>
          {editEmployee && (
            <>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Employee ID</Label>
                    <Input value={editEmployee.employeeId} onChange={(e) => setEditEmployee((prev) => prev ? { ...prev, employeeId: e.target.value } : null)} />
                  </div>
                  <div>
                    <Label>Name</Label>
                    <Input value={editEmployee.name} onChange={(e) => setEditEmployee((prev) => prev ? { ...prev, name: e.target.value } : null)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Position</Label>
                    <div className="flex gap-1">
                      <Select value={editEmployee.position} onValueChange={(v) => setEditEmployee((prev) => prev ? { ...prev, position: v } : null)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select position" /></SelectTrigger>
                        <SelectContent>
                          {positions.map((p) => (
                            <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {hasPermission("hrm.create") && (
                        <Button type="button" variant="outline" size="icon" onClick={() => { setPositionFormData({ name: "", description: "" }); setShowAddPositionDialog(true); }}><Plus className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Department</Label>
                    <div className="flex gap-1">
                      <Select value={editEmployee.department} onValueChange={(v) => setEditEmployee((prev) => prev ? { ...prev, department: v } : null)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select department" /></SelectTrigger>
                        <SelectContent>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {hasPermission("hrm.create") && (
                        <Button type="button" variant="outline" size="icon" onClick={() => { setDepartmentFormData({ name: "", description: "" }); setShowAddDepartmentDialog(true); }}><Plus className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Email</Label>
                    <Input value={editEmployee.email ?? ""} onChange={(e) => setEditEmployee((prev) => prev ? { ...prev, email: e.target.value } : null)} />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={editEmployee.phone ?? ""} onChange={(e) => setEditEmployee((prev) => prev ? { ...prev, phone: e.target.value } : null)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Joining date</Label>
                    <Input type="date" value={editEmployee.joiningDate ? format(new Date(editEmployee.joiningDate), "yyyy-MM-dd") : ""} onChange={(e) => setEditEmployee((prev) => prev ? { ...prev, joiningDate: e.target.value } as any : null)} />
                  </div>
                  <div>
                    <Label>Salary</Label>
                    <Input type="number" step="0.01" value={editEmployee.salary} onChange={(e) => setEditEmployee((prev) => prev ? { ...prev, salary: e.target.value } : null)} />
                  </div>
                </div>
                <div>
                  <Label>Photo</Label>
                  <div className="flex gap-4 items-start">
                    <div className="flex-shrink-0 w-20 h-20 rounded-full overflow-hidden border-2 bg-muted flex items-center justify-center relative">
                      {editEmployee.photoUrl && (
                        <img
                          src={editEmployee.photoUrl}
                          alt="Preview"
                          className="w-full h-full object-cover absolute inset-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                          }}
                        />
                      )}
                      <div className={`w-full h-full flex items-center justify-center ${editEmployee.photoUrl ? "hidden" : ""}`}>
                        <User className="h-10 w-10 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex gap-2 items-center">
                        <Input value={editEmployee.photoUrl ?? ""} onChange={(e) => setEditEmployee((prev) => prev ? { ...prev, photoUrl: e.target.value } : null)} placeholder="Enter image URL" className="flex-1 min-w-0" />
                        <input type="file" accept="image/*" className="hidden" ref={editPhotoFileInputRef} onChange={(e) => handlePhotoUpload(e, true)} />
                        <Button type="button" variant="outline" size="sm" onClick={() => editPhotoFileInputRef.current?.click()} title="Upload photo">
                          <Upload className="h-4 w-4 mr-1" />
                          Upload
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Paste a URL or click Upload to choose an image</p>
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={editEmployee.status} onValueChange={(v) => setEditEmployee((prev) => prev ? { ...prev, status: v } : null)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditEmployee(null)}>Cancel</Button>
                <Button onClick={handleEditSave}>Save</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Position dialog */}
      <Dialog open={showAddPositionDialog} onOpenChange={(open) => { if (!open) setShowAddPositionDialog(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Position</DialogTitle>
            <DialogDescription>Add a new job position for staff</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input value={positionFormData.name} onChange={(e) => setPositionFormData((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Waiter" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={positionFormData.description} onChange={(e) => setPositionFormData((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPositionDialog(false)}>Cancel</Button>
            <Button onClick={handleAddPosition}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Department dialog */}
      <Dialog open={showAddDepartmentDialog} onOpenChange={(open) => { if (!open) setShowAddDepartmentDialog(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Department</DialogTitle>
            <DialogDescription>Add a new department for staff</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Name *</Label>
              <Input value={departmentFormData.name} onChange={(e) => setDepartmentFormData((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. F&B" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={departmentFormData.description} onChange={(e) => setDepartmentFormData((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDepartmentDialog(false)}>Cancel</Button>
            <Button onClick={handleAddDepartment}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Position dialog */}
      <Dialog open={!!editPosition} onOpenChange={(open) => !open && setEditPosition(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Position</DialogTitle>
          </DialogHeader>
          {editPosition && (
            <>
              <div className="grid gap-4 py-4">
                <div>
                  <Label>Name *</Label>
                  <Input value={editPosition.name} onChange={(e) => setEditPosition((p) => p ? { ...p, name: e.target.value } : null)} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={editPosition.description ?? ""} onChange={(e) => setEditPosition((p) => p ? { ...p, description: e.target.value } : null)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditPosition(null)}>Cancel</Button>
                <Button onClick={() => editPosition && updatePositionMutation.mutate({ id: editPosition.id, data: { name: editPosition.name, description: editPosition.description ?? undefined } })}>Save</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Department dialog */}
      <Dialog open={!!editDepartment} onOpenChange={(open) => !open && setEditDepartment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
          </DialogHeader>
          {editDepartment && (
            <>
              <div className="grid gap-4 py-4">
                <div>
                  <Label>Name *</Label>
                  <Input value={editDepartment.name} onChange={(e) => setEditDepartment((d) => d ? { ...d, name: e.target.value } : null)} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={editDepartment.description ?? ""} onChange={(e) => setEditDepartment((d) => d ? { ...d, description: e.target.value } : null)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditDepartment(null)}>Cancel</Button>
                <Button onClick={() => editDepartment && updateDepartmentMutation.mutate({ id: editDepartment.id, data: { name: editDepartment.name, description: editDepartment.description ?? undefined } })}>Save</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Position confirm */}
      <AlertDialog open={!!deletePositionId} onOpenChange={(open) => !open && setDeletePositionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete position?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Staff using this position will keep the position name.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deletePositionId && deletePositionMutation.mutate(deletePositionId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Department confirm */}
      <AlertDialog open={!!deleteDepartmentId} onOpenChange={(open) => !open && setDeleteDepartmentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete department?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone. Staff using this department will keep the department name.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteDepartmentId && deleteDepartmentMutation.mutate(deleteDepartmentId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteEmployeeId} onOpenChange={(open) => !open && setDeleteEmployeeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete staff?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteEmployeeId && deleteEmployeeMutation.mutate(deleteEmployeeId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk release confirm */}
      <AlertDialog open={showBulkReleaseConfirm} onOpenChange={setShowBulkReleaseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Release salary</AlertDialogTitle>
            <AlertDialogDescription>
              Release salary for {selectedIds.size} staff on {format(salaryDate, "PPP")}? Amounts will use each staff&apos;s payable salary (base + previous due + carried − deductions − advances).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkRelease}>Release</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
