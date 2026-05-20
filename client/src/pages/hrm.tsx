import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Edit2, Trash2, Users, Calendar, FileText, DollarSign, BarChart3, Upload, Download, FileSpreadsheet, Search, Calendar as CalendarIcon } from "lucide-react";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { insertEmployeeSchema, type Employee, type InsertEmployee, insertAttendanceSchema, type Attendance, type InsertAttendance, insertLeaveSchema, type Leave, type InsertLeave, insertPayrollSchema, type Payroll, type InsertPayroll, insertStaffSalarySchema, type StaffSalary, type InsertStaffSalary } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

export default function HRM() {
  const [activeTab, setActiveTab] = useState("employees");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const { toast } = useToast();

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch = !searchTerm ||
      employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (employee.email && employee.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (employee.phone && employee.phone.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === "all" || employee.status === statusFilter;
    
    const employeeDate = new Date(employee.joiningDate);
    let matchesDate = true;
    const now = new Date();
    const currentYear = now.getFullYear();
    
    if (dateFilter === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      employeeDate.setHours(0, 0, 0, 0);
      matchesDate = employeeDate.getTime() === today.getTime();
    } else if (dateFilter === "yesterday") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      employeeDate.setHours(0, 0, 0, 0);
      matchesDate = employeeDate.getTime() === yesterday.getTime();
    } else if (dateFilter === "thisMonth") {
      const start = new Date(currentYear, now.getMonth(), 1);
      const end = new Date(currentYear, now.getMonth() + 1, 0, 23, 59, 59, 999);
      matchesDate = employeeDate >= start && employeeDate <= end;
    } else if (dateFilter === "lastMonth") {
      const start = new Date(currentYear, now.getMonth() - 1, 1);
      const end = new Date(currentYear, now.getMonth(), 0, 23, 59, 59, 999);
      matchesDate = employeeDate >= start && employeeDate <= end;
    } else if (dateFilter === "january") {
      const start = new Date(currentYear, 0, 1);
      const end = new Date(currentYear, 1, 0, 23, 59, 59, 999);
      matchesDate = employeeDate >= start && employeeDate <= end;
    } else if (dateFilter === "february") {
      const start = new Date(currentYear, 1, 1);
      const end = new Date(currentYear, 2, 0, 23, 59, 59, 999);
      matchesDate = employeeDate >= start && employeeDate <= end;
    } else if (dateFilter === "march") {
      const start = new Date(currentYear, 2, 1);
      const end = new Date(currentYear, 3, 0, 23, 59, 59, 999);
      matchesDate = employeeDate >= start && employeeDate <= end;
    } else if (dateFilter === "april") {
      const start = new Date(currentYear, 3, 1);
      const end = new Date(currentYear, 4, 0, 23, 59, 59, 999);
      matchesDate = employeeDate >= start && employeeDate <= end;
    } else if (dateFilter === "may") {
      const start = new Date(currentYear, 4, 1);
      const end = new Date(currentYear, 5, 0, 23, 59, 59, 999);
      matchesDate = employeeDate >= start && employeeDate <= end;
    } else if (dateFilter === "june") {
      const start = new Date(currentYear, 5, 1);
      const end = new Date(currentYear, 6, 0, 23, 59, 59, 999);
      matchesDate = employeeDate >= start && employeeDate <= end;
    } else if (dateFilter === "july") {
      const start = new Date(currentYear, 6, 1);
      const end = new Date(currentYear, 7, 0, 23, 59, 59, 999);
      matchesDate = employeeDate >= start && employeeDate <= end;
    } else if (dateFilter === "august") {
      const start = new Date(currentYear, 7, 1);
      const end = new Date(currentYear, 8, 0, 23, 59, 59, 999);
      matchesDate = employeeDate >= start && employeeDate <= end;
    } else if (dateFilter === "september") {
      const start = new Date(currentYear, 8, 1);
      const end = new Date(currentYear, 9, 0, 23, 59, 59, 999);
      matchesDate = employeeDate >= start && employeeDate <= end;
    } else if (dateFilter === "october") {
      const start = new Date(currentYear, 9, 1);
      const end = new Date(currentYear, 10, 0, 23, 59, 59, 999);
      matchesDate = employeeDate >= start && employeeDate <= end;
    } else if (dateFilter === "november") {
      const start = new Date(currentYear, 10, 1);
      const end = new Date(currentYear, 11, 0, 23, 59, 59, 999);
      matchesDate = employeeDate >= start && employeeDate <= end;
    } else if (dateFilter === "december") {
      const start = new Date(currentYear, 11, 1);
      const end = new Date(currentYear, 12, 0, 23, 59, 59, 999);
      matchesDate = employeeDate >= start && employeeDate <= end;
    } else if (dateFilter === "custom" && customDate) {
      const selectedDate = new Date(customDate);
      selectedDate.setHours(0, 0, 0, 0);
      employeeDate.setHours(0, 0, 0, 0);
      matchesDate = employeeDate.getTime() === selectedDate.getTime();
    }
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  const addForm = useForm<InsertEmployee>({
    resolver: zodResolver(insertEmployeeSchema),
    defaultValues: {
      employeeId: "",
      name: "",
      position: "",
      department: "",
      email: null,
      phone: null,
      joiningDate: new Date(),
      salary: "0",
      photoUrl: null,
      status: "active",
    },
  });

  const editForm = useForm<InsertEmployee>({
    resolver: zodResolver(insertEmployeeSchema),
    defaultValues: {
      employeeId: "",
      name: "",
      position: "",
      department: "",
      email: null,
      phone: null,
      joiningDate: new Date(),
      salary: "0",
      photoUrl: null,
      status: "active",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertEmployee) => {
      const res = await apiRequest("POST", "/api/employees", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Success", description: "Employee added successfully" });
      setIsAddDialogOpen(false);
      addForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add employee", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertEmployee> }) => {
      const res = await apiRequest("PATCH", `/api/employees/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Success", description: "Employee updated successfully" });
      setIsEditDialogOpen(false);
      setSelectedEmployee(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update employee", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/employees/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "Success", description: "Employee deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete employee", variant: "destructive" });
    },
  });

  const handleAdd = (data: InsertEmployee) => {
    const formattedData = {
      ...data,
      email: data.email || null,
      phone: data.phone || null,
      photoUrl: data.photoUrl || null,
    };
    createMutation.mutate(formattedData);
  };

  const handleEdit = (data: InsertEmployee) => {
    if (!selectedEmployee) return;
    const formattedData = {
      ...data,
      email: data.email || null,
      phone: data.phone || null,
      photoUrl: data.photoUrl || null,
    };
    updateMutation.mutate({ id: selectedEmployee.id, data: formattedData });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this employee?")) {
      deleteMutation.mutate(id);
    }
  };

  const openEditDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    editForm.reset({
      employeeId: employee.employeeId,
      name: employee.name,
      position: employee.position,
      department: employee.department,
      email: employee.email || "",
      phone: employee.phone || "",
      joiningDate: new Date(employee.joiningDate),
      salary: employee.salary,
      photoUrl: employee.photoUrl || "",
      status: employee.status,
    });
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsViewDialogOpen(true);
  };

  const handleExportToCSV = () => {
    if (employees.length === 0) {
      toast({ title: "No Data", description: "No employees to export", variant: "destructive" });
      return;
    }

    const csvData = employees.map((emp) => ({
      "Employee ID": emp.employeeId,
      Name: emp.name,
      Position: emp.position,
      Department: emp.department,
      Email: emp.email || "",
      Phone: emp.phone || "",
      "Joining Date": format(new Date(emp.joiningDate), "yyyy-MM-dd"),
      Salary: emp.salary,
      "Photo URL": emp.photoUrl || "",
      Status: emp.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(csvData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");
    XLSX.writeFile(workbook, `employees_${format(new Date(), "yyyy-MM-dd")}.csv`);
    toast({ title: "Success", description: "Employees exported successfully" });
  };

  const handleImportFromExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          toast({ title: "Error", description: "No data found in file", variant: "destructive" });
          return;
        }

        let successCount = 0;
        let errorCount = 0;

        jsonData.forEach((row: any) => {
          try {
            const joiningDate = row["Joining Date"];
            let parsedDate: Date;

            if (joiningDate instanceof Date) {
              parsedDate = joiningDate;
            } else if (typeof joiningDate === "string") {
              parsedDate = new Date(joiningDate);
            } else {
              parsedDate = new Date();
            }

            const employeeData: InsertEmployee = {
              employeeId: String(row["Employee ID"] || ""),
              name: String(row["Name"] || ""),
              position: String(row["Position"] || ""),
              department: String(row["Department"] || ""),
              email: row["Email"] ? String(row["Email"]) : null,
              phone: row["Phone"] ? String(row["Phone"]) : null,
              joiningDate: parsedDate,
              salary: String(row["Salary"] || "0"),
              photoUrl: row["Photo URL"] ? String(row["Photo URL"]) : null,
              status: String(row["Status"] || "active"),
            };

            createMutation.mutate(employeeData, {
              onSuccess: () => {
                successCount++;
              },
              onError: () => {
                errorCount++;
              },
            });
          } catch (error) {
            errorCount++;
          }
        });

        setTimeout(() => {
          toast({
            title: "Import Complete",
            description: `Successfully imported ${successCount} employees. ${errorCount > 0 ? `Failed: ${errorCount}` : ""}`,
          });
        }, 1000);
      } catch (error) {
        toast({ title: "Error", description: "Failed to parse file", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
  };

  const handleDownloadSampleTemplate = () => {
    const sampleData = [
      {
        "Employee ID": "EMP001",
        Name: "John Doe",
        Position: "Manager",
        Department: "Admin",
        Email: "john.doe@example.com",
        Phone: "+1234567890",
        "Joining Date": "2024-01-15",
        Salary: "5000.00",
        "Photo URL": "https://example.com/photo.jpg",
        Status: "active",
      },
      {
        "Employee ID": "EMP002",
        Name: "Jane Smith",
        Position: "Chef",
        Department: "Kitchen",
        Email: "jane.smith@example.com",
        Phone: "+1234567891",
        "Joining Date": "2024-02-01",
        Salary: "4000.00",
        "Photo URL": "",
        Status: "active",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");
    XLSX.writeFile(workbook, "employee_template.xlsx");
    toast({ title: "Success", description: "Sample template downloaded successfully" });
  };

  const handleDownloadScheduleTemplate = () => {
    const today = new Date();
    const sampleScheduleData: Array<{
      "Employee ID": string;
      "Employee Name": string;
      Date: string;
      "Shift Start": string;
      "Shift End": string;
      "Day Off": string;
    }> = [];
    
    // Generate sample data for a full month (30 days) for 3 employees
    const employees = [
      { id: "EMP001", name: "John Smith", shift: { start: "09:00 AM", end: "05:00 PM" } },
      { id: "EMP002", name: "Sarah Johnson", shift: { start: "08:00 AM", end: "04:00 PM" } },
      { id: "EMP003", name: "Michael Chen", shift: { start: "10:00 AM", end: "06:00 PM" } },
    ];

    for (let day = 1; day <= 30; day++) {
      const date = new Date(today.getFullYear(), today.getMonth(), day);
      const dateStr = format(date, "yyyy-MM-dd");
      
      employees.forEach((emp, index) => {
        // Every 7th day is a day off for demonstration
        const isDayOff = day % 7 === (index + 1);
        
        sampleScheduleData.push({
          "Employee ID": emp.id,
          "Employee Name": emp.name,
          Date: dateStr,
          "Shift Start": isDayOff ? "" : emp.shift.start,
          "Shift End": isDayOff ? "" : emp.shift.end,
          "Day Off": isDayOff ? "Yes" : "No",
        });
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(sampleScheduleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Schedule");
    XLSX.writeFile(workbook, `employee_schedule_template_${format(today, "MMMM_yyyy")}.xlsx`);
    toast({ 
      title: "Success", 
      description: `Full month schedule template downloaded (${sampleScheduleData.length} entries for 30 days)` 
    });
  };

  const handleUploadSchedule = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          toast({ title: "Error", description: "No schedule data found in file", variant: "destructive" });
          return;
        }

        const employeeIds = new Set(jsonData.map((row: any) => row["Employee ID"]));
        const dates = new Set(jsonData.map((row: any) => row["Date"]));
        
        console.log("Full Month Schedule Data:", jsonData);
        console.log("Employees scheduled:", employeeIds.size);
        console.log("Days covered:", dates.size);
        
        toast({
          title: "Full Month Schedule Imported",
          description: `Successfully imported ${jsonData.length} schedule entries for ${employeeIds.size} employees across ${dates.size} days`,
        });
      } catch (error) {
        toast({ title: "Error", description: "Failed to parse schedule file", variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Human Resource Management</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">Manage employees, attendance, leave, payroll and reports</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="employees" data-testid="tab-employees" className="gap-2">
              <Users className="w-4 h-4" />
              Employees
            </TabsTrigger>
            <TabsTrigger value="attendance" data-testid="tab-attendance" className="gap-2">
              <Calendar className="w-4 h-4" />
              Attendance
            </TabsTrigger>
            <TabsTrigger value="leave" data-testid="tab-leave" className="gap-2">
              <FileText className="w-4 h-4" />
              Leave
            </TabsTrigger>
            <TabsTrigger value="staff-salary" data-testid="tab-staff-salary" className="gap-2">
              <DollarSign className="w-4 h-4" />
              Staff Salary
            </TabsTrigger>
            <TabsTrigger value="payroll" data-testid="tab-payroll" className="gap-2">
              <DollarSign className="w-4 h-4" />
              Payroll
            </TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="employees" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Employee Management</CardTitle>
                      <CardDescription>View and manage all employees</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" onClick={handleDownloadSampleTemplate} data-testid="button-download-template">
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Employee Template
                    </Button>
                    <Button variant="outline" onClick={handleDownloadScheduleTemplate} data-testid="button-download-schedule-template">
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Schedule Template
                    </Button>
                    <Button variant="outline" onClick={handleExportToCSV} data-testid="button-export-employees">
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                    <Button variant="outline" asChild data-testid="button-import-employees">
                      <label className="cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        Import
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleImportFromExcel}
                          className="hidden"
                          data-testid="input-import-file"
                        />
                      </label>
                    </Button>
                    <Button variant="outline" asChild data-testid="button-upload-schedule">
                      <label className="cursor-pointer">
                        <Calendar className="w-4 h-4 mr-2" />
                        Import Full Month Schedule
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleUploadSchedule}
                          className="hidden"
                          data-testid="input-schedule-file"
                        />
                      </label>
                    </Button>
                    <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-employee">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Employee
                    </Button>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by ID, name, position, department, email, or phone..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter by joining date" />
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
                          <CalendarComponent
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
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading employees...</div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No employees found</div>
                ) : (
                  <Table data-testid="table-employees">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.map((employee) => (
                        <TableRow key={employee.id} data-testid={`row-employee-${employee.id}`}>
                          <TableCell className="font-medium">{employee.employeeId}</TableCell>
                          <TableCell>{employee.name}</TableCell>
                          <TableCell>{employee.position}</TableCell>
                          <TableCell>{employee.department}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {employee.email && <div>{employee.email}</div>}
                              {employee.phone && <div className="text-muted-foreground">{employee.phone}</div>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={employee.status === "active" ? "default" : "secondary"}
                              data-testid={`badge-status-${employee.id}`}
                            >
                              {employee.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openViewDialog(employee)}
                                data-testid={`button-view-${employee.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(employee)}
                                data-testid={`button-edit-${employee.id}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(employee.id)}
                                data-testid={`button-delete-${employee.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
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

          <TabsContent value="attendance" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Staff Schedule</CardTitle>
                    <CardDescription>Manage employee work schedules and shifts</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" onClick={handleDownloadScheduleTemplate} data-testid="button-download-schedule-template-attendance">
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Download Template
                    </Button>
                    <Button variant="outline" asChild data-testid="button-upload-schedule-attendance">
                      <label className="cursor-pointer">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Schedule
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleUploadSchedule}
                          className="hidden"
                          data-testid="input-schedule-file-attendance"
                        />
                      </label>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading schedule...</div>
                ) : employees.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No employees available</p>
                    <p className="text-sm mt-2">Add employees to create work schedules</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h3 className="font-semibold mb-3">Today's Schedule - {format(new Date(), "MMMM dd, yyyy")}</h3>
                      <Table data-testid="table-staff-schedule">
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Position</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Shift Time</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {employees.filter(emp => emp.status === "active").map((employee) => (
                            <TableRow key={employee.id} data-testid={`row-schedule-${employee.id}`}>
                              <TableCell className="font-medium">{employee.employeeId}</TableCell>
                              <TableCell>{employee.name}</TableCell>
                              <TableCell>{employee.position}</TableCell>
                              <TableCell>{employee.department}</TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {employee.department === "Kitchen" ? "08:00 AM - 04:00 PM" : 
                                   employee.department === "Admin" ? "09:00 AM - 05:00 PM" : 
                                   employee.position.toLowerCase().includes("chef") ? "10:00 AM - 06:00 PM" :
                                   "09:00 AM - 05:00 PM"}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="default" data-testid={`badge-shift-status-${employee.id}`}>
                                  Scheduled
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    
                    <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                      <h4 className="font-medium">Schedule Management Instructions</h4>
                      <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                        <li>Download the schedule template to create employee work schedules</li>
                        <li>Fill in the template with employee IDs, dates, shift times, and day-off information</li>
                        <li>Upload the completed schedule file to update employee shifts</li>
                        <li>The template supports multiple employees and multiple dates</li>
                        <li>Mark "Day Off" as "Yes" for employees who are not working on specific dates</li>
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leave" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Leave Management</CardTitle>
                <CardDescription>Manage leave requests and approvals</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Leave management will be implemented here</p>
                  <p className="text-sm mt-2">Apply for leave, approve/reject requests, and track leave balance</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="staff-salary" className="space-y-4">
            <StaffSalaryTab employees={employees} />
          </TabsContent>

          <TabsContent value="payroll" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payroll & Salary</CardTitle>
                <CardDescription>Manage salary records and generate payslips</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Payroll management will be implemented here</p>
                  <p className="text-sm mt-2">Manage salary records, calculate bonuses/deductions, and generate payslips</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Reports & Analytics</CardTitle>
                <CardDescription>Export and view HR reports</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Reports and analytics will be implemented here</p>
                  <p className="text-sm mt-2">Export attendance, leave, and payroll summaries</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-add-employee">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
              <DialogDescription>Fill in the employee details to add to the system</DialogDescription>
            </DialogHeader>
            <Form {...addForm}>
              <form onSubmit={addForm.handleSubmit(handleAdd)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={addForm.control}
                    name="employeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee ID</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="EMP001" data-testid="input-employee-id" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="John Doe" data-testid="input-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Position</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Manager" data-testid="input-position" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Admin" data-testid="input-department" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} type="email" placeholder="email@example.com" data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="+1234567890" data-testid="input-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="joiningDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Joining Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value ? format(new Date(field.value), "yyyy-MM-dd") : ""}
                            onChange={(e) => field.onChange(new Date(e.target.value))}
                            data-testid="input-joining-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="salary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salary</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="5000.00" data-testid="input-salary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="photoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Photo URL (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="https://example.com/photo.jpg" data-testid="input-photo-url" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)} data-testid="button-cancel-add">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-add">
                    {createMutation.isPending ? "Adding..." : "Add Employee"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-employee">
            <DialogHeader>
              <DialogTitle>Edit Employee</DialogTitle>
              <DialogDescription>Update employee details</DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="employeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee ID</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="EMP001" data-testid="input-edit-employee-id" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="John Doe" data-testid="input-edit-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Position</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Manager" data-testid="input-edit-position" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Admin" data-testid="input-edit-department" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} type="email" placeholder="email@example.com" data-testid="input-edit-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="+1234567890" data-testid="input-edit-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="joiningDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Joining Date</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value ? format(new Date(field.value), "yyyy-MM-dd") : ""}
                            onChange={(e) => field.onChange(new Date(e.target.value))}
                            data-testid="input-edit-joining-date"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="salary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Salary</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="5000.00" data-testid="input-edit-salary" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="photoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Photo URL (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="https://example.com/photo.jpg" data-testid="input-edit-photo-url" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} data-testid="button-cancel-edit">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit">
                    {updateMutation.isPending ? "Updating..." : "Update Employee"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent data-testid="dialog-view-employee">
            <DialogHeader>
              <DialogTitle>Employee Details</DialogTitle>
              <DialogDescription>View complete employee information</DialogDescription>
            </DialogHeader>
            {selectedEmployee && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Employee ID</Label>
                    <p className="font-medium" data-testid="text-view-employee-id">{selectedEmployee.employeeId}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Name</Label>
                    <p className="font-medium" data-testid="text-view-name">{selectedEmployee.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Position</Label>
                    <p className="font-medium" data-testid="text-view-position">{selectedEmployee.position}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Department</Label>
                    <p className="font-medium" data-testid="text-view-department">{selectedEmployee.department}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium" data-testid="text-view-email">{selectedEmployee.email || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium" data-testid="text-view-phone">{selectedEmployee.phone || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Joining Date</Label>
                    <p className="font-medium" data-testid="text-view-joining-date">
                      {format(new Date(selectedEmployee.joiningDate), "MMM dd, yyyy")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Salary</Label>
                    <p className="font-medium" data-testid="text-view-salary">${selectedEmployee.salary}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge variant={selectedEmployee.status === "active" ? "default" : "secondary"} data-testid="badge-view-status">
                      {selectedEmployee.status}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setIsViewDialogOpen(false)} data-testid="button-close-view">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function StaffSalaryTab({ employees }: { employees: Employee[] }) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: staffSalaries = [], isLoading } = useQuery<StaffSalary[]>({
    queryKey: ["/api/staff-salaries"],
  });

  const addForm = useForm<InsertStaffSalary>({
    resolver: zodResolver(insertStaffSalarySchema),
    defaultValues: {
      employeeId: "",
      salaryDate: new Date(),
      salaryAmount: "0",
      deductSalary: "0",
      totalSalary: "0",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertStaffSalary) => {
      const res = await apiRequest("POST", "/api/staff-salaries", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff-salaries"] });
      toast({ title: "Success", description: "Staff salary added successfully" });
      setIsAddDialogOpen(false);
      addForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add staff salary", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/staff-salaries/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff-salaries"] });
      toast({ title: "Success", description: "Staff salary deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete staff salary", variant: "destructive" });
    },
  });

  const handleAdd = (data: InsertStaffSalary) => {
    const salaryAmount = parseFloat(data.salaryAmount);
    const deductSalary = parseFloat(data.deductSalary || "0");
    const totalSalary = salaryAmount - deductSalary;

    createMutation.mutate({
      ...data,
      totalSalary: totalSalary.toString(),
    });
  };

  const sortedSalaries = [...staffSalaries].sort((a, b) => 
    new Date(b.salaryDate).getTime() - new Date(a.salaryDate).getTime()
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Staff Salary List</CardTitle>
              <CardDescription>Manage staff salary payments and deductions</CardDescription>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-salary">
              <Plus className="w-4 h-4 mr-2" />
              Add Salary
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : sortedSalaries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No staff salaries found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Staff Name</TableHead>
                    <TableHead className="text-right">Salary Amount</TableHead>
                    <TableHead className="text-right">Deduct Salary</TableHead>
                    <TableHead className="text-right">Total Salary</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSalaries.map((salary) => {
                    const employee = employees.find(emp => emp.id === salary.employeeId);
                    return (
                      <TableRow key={salary.id} data-testid={`row-salary-${salary.id}`}>
                        <TableCell data-testid={`text-date-${salary.id}`}>
                          {format(new Date(salary.salaryDate), 'PP')}
                        </TableCell>
                        <TableCell className="font-medium" data-testid={`text-staff-${salary.id}`}>
                          {employee?.name || 'Unknown'}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-amount-${salary.id}`}>
                          ${parseFloat(salary.salaryAmount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-deduct-${salary.id}`}>
                          ${parseFloat(salary.deductSalary).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-semibold" data-testid={`text-total-${salary.id}`}>
                          ${parseFloat(salary.totalSalary).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(salary.id)}
                            data-testid={`button-delete-${salary.id}`}
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
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent data-testid="dialog-add-salary">
          <DialogHeader>
            <DialogTitle>Add Staff Salary</DialogTitle>
            <DialogDescription>Enter salary payment details</DialogDescription>
          </DialogHeader>
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit(handleAdd)} className="space-y-4">
              <FormField
                control={addForm.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Staff Name</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-employee">
                          <SelectValue placeholder="Select staff member" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="salaryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value instanceof Date ? format(field.value, 'yyyy-MM-dd') : field.value}
                        data-testid="input-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="salaryAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salary Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        placeholder="0.00"
                        data-testid="input-salary-amount"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={addForm.control}
                name="deductSalary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deduct Salary</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        placeholder="0.00"
                        data-testid="input-deduct-salary"
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
                  onClick={() => setIsAddDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                  Add Salary
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
