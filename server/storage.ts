import {
  type Product,
  type InsertProduct,
  type Category,
  type InsertCategory,
  type Table,
  type InsertTable,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type ExpenseCategory,
  type InsertExpenseCategory,
  type Expense,
  type InsertExpense,
  type Purchase,
  type InsertPurchase,
  type Employee,
  type InsertEmployee,
  type Attendance,
  type InsertAttendance,
  type Leave,
  type InsertLeave,
  type Payroll,
  type InsertPayroll,
  type StaffSalary,
  type InsertStaffSalary,
  type StaffDeduction,
  type InsertStaffDeduction,
  type StaffAdvance,
  type InsertStaffAdvance,
  type StaffPreviousDue,
  type InsertStaffPreviousDue,
  type StaffLoan,
  type InsertStaffLoan,
  type StaffUnpaidLeave,
  type InsertStaffUnpaidLeave,
  type Position,
  type InsertPosition,
  type Department,
  type InsertDepartment,
  type Settings,
  type InsertSettings,
  type AuditLog,
  type InsertAuditLog,
  type User,
  type InsertUser,
  type InventoryAdjustment,
  type InsertInventoryAdjustment,
  type Branch,
  type InsertBranch,
  type PaymentAdjustment,
  type InsertPaymentAdjustment,
  type Customer,
  type InsertCustomer,
  type DuePayment,
  type InsertDuePayment,
  type DuePaymentAllocation,
  type InsertDuePaymentAllocation,
  type Role,
  type InsertRole,
  type Permission,
  type InsertPermission,
  type RolePermission,
  type InsertRolePermission,
  type MainProduct,
  type InsertMainProduct,
  type MainProductItem,
  type InsertMainProductItem,
  type Unit,
  type InsertUnit,
  type SubscriptionCard,
  type InsertSubscriptionCard,
  subscriptionCards,
  categories,
  products,
  tables,
  orders,
  orderItems,
  expenseCategories,
  expenses,
  purchases,
  employees,
  attendance,
  leaves,
  payroll,
  staffSalaries,
  staffDeductions,
  staffAdvances,
  staffPreviousDue,
  staffLoans,
  staffUnpaidLeave,
  positions,
  departments,
  settings,
  inventoryAdjustments,
  users,
  branches,
  paymentAdjustments,
  orderCounters,
  customers,
  duePayments,
  duePaymentAllocations,
  roles,
  permissions,
  rolePermissions,
  auditLogs,
  mainProducts,
  mainProductItems,
  units,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, asc, sql, isNull, or, inArray, ne, not } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { format } from "date-fns";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeSubscriptionDiscountAmount(
  subtotalAfterItems: number,
  settings: Settings | undefined,
  card: { discountOverrideValue: string | null }
): number {
  if (!settings || settings.subscriptionProgramEnabled === "false") return 0;
  const dtype = settings.subscriptionDiscountType === "amount" ? "amount" : "percentage";
  const defaultVal = parseFloat(settings.subscriptionDiscountValue || "5");
  const override = card.discountOverrideValue;
  const val =
    override != null && override !== "" && !Number.isNaN(parseFloat(override))
      ? parseFloat(override)
      : defaultVal;
  if (dtype === "percentage") {
    return roundMoney(Math.min(subtotalAfterItems, (subtotalAfterItems * val) / 100));
  }
  return roundMoney(Math.min(subtotalAfterItems, val));
}

export interface IStorage {
  getCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;
  
  getProducts(branchId?: string | null): Promise<Product[]>;
  getProductsPaginated(branchId?: string | null, limit?: number, offset?: number, categoryIdOrIds?: string | string[] | null, search?: string, minPrice?: number, maxPrice?: number, inStock?: boolean, dateFrom?: Date, dateTo?: Date, hasShortage?: boolean, status?: "in_stock" | "low_stock" | "out_of_stock", threshold?: number): Promise<{ products: Product[]; total: number }>;
  getLowStockProductsPaginated(branchId?: string | null, threshold?: number, limit?: number, offset?: number, search?: string, categoryId?: string | null): Promise<{ products: Product[]; total: number }>;
  getInventoryAdjustmentsPaginated(branchId?: string | null, limit?: number, offset?: number, search?: string, productId?: string | null, adjustmentType?: string | null): Promise<{ adjustments: InventoryAdjustment[]; total: number }>;
  getProduct(id: string): Promise<Product | undefined>;
  getProductByBarcode(barcode: string): Promise<Product | undefined>;
  getProductsByCategory(categoryId: string, branchId?: string | null): Promise<Product[]>;
  getProductByName(name: string, excludeId?: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  
  getTables(branchId?: string | null): Promise<Table[]>;
  getTable(id: string): Promise<Table | undefined>;
  createTable(table: InsertTable): Promise<Table>;
  updateTable(id: string, table: Partial<InsertTable>): Promise<Table | undefined>;
  updateTableStatus(id: string, status: string): Promise<Table | undefined>;
  deleteTable(id: string): Promise<boolean>;
  
  getOrders(branchId?: string | null): Promise<Order[]>;
  getOrdersPaginated(branchId?: string | null, limit?: number, offset?: number, search?: string, paymentMethod?: string, paymentStatus?: string, minAmount?: number, maxAmount?: number, dateFrom?: Date, dateTo?: Date, productSearch?: string, months?: string[]): Promise<{ orders: Order[]; total: number }>;
  getCustomerOrdersPaginated(customerId: string, branchId?: string | null, limit?: number, offset?: number, search?: string, paymentStatus?: string, dateFrom?: Date, dateTo?: Date): Promise<{ orders: Order[]; total: number }>;
  getCustomerTransactionsPaginated(customerId: string, branchId?: string | null, limit?: number, offset?: number, search?: string, dateFrom?: Date, dateTo?: Date): Promise<{ transactions: Array<{ id: string; type: "due" | "payment"; date: Date; amount: number; description: string; paymentMethod?: string; order?: Order; payment?: DuePayment }>; total: number }>;
  getOrder(id: string): Promise<Order | undefined>;
  getDraftOrders(branchId?: string | null): Promise<Order[]>;
  getQROrders(branchId?: string | null): Promise<Order[]>;
  getWebOrders(branchId?: string | null): Promise<Order[]>;
  getCompletedOrders(branchId?: string | null): Promise<Order[]>;
  getSalesStats(branchId?: string | null, filters?: { dateFrom?: Date; dateTo?: Date; months?: string[]; paymentMethod?: string; paymentStatus?: string; minAmount?: number; maxAmount?: number; search?: string }): Promise<{ totalSales: number; totalRevenue: number; totalDue: number; totalPaid: number; averageOrderValue: number; totalDiscounts: number; paymentMethodBreakdown: Record<string, { total: number; count: number; paid: number; pending: number; failed: number }> }>;
  createOrder(order: InsertOrder): Promise<Order>;
  createOrderWithItems(order: InsertOrder, items: Omit<InsertOrderItem, 'orderId'>[]): Promise<Order>;
  updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order | undefined>;
  updateOrderWithItems(id: string, updates: Partial<InsertOrder>, items: Omit<InsertOrderItem, 'orderId'>[]): Promise<Order | undefined>;
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;
  deleteOrder(id: string): Promise<boolean>;
  
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;
  deleteOrderItems(orderId: string): Promise<boolean>;
  getOrderItemsWithProducts(orderId: string): Promise<(OrderItem & { product: Product })[]>;
  getTableCurrentOrder(tableId: string): Promise<Order | undefined>;
  
  getDashboardStats(startDate: Date, endDate: Date): Promise<{
    todaySales: number;
    todayOrders: number;
    totalRevenue: number;
    totalOrders: number;
    totalExpenses: number;
    profitLoss: number;
    totalPurchase: number;
  }>;
  getSalesByCategory(startDate: Date, endDate: Date): Promise<Array<{ category: string; revenue: number }>>;
  getSalesByPaymentMethod(startDate: Date, endDate: Date): Promise<Array<{ paymentMethod: string; amount: number }>>;
  getPopularProducts(startDate: Date, endDate: Date): Promise<Array<{ product: string; quantity: number; revenue: number }>>;
  getSalesSummary(startDate: Date, endDate: Date): Promise<Array<{ product: string; quantity: number; revenue: number }>>;
  getSalesSummaryPaginated(startDate: Date, endDate: Date, branchId?: string | null, limit?: number, offset?: number, search?: string): Promise<{ items: Array<{ product: string; quantity: number; revenue: number }>; total: number }>;
  getRecentOrders(startDate: Date, endDate: Date): Promise<Order[]>;
  
  getExpenseCategories(): Promise<ExpenseCategory[]>;
  getExpenseCategory(id: string): Promise<ExpenseCategory | undefined>;
  createExpenseCategory(category: InsertExpenseCategory): Promise<ExpenseCategory>;
  updateExpenseCategory(id: string, category: Partial<InsertExpenseCategory>): Promise<ExpenseCategory | undefined>;
  deleteExpenseCategory(id: string): Promise<boolean>;
  
  getUnits(): Promise<Unit[]>;
  getUnit(id: string): Promise<Unit | undefined>;
  createUnit(unit: InsertUnit): Promise<Unit>;
  updateUnit(id: string, unit: Partial<InsertUnit>): Promise<Unit | undefined>;
  deleteUnit(id: string): Promise<boolean>;
  
  getExpenses(branchId?: string | null, dateFrom?: Date, dateTo?: Date, months?: string[], categoryId?: string | null): Promise<Expense[]>;
  getExpenseStats(branchId?: string | null, dateFrom?: Date, dateTo?: Date, months?: string[], categoryId?: string | null): Promise<{ totalAmount: number; count: number; avgExpense: number; categoryCount: number }>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, expense: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<boolean>;
  
  getPurchases(branchId?: string | null): Promise<Purchase[]>;
  getPurchase(id: string): Promise<Purchase | undefined>;
  createPurchase(purchase: InsertPurchase): Promise<Purchase>;
  updatePurchase(id: string, purchase: Partial<InsertPurchase>): Promise<Purchase | undefined>;
  deletePurchase(id: string): Promise<boolean>;
  
  getEmployees(branchId?: string | null): Promise<Employee[]>;
  getEmployeesPaginated(opts: { branchId?: string | null; limit: number; offset: number; search?: string; status?: string; joinDateFrom?: Date; joinDateTo?: Date }): Promise<{ employees: Employee[]; total: number }>;
  getNextEmployeeId(branchId?: string | null): Promise<string>;
  getEmployee(id: string): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: string): Promise<boolean>;
  
  getAttendance(): Promise<Attendance[]>;
  getAttendanceByDate(date: Date): Promise<Attendance[]>;
  getAttendanceByEmployee(employeeId: string): Promise<Attendance[]>;
  getAttendanceStats(): Promise<{
    totalRecords: number;
    presentToday: number;
    absentToday: number;
    avgHours: number;
  }>;
  createAttendance(attendance: InsertAttendance): Promise<Attendance>;
  updateAttendance(id: string, attendance: Partial<InsertAttendance>): Promise<Attendance | undefined>;
  deleteAttendance(id: string): Promise<boolean>;
  
  getLeaves(): Promise<Leave[]>;
  getLeave(id: string): Promise<Leave | undefined>;
  getLeavesByEmployee(employeeId: string): Promise<Leave[]>;
  createLeave(leave: InsertLeave): Promise<Leave>;
  updateLeave(id: string, leave: Partial<InsertLeave>): Promise<Leave | undefined>;
  deleteLeave(id: string): Promise<boolean>;
  
  getPayroll(): Promise<Payroll[]>;
  getPayrollById(id: string): Promise<Payroll | undefined>;
  getPayrollByEmployee(employeeId: string): Promise<Payroll[]>;
  createPayroll(payroll: InsertPayroll): Promise<Payroll>;
  updatePayroll(id: string, payroll: Partial<InsertPayroll>): Promise<Payroll | undefined>;
  deletePayroll(id: string): Promise<boolean>;
  
  getStaffSalaries(): Promise<StaffSalary[]>;
  getStaffSalariesByEmployee(employeeId: string): Promise<StaffSalary[]>;
  getStaffSalary(id: string): Promise<StaffSalary | undefined>;
  createStaffSalary(salary: InsertStaffSalary): Promise<StaffSalary>;
  updateStaffSalary(id: string, salary: Partial<InsertStaffSalary>): Promise<StaffSalary | undefined>;
  deleteStaffSalary(id: string): Promise<boolean>;

  getEmployeesPayableSummary(branchId?: string | null): Promise<{ totalPayable: number; totalDeduction: number }>;
  getDeductionsByEmployee(employeeId: string, status?: "pending" | "applied"): Promise<StaffDeduction[]>;
  getStaffDeduction(id: string): Promise<StaffDeduction | undefined>;
  createStaffDeduction(data: InsertStaffDeduction): Promise<StaffDeduction>;
  updateStaffDeduction(id: string, data: Partial<Pick<StaffDeduction, "amount" | "reason">>): Promise<StaffDeduction | undefined>;
  deleteStaffDeduction(id: string): Promise<boolean>;
  getAdvancesByEmployee(employeeId: string, status?: "pending" | "deducted"): Promise<StaffAdvance[]>;
  getStaffAdvance(id: string): Promise<StaffAdvance | undefined>;
  createStaffAdvance(data: InsertStaffAdvance): Promise<StaffAdvance>;
  updateStaffAdvance(id: string, data: Partial<Pick<StaffAdvance, "amount" | "note">>): Promise<StaffAdvance | undefined>;
  deleteStaffAdvance(id: string): Promise<boolean>;
  getPendingDeductionsTotalsByEmployeeIds(employeeIds: string[]): Promise<Record<string, number>>;
  getPendingAdvancesTotalsByEmployeeIds(employeeIds: string[]): Promise<Record<string, number>>;
  getPendingPreviousDueTotalsByEmployeeIds(employeeIds: string[]): Promise<Record<string, number>>;
  getLastCarriedByEmployeeIds(employeeIds: string[]): Promise<Record<string, number>>;
  getPreviousDueByEmployee(employeeId: string, status?: "pending" | "settled"): Promise<StaffPreviousDue[]>;
  getStaffPreviousDue(id: string): Promise<StaffPreviousDue | undefined>;
  createStaffPreviousDue(data: InsertStaffPreviousDue): Promise<StaffPreviousDue>;
  updateStaffPreviousDue(id: string, data: Partial<Pick<StaffPreviousDue, "amount" | "note">>): Promise<StaffPreviousDue | undefined>;
  deleteStaffPreviousDue(id: string): Promise<boolean>;

  getPendingLoanTotalsByEmployeeIds(employeeIds: string[]): Promise<Record<string, number>>;
  getLoansByEmployee(employeeId: string, status?: "pending" | "settled"): Promise<StaffLoan[]>;
  getStaffLoan(id: string): Promise<StaffLoan | undefined>;
  createStaffLoan(data: InsertStaffLoan): Promise<StaffLoan>;
  updateStaffLoan(id: string, data: Partial<Pick<StaffLoan, "amount" | "note">>): Promise<StaffLoan | undefined>;
  deleteStaffLoan(id: string): Promise<boolean>;

  getPendingUnpaidLeaveTotalsByEmployeeIds(employeeIds: string[]): Promise<Record<string, number>>;
  getUnpaidLeaveByEmployee(employeeId: string, status?: "pending" | "applied"): Promise<StaffUnpaidLeave[]>;
  getStaffUnpaidLeave(id: string): Promise<StaffUnpaidLeave | undefined>;
  createStaffUnpaidLeave(data: InsertStaffUnpaidLeave): Promise<StaffUnpaidLeave>;
  updateStaffUnpaidLeave(id: string, data: Partial<Pick<StaffUnpaidLeave, "amount" | "note">>): Promise<StaffUnpaidLeave | undefined>;
  deleteStaffUnpaidLeave(id: string): Promise<boolean>;

  getPositions(): Promise<Position[]>;
  getPosition(id: string): Promise<Position | undefined>;
  createPosition(position: InsertPosition): Promise<Position>;
  updatePosition(id: string, position: Partial<InsertPosition>): Promise<Position | undefined>;
  deletePosition(id: string): Promise<boolean>;

  getDepartments(): Promise<Department[]>;
  getDepartment(id: string): Promise<Department | undefined>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  updateDepartment(id: string, department: Partial<InsertDepartment>): Promise<Department | undefined>;
  deleteDepartment(id: string): Promise<boolean>;
  
  getSettings(): Promise<Settings | undefined>;
  updateSettings(settings: Partial<InsertSettings>): Promise<Settings>;
  
  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filters?: { userId?: string; entityType?: string; action?: string; startDate?: Date; endDate?: Date; limit?: number; offset?: number }): Promise<{ logs: AuditLog[]; total: number }>;
  
  getInventoryAdjustments(): Promise<InventoryAdjustment[]>;
  getInventoryAdjustment(id: string): Promise<InventoryAdjustment | undefined>;
  getInventoryAdjustmentsByProduct(productId: string): Promise<InventoryAdjustment[]>;
  createInventoryAdjustment(adjustment: InsertInventoryAdjustment): Promise<InventoryAdjustment>;
  updateInventoryAdjustment(id: string, updateData: Partial<InsertInventoryAdjustment>): Promise<InventoryAdjustment>;
  deleteInventoryAdjustment(id: string): Promise<void>;
  getLowStockProducts(threshold: number): Promise<Product[]>;
  getSoldQuantitiesByProduct(): Promise<Record<string, number>>;
  getInventoryStats(branchId?: string | null, threshold?: number): Promise<{
    totalProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalStockValue: number;
    totalPurchaseCost: number;
    totalQuantity: number;
    totalShortage: number;
    shortageCount: number;
  }>;
  
  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  validateUserCredentials(username: string, password: string): Promise<User | null>;
  validateBranchCredentials(username: string, password: string): Promise<Branch | null>;
  
  // Roles management
  getRoles(): Promise<Role[]>;
  getRole(id: string): Promise<Role | undefined>;
  getRoleByName(name: string): Promise<Role | undefined>;
  createRole(role: InsertRole): Promise<Role>;
  updateRole(id: string, role: Partial<InsertRole>): Promise<Role | undefined>;
  deleteRole(id: string): Promise<boolean>;
  
  // Permissions management
  getPermissions(): Promise<Permission[]>;
  getPermission(id: string): Promise<Permission | undefined>;
  getPermissionsByCategory(category: string): Promise<Permission[]>;
  createPermission(permission: InsertPermission): Promise<Permission>;
  updatePermission(id: string, permission: Partial<InsertPermission>): Promise<Permission | undefined>;
  deletePermission(id: string): Promise<boolean>;
  
  // Role-Permissions management
  getRolePermissions(roleId: string): Promise<RolePermission[]>;
  getPermissionsForRole(roleId: string): Promise<Permission[]>;
  assignPermissionToRole(roleId: string, permissionId: string): Promise<RolePermission>;
  removePermissionFromRole(roleId: string, permissionId: string): Promise<boolean>;
  setRolePermissions(roleId: string, permissionIds: string[]): Promise<void>;
  
  getBranches(): Promise<Branch[]>;
  getBranch(id: string): Promise<Branch | undefined>;
  getBranchByName(name: string): Promise<Branch | undefined>;
  getBranchByUsername(username: string): Promise<Branch | undefined>;
  createBranch(branch: InsertBranch): Promise<Branch>;
  updateBranch(id: string, branch: Partial<InsertBranch>): Promise<Branch | undefined>;
  deleteBranch(id: string): Promise<boolean>;
  
  getPaymentAdjustments(branchId?: string | null): Promise<PaymentAdjustment[]>;
  createPaymentAdjustment(adjustment: InsertPaymentAdjustment): Promise<PaymentAdjustment>;
  
  getCustomers(branchId?: string | null): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByPhone(phone: string, branchId?: string | null): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: string): Promise<boolean>;
  
  getDuePayments(customerId?: string, branchId?: string | null, limit?: number, offset?: number): Promise<{ payments: DuePayment[]; total: number }>;
  getDuePayment(id: string): Promise<DuePayment | undefined>;
  createDuePayment(payment: InsertDuePayment): Promise<DuePayment>;
  updateDuePayment(id: string, payment: Partial<InsertDuePayment>): Promise<DuePayment | undefined>;
  deleteDuePayment(id: string): Promise<boolean>;
  
  getDuePaymentAllocations(paymentId?: string, orderId?: string): Promise<DuePaymentAllocation[]>;
  createDuePaymentAllocation(allocation: InsertDuePaymentAllocation): Promise<DuePaymentAllocation>;
  
  recordPaymentWithAllocations(
    payment: InsertDuePayment,
    allocations: { orderId: string; amount: number }[]
  ): Promise<DuePayment>;
  
  getCustomerDueSummary(customerId: string, branchId?: string | null, dateFrom?: Date, dateTo?: Date): Promise<{
    totalDue: number;
    totalPaid: number;
    balance: number;
    credit: number;
    ordersCount: number;
  }>;
  
  getAllCustomersDueSummary(
    branchId?: string | null, 
    limit?: number, 
    offset?: number,
    search?: string,
    statusFilter?: string,
    minAmount?: number,
    maxAmount?: number,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<{ summaries: Array<{
    customer: Customer;
    totalDue: number;
    totalPaid: number;
    balance: number;
    credit: number;
    ordersCount: number;
  }>; total: number }>;
  
  getCustomersDueSummaryStats(
    branchId?: string | null,
    dateFrom?: Date,
    dateTo?: Date,
    search?: string,
    statusFilter?: string,
    minAmount?: number,
    maxAmount?: number
  ): Promise<{
    totalCustomers: number;
    pendingDues: number;
    totalDue: number;
    totalOutstanding: number;
    totalCollected: number;
  }>;
  
  // Main Products management
  getMainProducts(): Promise<MainProduct[]>;
  getMainProduct(id: string): Promise<MainProduct | undefined>;
  createMainProduct(mainProduct: InsertMainProduct): Promise<MainProduct>;
  updateMainProduct(id: string, mainProduct: Partial<InsertMainProduct>): Promise<MainProduct | undefined>;
  deleteMainProduct(id: string): Promise<boolean>;
  
  // Main Product Items management
  getMainProductItems(mainProductId: string): Promise<Array<MainProductItem & { product: Product }>>;
  addMainProductItem(item: InsertMainProductItem): Promise<MainProductItem>;
  removeMainProductItem(id: string): Promise<boolean>;
  removeMainProductItemByProduct(mainProductId: string, productId: string): Promise<boolean>;
  
  // Main Product Stats
  getMainProductStats(mainProductId: string): Promise<{
    totalStock: number;
    branchBreakdown: Array<{ branchName: string; quantity: number; sold: number; available: number }>;
    totalQuantity: number;
    totalSold: number;
    totalAvailable: number;
    available: number;
    subProducts: Array<{ product: Product; quantity: number; sold: number; available: number; branchName: string | null }>;
  }>;

  getCustomerPosLifetimeSpend(customerId: string): Promise<number>;
  getSubscriptionCardByBarcode(barcode: string): Promise<(SubscriptionCard & { customer: Customer }) | undefined>;
  getSubscriptionCardById(id: string): Promise<(SubscriptionCard & { customer: Customer }) | undefined>;
  listSubscriptionCards(): Promise<Array<SubscriptionCard & { customer: Customer }>>;
  issueSubscriptionCard(
    customerId: string,
    opts?: { discountOverrideValue?: string | null; notes?: string | null }
  ): Promise<SubscriptionCard>;
  updateSubscriptionCard(
    id: string,
    updates: Partial<Pick<InsertSubscriptionCard, "isActive" | "notes" | "discountOverrideValue">>
  ): Promise<SubscriptionCard | undefined>;
}

export class DatabaseStorage implements IStorage {
  private readonly ORDER_COUNTER_ID = 'order-counter';

  private async getNextOrderNumber(): Promise<string> {
    return await db.transaction(async (tx) => {
      await tx
        .insert(orderCounters)
        .values({ id: this.ORDER_COUNTER_ID, counterValue: 0 })
        .onConflictDoNothing();
      
      const counters = await tx
        .select()
        .from(orderCounters)
        .where(eq(orderCounters.id, this.ORDER_COUNTER_ID))
        .for('update');
      
      const newValue = counters[0].counterValue + 1;
      const result = await tx
        .update(orderCounters)
        .set({ counterValue: newValue })
        .where(eq(orderCounters.id, this.ORDER_COUNTER_ID))
        .returning();
      
      return result[0].counterValue.toString();
    });
  }

  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const result = await db.select().from(categories).where(eq(categories.id, id));
    return result[0];
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const result = await db.insert(categories).values(insertCategory).returning();
    return result[0];
  }

  async updateCategory(id: string, updates: Partial<InsertCategory>): Promise<Category | undefined> {
    const result = await db.update(categories).set(updates).where(eq(categories.id, id)).returning();
    return result[0];
  }

  async deleteCategory(id: string): Promise<boolean> {
    const result = await db.delete(categories).where(eq(categories.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getProducts(branchId?: string | null): Promise<Product[]> {
    if (branchId) {
      // Return products with matching branchId OR NULL branchId (global products)
      return await db.select().from(products)
        .where(or(eq(products.branchId, branchId), isNull(products.branchId)));
    }
    return await db.select().from(products);
  }

  async getProductsPaginated(
    branchId?: string | null,
    limit: number = 50,
    offset: number = 0,
    categoryId?: string | null,
    search?: string,
    minPrice?: number,
    maxPrice?: number,
    inStock?: boolean,
    dateFrom?: Date,
    dateTo?: Date,
    hasShortage?: boolean,
    status?: "in_stock" | "low_stock" | "out_of_stock",
    threshold: number = 10
  ): Promise<{ products: Product[]; total: number }> {
    // Build where conditions
    const conditions = [];
    
    // Branch filter
    if (branchId) {
      conditions.push(or(eq(products.branchId, branchId), isNull(products.branchId)));
    }
    
    // Category filter (__none__ = products with no category)
    if (categoryId) {
      if (categoryId === "__none__") {
        conditions.push(or(isNull(products.categoryId), eq(products.categoryId, "")));
      } else {
        conditions.push(eq(products.categoryId, categoryId));
      }
    }
    
    // Search filter
    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(sql`LOWER(${products.name}) LIKE LOWER(${searchPattern})`);
    }
    
    // Price range filter
    if (minPrice !== undefined) {
      conditions.push(gte(sql`CAST(${products.price} AS DECIMAL)`, minPrice));
    }
    if (maxPrice !== undefined) {
      conditions.push(lte(sql`CAST(${products.price} AS DECIMAL)`, maxPrice));
    }
    
    // Stock filter
    if (inStock !== undefined) {
      if (inStock) {
        conditions.push(gte(sql`CAST(${products.quantity} AS DECIMAL)`, 1));
      } else {
        conditions.push(lte(sql`CAST(${products.quantity} AS DECIMAL)`, 0));
      }
    }

    // Date range filter (use dateTo as-is so client's timezone end time is respected)
    if (dateFrom) {
      conditions.push(gte(products.createdAt, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(products.createdAt, dateTo));
    }

    // Shortage filter
    if (hasShortage !== undefined) {
      if (hasShortage) {
        conditions.push(sql`CAST(${products.stockShort} AS DECIMAL) > 0`);
      } else {
        conditions.push(or(
          sql`CAST(${products.stockShort} AS DECIMAL) = 0`,
          isNull(products.stockShort)
        ));
      }
    }

    // Status filter (in_stock, low_stock, out_of_stock)
    if (status) {
      if (status === "out_of_stock") {
        conditions.push(sql`CAST(${products.quantity} AS DECIMAL) = 0`);
      } else if (status === "low_stock") {
        conditions.push(and(
          sql`CAST(${products.quantity} AS DECIMAL) > 0`,
          sql`CAST(${products.quantity} AS DECIMAL) <= ${threshold}`
        ));
      } else if (status === "in_stock") {
        conditions.push(sql`CAST(${products.quantity} AS DECIMAL) > ${threshold}`);
      }
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(whereClause);
    const total = Number(countResult[0]?.count || 0);
    
    // Get paginated products
    let query = db.select().from(products);
    if (whereClause) {
      query = query.where(whereClause) as any;
    }
    const productResults = await query
      .limit(limit)
      .offset(offset)
      .orderBy(asc(products.name));
    
    return {
      products: productResults,
      total,
    };
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.id, id));
    return result[0];
  }

  async getProductByBarcode(barcode: string): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.barcode, barcode));
    return result[0];
  }

  async getProductsByCategory(categoryId: string, branchId?: string | null): Promise<Product[]> {
    if (branchId) {
      // Return products with matching category and (matching branchId OR NULL branchId)
      return await db.select().from(products)
        .where(and(
          eq(products.categoryId, categoryId),
          or(eq(products.branchId, branchId), isNull(products.branchId))
        ));
    }
    return await db.select().from(products).where(eq(products.categoryId, categoryId));
  }

  async getProductByName(name: string, excludeId?: string): Promise<Product | undefined> {
    if (excludeId) {
      const result = await db.select().from(products)
        .where(and(
          eq(products.name, name),
          sql`${products.id} != ${excludeId}`
        ));
      return result[0];
    }
    const result = await db.select().from(products).where(eq(products.name, name));
    return result[0];
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const result = await db.insert(products).values(insertProduct).returning();
    return result[0];
  }

  async updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | undefined> {
    const result = await db.update(products).set(updates).where(eq(products.id, id)).returning();
    return result[0];
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getTables(branchId?: string | null): Promise<Table[]> {
    if (branchId) {
      return await db.select().from(tables).where(
        or(
          eq(tables.branchId, branchId),
          isNull(tables.branchId)
        )
      );
    }
    return await db.select().from(tables);
  }

  async getTable(id: string): Promise<Table | undefined> {
    const result = await db.select().from(tables).where(eq(tables.id, id));
    return result[0];
  }

  async createTable(insertTable: InsertTable): Promise<Table> {
    const result = await db.insert(tables).values(insertTable).returning();
    return result[0];
  }

  async updateTable(id: string, updates: Partial<InsertTable>): Promise<Table | undefined> {
    const result = await db.update(tables).set(updates).where(eq(tables.id, id)).returning();
    return result[0];
  }

  async updateTableStatus(id: string, status: string): Promise<Table | undefined> {
    const result = await db.update(tables).set({ status }).where(eq(tables.id, id)).returning();
    return result[0];
  }

  async deleteTable(id: string): Promise<boolean> {
    const result = await db.delete(tables).where(eq(tables.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getOrders(branchId?: string | null): Promise<Order[]> {
    if (branchId) {
      return await db.select().from(orders).where(eq(orders.branchId, branchId)).orderBy(desc(orders.createdAt));
    }
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id));
    return result[0];
  }

  async getDraftOrders(branchId?: string | null): Promise<Order[]> {
    if (branchId) {
      return await db.select().from(orders)
        .where(and(eq(orders.status, 'draft'), eq(orders.branchId, branchId)))
        .orderBy(desc(orders.createdAt));
    }
    return await db.select().from(orders).where(eq(orders.status, 'draft')).orderBy(desc(orders.createdAt));
  }

  async getQROrders(branchId?: string | null): Promise<Order[]> {
    if (branchId) {
      return await db.select().from(orders)
        .where(and(eq(orders.status, 'qr-pending'), eq(orders.branchId, branchId)))
        .orderBy(desc(orders.createdAt));
    }
    return await db.select().from(orders).where(eq(orders.status, 'qr-pending')).orderBy(desc(orders.createdAt));
  }

  async getWebOrders(branchId?: string | null): Promise<Order[]> {
    const webPending = and(eq(orders.orderSource, 'web'), eq(orders.status, 'web-pending'));
    if (branchId) {
      return await db.select().from(orders)
        .where(and(webPending, eq(orders.branchId, branchId)))
        .orderBy(desc(orders.createdAt));
    }
    return await db.select().from(orders).where(webPending).orderBy(desc(orders.createdAt));
  }

  async getCompletedOrders(branchId?: string | null): Promise<Order[]> {
    if (branchId) {
      return await db.select().from(orders)
        .where(and(eq(orders.status, 'completed'), eq(orders.branchId, branchId)))
        .orderBy(desc(orders.createdAt));
    }
    return await db.select().from(orders).where(eq(orders.status, 'completed')).orderBy(desc(orders.createdAt));
  }

  async getOrdersPaginated(
    branchId?: string | null,
    limit: number = 50,
    offset: number = 0,
    search?: string,
    paymentMethod?: string,
    paymentStatus?: string,
    minAmount?: number,
    maxAmount?: number,
    dateFrom?: Date,
    dateTo?: Date,
    productSearch?: string,
    months?: string[]
  ): Promise<{ orders: Order[]; total: number }> {
    const conditions: any[] = [];
    
    // Branch filter
    if (branchId) {
      conditions.push(eq(orders.branchId, branchId));
    }
    
    // Status filter - only completed orders for sales
    conditions.push(eq(orders.status, 'completed'));
    
    // Search filter - search in orderNumber (invoice number) and customerName only
    // No search by Sale ID (order ID) - removed as per user request
    if (search) {
      const searchTrimmed = search.trim();
      
      // Get invoice prefix from settings for invoice number search
      const settings = await this.getSettings();
      const invoicePrefix = settings?.invoicePrefix || "INV-";
      
      // Check if search term contains invoice prefix (case-insensitive)
      const upperSearch = searchTrimmed.toUpperCase();
      const upperPrefix = invoicePrefix.toUpperCase();
      let orderNumberSearch = searchTrimmed;
      let hasPrefix = false;
      
      // If search starts with invoice prefix, extract the order number part
      if (upperSearch.startsWith(upperPrefix)) {
        orderNumberSearch = searchTrimmed.substring(invoicePrefix.length);
        hasPrefix = true;
      }
      
      // Check if the search term (or extracted number) is purely numeric
      const isNumeric = /^\d+$/.test(orderNumberSearch);
      
      // Escape single quotes in invoice prefix for SQL
      const escapedPrefix = invoicePrefix.replace(/'/g, "''");
      
      // Pattern search for customer name (fuzzy matching)
      const searchPattern = `%${searchTrimmed}%`;
      
      if (isNumeric) {
        // For numeric searches (invoice numbers), use exact matching
        // This ensures "84" only matches invoice "84", not "1184" or "1842"
        const exactOrderNumber = orderNumberSearch;
        
        // Build exact invoice number matching conditions
        const invoiceMatchConditions: any[] = [];
        
        // Always check exact match for orderNumber (invoice number without prefix)
        invoiceMatchConditions.push(eq(orders.orderNumber, exactOrderNumber));
        
        // If search includes prefix, also check for full invoice format match
        if (hasPrefix) {
          invoiceMatchConditions.push(
            sql`LOWER(${sql.raw(`'${escapedPrefix}'`)}) || ${orders.orderNumber} = LOWER(${sql.raw(`'${escapedPrefix}${exactOrderNumber}'`)})`
          );
        }
        
        // For numeric searches: exact invoice match OR customer name match (fuzzy)
        const searchConditions: any[] = [];
        
        // Add invoice matching conditions
        if (invoiceMatchConditions.length === 1) {
          searchConditions.push(invoiceMatchConditions[0]);
        } else {
          searchConditions.push(or(...invoiceMatchConditions));
        }
        
        // Add customer name fuzzy matching
        searchConditions.push(
          sql`LOWER(${orders.customerName}) LIKE LOWER(${searchPattern})`
        );
        
        conditions.push(or(...searchConditions));
      } else {
        // For non-numeric searches, use fuzzy matching for customer name only
        // No search by invoice number for non-numeric text
        conditions.push(
          sql`LOWER(${orders.customerName}) LIKE LOWER(${searchPattern})`
        );
      }
    }
    
    // Payment method filter
    if (paymentMethod && paymentMethod !== "all") {
      // Handle comma-separated payment methods (for split payments)
      conditions.push(
        or(
          eq(orders.paymentMethod, paymentMethod),
          sql`${orders.paymentMethod} LIKE ${`%${paymentMethod}%`}`
        )
      );
    }
    
    // Payment status filter
    if (paymentStatus && paymentStatus !== "all") {
      conditions.push(eq(orders.paymentStatus, paymentStatus));
    }
    
    // Amount range filter
    if (minAmount !== undefined) {
      conditions.push(gte(sql`CAST(${orders.total} AS DECIMAL)`, minAmount));
    }
    if (maxAmount !== undefined) {
      conditions.push(lte(sql`CAST(${orders.total} AS DECIMAL)`, maxAmount));
    }
    
    // Date range filter (use dateTo as-is so client's timezone end time is respected, e.g. Jan 31 23:59:59.999 local)
    if (dateFrom) {
      conditions.push(gte(orders.createdAt, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(orders.createdAt, dateTo));
    }
    
    // Months filter (YYYY-MM): only when dateFrom/dateTo not both set (e.g. legacy or when client sends months only)
    if (months && months.length > 0 && !(dateFrom && dateTo)) {
      const monthConditions = months.map((m) => {
        const parts = m.trim().split("-");
        const y = parseInt(parts[0], 10);
        const mo = parseInt(parts[1], 10);
        if (isNaN(y) || isNaN(mo)) return null;
        return sql`(EXTRACT(YEAR FROM ${orders.createdAt})::int = ${y} AND EXTRACT(MONTH FROM ${orders.createdAt})::int = ${mo})`;
      }).filter(Boolean);
      if (monthConditions.length > 0) {
        conditions.push(or(...monthConditions));
      }
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(whereClause);
    const total = Number(countResult[0]?.count || 0);
    
    // Get paginated orders
    let query = db.select().from(orders).where(whereClause).orderBy(desc(orders.createdAt));
    
    if (limit > 0) {
      query = query.limit(limit) as any;
    }
    if (offset > 0) {
      query = query.offset(offset) as any;
    }
    
    const ordersList = await query;
    
    // If productSearch is provided, filter orders that contain products matching the search
    if (productSearch && productSearch.trim()) {
      const filteredOrders: Order[] = [];
      for (const order of ordersList) {
        const items = await this.getOrderItemsWithProducts(order.id);
        const hasMatchingProduct = items.some(item => 
          item.product && 
          item.product.name.toLowerCase().includes(productSearch.toLowerCase())
        );
        if (hasMatchingProduct) {
          filteredOrders.push(order);
        }
      }
      
      // Recalculate total for product search
      // This is less efficient but necessary for product-based filtering
      const allOrders = await db.select().from(orders).where(whereClause);
      let productFilteredTotal = 0;
      for (const order of allOrders) {
        const items = await this.getOrderItemsWithProducts(order.id);
        const hasMatchingProduct = items.some(item => 
          item.product && 
          item.product.name.toLowerCase().includes(productSearch.toLowerCase())
        );
        if (hasMatchingProduct) {
          productFilteredTotal++;
        }
      }
      
      return { orders: filteredOrders, total: productFilteredTotal };
    }
    
    return { orders: ordersList, total };
  }

  async getCustomerOrdersPaginated(
    customerId: string,
    branchId?: string | null,
    limit: number = 50,
    offset: number = 0,
    search?: string,
    paymentStatus?: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<{ orders: Order[]; total: number }> {
    const conditions: any[] = [
      eq(orders.customerId, customerId),
    ];
    
    // Branch filter - if branchId is provided, only show orders for that branch or null branch
    if (branchId) {
      conditions.push(
        or(
          eq(orders.branchId, branchId),
          sql`${orders.branchId} IS NULL`
        )
      );
    }
    
    // Search filter
    if (search) {
      const searchTrimmed = search.trim();
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchTrimmed);
      
      if (isUUID) {
        conditions.push(eq(orders.id, searchTrimmed));
      } else {
        const searchPattern = `%${searchTrimmed}%`;
        conditions.push(
          or(
            sql`LOWER(${orders.orderNumber}) LIKE LOWER(${searchPattern})`,
            sql`LOWER(${orders.customerName}) LIKE LOWER(${searchPattern})`
          )
        );
      }
    }
    
    // Payment status filter
    if (paymentStatus && paymentStatus !== "all") {
      conditions.push(eq(orders.paymentStatus, paymentStatus));
    }
    
    // Date range filter (use dateTo as-is so client's timezone end time is respected)
    if (dateFrom) {
      conditions.push(gte(orders.createdAt, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(orders.createdAt, dateTo));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(whereClause);
    const total = Number(countResult[0]?.count || 0);
    
    // Get paginated orders
    let query = db.select().from(orders).where(whereClause).orderBy(desc(orders.createdAt));
    
    if (limit > 0) {
      query = query.limit(limit) as any;
    }
    if (offset > 0) {
      query = query.offset(offset) as any;
    }
    
    const ordersList = await query;
    
    return { orders: ordersList, total };
  }

  async getCustomerTransactionsPaginated(
    customerId: string,
    branchId?: string | null,
    limit: number = 50,
    offset: number = 0,
    search?: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<{ transactions: Array<{ id: string; type: "due" | "payment"; date: Date; amount: number; description: string; paymentMethod?: string; order?: Order; payment?: DuePayment }>; total: number }> {
    // Get all orders for this customer that are due-related
    // Include: orders with orderSource="due-management" OR orders with due/partial status OR orders that have payment allocations
    const orderConditions: any[] = [eq(orders.customerId, customerId)];
    
    // Branch filter - if branchId is provided, only show orders for that branch or null branch
    if (branchId) {
      orderConditions.push(
        or(
          eq(orders.branchId, branchId),
          sql`${orders.branchId} IS NULL`
        )
      );
    }
    
    // Get orders that are due-related (due-management source OR due/partial status OR have allocations)
    const allCustomerOrders = await db.select().from(orders).where(and(...orderConditions));
    
    // Get payment allocations to find orders that have been paid
    const allocations = await db.select().from(duePaymentAllocations);
    const orderIdsWithAllocations = new Set(allocations.map(a => a.orderId));
    
    // Filter due-related orders
    const dueRelatedOrders = allCustomerOrders.filter(order => 
      order.orderSource === "due-management" ||
      order.paymentStatus === "due" ||
      order.paymentStatus === "partial" ||
      orderIdsWithAllocations.has(order.id)
    );
    
    // Get due payments
    const { payments: duePayments } = await this.getDuePayments(customerId, branchId);
    
    // Combine into transactions
    type Transaction = {
      id: string;
      type: "due" | "payment";
      date: Date;
      amount: number;
      description: string;
      paymentMethod?: string;
      order?: Order;
      payment?: DuePayment;
    };
    
    const transactions: Transaction[] = [
      ...dueRelatedOrders.map(order => ({
        id: order.id,
        type: "due" as const,
        date: new Date(order.createdAt),
        amount: parseFloat(order.total || "0"),
        description: order.orderSource === "due-management" ? "Due Entry" : `Order ${order.orderNumber}`,
        order,
      })),
      ...duePayments.map(payment => {
        // Parse paymentSlips if it's a string
        let parsedPayment = payment;
        if (payment.paymentSlips && typeof payment.paymentSlips === 'string') {
          try {
            parsedPayment = {
              ...payment,
              paymentSlips: JSON.parse(payment.paymentSlips),
            };
          } catch (e) {
            // If parsing fails, keep as is
          }
        }
        return {
          id: payment.id,
          type: "payment" as const,
          date: new Date(payment.paymentDate),
          amount: parseFloat(payment.amount || "0"),
          description: payment.note || "Payment",
          paymentMethod: payment.paymentMethod,
          payment: parsedPayment,
        };
      }),
    ];
    
    // Apply search filter
    let filteredTransactions = transactions;
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      filteredTransactions = transactions.filter(t => 
        t.description.toLowerCase().includes(searchLower) ||
        (t.paymentMethod && t.paymentMethod.toLowerCase().includes(searchLower)) ||
        (t.order && t.order.orderNumber.toLowerCase().includes(searchLower))
      );
    }
    
    // Apply date range filter (use dateTo as-is so client's timezone end time is respected)
    if (dateFrom) {
      filteredTransactions = filteredTransactions.filter(t => t.date >= dateFrom);
    }
    if (dateTo) {
      filteredTransactions = filteredTransactions.filter(t => t.date <= dateTo);
    }
    
    // Sort by date, newest first
    filteredTransactions.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    const total = filteredTransactions.length;
    
    // Apply pagination
    const paginatedTransactions = limit > 0 
      ? filteredTransactions.slice(offset, offset + limit)
      : filteredTransactions;
    
    return { transactions: paginatedTransactions, total };
  }

  async getSalesStats(branchId?: string | null, filters?: { dateFrom?: Date; dateTo?: Date; months?: string[]; paymentMethod?: string; paymentStatus?: string; minAmount?: number; maxAmount?: number; search?: string }): Promise<{ totalSales: number; totalRevenue: number; totalDue: number; totalPaid: number; averageOrderValue: number }> {
    const conditions: any[] = [];

    if (branchId) conditions.push(eq(orders.branchId, branchId));
    conditions.push(eq(orders.status, 'completed'));

    if (filters?.search?.trim()) {
      const searchTrimmed = filters.search.trim();
      const settings = await this.getSettings();
      const invoicePrefix = settings?.invoicePrefix || "INV-";
      const upperSearch = searchTrimmed.toUpperCase();
      const upperPrefix = invoicePrefix.toUpperCase();
      let orderNumberSearch = searchTrimmed;
      let hasPrefix = false;
      if (upperSearch.startsWith(upperPrefix)) {
        orderNumberSearch = searchTrimmed.substring(invoicePrefix.length);
        hasPrefix = true;
      }
      const isNumeric = /^\d+$/.test(orderNumberSearch);
      const escapedPrefix = invoicePrefix.replace(/'/g, "''");
      const searchPattern = `%${searchTrimmed}%`;
      if (isNumeric) {
        const exactOrderNumber = orderNumberSearch;
        const invoiceMatchConditions: any[] = [eq(orders.orderNumber, exactOrderNumber)];
        if (hasPrefix) {
          invoiceMatchConditions.push(
            sql`LOWER(${sql.raw(`'${escapedPrefix}'`)}) || ${orders.orderNumber} = LOWER(${sql.raw(`'${escapedPrefix}${exactOrderNumber}'`)})`
          );
        }
        const searchConditions = [
          invoiceMatchConditions.length === 1 ? invoiceMatchConditions[0] : or(...invoiceMatchConditions),
          sql`LOWER(${orders.customerName}) LIKE LOWER(${searchPattern})`,
        ];
        conditions.push(or(...searchConditions));
      } else {
        conditions.push(sql`LOWER(${orders.customerName}) LIKE LOWER(${searchPattern})`);
      }
    }

    if (filters?.paymentMethod && filters.paymentMethod !== "all") {
      conditions.push(or(
        eq(orders.paymentMethod, filters.paymentMethod),
        sql`${orders.paymentMethod} LIKE ${`%${filters.paymentMethod}%`}`
      ));
    }
    if (filters?.paymentStatus && filters.paymentStatus !== "all") {
      conditions.push(eq(orders.paymentStatus, filters.paymentStatus));
    }
    if (filters?.minAmount !== undefined) conditions.push(gte(sql`CAST(${orders.total} AS DECIMAL)`, filters.minAmount));
    if (filters?.maxAmount !== undefined) conditions.push(lte(sql`CAST(${orders.total} AS DECIMAL)`, filters.maxAmount));
    if (filters?.dateFrom) conditions.push(gte(orders.createdAt, filters.dateFrom));
    if (filters?.dateTo) conditions.push(lte(orders.createdAt, filters.dateTo));
    if (filters?.months && filters.months.length > 0 && !(filters.dateFrom && filters.dateTo)) {
      const monthConditions = filters.months.map((m) => {
        const parts = m.trim().split("-");
        const y = parseInt(parts[0], 10);
        const mo = parseInt(parts[1], 10);
        if (isNaN(y) || isNaN(mo)) return null;
        return sql`(EXTRACT(YEAR FROM ${orders.createdAt})::int = ${y} AND EXTRACT(MONTH FROM ${orders.createdAt})::int = ${mo})`;
      }).filter(Boolean);
      if (monthConditions.length > 0) conditions.push(or(...monthConditions));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const allOrders = await db.select().from(orders).where(whereClause);

    let totalRevenue = 0;
    let totalDue = 0;
    let totalPaid = 0;
    for (const order of allOrders) {
      totalRevenue += parseFloat(order.total || "0");
      totalPaid += parseFloat(order.paidAmount || "0");
      totalDue += parseFloat(order.dueAmount || "0");
    }
    const totalSales = allOrders.length;
    const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;
    let totalDiscounts = 0;
    const paymentMethodBreakdown: Record<string, { total: number; count: number; paid: number; pending: number; failed: number }> = {};
    for (const order of allOrders) {
      totalDiscounts += parseFloat(order.discount || "0");
      const method = order.paymentMethod || "unknown";
      if (!paymentMethodBreakdown[method]) {
        paymentMethodBreakdown[method] = { total: 0, count: 0, paid: 0, pending: 0, failed: 0 };
      }
      const amt = parseFloat(order.total || "0");
      paymentMethodBreakdown[method].total += amt;
      paymentMethodBreakdown[method].count += 1;
      if (order.paymentStatus === "paid") {
        paymentMethodBreakdown[method].paid += amt;
      } else if (order.paymentStatus === "pending") {
        paymentMethodBreakdown[method].pending += amt;
      } else if (order.paymentStatus === "failed") {
        paymentMethodBreakdown[method].failed += amt;
      }
    }
    return { totalSales, totalRevenue, totalDue, totalPaid, averageOrderValue, totalDiscounts, paymentMethodBreakdown };
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const orderNumber = await this.getNextOrderNumber();
    const orderWithNumber = {
      ...insertOrder,
      orderNumber,
    };
    const result = await db.insert(orders).values(orderWithNumber).returning();
    return result[0];
  }

  private async resolveSubscriptionAndValidateTotalsInTx(
    tx: any,
    orderPayload: any,
    items: Omit<InsertOrderItem, "orderId">[]
  ): Promise<{
    subscriptionCardId: string | null;
    subscriptionDiscount: string;
    subtotal: string;
    total: string;
    customerId?: string;
    customerName?: string | null;
    customerPhone?: string | null;
  }> {
    const settings = await this.getSettings();
    const subtotalNum = roundMoney(
      items.reduce((sum, i) => sum + parseFloat(String(i.total)), 0)
    );

    let subscriptionCardId: string | null = orderPayload.subscriptionCardId || null;
    let subscriptionDiscountNum = 0;

    let customerId: string | undefined;
    let customerName: string | null | undefined;
    let customerPhone: string | null | undefined;

    // Without a subscription card: trust client subtotal/total like before (no cross-check vs line items).
    if (!subscriptionCardId) {
      const clientSubDisc = roundMoney(parseFloat(String(orderPayload.subscriptionDiscount ?? 0)));
      if (Math.abs(clientSubDisc) > 0.05) {
        throw new Error("Unexpected subscription discount without a card");
      }
      const subStr =
        orderPayload.subtotal != null && String(orderPayload.subtotal).trim() !== ""
          ? String(orderPayload.subtotal)
          : subtotalNum.toFixed(2);
      const totalStr =
        orderPayload.total != null && String(orderPayload.total).trim() !== ""
          ? String(orderPayload.total)
          : subStr;
      return {
        subscriptionCardId: null,
        subscriptionDiscount: "0.00",
        subtotal: subStr,
        total: totalStr,
      };
    }

    const clientSubtotal = roundMoney(parseFloat(String(orderPayload.subtotal ?? 0)));
    if (Math.abs(clientSubtotal - subtotalNum) > 0.05) {
      throw new Error(`Subtotal mismatch (${clientSubtotal} vs ${subtotalNum})`);
    }

    const cardRows = await tx
      .select()
      .from(subscriptionCards)
      .where(eq(subscriptionCards.id, subscriptionCardId))
      .limit(1);
    const card = cardRows[0];
    if (!card || card.isActive !== "true") {
      throw new Error("Invalid or inactive subscription card");
    }
    if (settings?.subscriptionProgramEnabled === "false") {
      throw new Error("Subscription program is disabled");
    }
    subscriptionDiscountNum = computeSubscriptionDiscountAmount(subtotalNum, settings, card);
    const clientSubDisc = roundMoney(parseFloat(String(orderPayload.subscriptionDiscount ?? 0)));
    if (Math.abs(clientSubDisc - subscriptionDiscountNum) > 0.05) {
      throw new Error("Subscription discount mismatch");
    }
    const custRows = await tx
      .select()
      .from(customers)
      .where(eq(customers.id, card.customerId))
      .limit(1);
    const cust = custRows[0];
    customerId = card.customerId;
    customerName = cust?.name ?? null;
    customerPhone = cust?.phone ?? null;

    const afterSub = roundMoney(subtotalNum - subscriptionDiscountNum);
    const globalDiscRaw = parseFloat(String(orderPayload.discount ?? 0));
    const discType = (orderPayload.discountType || "amount") as "amount" | "percentage";
    const globalAmt =
      discType === "percentage"
        ? roundMoney((afterSub * globalDiscRaw) / 100)
        : roundMoney(Math.min(afterSub, globalDiscRaw));
    const expectedTotal = roundMoney(afterSub - globalAmt);
    const clientTotal = roundMoney(parseFloat(String(orderPayload.total ?? 0)));
    if (Math.abs(expectedTotal - clientTotal) > 0.05) {
      throw new Error(`Order total mismatch (expected ${expectedTotal}, got ${clientTotal})`);
    }

    return {
      subscriptionCardId,
      subscriptionDiscount: subscriptionDiscountNum.toFixed(2),
      subtotal: subtotalNum.toFixed(2),
      total: expectedTotal.toFixed(2),
      ...(customerId ? { customerId, customerName, customerPhone } : {}),
    };
  }

  async createOrderWithItems(insertOrder: InsertOrder, items: Omit<InsertOrderItem, 'orderId'>[]): Promise<Order> {
    return await db.transaction(async (tx) => {
      const orderNumber = await this.getNextOrderNumber();
      const pricing = await this.resolveSubscriptionAndValidateTotalsInTx(tx, insertOrder, items);
      let orderData: any = {
        ...insertOrder,
        orderNumber,
        subscriptionCardId: pricing.subscriptionCardId,
        subscriptionDiscount: pricing.subscriptionDiscount,
        subtotal: pricing.subtotal,
        total: pricing.total,
      };

      if (pricing.customerId) {
        orderData.customerId = pricing.customerId;
        orderData.customerName = pricing.customerName ?? orderData.customerName;
        orderData.customerPhone = pricing.customerPhone ?? orderData.customerPhone;
      }
      
      // Handle createdAt if provided - convert to Date if it's a string
      if (insertOrder.createdAt) {
        orderData.createdAt = insertOrder.createdAt instanceof Date 
          ? insertOrder.createdAt 
          : new Date(insertOrder.createdAt);
      }
      
      // Create or find customer if customerName is provided (not just for due/partial orders)
      if (!orderData.customerId && insertOrder.customerName && insertOrder.customerName.trim() && insertOrder.customerName !== 'Walk-in Customer') {
        const customerName = insertOrder.customerName.trim();
        
        // Try to find existing customer by name and phone (if provided)
        let existingCustomer;
        if (insertOrder.customerPhone) {
          existingCustomer = await tx
            .select()
            .from(customers)
            .where(and(
              eq(customers.name, customerName),
              eq(customers.phone, insertOrder.customerPhone)
            ))
            .limit(1);
        }
        
        // If not found by name+phone, try by name only
        if (!existingCustomer || existingCustomer.length === 0) {
          existingCustomer = await tx
            .select()
            .from(customers)
            .where(eq(customers.name, customerName))
            .limit(1);
        }
        
        let customerId: string;
        
        if (existingCustomer && existingCustomer.length > 0) {
          customerId = existingCustomer[0].id;
          // Update customer phone if provided and different
          if (insertOrder.customerPhone && existingCustomer[0].phone !== insertOrder.customerPhone) {
            await tx
              .update(customers)
              .set({ phone: insertOrder.customerPhone })
              .where(eq(customers.id, customerId));
          }
        } else {
          // Create new customer
          const newCustomerResult = await tx
            .insert(customers)
            .values({
              name: customerName,
              phone: insertOrder.customerPhone || null,
              email: null,
              branchId: insertOrder.branchId || null,
              notes: null,
            })
            .returning();
          customerId = newCustomerResult[0].id;
        }
        
        // Set customer-related fields
        orderData = {
          ...orderData,
          customerId,
          customerName: customerName,
        };
      }
      
      // If payment status is "due" or "partial", set due/paid amounts
      if (insertOrder.paymentStatus === 'due' || insertOrder.paymentStatus === 'partial') {
        orderData = {
          ...orderData,
          dueAmount: insertOrder.dueAmount !== undefined ? insertOrder.dueAmount : (insertOrder.paymentStatus === 'due' ? insertOrder.total : '0'),
          paidAmount: insertOrder.paidAmount !== undefined ? insertOrder.paidAmount : (insertOrder.paymentStatus === 'partial' ? '0' : '0'),
        };
      }
      
      const result = await tx.insert(orders).values(orderData).returning();
      const newOrder = result[0];

      if (items.length > 0) {
        const orderItemsWithOrderId = items.map(item => ({
          ...item,
          orderId: newOrder.id,
          itemDiscount: item.itemDiscount || "0",
          itemDiscountType: item.itemDiscountType || "amount",
          selectedSize: (item as any).selectedSize || undefined,
        }));
        await tx.insert(orderItems).values(orderItemsWithOrderId);
      }

      return newOrder;
    });
  }

  async updateOrder(id: string, updates: Partial<InsertOrder>): Promise<Order | undefined> {
    return await db.transaction(async (tx) => {
      // If customerName is being updated and is provided, create or find customer
      if (!(updates as any).customerId && updates.customerName && updates.customerName.trim() && updates.customerName !== 'Walk-in Customer') {
        const customerName = updates.customerName.trim();
        
        // Try to find existing customer by name and phone (if provided)
        let existingCustomer;
        if (updates.customerPhone) {
          existingCustomer = await tx
            .select()
            .from(customers)
            .where(and(
              eq(customers.name, customerName),
              eq(customers.phone, updates.customerPhone)
            ))
            .limit(1);
        }
        
        // If not found by name+phone, try by name only
        if (!existingCustomer || existingCustomer.length === 0) {
          existingCustomer = await tx
            .select()
            .from(customers)
            .where(eq(customers.name, customerName))
            .limit(1);
        }
        
        let customerId: string;
        
        if (existingCustomer && existingCustomer.length > 0) {
          customerId = existingCustomer[0].id;
          // Update customer phone if provided and different
          if (updates.customerPhone && existingCustomer[0].phone !== updates.customerPhone) {
            await tx
              .update(customers)
              .set({ phone: updates.customerPhone })
              .where(eq(customers.id, customerId));
          }
        } else {
          // Get the current order to get branchId
          const currentOrder = await tx
            .select()
            .from(orders)
            .where(eq(orders.id, id))
            .limit(1);
          
          // Create new customer
          const newCustomerResult = await tx
            .insert(customers)
            .values({
              name: customerName,
              phone: updates.customerPhone || null,
              email: null,
              branchId: currentOrder[0]?.branchId || null,
              notes: null,
            })
            .returning();
          customerId = newCustomerResult[0].id;
        }
        
        // Set customer-related fields in updates
        updates.customerId = customerId;
        updates.customerName = customerName;
      }
      
      const result = await tx.update(orders).set(updates).where(eq(orders.id, id)).returning();
      return result[0];
    });
  }

  async updateOrderWithItems(id: string, updates: Partial<InsertOrder>, items: Omit<InsertOrderItem, 'orderId'>[]): Promise<Order | undefined> {
    return await db.transaction(async (tx) => {
      // Get the existing order to check current items for inventory restoration
      const existingOrder = await tx.select().from(orders).where(eq(orders.id, id)).limit(1);
      if (!existingOrder || existingOrder.length === 0) {
        return undefined;
      }
      
      // Get existing order items to restore inventory
      const existingItems = await tx.select().from(orderItems).where(eq(orderItems.orderId, id));
      
      // Restore inventory for existing items
      for (const item of existingItems) {
        const product = await tx.select().from(products).where(eq(products.id, item.productId)).limit(1);
        if (product && product[0]) {
          const currentStock = parseFloat(product[0].stock || "0");
          const newStock = currentStock + item.quantity;
          await tx.update(products).set({ stock: newStock.toString() }).where(eq(products.id, item.productId));
        }
      }
      
      // Delete existing order items
      await tx.delete(orderItems).where(eq(orderItems.orderId, id));
      
      const mergedPayload: any = { ...existingOrder[0], ...updates };
      const pricing = await this.resolveSubscriptionAndValidateTotalsInTx(tx, mergedPayload, items);
      Object.assign(updates, {
        subscriptionCardId: pricing.subscriptionCardId,
        subscriptionDiscount: pricing.subscriptionDiscount,
        subtotal: pricing.subtotal,
        total: pricing.total,
      });
      if (pricing.customerId) {
        (updates as any).customerId = pricing.customerId;
        (updates as any).customerName = pricing.customerName ?? (updates as any).customerName;
        (updates as any).customerPhone = pricing.customerPhone ?? (updates as any).customerPhone;
      }

      // Handle customer creation/update (same logic as updateOrder)
      if (!(updates as any).customerId && updates.customerName && updates.customerName.trim() && updates.customerName !== 'Walk-in Customer') {
        const customerName = updates.customerName.trim();
        
        let existingCustomer;
        if (updates.customerPhone) {
          existingCustomer = await tx
            .select()
            .from(customers)
            .where(and(
              eq(customers.name, customerName),
              eq(customers.phone, updates.customerPhone)
            ))
            .limit(1);
        }
        
        if (!existingCustomer || existingCustomer.length === 0) {
          existingCustomer = await tx
            .select()
            .from(customers)
            .where(eq(customers.name, customerName))
            .limit(1);
        }
        
        let customerId: string;
        
        if (existingCustomer && existingCustomer.length > 0) {
          customerId = existingCustomer[0].id;
          if (updates.customerPhone && existingCustomer[0].phone !== updates.customerPhone) {
            await tx
              .update(customers)
              .set({ phone: updates.customerPhone })
              .where(eq(customers.id, customerId));
          }
        } else {
          const newCustomerResult = await tx
            .insert(customers)
            .values({
              name: customerName,
              phone: updates.customerPhone || null,
              email: null,
              branchId: existingOrder[0].branchId || null,
              notes: null,
            })
            .returning();
          customerId = newCustomerResult[0].id;
        }
        
        updates.customerId = customerId;
        updates.customerName = customerName;
      }
      
      // Update the order
      const result = await tx.update(orders).set(updates).where(eq(orders.id, id)).returning();
      const updatedOrder = result[0];
      
      if (!updatedOrder) {
        return undefined;
      }
      
      // Create new order items and deduct inventory
      if (items.length > 0) {
        const orderItemsWithOrderId = items.map(item => ({
          ...item,
          orderId: id,
          itemDiscount: item.itemDiscount || "0",
          itemDiscountType: item.itemDiscountType || "amount",
          selectedSize: (item as any).selectedSize || undefined,
        }));
        await tx.insert(orderItems).values(orderItemsWithOrderId);
        
        // Deduct inventory for new items
        for (const item of items) {
          const product = await tx.select().from(products).where(eq(products.id, item.productId)).limit(1);
          if (product && product[0]) {
            const currentStock = parseFloat(product[0].stock || "0");
            const newStock = Math.max(0, currentStock - item.quantity);
            await tx.update(products).set({ stock: newStock.toString() }).where(eq(products.id, item.productId));
          }
        }
      }
      
      return updatedOrder;
    });
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const updateData: any = { status };
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }
    const result = await db.update(orders).set(updateData).where(eq(orders.id, id)).returning();
    return result[0];
  }

  async deleteOrder(id: string): Promise<boolean> {
    await db.delete(orderItems).where(eq(orderItems.orderId, id));
    const result = await db.delete(orders).where(eq(orders.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  async createOrderItem(insertOrderItem: InsertOrderItem): Promise<OrderItem> {
    const result = await db.insert(orderItems).values(insertOrderItem).returning();
    return result[0];
  }

  async deleteOrderItems(orderId: string): Promise<boolean> {
    const result = await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getOrderItemsWithProducts(orderId: string): Promise<(OrderItem & { product: Product })[]> {
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    
    const itemsWithProducts = await Promise.all(
      items.map(async (item) => {
        const product = await this.getProduct(item.productId);
        if (!product) {
          // Return a placeholder product if the actual product is deleted
          return {
            ...item,
            product: {
              id: item.productId,
              name: "Deleted Product",
              description: null,
              price: item.price,
              purchaseCost: null,
              categoryId: "",
              branchId: null,
              imageUrl: null,
              unit: "piece",
              quantity: "0",
              createdAt: new Date(),
            } as Product,
          };
        }
        return {
          ...item,
          product,
        };
      })
    );

    return itemsWithProducts;
  }

  async getTableCurrentOrder(tableId: string): Promise<Order | undefined> {
    const result = await db.select().from(orders)
      .where(and(
        eq(orders.tableId, tableId),
        or(eq(orders.status, 'draft'), eq(orders.status, 'confirmed'))
      ))
      .orderBy(desc(orders.createdAt));
    return result[0];
  }

  async getDashboardStats(startDate: Date, endDate: Date): Promise<{
    todaySales: number;
    todayOrders: number;
    totalRevenue: number;
    totalOrders: number;
    totalExpenses: number;
    totalStaffSalary: number;
    profitLoss: number;
    totalPurchase: number;
  }> {
    const completedOrders = await db.select().from(orders)
      .where(and(
        eq(orders.status, 'completed'),
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate)
      ));

    const todaySales = completedOrders.reduce((sum, order) => sum + parseFloat(order.total), 0);
    const totalSales = completedOrders.reduce((sum, order) => sum + parseFloat(order.total), 0);
    const totalDiscount = completedOrders.reduce((sum, order) => sum + parseFloat(order.discount), 0);

    const allPurchases = await db.select().from(purchases)
      .where(and(
        gte(purchases.purchaseDate, startDate),
        lte(purchases.purchaseDate, endDate)
      ));

    const totalPurchaseCost = allPurchases.reduce((sum, purchase) => {
      return sum + (parseFloat(purchase.price) * parseFloat(purchase.quantity));
    }, 0);

    const totalRevenue = totalSales - (totalPurchaseCost + totalDiscount);

    const allExpenses = await db.select().from(expenses)
      .where(and(
        gte(expenses.expenseDate, startDate),
        lte(expenses.expenseDate, endDate)
      ));

    const totalExpenses = allExpenses.reduce((sum, expense) => sum + parseFloat(expense.total), 0);

    // Get staff salaries for the period
    const allStaffSalaries = await db.select().from(staffSalaries)
      .where(and(
        gte(staffSalaries.salaryDate, startDate),
        lte(staffSalaries.salaryDate, endDate)
      ));

    const totalStaffSalary = allStaffSalaries.reduce((sum, salary) => sum + parseFloat(salary.totalSalary), 0);

    // Profit/Loss = Revenue - Expenses - Staff Salaries
    const profitLoss = totalRevenue - totalExpenses - totalStaffSalary;

    const allOrders = await db.select().from(orders).where(eq(orders.status, 'completed'));

    return {
      todaySales,
      todayOrders: completedOrders.length,
      totalRevenue,
      totalOrders: allOrders.length,
      totalExpenses,
      totalStaffSalary,
      profitLoss,
      totalPurchase: totalPurchaseCost,
    };
  }

  async getSalesByCategory(startDate: Date, endDate: Date): Promise<Array<{ category: string; revenue: number }>> {
    const completedOrders = await db.select().from(orders)
      .where(and(
        eq(orders.status, 'completed'),
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate)
      ));

    const categoryRevenue = new Map<string, number>();

    for (const order of completedOrders) {
      const items = await this.getOrderItems(order.id);
      for (const item of items) {
        const product = await this.getProduct(item.productId);
        if (product) {
          const category = await this.getCategory(product.categoryId);
          if (category) {
            const current = categoryRevenue.get(category.name) || 0;
            categoryRevenue.set(category.name, current + parseFloat(item.total));
          }
        }
      }
    }

    return Array.from(categoryRevenue.entries())
      .map(([category, revenue]) => ({ category, revenue }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  async getSalesByPaymentMethod(startDate: Date, endDate: Date): Promise<Array<{ paymentMethod: string; amount: number }>> {
    const completedOrders = await db.select().from(orders)
      .where(and(
        eq(orders.status, 'completed'),
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate)
      ));

    const paymentMethodTotals = new Map<string, number>();

    for (const order of completedOrders) {
      const paymentMethod = order.paymentMethod || 'Not specified';
      const current = paymentMethodTotals.get(paymentMethod) || 0;
      paymentMethodTotals.set(paymentMethod, current + parseFloat(order.total));
    }

    return Array.from(paymentMethodTotals.entries())
      .map(([paymentMethod, amount]) => ({ paymentMethod, amount }))
      .sort((a, b) => b.amount - a.amount);
  }

  async getPopularProducts(startDate: Date, endDate: Date): Promise<Array<{ product: string; quantity: number; revenue: number }>> {
    const completedOrders = await db.select().from(orders)
      .where(and(
        eq(orders.status, 'completed'),
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate)
      ));

    const productStats = new Map<string, { name: string; quantity: number; revenue: number }>();

    for (const order of completedOrders) {
      const items = await this.getOrderItems(order.id);
      for (const item of items) {
        const product = await this.getProduct(item.productId);
        if (product) {
          const current = productStats.get(product.id) || { name: product.name, quantity: 0, revenue: 0 };
          productStats.set(product.id, {
            name: product.name,
            quantity: current.quantity + item.quantity,
            revenue: current.revenue + parseFloat(item.total),
          });
        }
      }
    }

    return Array.from(productStats.values())
      .map(({ name, quantity, revenue }) => ({ product: name, quantity, revenue }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }

  async getSalesSummary(startDate: Date, endDate: Date): Promise<Array<{ product: string; quantity: number; revenue: number }>> {
    const completedOrders = await db.select().from(orders)
      .where(and(
        eq(orders.status, 'completed'),
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate)
      ));

    const productStats = new Map<string, { name: string; quantity: number; revenue: number }>();

    for (const order of completedOrders) {
      const items = await this.getOrderItems(order.id);
      for (const item of items) {
        const product = await this.getProduct(item.productId);
        if (product) {
          const current = productStats.get(product.id) || { name: product.name, quantity: 0, revenue: 0 };
          productStats.set(product.id, {
            name: product.name,
            quantity: current.quantity + item.quantity,
            revenue: current.revenue + parseFloat(item.total),
          });
        }
      }
    }

    return Array.from(productStats.values())
      .map(({ name, quantity, revenue }) => ({ product: name, quantity, revenue }))
      .sort((a, b) => a.product.localeCompare(b.product));
  }

  async getSalesSummaryPaginated(
    startDate: Date, 
    endDate: Date, 
    branchId?: string | null,
    limit: number = 50,
    offset: number = 0,
    search?: string
  ): Promise<{ items: Array<{ product: string; quantity: number; revenue: number }>; total: number }> {
    const conditions: any[] = [
      eq(orders.status, 'completed'),
      gte(orders.createdAt, startDate),
      lte(orders.createdAt, endDate),
    ];

    // Branch filter
    if (branchId) {
      conditions.push(eq(orders.branchId, branchId));
    }

    const whereClause = and(...conditions);

    const completedOrders = await db.select().from(orders).where(whereClause);

    const productStats = new Map<string, { name: string; quantity: number; revenue: number }>();

    for (const order of completedOrders) {
      const items = await this.getOrderItems(order.id);
      for (const item of items) {
        const product = await this.getProduct(item.productId);
        if (product) {
          const current = productStats.get(product.id) || { name: product.name, quantity: 0, revenue: 0 };
          productStats.set(product.id, {
            name: product.name,
            quantity: current.quantity + item.quantity,
            revenue: current.revenue + parseFloat(item.total),
          });
        }
      }
    }

    let allItems = Array.from(productStats.values())
      .map(({ name, quantity, revenue }) => ({ product: name, quantity, revenue }))
      .sort((a, b) => a.product.localeCompare(b.product));

    // Apply search filter if provided
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      allItems = allItems.filter(item => 
        item.product.toLowerCase().includes(searchLower)
      );
    }

    const total = allItems.length;

    // Apply pagination
    const paginatedItems = limit > 0 
      ? allItems.slice(offset, offset + limit)
      : allItems;

    return { items: paginatedItems, total };
  }

  async getRecentOrders(startDate: Date, endDate: Date): Promise<Order[]> {
    return await db.select().from(orders)
      .where(and(
        eq(orders.status, 'completed'),
        gte(orders.createdAt, startDate),
        lte(orders.createdAt, endDate)
      ))
      .orderBy(desc(orders.createdAt))
      .limit(10);
  }

  async getExpenseCategories(): Promise<ExpenseCategory[]> {
    return await db.select().from(expenseCategories);
  }

  async getExpenseCategory(id: string): Promise<ExpenseCategory | undefined> {
    const result = await db.select().from(expenseCategories).where(eq(expenseCategories.id, id));
    return result[0];
  }

  async createExpenseCategory(insertCategory: InsertExpenseCategory): Promise<ExpenseCategory> {
    const result = await db.insert(expenseCategories).values(insertCategory).returning();
    return result[0];
  }

  async updateExpenseCategory(id: string, updates: Partial<InsertExpenseCategory>): Promise<ExpenseCategory | undefined> {
    const result = await db.update(expenseCategories).set(updates).where(eq(expenseCategories.id, id)).returning();
    return result[0];
  }

  async deleteExpenseCategory(id: string): Promise<boolean> {
    const result = await db.delete(expenseCategories).where(eq(expenseCategories.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getExpenses(branchId?: string | null, dateFrom?: Date, dateTo?: Date, months?: string[], categoryId?: string | null): Promise<Expense[]> {
    const conditions: any[] = [];
    if (branchId) {
      conditions.push(eq(expenses.branchId, branchId));
    }
    if (categoryId) {
      conditions.push(eq(expenses.categoryId, categoryId));
    }
    if (dateFrom) {
      conditions.push(gte(expenses.expenseDate, dateFrom));
    }
    if (dateTo) conditions.push(lte(expenses.expenseDate, dateTo));
    if (months && months.length > 0 && !(dateFrom && dateTo)) {
      const monthConditions = months.map((m) => {
        const parts = m.trim().split("-");
        const y = parseInt(parts[0], 10);
        const mo = parseInt(parts[1], 10);
        if (isNaN(y) || isNaN(mo)) return null;
        return sql`(EXTRACT(YEAR FROM ${expenses.expenseDate})::int = ${y} AND EXTRACT(MONTH FROM ${expenses.expenseDate})::int = ${mo})`;
      }).filter(Boolean);
      if (monthConditions.length > 0) {
        conditions.push(or(...monthConditions));
      }
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    return await db.select().from(expenses).where(whereClause);
  }

  async getExpenseStats(branchId?: string | null, dateFrom?: Date, dateTo?: Date, months?: string[], categoryId?: string | null): Promise<{ totalAmount: number; count: number; avgExpense: number; categoryCount: number }> {
    const conditions: any[] = [];
    if (branchId) conditions.push(eq(expenses.branchId, branchId));
    if (categoryId) conditions.push(eq(expenses.categoryId, categoryId));
    if (dateFrom) conditions.push(gte(expenses.expenseDate, dateFrom));
    if (dateTo) conditions.push(lte(expenses.expenseDate, dateTo));
    if (months && months.length > 0 && !(dateFrom && dateTo)) {
      const monthConditions = months.map((m) => {
        const parts = m.trim().split("-");
        const y = parseInt(parts[0], 10);
        const mo = parseInt(parts[1], 10);
        if (isNaN(y) || isNaN(mo)) return null;
        return sql`(EXTRACT(YEAR FROM ${expenses.expenseDate})::int = ${y} AND EXTRACT(MONTH FROM ${expenses.expenseDate})::int = ${mo})`;
      }).filter(Boolean);
      if (monthConditions.length > 0) conditions.push(or(...monthConditions));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    let query = db.select({
      totalAmount: sql<string>`COALESCE(SUM(CAST(${expenses.total} AS DECIMAL)), 0)`,
      count: sql<number>`count(*)`,
      categoryCount: sql<number>`COUNT(DISTINCT ${expenses.categoryId})`,
    }).from(expenses);
    if (whereClause) query = query.where(whereClause) as any;
    const rows = await query;
    const totalAmount = parseFloat(rows[0]?.totalAmount || "0");
    const count = Number(rows[0]?.count || 0);
    const categoryCount = Number(rows[0]?.categoryCount || 0);
    const avgExpense = count > 0 ? totalAmount / count : 0;
    return { totalAmount, count, avgExpense, categoryCount };
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    const result = await db.select().from(expenses).where(eq(expenses.id, id));
    return result[0];
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const result = await db.insert(expenses).values(insertExpense).returning();
    return result[0];
  }

  async updateExpense(id: string, updates: Partial<InsertExpense>): Promise<Expense | undefined> {
    const result = await db.update(expenses).set(updates).where(eq(expenses.id, id)).returning();
    return result[0];
  }

  async deleteExpense(id: string): Promise<boolean> {
    const result = await db.delete(expenses).where(eq(expenses.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getPurchases(branchId?: string | null): Promise<Purchase[]> {
    if (branchId) {
      return await db.select().from(purchases).where(eq(purchases.branchId, branchId));
    }
    return await db.select().from(purchases);
  }

  async getPurchase(id: string): Promise<Purchase | undefined> {
    const result = await db.select().from(purchases).where(eq(purchases.id, id));
    return result[0];
  }

  async createPurchase(insertPurchase: InsertPurchase): Promise<Purchase> {
    const result = await db.insert(purchases).values(insertPurchase).returning();
    const purchase = result[0];
    
    let product: Product | undefined;
    
    // First, try to find product by productId if provided
    if (insertPurchase.productId) {
      product = await this.getProduct(insertPurchase.productId);
    }
    
    // If product not found by ID, try to find by name
    if (!product && insertPurchase.itemName) {
      product = await this.getProductByName(insertPurchase.itemName);
    }
    
    // Update inventory if product found
    if (product) {
      const currentQty = parseFloat(product.quantity || "0");
      const purchasedQty = parseFloat(insertPurchase.quantity);
      
      // Calculate quantity to add based on pieces per unit if available
      let quantityToAdd = purchasedQty;
      
      // If purchase has piecesPerUnit, calculate total pieces
      if (insertPurchase.piecesPerUnit) {
        const piecesPerUnit = parseFloat(insertPurchase.piecesPerUnit);
        const totalPieces = purchasedQty * piecesPerUnit;
        
        // If product unit is "piece", add total pieces
        if (product.unit === "piece") {
          quantityToAdd = totalPieces;
        } else if (product.unit === insertPurchase.unit) {
          // If units match, add the purchased quantity
          quantityToAdd = purchasedQty;
        } else {
          // If units don't match but we have pieces info, add total pieces if product is in pieces
          // Otherwise, add the purchased quantity as-is
          quantityToAdd = product.unit === "piece" ? totalPieces : purchasedQty;
        }
      } else {
        // No pieces info, check if units match
        if (product.unit === insertPurchase.unit) {
          quantityToAdd = purchasedQty;
        } else {
          // Units don't match, add as-is (might need manual adjustment)
          quantityToAdd = purchasedQty;
        }
      }
      
      const newQty = currentQty + quantityToAdd;
      
      await db.update(products)
        .set({ quantity: newQty.toString() })
        .where(eq(products.id, product.id));
      
      await db.insert(inventoryAdjustments).values({
        productId: product.id,
        adjustmentType: "add",
        quantity: quantityToAdd.toString(),
        reason: "purchase",
        notes: `Automatic addition from purchase - ${insertPurchase.itemName} (${insertPurchase.quantity} ${insertPurchase.unit}${insertPurchase.piecesPerUnit ? `, ${insertPurchase.piecesPerUnit} pieces/${insertPurchase.unit}` : ''})`,
        performedBy: null,
      });
    }
    
    return purchase;
  }

  async updatePurchase(id: string, updates: Partial<InsertPurchase>): Promise<Purchase | undefined> {
    const purchase = await this.getPurchase(id);
    if (!purchase) return undefined;
    
    // Find product by ID or name
    let product: Product | undefined;
    if (purchase.productId) {
      product = await this.getProduct(purchase.productId);
    }
    if (!product && purchase.itemName) {
      product = await this.getProductByName(purchase.itemName);
    }
    
    // Handle inventory update if quantity changed
    if (product && updates.quantity !== undefined) {
      const oldQty = parseFloat(purchase.quantity);
      const newQty = parseFloat(updates.quantity);
      
      // Calculate old quantity to add (from original purchase)
      let oldQuantityToAdd = oldQty;
      if (purchase.piecesPerUnit) {
        const piecesPerUnit = parseFloat(purchase.piecesPerUnit);
        const totalPieces = oldQty * piecesPerUnit;
        if (product.unit === "piece") {
          oldQuantityToAdd = totalPieces;
        } else if (product.unit === purchase.unit) {
          oldQuantityToAdd = oldQty;
        } else {
          oldQuantityToAdd = product.unit === "piece" ? totalPieces : oldQty;
        }
      } else if (product.unit !== purchase.unit) {
        oldQuantityToAdd = oldQty; // Keep as-is if units don't match
      }
      
      // Calculate new quantity to add (from updated purchase)
      const updatedPiecesPerUnit = updates.piecesPerUnit || purchase.piecesPerUnit;
      const updatedUnit = updates.unit || purchase.unit;
      let newQuantityToAdd = newQty;
      if (updatedPiecesPerUnit) {
        const piecesPerUnit = parseFloat(updatedPiecesPerUnit);
        const totalPieces = newQty * piecesPerUnit;
        if (product.unit === "piece") {
          newQuantityToAdd = totalPieces;
        } else if (product.unit === updatedUnit) {
          newQuantityToAdd = newQty;
        } else {
          newQuantityToAdd = product.unit === "piece" ? totalPieces : newQty;
        }
      } else if (product.unit !== updatedUnit) {
        newQuantityToAdd = newQty; // Keep as-is if units don't match
      }
      
      const delta = newQuantityToAdd - oldQuantityToAdd;
      
      if (delta !== 0) {
        const currentInventory = parseFloat(product.quantity || "0");
        const newInventory = Math.max(0, currentInventory + delta);
        
        await db.update(products)
          .set({ quantity: newInventory.toString() })
          .where(eq(products.id, product.id));
        
        await db.insert(inventoryAdjustments).values({
          productId: product.id,
          adjustmentType: delta > 0 ? "add" : "remove",
          quantity: Math.abs(delta).toString(),
          reason: "purchase",
          notes: `Adjustment from purchase update - ${purchase.itemName} (changed from ${oldQty} ${purchase.unit} to ${newQty} ${updatedUnit})`,
          performedBy: null,
        });
      }
    }
    
    const result = await db.update(purchases).set(updates).where(eq(purchases.id, id)).returning();
    return result[0];
  }

  async deletePurchase(id: string): Promise<boolean> {
    const purchase = await this.getPurchase(id);
    if (!purchase) return false;
    
    // Find product by ID or name
    let product: Product | undefined;
    if (purchase.productId) {
      product = await this.getProduct(purchase.productId);
    }
    if (!product && purchase.itemName) {
      product = await this.getProductByName(purchase.itemName);
    }
    
    if (product) {
      const purchasedQty = parseFloat(purchase.quantity);
      
      // Calculate quantity to remove based on pieces per unit if available
      let quantityToRemove = purchasedQty;
      if (purchase.piecesPerUnit) {
        const piecesPerUnit = parseFloat(purchase.piecesPerUnit);
        const totalPieces = purchasedQty * piecesPerUnit;
        if (product.unit === "piece") {
          quantityToRemove = totalPieces;
        } else if (product.unit === purchase.unit) {
          quantityToRemove = purchasedQty;
        } else {
          quantityToRemove = product.unit === "piece" ? totalPieces : purchasedQty;
        }
      } else if (product.unit !== purchase.unit) {
        quantityToRemove = purchasedQty; // Keep as-is if units don't match
      }
      
      const currentInventory = parseFloat(product.quantity || "0");
      const newInventory = Math.max(0, currentInventory - quantityToRemove);
      
      await db.update(products)
        .set({ quantity: newInventory.toString() })
        .where(eq(products.id, product.id));
      
      await db.insert(inventoryAdjustments).values({
        productId: product.id,
        adjustmentType: "remove",
        quantity: quantityToRemove.toString(),
        reason: "purchase",
        notes: `Reversal from purchase deletion - ${purchase.itemName} (${purchase.quantity} ${purchase.unit}${purchase.piecesPerUnit ? `, ${purchase.piecesPerUnit} pieces/${purchase.unit}` : ''})`,
        performedBy: null,
      });
    }
    
    const result = await db.delete(purchases).where(eq(purchases.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getEmployees(branchId?: string | null): Promise<Employee[]> {
    if (branchId) {
      return await db.select().from(employees).where(eq(employees.branchId, branchId));
    }
    return await db.select().from(employees);
  }

  async getEmployeesPaginated(opts: { branchId?: string | null; limit: number; offset: number; search?: string; status?: string; joinDateFrom?: Date; joinDateTo?: Date }): Promise<{ employees: Employee[]; total: number }> {
    const conditions: any[] = [];
    if (opts.branchId) conditions.push(eq(employees.branchId, opts.branchId));
    if (opts.status && opts.status !== "all") conditions.push(eq(employees.status, opts.status));
    if (opts.joinDateFrom) conditions.push(gte(employees.joiningDate, opts.joinDateFrom));
    if (opts.joinDateTo) {
      const endOfDay = new Date(opts.joinDateTo);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(lte(employees.joiningDate, endOfDay));
    }
    if (opts.search && opts.search.trim()) {
      const term = `%${opts.search.trim().toLowerCase()}%`;
      conditions.push(
        or(
          sql`LOWER(${employees.name}) LIKE ${term}`,
          sql`LOWER(${employees.employeeId}) LIKE ${term}`,
          sql`LOWER(${employees.position}) LIKE ${term}`,
          sql`LOWER(${employees.department}) LIKE ${term}`,
          sql`LOWER(COALESCE(${employees.email}, '')) LIKE ${term}`,
          sql`LOWER(COALESCE(${employees.phone}, '')) LIKE ${term}`
        )!
      );
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(employees).where(whereClause);
    const total = Number(countResult[0]?.count ?? 0);
    let query = db.select().from(employees).where(whereClause).orderBy(desc(employees.createdAt));
    if (opts.limit > 0) query = query.limit(opts.limit) as any;
    if (opts.offset > 0) query = query.offset(opts.offset) as any;
    const list = await query;
    return { employees: list, total };
  }

  async getNextEmployeeId(branchId?: string | null): Promise<string> {
    const list = await this.getEmployees(branchId);
    let maxNum = 0;
    for (const e of list) {
      const match = /^E(\d+)$/i.exec(e.employeeId?.trim() ?? "");
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
    return `E${String(maxNum + 1).padStart(3, "0")}`;
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    const result = await db.select().from(employees).where(eq(employees.id, id));
    return result[0];
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const result = await db.insert(employees).values(insertEmployee).returning();
    return result[0];
  }

  async updateEmployee(id: string, updates: Partial<InsertEmployee>): Promise<Employee | undefined> {
    const result = await db.update(employees).set(updates).where(eq(employees.id, id)).returning();
    return result[0];
  }

  async deleteEmployee(id: string): Promise<boolean> {
    const result = await db.delete(employees).where(eq(employees.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getPositions(): Promise<Position[]> {
    return await db.select().from(positions).orderBy(asc(positions.name));
  }

  async getPosition(id: string): Promise<Position | undefined> {
    const result = await db.select().from(positions).where(eq(positions.id, id));
    return result[0];
  }

  async createPosition(insertPosition: InsertPosition): Promise<Position> {
    const result = await db.insert(positions).values(insertPosition).returning();
    return result[0];
  }

  async updatePosition(id: string, updates: Partial<InsertPosition>): Promise<Position | undefined> {
    const result = await db.update(positions).set(updates).where(eq(positions.id, id)).returning();
    return result[0];
  }

  async deletePosition(id: string): Promise<boolean> {
    const result = await db.delete(positions).where(eq(positions.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getDepartments(): Promise<Department[]> {
    return await db.select().from(departments).orderBy(asc(departments.name));
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    const result = await db.select().from(departments).where(eq(departments.id, id));
    return result[0];
  }

  async createDepartment(insertDepartment: InsertDepartment): Promise<Department> {
    const result = await db.insert(departments).values(insertDepartment).returning();
    return result[0];
  }

  async updateDepartment(id: string, updates: Partial<InsertDepartment>): Promise<Department | undefined> {
    const result = await db.update(departments).set(updates).where(eq(departments.id, id)).returning();
    return result[0];
  }

  async deleteDepartment(id: string): Promise<boolean> {
    const result = await db.delete(departments).where(eq(departments.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getAttendance(): Promise<Attendance[]> {
    return await db.select().from(attendance);
  }

  async getAttendanceByDate(date: Date): Promise<Attendance[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return await db.select().from(attendance)
      .where(and(
        gte(attendance.date, startOfDay),
        lte(attendance.date, endOfDay)
      ));
  }

  async getAttendanceByEmployee(employeeId: string): Promise<Attendance[]> {
    return await db.select().from(attendance).where(eq(attendance.employeeId, employeeId));
  }

  async getAttendanceStats(): Promise<{
    totalRecords: number;
    presentToday: number;
    absentToday: number;
    avgHours: number;
  }> {
    // Get current date starting from midnight (12:00 AM)
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all active employees
    const allEmployees = await db.select().from(employees).where(eq(employees.status, "active"));
    const totalActiveEmployees = allEmployees.length;

    // Get all attendance records from today (from midnight)
    const todayAttendance = await db.select().from(attendance)
      .where(and(
        gte(attendance.date, startOfDay),
        lte(attendance.date, endOfDay)
      ));

    // Count employees with check-in from midnight onwards
    const employeesWithCheckIn = new Set(
      todayAttendance
        .filter(record => record.checkIn && record.checkIn.trim() !== "")
        .map(record => record.employeeId)
    );

    const presentToday = employeesWithCheckIn.size;
    const absentToday = Math.max(0, totalActiveEmployees - presentToday);

    // Calculate average working hours
    let totalHours = 0;
    let recordsWithHours = 0;

    for (const record of todayAttendance) {
      if (record.checkIn && record.checkOut) {
        try {
          // Parse time strings (format: "HH:mm" or "HH:mm:ss")
          const parseTime = (timeStr: string): number => {
            const parts = timeStr.trim().split(":");
            const hours = parseInt(parts[0], 10) || 0;
            const minutes = parseInt(parts[1], 10) || 0;
            return hours + minutes / 60;
          };

          const checkInHours = parseTime(record.checkIn);
          let checkOutHours = parseTime(record.checkOut);
          
          // Handle next day check-out (if check-out time is earlier than check-in, assume next day)
          if (checkOutHours < checkInHours) {
            checkOutHours += 24; // Add 24 hours for next day
          }
          
          const hours = checkOutHours - checkInHours;
          if (hours > 0) {
            totalHours += hours;
            recordsWithHours++;
          }
        } catch (error) {
          // Skip invalid time formats
        }
      }
    }

    const avgHours = recordsWithHours > 0 ? totalHours / recordsWithHours : 0;

    return {
      totalRecords: todayAttendance.length,
      presentToday,
      absentToday,
      avgHours: Math.round(avgHours * 10) / 10, // Round to 1 decimal place
    };
  }

  async createAttendance(insertAttendance: InsertAttendance): Promise<Attendance> {
    const result = await db.insert(attendance).values(insertAttendance).returning();
    return result[0];
  }

  async updateAttendance(id: string, updates: Partial<InsertAttendance>): Promise<Attendance | undefined> {
    const result = await db.update(attendance).set(updates).where(eq(attendance.id, id)).returning();
    return result[0];
  }

  async deleteAttendance(id: string): Promise<boolean> {
    const result = await db.delete(attendance).where(eq(attendance.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getLeaves(): Promise<Leave[]> {
    return await db.select().from(leaves);
  }

  async getLeave(id: string): Promise<Leave | undefined> {
    const result = await db.select().from(leaves).where(eq(leaves.id, id));
    return result[0];
  }

  async getLeavesByEmployee(employeeId: string): Promise<Leave[]> {
    return await db.select().from(leaves).where(eq(leaves.employeeId, employeeId));
  }

  async createLeave(insertLeave: InsertLeave): Promise<Leave> {
    const result = await db.insert(leaves).values(insertLeave).returning();
    return result[0];
  }

  async updateLeave(id: string, updates: Partial<InsertLeave>): Promise<Leave | undefined> {
    const result = await db.update(leaves).set(updates).where(eq(leaves.id, id)).returning();
    return result[0];
  }

  async deleteLeave(id: string): Promise<boolean> {
    const result = await db.delete(leaves).where(eq(leaves.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getPayroll(): Promise<Payroll[]> {
    return await db.select().from(payroll);
  }

  async getPayrollById(id: string): Promise<Payroll | undefined> {
    const result = await db.select().from(payroll).where(eq(payroll.id, id));
    return result[0];
  }

  async getPayrollByEmployee(employeeId: string): Promise<Payroll[]> {
    return await db.select().from(payroll).where(eq(payroll.employeeId, employeeId));
  }

  async createPayroll(insertPayroll: InsertPayroll): Promise<Payroll> {
    const result = await db.insert(payroll).values(insertPayroll).returning();
    return result[0];
  }

  async updatePayroll(id: string, updates: Partial<InsertPayroll>): Promise<Payroll | undefined> {
    const result = await db.update(payroll).set(updates).where(eq(payroll.id, id)).returning();
    return result[0];
  }

  async deletePayroll(id: string): Promise<boolean> {
    const result = await db.delete(payroll).where(eq(payroll.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getStaffSalaries(): Promise<StaffSalary[]> {
    return await db.select().from(staffSalaries);
  }

  async getStaffSalary(id: string): Promise<StaffSalary | undefined> {
    const result = await db.select().from(staffSalaries).where(eq(staffSalaries.id, id));
    return result[0];
  }

  async getStaffSalariesByEmployee(employeeId: string): Promise<StaffSalary[]> {
    return await db.select().from(staffSalaries).where(eq(staffSalaries.employeeId, employeeId)).orderBy(desc(staffSalaries.salaryDate));
  }

  async createStaffSalary(insertSalary: InsertStaffSalary): Promise<StaffSalary> {
    const result = await db.insert(staffSalaries).values(insertSalary).returning();
    return result[0];
  }

  async updateStaffSalary(id: string, updates: Partial<InsertStaffSalary>): Promise<StaffSalary | undefined> {
    const result = await db.update(staffSalaries).set(updates).where(eq(staffSalaries.id, id)).returning();
    return result[0];
  }

  async deleteStaffSalary(id: string): Promise<boolean> {
    const result = await db.delete(staffSalaries).where(eq(staffSalaries.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getEmployeesPayableSummary(branchId?: string | null): Promise<{ totalPayable: number; totalDeduction: number }> {
    const list = await this.getEmployees(branchId);
    const ids = list.map((e) => e.id);
    if (ids.length === 0) return { totalPayable: 0, totalDeduction: 0 };
    const [pendingDed, pendingAdv, lastCarried, pendingPrevDue, pendingLoan, pendingUL] = await Promise.all([
      this.getPendingDeductionsTotalsByEmployeeIds(ids),
      this.getPendingAdvancesTotalsByEmployeeIds(ids),
      this.getLastCarriedByEmployeeIds(ids),
      this.getPendingPreviousDueTotalsByEmployeeIds(ids),
      this.getPendingLoanTotalsByEmployeeIds(ids),
      this.getPendingUnpaidLeaveTotalsByEmployeeIds(ids),
    ]);
    let totalPayable = 0;
    let totalDeduction = 0;
    for (const e of list) {
      const base = parseFloat(e.salary);
      const ded = pendingDed[e.id] ?? 0;
      totalDeduction += ded;
      totalPayable += base + (lastCarried[e.id] ?? 0) + (pendingPrevDue[e.id] ?? 0) - ded - (pendingAdv[e.id] ?? 0) - (pendingLoan[e.id] ?? 0) - (pendingUL[e.id] ?? 0);
    }
    return { totalPayable, totalDeduction };
  }

  async getDeductionsByEmployee(employeeId: string, status?: "pending" | "applied"): Promise<StaffDeduction[]> {
    const conditions = [eq(staffDeductions.employeeId, employeeId)];
    if (status) conditions.push(eq(staffDeductions.status, status));
    return await db.select().from(staffDeductions).where(and(...conditions)).orderBy(desc(staffDeductions.createdAt));
  }

  async createStaffDeduction(data: InsertStaffDeduction): Promise<StaffDeduction> {
    const result = await db.insert(staffDeductions).values(data).returning();
    return result[0];
  }

  async updateStaffDeduction(id: string, data: Partial<Pick<StaffDeduction, "amount" | "reason">>): Promise<StaffDeduction | undefined> {
    const updates: Record<string, unknown> = {};
    if (data.amount !== undefined) updates.amount = String(data.amount);
    if (data.reason !== undefined) updates.reason = data.reason;
    if (Object.keys(updates).length === 0) return this.getStaffDeduction(id);
    const result = await db.update(staffDeductions).set(updates).where(eq(staffDeductions.id, id)).returning();
    return result[0];
  }

  async deleteStaffDeduction(id: string): Promise<boolean> {
    const result = await db.delete(staffDeductions).where(eq(staffDeductions.id, id));
    return result.rowCount != null && result.rowCount > 0;
  }

  async getStaffDeduction(id: string): Promise<StaffDeduction | undefined> {
    const rows = await db.select().from(staffDeductions).where(eq(staffDeductions.id, id));
    return rows[0];
  }

  async getAdvancesByEmployee(employeeId: string, status?: "pending" | "deducted"): Promise<StaffAdvance[]> {
    const conditions = [eq(staffAdvances.employeeId, employeeId)];
    if (status) conditions.push(eq(staffAdvances.status, status));
    return await db.select().from(staffAdvances).where(and(...conditions)).orderBy(desc(staffAdvances.createdAt));
  }

  async createStaffAdvance(data: InsertStaffAdvance): Promise<StaffAdvance> {
    const result = await db.insert(staffAdvances).values(data).returning();
    return result[0];
  }

  async updateStaffAdvance(id: string, data: Partial<Pick<StaffAdvance, "amount" | "note">>): Promise<StaffAdvance | undefined> {
    const updates: Record<string, unknown> = {};
    if (data.amount !== undefined) updates.amount = String(data.amount);
    if (data.note !== undefined) updates.note = data.note;
    if (Object.keys(updates).length === 0) return this.getStaffAdvance(id);
    const result = await db.update(staffAdvances).set(updates).where(eq(staffAdvances.id, id)).returning();
    return result[0];
  }

  async deleteStaffAdvance(id: string): Promise<boolean> {
    const result = await db.delete(staffAdvances).where(eq(staffAdvances.id, id));
    return result.rowCount != null && result.rowCount > 0;
  }

  async getStaffAdvance(id: string): Promise<StaffAdvance | undefined> {
    const rows = await db.select().from(staffAdvances).where(eq(staffAdvances.id, id));
    return rows[0];
  }

  async getPendingDeductionsTotalsByEmployeeIds(employeeIds: string[]): Promise<Record<string, number>> {
    if (employeeIds.length === 0) return {};
    const rows = await db.select({
      employeeId: staffDeductions.employeeId,
      total: sql<string>`COALESCE(SUM(${staffDeductions.amount}::numeric), 0)`,
    }).from(staffDeductions).where(and(eq(staffDeductions.status, "pending"), inArray(staffDeductions.employeeId, employeeIds))).groupBy(staffDeductions.employeeId);
    const out: Record<string, number> = {};
    for (const id of employeeIds) out[id] = 0;
    for (const r of rows) out[r.employeeId] = parseFloat(r.total);
    return out;
  }

  async getPendingAdvancesTotalsByEmployeeIds(employeeIds: string[]): Promise<Record<string, number>> {
    if (employeeIds.length === 0) return {};
    const rows = await db.select({
      employeeId: staffAdvances.employeeId,
      total: sql<string>`COALESCE(SUM(${staffAdvances.amount}::numeric), 0)`,
    }).from(staffAdvances).where(and(eq(staffAdvances.status, "pending"), inArray(staffAdvances.employeeId, employeeIds))).groupBy(staffAdvances.employeeId);
    const out: Record<string, number> = {};
    for (const id of employeeIds) out[id] = 0;
    for (const r of rows) out[r.employeeId] = parseFloat(r.total);
    return out;
  }

  async getPendingPreviousDueTotalsByEmployeeIds(employeeIds: string[]): Promise<Record<string, number>> {
    if (employeeIds.length === 0) return {};
    const rows = await db.select({
      employeeId: staffPreviousDue.employeeId,
      total: sql<string>`COALESCE(SUM(${staffPreviousDue.amount}::numeric), 0)`,
    }).from(staffPreviousDue).where(and(eq(staffPreviousDue.status, "pending"), inArray(staffPreviousDue.employeeId, employeeIds))).groupBy(staffPreviousDue.employeeId);
    const out: Record<string, number> = {};
    for (const id of employeeIds) out[id] = 0;
    for (const r of rows) out[r.employeeId] = parseFloat(r.total);
    return out;
  }

  async getPreviousDueByEmployee(employeeId: string, status?: "pending" | "settled"): Promise<StaffPreviousDue[]> {
    const conditions = [eq(staffPreviousDue.employeeId, employeeId)];
    if (status) conditions.push(eq(staffPreviousDue.status, status));
    return await db.select().from(staffPreviousDue).where(and(...conditions)).orderBy(desc(staffPreviousDue.createdAt));
  }

  async createStaffPreviousDue(data: InsertStaffPreviousDue): Promise<StaffPreviousDue> {
    const result = await db.insert(staffPreviousDue).values(data).returning();
    return result[0];
  }

  async updateStaffPreviousDue(id: string, data: Partial<Pick<StaffPreviousDue, "amount" | "note">>): Promise<StaffPreviousDue | undefined> {
    const updates: Record<string, unknown> = {};
    if (data.amount !== undefined) updates.amount = String(data.amount);
    if (data.note !== undefined) updates.note = data.note;
    if (Object.keys(updates).length === 0) return this.getStaffPreviousDue(id);
    const result = await db.update(staffPreviousDue).set(updates).where(eq(staffPreviousDue.id, id)).returning();
    return result[0];
  }

  async deleteStaffPreviousDue(id: string): Promise<boolean> {
    const result = await db.delete(staffPreviousDue).where(eq(staffPreviousDue.id, id));
    return result.rowCount != null && result.rowCount > 0;
  }

  async getStaffPreviousDue(id: string): Promise<StaffPreviousDue | undefined> {
    const rows = await db.select().from(staffPreviousDue).where(eq(staffPreviousDue.id, id));
    return rows[0];
  }

  async getPendingLoanTotalsByEmployeeIds(employeeIds: string[]): Promise<Record<string, number>> {
    if (employeeIds.length === 0) return {};
    const rows = await db.select({
      employeeId: staffLoans.employeeId,
      total: sql<string>`COALESCE(SUM(${staffLoans.amount}::numeric), 0)`,
    }).from(staffLoans).where(and(eq(staffLoans.status, "pending"), inArray(staffLoans.employeeId, employeeIds))).groupBy(staffLoans.employeeId);
    const out: Record<string, number> = {};
    for (const id of employeeIds) out[id] = 0;
    for (const r of rows) out[r.employeeId] = parseFloat(r.total);
    return out;
  }

  async getLoansByEmployee(employeeId: string, status?: "pending" | "settled"): Promise<StaffLoan[]> {
    const conditions = [eq(staffLoans.employeeId, employeeId)];
    if (status) conditions.push(eq(staffLoans.status, status));
    return await db.select().from(staffLoans).where(and(...conditions)).orderBy(desc(staffLoans.createdAt));
  }

  async createStaffLoan(data: InsertStaffLoan): Promise<StaffLoan> {
    const result = await db.insert(staffLoans).values(data).returning();
    return result[0];
  }

  async updateStaffLoan(id: string, data: Partial<Pick<StaffLoan, "amount" | "note">>): Promise<StaffLoan | undefined> {
    const updates: Record<string, unknown> = {};
    if (data.amount !== undefined) updates.amount = String(data.amount);
    if (data.note !== undefined) updates.note = data.note;
    if (Object.keys(updates).length === 0) return this.getStaffLoan(id);
    const result = await db.update(staffLoans).set(updates).where(eq(staffLoans.id, id)).returning();
    return result[0];
  }

  async deleteStaffLoan(id: string): Promise<boolean> {
    const result = await db.delete(staffLoans).where(eq(staffLoans.id, id));
    return result.rowCount != null && result.rowCount > 0;
  }

  async getStaffLoan(id: string): Promise<StaffLoan | undefined> {
    const rows = await db.select().from(staffLoans).where(eq(staffLoans.id, id));
    return rows[0];
  }

  async getPendingUnpaidLeaveTotalsByEmployeeIds(employeeIds: string[]): Promise<Record<string, number>> {
    if (employeeIds.length === 0) return {};
    const rows = await db.select({
      employeeId: staffUnpaidLeave.employeeId,
      total: sql<string>`COALESCE(SUM(${staffUnpaidLeave.amount}::numeric), 0)`,
    }).from(staffUnpaidLeave).where(and(eq(staffUnpaidLeave.status, "pending"), inArray(staffUnpaidLeave.employeeId, employeeIds))).groupBy(staffUnpaidLeave.employeeId);
    const out: Record<string, number> = {};
    for (const id of employeeIds) out[id] = 0;
    for (const r of rows) out[r.employeeId] = parseFloat(r.total);
    return out;
  }

  async getUnpaidLeaveByEmployee(employeeId: string, status?: "pending" | "applied"): Promise<StaffUnpaidLeave[]> {
    const conditions = [eq(staffUnpaidLeave.employeeId, employeeId)];
    if (status) conditions.push(eq(staffUnpaidLeave.status, status));
    return await db.select().from(staffUnpaidLeave).where(and(...conditions)).orderBy(desc(staffUnpaidLeave.createdAt));
  }

  async createStaffUnpaidLeave(data: InsertStaffUnpaidLeave): Promise<StaffUnpaidLeave> {
    const result = await db.insert(staffUnpaidLeave).values(data).returning();
    return result[0];
  }

  async updateStaffUnpaidLeave(id: string, data: Partial<Pick<StaffUnpaidLeave, "amount" | "note">>): Promise<StaffUnpaidLeave | undefined> {
    const updates: Record<string, unknown> = {};
    if (data.amount !== undefined) updates.amount = String(data.amount);
    if (data.note !== undefined) updates.note = data.note;
    if (Object.keys(updates).length === 0) return this.getStaffUnpaidLeave(id);
    const result = await db.update(staffUnpaidLeave).set(updates).where(eq(staffUnpaidLeave.id, id)).returning();
    return result[0];
  }

  async deleteStaffUnpaidLeave(id: string): Promise<boolean> {
    const result = await db.delete(staffUnpaidLeave).where(eq(staffUnpaidLeave.id, id));
    return result.rowCount != null && result.rowCount > 0;
  }

  async getStaffUnpaidLeave(id: string): Promise<StaffUnpaidLeave | undefined> {
    const rows = await db.select().from(staffUnpaidLeave).where(eq(staffUnpaidLeave.id, id));
    return rows[0];
  }

  async getLastCarriedByEmployeeIds(employeeIds: string[]): Promise<Record<string, number>> {
    if (employeeIds.length === 0) return {};
    const out: Record<string, number> = {};
    for (const id of employeeIds) out[id] = 0;
    const salaries = await db.select().from(staffSalaries).where(inArray(staffSalaries.employeeId, employeeIds)).orderBy(desc(staffSalaries.salaryDate));
    const seen = new Set<string>();
    for (const s of salaries) {
      if (!seen.has(s.employeeId)) {
        seen.add(s.employeeId);
        out[s.employeeId] = parseFloat(s.carriedUnreleased ?? "0");
      }
    }
    return out;
  }

  async getStaffSalariesWithEmployees(startDate?: Date, endDate?: Date): Promise<Array<StaffSalary & { employee: Employee | null }>> {
    const conditions = [];
    if (startDate) {
      conditions.push(gte(staffSalaries.salaryDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(staffSalaries.salaryDate, endDate));
    }

    let salariesQuery = db.select().from(staffSalaries);
    if (conditions.length > 0) {
      salariesQuery = salariesQuery.where(and(...conditions)) as any;
    }
    const allSalaries = await salariesQuery.orderBy(desc(staffSalaries.salaryDate));

    // Get employee details for each salary
    const result = await Promise.all(
      allSalaries.map(async (salary) => {
        const employee = await this.getEmployee(salary.employeeId);
        return { ...salary, employee: employee || null };
      })
    );

    return result;
  }

  async getStaffSalarySummary(startDate?: Date, endDate?: Date): Promise<{
    totalSalaries: number;
    totalAmount: number;
    totalDeductions: number;
    netTotal: number;
    employeeCount: number;
  }> {
    const conditions = [];
    if (startDate) {
      conditions.push(gte(staffSalaries.salaryDate, startDate));
    }
    if (endDate) {
      conditions.push(lte(staffSalaries.salaryDate, endDate));
    }

    let salariesQuery = db.select().from(staffSalaries);
    if (conditions.length > 0) {
      salariesQuery = salariesQuery.where(and(...conditions)) as any;
    }
    const allSalaries = await salariesQuery;

    const totalAmount = allSalaries.reduce((sum, s) => sum + parseFloat(s.salaryAmount), 0);
    const totalDeductions = allSalaries.reduce((sum, s) => sum + parseFloat(s.deductSalary || "0"), 0);
    const netTotal = allSalaries.reduce((sum, s) => sum + parseFloat(s.totalSalary), 0);
    const uniqueEmployees = new Set(allSalaries.map(s => s.employeeId));

    return {
      totalSalaries: allSalaries.length,
      totalAmount,
      totalDeductions,
      netTotal,
      employeeCount: uniqueEmployees.size,
    };
  }

  async getSettings(): Promise<Settings | undefined> {
    const result = await db.select().from(settings).limit(1);
    if (result.length === 0) {
      const defaultSettings = await db.insert(settings).values({}).returning();
      return defaultSettings[0];
    }
    return result[0];
  }

  async updateSettings(updates: Partial<InsertSettings>): Promise<Settings> {
    const current = await this.getSettings();
    if (!current) {
      const result = await db.insert(settings).values(updates).returning();
      return result[0];
    }
    
    const result = await db.update(settings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(settings.id, current.id))
      .returning();
    return result[0];
  }

  async getInventoryAdjustments(): Promise<InventoryAdjustment[]> {
    return await db.select().from(inventoryAdjustments).orderBy(desc(inventoryAdjustments.createdAt));
  }

  async getInventoryAdjustmentsPaginated(
    branchId?: string | null,
    limit: number = 50,
    offset: number = 0,
    search?: string,
    productId?: string | null,
    adjustmentType?: string | null
  ): Promise<{ adjustments: InventoryAdjustment[]; total: number }> {
    const conditions = [];
    
    // Product filter
    if (productId) {
      conditions.push(eq(inventoryAdjustments.productId, productId));
    }
    
    // Adjustment type filter
    if (adjustmentType) {
      conditions.push(eq(inventoryAdjustments.adjustmentType, adjustmentType));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryAdjustments)
      .where(whereClause);
    const total = Number(countResult[0]?.count || 0);
    
    // Get paginated adjustments
    let query = db.select().from(inventoryAdjustments);
    if (whereClause) {
      query = query.where(whereClause) as any;
    }
    
    // If search is provided, we need to join with products table
    let adjustments: InventoryAdjustment[] = [];
    if (search) {
      // Get all adjustments first, then filter by product name
      const allAdjustments = await query
        .orderBy(desc(inventoryAdjustments.createdAt))
        .limit(10000); // Large limit to get all for filtering
      
      // Get product IDs for matching products
      const searchPattern = `%${search}%`;
      const matchingProducts = await db.select({ id: products.id })
        .from(products)
        .where(sql`LOWER(${products.name}) LIKE LOWER(${searchPattern})`);
      const matchingProductIds = new Set(matchingProducts.map(p => p.id));
      
      // Filter adjustments by matching product IDs
      adjustments = allAdjustments.filter(adj => matchingProductIds.has(adj.productId));
      
      // Apply pagination after filtering
      const paginatedAdjustments = adjustments.slice(offset, offset + limit);
      return {
        adjustments: paginatedAdjustments,
        total: adjustments.length,
      };
    } else {
      adjustments = await query
        .orderBy(desc(inventoryAdjustments.createdAt))
        .limit(limit)
        .offset(offset);
    }
    
    return {
      adjustments,
      total,
    };
  }

  async getInventoryAdjustment(id: string): Promise<InventoryAdjustment | undefined> {
    const result = await db.select().from(inventoryAdjustments).where(eq(inventoryAdjustments.id, id));
    return result[0];
  }

  async updateInventoryAdjustment(id: string, updateData: Partial<InsertInventoryAdjustment>): Promise<InventoryAdjustment> {
    // Use transaction to update adjustment and recalculate product quantity
    return await db.transaction(async (tx) => {
      // Get the original adjustment
      const [originalAdjustment] = await tx.select()
        .from(inventoryAdjustments)
        .where(eq(inventoryAdjustments.id, id))
        .limit(1);
      
      if (!originalAdjustment) {
        throw new Error("Adjustment not found");
      }
      
      // Get current product quantity
      const [product] = await tx.select({ quantity: products.quantity })
        .from(products)
        .where(eq(products.id, originalAdjustment.productId))
        .limit(1);
      
      if (!product) {
        throw new Error("Product not found");
      }
      
      const currentQuantity = parseFloat(product.quantity || "0");
      
      // Reverse the original adjustment
      const originalQuantity = parseFloat(originalAdjustment.quantity);
      let reversedQuantity = currentQuantity;
      if (originalAdjustment.adjustmentType === "add") {
        reversedQuantity = Math.max(0, currentQuantity - originalQuantity);
      } else if (originalAdjustment.adjustmentType === "remove") {
        reversedQuantity = currentQuantity + originalQuantity;
      } else if (originalAdjustment.adjustmentType === "set") {
        // For "set" type, we need to know the previous quantity before the adjustment
        // This is complex, so we'll need to recalculate from all adjustments
        // For now, we'll use a simpler approach: get all adjustments except this one
        const allAdjustments = await tx.select()
          .from(inventoryAdjustments)
          .where(and(
            eq(inventoryAdjustments.productId, originalAdjustment.productId),
            not(eq(inventoryAdjustments.id, id))
          ))
          .orderBy(inventoryAdjustments.createdAt);
        
        // Get base quantity (we'll need to track this, but for now assume 0)
        // This is a limitation - we'd need to store initial quantity
        reversedQuantity = 0;
        for (const adj of allAdjustments) {
          const adjQty = parseFloat(adj.quantity);
          if (adj.adjustmentType === "add") {
            reversedQuantity += adjQty;
          } else if (adj.adjustmentType === "remove") {
            reversedQuantity = Math.max(0, reversedQuantity - adjQty);
          } else if (adj.adjustmentType === "set") {
            reversedQuantity = adjQty;
          }
        }
      }
      
      // Apply the new adjustment
      const newAdjustmentType = updateData.adjustmentType || originalAdjustment.adjustmentType;
      const newAdjustmentQuantity = updateData.quantity 
        ? parseFloat(updateData.quantity) 
        : originalQuantity;
      
      let newQuantity = reversedQuantity;
      if (newAdjustmentType === "add") {
        newQuantity = reversedQuantity + newAdjustmentQuantity;
      } else if (newAdjustmentType === "remove") {
        newQuantity = Math.max(0, reversedQuantity - newAdjustmentQuantity);
      } else if (newAdjustmentType === "set") {
        newQuantity = newAdjustmentQuantity;
      }
      
      // Update product quantity
      await tx.update(products)
        .set({ quantity: newQuantity.toString() })
        .where(eq(products.id, originalAdjustment.productId));
      
      // Update adjustment record
      const updatedData = {
        ...originalAdjustment,
        ...updateData,
        id: originalAdjustment.id, // Keep original ID
        productId: originalAdjustment.productId, // Don't allow changing product
        createdAt: originalAdjustment.createdAt, // Keep original timestamp
      };
      
      const result = await tx.update(inventoryAdjustments)
        .set(updatedData)
        .where(eq(inventoryAdjustments.id, id))
        .returning();
      
      return result[0];
    });
  }

  async deleteInventoryAdjustment(id: string): Promise<void> {
    // Use transaction to delete adjustment and reverse its effect on product quantity
    return await db.transaction(async (tx) => {
      // Get the adjustment
      const [adjustment] = await tx.select()
        .from(inventoryAdjustments)
        .where(eq(inventoryAdjustments.id, id))
        .limit(1);
      
      if (!adjustment) {
        throw new Error("Adjustment not found");
      }
      
      // Get current product quantity
      const [product] = await tx.select({ quantity: products.quantity })
        .from(products)
        .where(eq(products.id, adjustment.productId))
        .limit(1);
      
      if (!product) {
        throw new Error("Product not found");
      }
      
      const currentQuantity = parseFloat(product.quantity || "0");
      const adjustmentQuantity = parseFloat(adjustment.quantity);
      let newQuantity = currentQuantity;
      
      // Reverse the adjustment effect
      if (adjustment.adjustmentType === "add") {
        newQuantity = Math.max(0, currentQuantity - adjustmentQuantity);
      } else if (adjustment.adjustmentType === "remove") {
        newQuantity = currentQuantity + adjustmentQuantity;
      } else if (adjustment.adjustmentType === "set") {
        // For "set" type, we need to recalculate from all other adjustments
        const allAdjustments = await tx.select()
          .from(inventoryAdjustments)
          .where(and(
            eq(inventoryAdjustments.productId, adjustment.productId),
            not(eq(inventoryAdjustments.id, id))
          ))
          .orderBy(inventoryAdjustments.createdAt);
        
        newQuantity = 0;
        for (const adj of allAdjustments) {
          const adjQty = parseFloat(adj.quantity);
          if (adj.adjustmentType === "add") {
            newQuantity += adjQty;
          } else if (adj.adjustmentType === "remove") {
            newQuantity = Math.max(0, newQuantity - adjQty);
          } else if (adj.adjustmentType === "set") {
            newQuantity = adjQty;
          }
        }
      }
      
      // Update product quantity
      await tx.update(products)
        .set({ quantity: newQuantity.toString() })
        .where(eq(products.id, adjustment.productId));
      
      // Delete adjustment record
      await tx.delete(inventoryAdjustments)
        .where(eq(inventoryAdjustments.id, id));
    });
  }

  async getInventoryAdjustmentsByProduct(productId: string): Promise<InventoryAdjustment[]> {
    return await db.select().from(inventoryAdjustments)
      .where(eq(inventoryAdjustments.productId, productId))
      .orderBy(desc(inventoryAdjustments.createdAt));
  }

  async createInventoryAdjustment(insertAdjustment: InsertInventoryAdjustment): Promise<InventoryAdjustment> {
    // Use transaction to ensure both adjustment record and product quantity are updated
    return await db.transaction(async (tx) => {
      // Get current product quantity
      const [product] = await tx.select({ quantity: products.quantity })
        .from(products)
        .where(eq(products.id, insertAdjustment.productId))
        .limit(1);
      
      if (!product) {
        throw new Error("Product not found");
      }
      
      const currentQuantity = parseFloat(product.quantity || "0");
      const adjustmentQuantity = parseFloat(insertAdjustment.quantity);
      let newQuantity = currentQuantity;
      
      // Calculate new quantity based on adjustment type
      if (insertAdjustment.adjustmentType === "add") {
        newQuantity = currentQuantity + adjustmentQuantity;
      } else if (insertAdjustment.adjustmentType === "remove") {
        newQuantity = Math.max(0, currentQuantity - adjustmentQuantity);
      } else if (insertAdjustment.adjustmentType === "set") {
        newQuantity = adjustmentQuantity;
      }
      
      // Update product quantity
      await tx.update(products)
        .set({ quantity: newQuantity.toString() })
        .where(eq(products.id, insertAdjustment.productId));
      
      // Create adjustment record
      const result = await tx.insert(inventoryAdjustments).values(insertAdjustment).returning();
      return result[0];
    });
  }

  async getLowStockProducts(threshold: number): Promise<Product[]> {
    return await db.select().from(products)
      .where(sql`CAST(${products.quantity} AS DECIMAL) <= ${threshold}`);
  }

  async getLowStockProductsPaginated(
    branchId?: string | null,
    threshold: number = 10,
    limit: number = 50,
    offset: number = 0,
    search?: string,
    categoryId?: string | null
  ): Promise<{ products: Product[]; total: number }> {
    const conditions = [];
    
    // Branch filter
    if (branchId) {
      conditions.push(or(eq(products.branchId, branchId), isNull(products.branchId)));
    }
    
    // Low stock filter
    conditions.push(and(
      sql`CAST(${products.quantity} AS DECIMAL) > 0`,
      sql`CAST(${products.quantity} AS DECIMAL) <= ${threshold}`
    ));
    
    // Category filter (__none__ = products with no category)
    if (categoryId) {
      if (categoryId === "__none__") {
        conditions.push(or(isNull(products.categoryId), eq(products.categoryId, "")));
      } else {
        conditions.push(eq(products.categoryId, categoryId));
      }
    }
    
    // Search filter
    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(sql`LOWER(${products.name}) LIKE LOWER(${searchPattern})`);
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(whereClause);
    const total = Number(countResult[0]?.count || 0);
    
    // Get paginated products
    let query = db.select().from(products);
    if (whereClause) {
      query = query.where(whereClause) as any;
    }
    const productResults = await query
      .limit(limit)
      .offset(offset)
      .orderBy(asc(products.name));
    
    return {
      products: productResults,
      total,
    };
  }

  async getInventoryStats(branchId?: string | null, threshold: number = 10): Promise<{
    totalProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalStockValue: number;
    totalPurchaseCost: number;
    totalQuantity: number;
    totalShortage: number;
    shortageCount: number;
  }> {
    // Build where conditions
    const conditions = [];
    if (branchId) {
      conditions.push(or(eq(products.branchId, branchId), isNull(products.branchId)));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get all products for stats calculation
    let query = db.select().from(products);
    if (whereClause) {
      query = query.where(whereClause) as any;
    }
    const allProducts = await query;

    // Calculate stats
    const totalProducts = allProducts.length;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalStockValue = 0;
    let totalPurchaseCost = 0;
    let totalQuantity = 0;
    let totalShortage = 0;
    let shortageCount = 0;

    for (const product of allProducts) {
      const qty = parseFloat(product.quantity);
      const price = parseFloat(product.price);
      const purchaseCost = product.purchaseCost ? parseFloat(product.purchaseCost) : 0;
      
      // Total stock value (selling price * quantity)
      totalStockValue += qty * price;
      
      // Total purchase cost (purchase cost * quantity)
      totalPurchaseCost += qty * purchaseCost;
      
      // Total quantity
      totalQuantity += qty;

      if (qty === 0) {
        outOfStockCount++;
      } else if (qty <= threshold) {
        lowStockCount++;
      }

      const stockShort = parseFloat(product.stockShort || "0") || 0;
      if (stockShort > 0) {
        totalShortage += stockShort;
        shortageCount++;
      }
    }

    return {
      totalProducts,
      lowStockCount,
      outOfStockCount,
      totalStockValue,
      totalPurchaseCost,
      totalQuantity,
      totalShortage,
      shortageCount,
    };
  }

  async getSoldQuantitiesByProduct(): Promise<Record<string, number>> {
    // Get all completed orders
    const completedOrders = await db.select().from(orders)
      .where(eq(orders.status, "completed"));
    
    // Get all order items for completed orders
    const orderIds = completedOrders.map(order => order.id);
    
    if (orderIds.length === 0) {
      return {};
    }
    
    // Query order items for completed orders
    const allItems = await db.select({
      productId: orderItems.productId,
      quantity: orderItems.quantity,
    })
      .from(orderItems)
      .where(inArray(orderItems.orderId, orderIds));
    
    // Aggregate by productId
    const soldQuantities: Record<string, number> = {};
    for (const item of allItems) {
      const qty = parseInt(item.quantity.toString());
      soldQuantities[item.productId] = (soldQuantities[item.productId] || 0) + qty;
    }
    
    return soldQuantities;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const userWithHashedPassword = {
      ...insertUser,
      password: hashedPassword,
    };
    const result = await db.insert(users).values(userWithHashedPassword).returning();
    return result[0];
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const updateData = { ...updates };
    if (updates.password) {
      updateData.password = await bcrypt.hash(updates.password, 10);
    }
    const result = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async validateUserCredentials(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user) return null;
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;
    
    return user;
  }

  async validateBranchCredentials(username: string, password: string): Promise<Branch | null> {
    const branch = await this.getBranchByUsername(username);
    if (!branch) return null;
    
    const isValid = await bcrypt.compare(password, branch.password);
    if (!isValid) return null;
    
    return branch;
  }

  // Roles management
  async getRoles(): Promise<Role[]> {
    return await db.select().from(roles).orderBy(asc(roles.name));
  }

  async getRole(id: string): Promise<Role | undefined> {
    const result = await db.select().from(roles).where(eq(roles.id, id));
    return result[0];
  }

  async getRoleByName(name: string): Promise<Role | undefined> {
    const result = await db.select().from(roles).where(eq(roles.name, name));
    return result[0];
  }

  async createRole(insertRole: InsertRole): Promise<Role> {
    const result = await db.insert(roles).values(insertRole).returning();
    return result[0];
  }

  async updateRole(id: string, updates: Partial<InsertRole>): Promise<Role | undefined> {
    const result = await db.update(roles).set(updates).where(eq(roles.id, id)).returning();
    return result[0];
  }

  async deleteRole(id: string): Promise<boolean> {
    const result = await db.delete(roles).where(eq(roles.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Permissions management
  async getPermissions(): Promise<Permission[]> {
    return await db.select().from(permissions).orderBy(asc(permissions.category), asc(permissions.name));
  }

  async getPermission(id: string): Promise<Permission | undefined> {
    const result = await db.select().from(permissions).where(eq(permissions.id, id));
    return result[0];
  }

  async getPermissionsByCategory(category: string): Promise<Permission[]> {
    return await db.select().from(permissions)
      .where(eq(permissions.category, category))
      .orderBy(asc(permissions.name));
  }

  async createPermission(insertPermission: InsertPermission): Promise<Permission> {
    const result = await db.insert(permissions).values(insertPermission).returning();
    return result[0];
  }

  async updatePermission(id: string, updates: Partial<InsertPermission>): Promise<Permission | undefined> {
    const result = await db.update(permissions).set(updates).where(eq(permissions.id, id)).returning();
    return result[0];
  }

  async deletePermission(id: string): Promise<boolean> {
    const result = await db.delete(permissions).where(eq(permissions.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Role-Permissions management
  async getRolePermissions(roleId: string): Promise<RolePermission[]> {
    return await db.select().from(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId));
  }

  async getPermissionsForRole(roleId: string): Promise<Permission[]> {
    const result = await db.select({
      id: permissions.id,
      name: permissions.name,
      description: permissions.description,
      category: permissions.category,
      createdAt: permissions.createdAt,
    })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));
    return result;
  }

  async assignPermissionToRole(roleId: string, permissionId: string): Promise<RolePermission> {
    // Check if already exists
    const existing = await db.select().from(rolePermissions)
      .where(and(
        eq(rolePermissions.roleId, roleId),
        eq(rolePermissions.permissionId, permissionId)
      ));
    
    if (existing.length > 0) {
      return existing[0];
    }

    const result = await db.insert(rolePermissions).values({
      roleId,
      permissionId,
    }).returning();
    return result[0];
  }

  async removePermissionFromRole(roleId: string, permissionId: string): Promise<boolean> {
    const result = await db.delete(rolePermissions)
      .where(and(
        eq(rolePermissions.roleId, roleId),
        eq(rolePermissions.permissionId, permissionId)
      ));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async setRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
    // Delete all existing permissions for this role
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    
    // Insert new permissions
    if (permissionIds.length > 0) {
      await db.insert(rolePermissions).values(
        permissionIds.map(permissionId => ({
          roleId,
          permissionId,
        }))
      );
    }
  }

  async getBranches(): Promise<Branch[]> {
    return await db.select().from(branches);
  }

  async getBranch(id: string): Promise<Branch | undefined> {
    const result = await db.select().from(branches).where(eq(branches.id, id));
    return result[0];
  }

  async getBranchByName(name: string): Promise<Branch | undefined> {
    const result = await db.select().from(branches).where(eq(branches.name, name));
    return result[0];
  }

  async getBranchByUsername(username: string): Promise<Branch | undefined> {
    const result = await db.select().from(branches).where(eq(branches.username, username));
    return result[0];
  }

  async createBranch(insertBranch: InsertBranch): Promise<Branch> {
    const hashedPassword = await bcrypt.hash(insertBranch.password, 10);
    const branchWithHashedPassword = {
      ...insertBranch,
      password: hashedPassword,
    };
    const result = await db.insert(branches).values(branchWithHashedPassword).returning();
    return result[0];
  }

  async updateBranch(id: string, updates: Partial<InsertBranch>): Promise<Branch | undefined> {
    const updateData = { ...updates };
    if (updates.password) {
      updateData.password = await bcrypt.hash(updates.password, 10);
    }
    const result = await db.update(branches).set(updateData).where(eq(branches.id, id)).returning();
    return result[0];
  }

  async deleteBranch(id: string): Promise<boolean> {
    const result = await db.delete(branches).where(eq(branches.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getPaymentAdjustments(branchId?: string | null): Promise<PaymentAdjustment[]> {
    if (branchId) {
      return await db.select().from(paymentAdjustments)
        .where(eq(paymentAdjustments.branchId, branchId))
        .orderBy(desc(paymentAdjustments.createdAt));
    }
    return await db.select().from(paymentAdjustments).orderBy(desc(paymentAdjustments.createdAt));
  }

  async createPaymentAdjustment(insertAdjustment: InsertPaymentAdjustment): Promise<PaymentAdjustment> {
    const result = await db.insert(paymentAdjustments).values(insertAdjustment).returning();
    return result[0];
  }

  async getCustomers(branchId?: string | null): Promise<Customer[]> {
    if (branchId) {
      // Include customers with matching branchId OR NULL branchId (unassigned customers)
      return await db.select().from(customers)
        .where(or(
          eq(customers.branchId, branchId),
          isNull(customers.branchId)
        ))
        .orderBy(desc(customers.createdAt));
    }
    return await db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const result = await db.select().from(customers).where(eq(customers.id, id));
    return result[0];
  }

  async getCustomerByPhone(phone: string, branchId?: string | null): Promise<Customer | undefined> {
    if (branchId) {
      const result = await db.select().from(customers)
        .where(and(eq(customers.phone, phone), eq(customers.branchId, branchId)));
      return result[0];
    }
    const result = await db.select().from(customers).where(eq(customers.phone, phone));
    return result[0];
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const result = await db.insert(customers).values(insertCustomer).returning();
    return result[0];
  }

  async updateCustomer(id: string, updates: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const result = await db.update(customers).set(updates).where(eq(customers.id, id)).returning();
    return result[0];
  }

  async deleteCustomer(id: string): Promise<boolean> {
    try {
      // Check if customer exists in customers table
      const existingCustomer = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
      
      // Check if there are any orders or due payments for this customer ID
      // (even if customer doesn't exist in customers table, they might have orders)
      const ordersWithCustomer = await db.select({ id: orders.id })
        .from(orders)
        .where(eq(orders.customerId, id))
        .limit(1);
      
      const paymentsWithCustomer = await db.select({ id: duePayments.id })
        .from(duePayments)
        .where(eq(duePayments.customerId, id))
        .limit(1);

      // If customer doesn't exist and has no related records, return false
      if (existingCustomer.length === 0 && ordersWithCustomer.length === 0 && paymentsWithCustomer.length === 0) {
        return false;
      }

      // Delete related due payment allocations first
      const duePaymentsToDelete = await db.select({ id: duePayments.id })
        .from(duePayments)
        .where(eq(duePayments.customerId, id));
      
      for (const payment of duePaymentsToDelete) {
        await db.delete(duePaymentAllocations).where(eq(duePaymentAllocations.paymentId, payment.id));
      }

      // Delete related due payments
      await db.delete(duePayments).where(eq(duePayments.customerId, id));

      // Delete related order items (for orders with this customer)
      const ordersToDelete = await db.select({ id: orders.id })
        .from(orders)
        .where(eq(orders.customerId, id));
      
      for (const order of ordersToDelete) {
        await db.delete(orderItems).where(eq(orderItems.orderId, order.id));
      }

      // Delete related orders
      await db.delete(orders).where(eq(orders.customerId, id));

      // Delete the customer from customers table if it exists
      if (existingCustomer.length > 0) {
        await db.delete(customers).where(eq(customers.id, id));
        
        // Verify deletion by checking if record still exists
        const verify = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
        return verify.length === 0;
      }

      // If customer didn't exist in customers table but we deleted related records, return true
      return true;
    } catch (error) {
      console.error("Error deleting customer:", error);
      return false;
    }
  }

  async getDuePayments(customerId?: string, branchId?: string | null, limit?: number, offset?: number): Promise<{ payments: DuePayment[]; total: number }> {
    // Build where conditions
    const conditions: any[] = [];
    if (customerId) {
      conditions.push(eq(duePayments.customerId, customerId));
    }
    // Branch filter - if branchId is provided, only show payments for that branch or null branch
    if (branchId) {
      conditions.push(
        or(
          eq(duePayments.branchId, branchId),
          sql`${duePayments.branchId} IS NULL`
        )
      );
    }

    // Get total count
    const countQuery = db.select({ count: sql<number>`count(*)` }).from(duePayments);
    const countConditions = conditions.length > 0 ? and(...conditions) : undefined;
    const totalResult = await (countConditions ? countQuery.where(countConditions) : countQuery);
    const total = Number(totalResult[0]?.count || 0);

    // Build query with conditions, ordering, and pagination
    let query = db.select().from(duePayments);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    query = query.orderBy(desc(duePayments.paymentDate)) as any;
    
    if (limit !== undefined) {
      query = query.limit(limit) as any;
    }
    if (offset !== undefined) {
      query = query.offset(offset) as any;
    }
    
    const payments = await query;
    
    // Parse paymentSlips JSON strings for all payments
    const paymentsWithParsedSlips = payments.map(payment => {
      if (payment.paymentSlips) {
        try {
          return {
            ...payment,
            paymentSlips: JSON.parse(payment.paymentSlips as string),
          };
        } catch (e) {
          return payment;
        }
      }
      return payment;
    });
    
    return { payments: paymentsWithParsedSlips, total };
  }

  async getDuePayment(id: string): Promise<DuePayment | undefined> {
    const result = await db.select().from(duePayments).where(eq(duePayments.id, id));
    return result[0];
  }

  async createDuePayment(insertPayment: InsertDuePayment): Promise<DuePayment> {
    const result = await db.insert(duePayments).values(insertPayment).returning();
    return result[0];
  }

  async updateDuePayment(id: string, updates: Partial<InsertDuePayment>): Promise<DuePayment | undefined> {
    const result = await db.update(duePayments).set(updates).where(eq(duePayments.id, id)).returning();
    return result[0];
  }

  async deleteDuePayment(id: string): Promise<boolean> {
    try {
      // First, check if payment exists
      const existing = await db.select().from(duePayments).where(eq(duePayments.id, id)).limit(1);
      if (existing.length === 0) {
        return false;
      }

      // Delete related allocations first
      await db.delete(duePaymentAllocations).where(eq(duePaymentAllocations.paymentId, id));

      // Delete the payment
      await db.delete(duePayments).where(eq(duePayments.id, id));

      // Verify deletion by checking if record still exists
      const verify = await db.select().from(duePayments).where(eq(duePayments.id, id)).limit(1);
      return verify.length === 0;
    } catch (error) {
      console.error("Error deleting due payment:", error);
      return false;
    }
  }

  async getDuePaymentAllocations(paymentId?: string, orderId?: string): Promise<DuePaymentAllocation[]> {
    if (paymentId && orderId) {
      return await db.select().from(duePaymentAllocations)
        .where(and(
          eq(duePaymentAllocations.paymentId, paymentId),
          eq(duePaymentAllocations.orderId, orderId)
        ));
    }
    if (paymentId) {
      return await db.select().from(duePaymentAllocations)
        .where(eq(duePaymentAllocations.paymentId, paymentId));
    }
    if (orderId) {
      return await db.select().from(duePaymentAllocations)
        .where(eq(duePaymentAllocations.orderId, orderId));
    }
    return await db.select().from(duePaymentAllocations);
  }

  async createDuePaymentAllocation(insertAllocation: InsertDuePaymentAllocation): Promise<DuePaymentAllocation> {
    const result = await db.insert(duePaymentAllocations).values(insertAllocation).returning();
    return result[0];
  }

  async recordPaymentWithAllocations(
    payment: InsertDuePayment,
    allocations: { orderId: string; amount: number }[]
  ): Promise<DuePayment> {
    return await db.transaction(async (tx) => {
      const [createdPayment] = await tx.insert(duePayments).values(payment).returning();
      
      let totalAllocated = 0;
      
      for (const allocation of allocations) {
        await tx.insert(duePaymentAllocations).values({
          paymentId: createdPayment.id,
          orderId: allocation.orderId,
          amount: allocation.amount.toString(),
        });
        
        totalAllocated += allocation.amount;
        
        const [order] = await tx.select().from(orders).where(eq(orders.id, allocation.orderId));
        
        if (order) {
          const currentPaid = parseFloat(order.paidAmount || "0");
          const newPaidAmount = currentPaid + allocation.amount;
          const dueAmount = parseFloat(order.dueAmount || order.total);
          
          let newPaymentStatus = order.paymentStatus;
          if (newPaidAmount >= dueAmount) {
            newPaymentStatus = "paid";
          } else if (newPaidAmount > 0) {
            newPaymentStatus = "partial";
          }
          
          await tx.update(orders)
            .set({
              paidAmount: newPaidAmount.toString(),
              paymentStatus: newPaymentStatus,
            })
            .where(eq(orders.id, allocation.orderId));
        }
      }
      
      const unapplied = parseFloat(payment.amount) - totalAllocated;
      
      if (unapplied !== 0) {
        await tx.update(duePayments)
          .set({ unappliedAmount: unapplied.toString() })
          .where(eq(duePayments.id, createdPayment.id));
      }
      
      // Parse paymentSlips JSON string if it exists
      const [updatedPayment] = await tx.select().from(duePayments)
        .where(eq(duePayments.id, createdPayment.id));
      
      // Parse paymentSlips JSON string if it exists for return value
      if (updatedPayment.paymentSlips) {
        try {
          updatedPayment.paymentSlips = JSON.parse(updatedPayment.paymentSlips as string);
        } catch (e) {
          // If parsing fails, keep as is
        }
      }
      
      return updatedPayment;
    });
  }

  async getCustomerDueSummary(customerId: string, branchId?: string | null, dateFrom?: Date, dateTo?: Date): Promise<{
    totalDue: number;
    totalPaid: number;
    balance: number;
    credit: number;
    ordersCount: number;
  }> {
    // Build order conditions
    const orderConditions: any[] = [eq(orders.customerId, customerId)];
    if (branchId) {
      orderConditions.push(
        or(
          eq(orders.branchId, branchId),
          sql`${orders.branchId} IS NULL`
        )
      );
    }
    if (dateFrom) orderConditions.push(gte(orders.createdAt, dateFrom));
    if (dateTo) orderConditions.push(lte(orders.createdAt, dateTo));

    const allOrders = await db.select().from(orders).where(and(...orderConditions));

    // Due-related: orderSource=due-management OR paymentStatus=due/partial OR has allocations
    const allocations = await db.select().from(duePaymentAllocations);
    const orderIdsWithAllocations = new Set(allocations.map(a => a.orderId));
    const dueRelatedOrders = allOrders.filter(order =>
      order.orderSource === "due-management" ||
      order.paymentStatus === "due" ||
      order.paymentStatus === "partial" ||
      orderIdsWithAllocations.has(order.id)
    );
    const dueOrders = allOrders.filter(order =>
      order.paymentStatus === "due" || order.paymentStatus === "partial"
    );

    let totalDue = 0;
    let totalPaid = 0;
    let balance = 0;

    if (dateFrom || dateTo) {
      // Date-filtered: stats from orders in range only
      for (const order of dueRelatedOrders) {
        const orderTotal = parseFloat(order.total || "0");
        const orderPaid = parseFloat(order.paidAmount || "0");
        totalDue += orderTotal;
        totalPaid += orderPaid;
      }
      for (const order of dueOrders) {
        const orderTotal = parseFloat(order.total || "0");
        const orderPaid = parseFloat(order.paidAmount || "0");
        balance += orderTotal - orderPaid;
      }
      // totalPaid for date range = payments received in range (not order.paidAmount)
      const { payments } = await this.getDuePayments(customerId, branchId);
      const paymentsInRange = payments.filter(p => {
        const d = new Date(p.paymentDate);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      });
      totalPaid = paymentsInRange.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
    } else {
      // No date filter: all-time totals (original behavior)
      for (const order of allOrders) {
        const orderTotal = parseFloat(order.total || "0");
        const orderPaid = parseFloat(order.paidAmount || "0");
        totalDue += orderTotal;
        totalPaid += orderPaid;
      }
      for (const order of dueOrders) {
        const orderTotal = parseFloat(order.total || "0");
        const orderPaid = parseFloat(order.paidAmount || "0");
        balance += orderTotal - orderPaid;
      }
    }

    const { payments } = await this.getDuePayments(customerId, branchId);
    const credit = payments.reduce((sum, p) => sum + parseFloat(p.unappliedAmount || "0"), 0);

    return {
      totalDue,
      totalPaid,
      balance,
      credit,
      ordersCount: dueOrders.length,
    };
  }

  async getAllCustomersDueSummary(
    branchId?: string | null, 
    limit?: number, 
    offset?: number,
    search?: string,
    statusFilter?: string,
    minAmount?: number,
    maxAmount?: number,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<{ summaries: Array<{
    customer: Customer;
    totalDue: number;
    totalPaid: number;
    balance: number;
    credit: number;
    ordersCount: number;
  }>; total: number }> {
    const allCustomers = await this.getCustomers(branchId);
    const allocations = await db.select().from(duePaymentAllocations);
    const orderIdsWithAllocations = new Set(allocations.map(a => a.orderId));

    let allOrdersQuery = db.select().from(orders);
    const orderBaseConditions: any[] = [];
    if (branchId) {
      orderBaseConditions.push(
        or(eq(orders.branchId, branchId), sql`${orders.branchId} IS NULL`)
      );
    }
    if (dateFrom) orderBaseConditions.push(gte(orders.createdAt, dateFrom));
    if (dateTo) orderBaseConditions.push(lte(orders.createdAt, dateTo));
    if (orderBaseConditions.length > 0) {
      allOrdersQuery = allOrdersQuery.where(and(...orderBaseConditions)) as any;
    }
    const allOrders = await allOrdersQuery;

    // Due-related: orderSource=due-management OR paymentStatus=due/partial OR has allocations
    const dueRelatedOrders = allOrders.filter(order =>
      order.customerId && (
        order.orderSource === "due-management" ||
        order.paymentStatus === "due" ||
        order.paymentStatus === "partial" ||
        orderIdsWithAllocations.has(order.id)
      )
    );

    const customerIdsFromOrders = new Set<string>();
    const customerDataFromOrders = new Map<string, { name: string; phone: string | null; branchId: string | null; createdAt: Date }>();
    for (const order of dueRelatedOrders) {
      if (order.customerId) {
        customerIdsFromOrders.add(order.customerId);
        if (!customerDataFromOrders.has(order.customerId) && order.customerName) {
          customerDataFromOrders.set(order.customerId, {
            name: order.customerName || 'Unknown Customer',
            phone: order.customerPhone || null,
            branchId: order.branchId || null,
            createdAt: order.createdAt || new Date(),
          });
        }
      }
    }

    // When date filter: also include customers with payments in range
    let customerIdsFromPayments = new Set<string>();
    if (dateFrom || dateTo) {
      let paymentsQuery = db.select({ customerId: duePayments.customerId }).from(duePayments);
      const payConditions: any[] = [];
      if (branchId) {
        payConditions.push(
          or(eq(duePayments.branchId, branchId), sql`${duePayments.branchId} IS NULL`)
        );
      }
      if (dateFrom) payConditions.push(gte(duePayments.paymentDate, dateFrom));
      if (dateTo) payConditions.push(lte(duePayments.paymentDate, dateTo));
      if (payConditions.length > 0) {
        paymentsQuery = paymentsQuery.where(and(...payConditions)) as any;
      }
      const paymentsInRange = await paymentsQuery;
      customerIdsFromPayments = new Set(paymentsInRange.map(p => p.customerId).filter(Boolean));
    }

    // When date filter: only customers with due activity in range
    // When no date filter: all customers (original behavior)
    let customerIdsToInclude: Set<string>;
    if (dateFrom || dateTo) {
      customerIdsToInclude = new Set([...customerIdsFromOrders, ...customerIdsFromPayments]);
    } else {
      customerIdsToInclude = new Set(allCustomers.map(c => c.id));
      for (const id of customerIdsFromOrders) customerIdsToInclude.add(id);
    }

    const existingCustomerIds = new Set(allCustomers.map(c => c.id));
    const missingCustomerIds = Array.from(customerIdsToInclude).filter(id => !existingCustomerIds.has(id));

    const missingCustomers: Customer[] = [];
    for (const customerId of missingCustomerIds) {
      let customerData = customerDataFromOrders.get(customerId);
      if (!customerData) {
        const cust = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
        if (cust[0]) {
          missingCustomers.push(cust[0] as Customer);
          continue;
        }
        customerData = { name: "Unknown Customer", phone: null, branchId: null, createdAt: new Date() };
      }
      missingCustomers.push({
        id: customerId,
        name: customerData.name,
        phone: customerData.phone,
        email: null,
        branchId: customerData.branchId,
        notes: null,
        createdAt: customerData.createdAt,
      } as Customer);
    }

    const allCustomersCombined = dateFrom || dateTo
      ? [...allCustomers.filter(c => customerIdsToInclude.has(c.id)), ...missingCustomers.filter(c => customerIdsToInclude.has(c.id))]
      : [...allCustomers, ...missingCustomers];

    const summaries = [];

    for (const customer of allCustomersCombined) {
      const summary = await this.getCustomerDueSummary(
        customer.id,
        branchId,
        dateFrom || undefined,
        dateTo || undefined
      );

      summaries.push({
        customer,
        ...summary,
      });
    }
    
    // Apply server-side filtering
    let filteredSummaries = summaries;
    
    // Search filter - supports customer name, phone, email, and invoice number
    if (search && search.trim()) {
      const searchTrimmed = search.trim();
      const searchLower = searchTrimmed.toLowerCase();
      
      // Check if search is for invoice number (starts with "inv-" or is numeric)
      const isInvoiceSearch = searchLower.startsWith("inv-") || /^\d+$/.test(searchTrimmed);
      
      if (isInvoiceSearch) {
        // Extract invoice number (remove "inv-" prefix if present)
        let invoiceNumber = searchTrimmed;
        if (searchLower.startsWith("inv-")) {
          invoiceNumber = searchTrimmed.substring(4); // Remove "inv-" prefix
        }
        
        // Get invoice prefix from settings
        const settings = await this.getSettings();
        const invoicePrefix = settings?.invoicePrefix || "INV-";
        
        // Find orders with matching invoice number (exact match)
        const matchingOrderConditions: any[] = [eq(orders.orderNumber, invoiceNumber)];
        
        // Also check for full invoice format if prefix is included in search
        if (searchLower.startsWith("inv-")) {
          const escapedPrefix = invoicePrefix.replace(/'/g, "''");
          matchingOrderConditions.push(
            sql`LOWER(${sql.raw(`'${escapedPrefix}'`)}) || ${orders.orderNumber} = LOWER(${sql.raw(`'${invoicePrefix}${invoiceNumber}'`)})`
          );
        }
        
        // Get orders matching the invoice number
        const invoiceWhereConditions: any[] = [or(...matchingOrderConditions)];
        
        if (branchId) {
          invoiceWhereConditions.push(eq(orders.branchId, branchId));
        }
        
        const matchingOrders = await db.select({ customerId: orders.customerId })
          .from(orders)
          .where(and(...invoiceWhereConditions));
        const matchingCustomerIds = new Set(matchingOrders.map(o => o.customerId).filter(id => id != null));
        
        // Filter summaries to only include customers with matching invoice numbers
        filteredSummaries = filteredSummaries.filter(s => 
          matchingCustomerIds.has(s.customer.id)
        );
      } else {
        // Regular search by customer name, phone, or email
        filteredSummaries = filteredSummaries.filter(s => 
          s.customer.name.toLowerCase().includes(searchLower) ||
          s.customer.phone?.toLowerCase().includes(searchLower) ||
          s.customer.email?.toLowerCase().includes(searchLower)
        );
      }
    }
    
    // Status filter
    if (statusFilter === "pending") {
      filteredSummaries = filteredSummaries.filter(s => s.balance > 0);
    } else if (statusFilter === "cleared") {
      filteredSummaries = filteredSummaries.filter(s => s.balance === 0 && (s.ordersCount > 0 || s.totalPaid > 0));
    } else if (statusFilter === "no-record") {
      // No Record: customers with no orders, no balance, and no payments
      filteredSummaries = filteredSummaries.filter(s => s.ordersCount === 0 && s.balance === 0 && s.totalPaid === 0);
    }
    
    // Amount filters
    if (minAmount !== undefined && !isNaN(minAmount)) {
      filteredSummaries = filteredSummaries.filter(s => s.balance >= minAmount);
    }
    if (maxAmount !== undefined && !isNaN(maxAmount)) {
      filteredSummaries = filteredSummaries.filter(s => s.balance <= maxAmount);
    }
    
    // Store total before pagination
    const total = filteredSummaries.length;
    
    // Apply pagination
    const paginatedSummaries = limit !== undefined || offset !== undefined
      ? filteredSummaries.slice(offset || 0, (offset || 0) + (limit || filteredSummaries.length))
      : filteredSummaries;
    
    return { summaries: paginatedSummaries, total };
  }

  async getCustomersDueSummaryStats(
    branchId?: string | null,
    dateFrom?: Date,
    dateTo?: Date,
    search?: string,
    statusFilter?: string,
    minAmount?: number,
    maxAmount?: number
  ): Promise<{
    totalCustomers: number;
    pendingDues: number;
    totalOutstanding: number;
    totalCollected: number;
  }> {
    const result = await this.getAllCustomersDueSummary(
      branchId,
      undefined,
      undefined,
      search,
      statusFilter,
      minAmount,
      maxAmount,
      dateFrom,
      dateTo
    );
    
    const totalCustomers = result.total;
    const pendingDues = result.summaries.filter(s => s.balance > 0).length;
    const totalDue = result.summaries.reduce((sum, s) => sum + s.totalDue, 0);
    const totalOutstanding = result.summaries.reduce((sum, s) => sum + s.balance, 0);
    const totalCollected = result.summaries.reduce((sum, s) => sum + s.totalPaid, 0);
    
    return {
      totalCustomers,
      pendingDues,
      totalDue,
      totalOutstanding,
      totalCollected,
    };
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const result = await db.insert(auditLogs).values(log).returning();
    return result[0];
  }

  async getAuditLogs(filters?: { userId?: string; entityType?: string; action?: string; startDate?: Date; endDate?: Date; limit?: number; offset?: number }): Promise<{ logs: AuditLog[]; total: number }> {
    const conditions: any[] = [];

    if (filters?.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }
    if (filters?.entityType) {
      conditions.push(eq(auditLogs.entityType, filters.entityType));
    }
    if (filters?.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters?.startDate) {
      conditions.push(gte(auditLogs.createdAt, filters.startDate));
    }
    if (filters?.endDate) {
      conditions.push(lte(auditLogs.createdAt, filters.endDate));
    }

    // Get total count
    const countConditions = conditions.length > 0 ? and(...conditions) : undefined;
    const countQuery = db.select({ count: sql<number>`count(*)` }).from(auditLogs);
    const totalResult = await (countConditions ? countQuery.where(countConditions) : countQuery);
    const total = Number(totalResult[0]?.count || 0);

    // Build query with conditions, ordering, and pagination
    let query = db.select().from(auditLogs);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    query = query.orderBy(desc(auditLogs.createdAt)) as any;
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    if (filters?.offset) {
      query = query.offset(filters.offset) as any;
    }

    const logs = await query;
    return { logs, total };
  }

  // Main Products management
  async getMainProducts(): Promise<MainProduct[]> {
    return await db.select().from(mainProducts).orderBy(asc(mainProducts.name));
  }

  async getMainProduct(id: string): Promise<MainProduct | undefined> {
    const result = await db.select().from(mainProducts).where(eq(mainProducts.id, id));
    return result[0];
  }

  async createMainProduct(mainProduct: InsertMainProduct): Promise<MainProduct> {
    const result = await db.insert(mainProducts).values(mainProduct).returning();
    return result[0];
  }

  async updateMainProduct(id: string, mainProduct: Partial<InsertMainProduct>): Promise<MainProduct | undefined> {
    const result = await db
      .update(mainProducts)
      .set(mainProduct)
      .where(eq(mainProducts.id, id))
      .returning();
    return result[0];
  }

  async deleteMainProduct(id: string): Promise<boolean> {
    const result = await db.delete(mainProducts).where(eq(mainProducts.id, id)).returning();
    return result.length > 0;
  }

  async getMainProductItems(mainProductId: string): Promise<Array<MainProductItem & { product: Product }>> {
    const items = await db
      .select()
      .from(mainProductItems)
      .where(eq(mainProductItems.mainProductId, mainProductId));
    
    const result: Array<MainProductItem & { product: Product }> = [];
    for (const item of items) {
      const product = await this.getProduct(item.productId);
      if (product) {
        result.push({ ...item, product });
      }
    }
    return result;
  }

  async addMainProductItem(item: InsertMainProductItem): Promise<MainProductItem> {
    // Check if item already exists
    const existing = await db
      .select()
      .from(mainProductItems)
      .where(
        and(
          eq(mainProductItems.mainProductId, item.mainProductId),
          eq(mainProductItems.productId, item.productId)
        )
      );
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const result = await db.insert(mainProductItems).values(item).returning();
    return result[0];
  }

  async removeMainProductItem(id: string): Promise<boolean> {
    const result = await db.delete(mainProductItems).where(eq(mainProductItems.id, id)).returning();
    return result.length > 0;
  }

  async removeMainProductItemByProduct(mainProductId: string, productId: string): Promise<boolean> {
    const result = await db
      .delete(mainProductItems)
      .where(
        and(
          eq(mainProductItems.mainProductId, mainProductId),
          eq(mainProductItems.productId, productId)
        )
      )
      .returning();
    return result.length > 0;
  }

  async getMainProductStats(mainProductId: string): Promise<{
    totalStock: number;
    branchBreakdown: Array<{ branchName: string; quantity: number; sold: number; available: number }>;
    totalQuantity: number;
    totalSold: number;
    totalAvailable: number;
    available: number;
    subProducts: Array<{ product: Product; quantity: number; sold: number; available: number; branchName: string | null }>;
  }> {
    // Get main product to access mainStockCount
    const mainProduct = await this.getMainProduct(mainProductId);
    const mainStockCount = mainProduct?.mainStockCount ? parseFloat(String(mainProduct.mainStockCount)) : null;
    
    const items = await this.getMainProductItems(mainProductId);
    const soldQuantities = await this.getSoldQuantitiesByProduct();
    
    // Calculate total quantity from sub-products (Total Supplied)
    let totalQuantityFromSubProducts = 0;
    let totalSold = 0;
    const branchMap = new Map<string, { quantity: number; sold: number; available: number }>();
    const subProducts: Array<{ product: Product; quantity: number; sold: number; available: number; branchName: string | null }> = [];
    
    for (const item of items) {
      const qty = parseFloat(item.product.quantity);
      const sold = soldQuantities[item.product.id] || 0;
      const available = Math.max(0, qty - sold);
      
      totalQuantityFromSubProducts += qty;
      totalSold += sold;
      
      const branchName = item.product.branchId 
        ? (await this.getBranch(item.product.branchId))?.name || "Unknown"
        : "Main";
      
      const currentBranch = branchMap.get(branchName) || { quantity: 0, sold: 0, available: 0 };
      branchMap.set(branchName, {
        quantity: currentBranch.quantity + qty,
        sold: currentBranch.sold + sold,
        available: currentBranch.available + available,
      });
      
      subProducts.push({
        product: item.product,
        quantity: qty,
        sold,
        available,
        branchName: item.product.branchId ? branchName : null,
      });
    }
    
    const branchBreakdown = Array.from(branchMap.entries()).map(([branchName, data]) => ({
      branchName,
      quantity: data.quantity,
      sold: data.sold,
      available: data.available,
    }));
    
    // Calculate total quantity (sum of all branch quantities - Total Supplied)
    const totalQuantity = branchBreakdown.reduce((sum, branch) => sum + branch.quantity, 0);
    
    // Use mainStockCount as totalStock if set, otherwise use sum of sub-products
    const totalStock = mainStockCount !== null && mainStockCount > 0 ? mainStockCount : totalQuantityFromSubProducts;
    
    // Total Available = Total Stock - Total Supplied (Total Quantity)
    const totalAvailable = Math.max(0, totalStock - totalQuantity);
    
    // Available is the same as totalAvailable for consistency
    const available = totalAvailable;
    
    return {
      totalStock,
      branchBreakdown,
      totalQuantity,
      totalSold,
      totalAvailable,
      available,
      subProducts,
    };
  }

  // Units management
  async getUnits(): Promise<Unit[]> {
    return await db.select().from(units).orderBy(units.name);
  }

  async getUnit(id: string): Promise<Unit | undefined> {
    const result = await db.select().from(units).where(eq(units.id, id)).limit(1);
    return result[0];
  }

  async createUnit(insertUnit: InsertUnit): Promise<Unit> {
    const result = await db.insert(units).values(insertUnit).returning();
    return result[0];
  }

  async updateUnit(id: string, updates: Partial<InsertUnit>): Promise<Unit | undefined> {
    const result = await db.update(units).set(updates).where(eq(units.id, id)).returning();
    return result[0];
  }

  async deleteUnit(id: string): Promise<boolean> {
    try {
      await db.delete(units).where(eq(units.id, id));
      const verify = await db.select().from(units).where(eq(units.id, id)).limit(1);
      return verify.length === 0;
    } catch (error) {
      console.error("Error deleting unit:", error);
      return false;
    }
  }

  async getCustomerPosLifetimeSpend(customerId: string): Promise<number> {
    const rows = await db
      .select({
        sum: sql<string>`coalesce(sum(${orders.total}::numeric), 0)`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.customerId, customerId),
          eq(orders.status, "completed"),
          eq(orders.orderSource, "pos")
        )
      );
    return roundMoney(parseFloat(rows[0]?.sum || "0"));
  }

  async getSubscriptionCardByBarcode(barcode: string): Promise<(SubscriptionCard & { customer: Customer }) | undefined> {
    const trimmed = barcode.trim();
    if (!trimmed) return undefined;
    const [card] = await db
      .select()
      .from(subscriptionCards)
      .where(eq(subscriptionCards.barcode, trimmed))
      .limit(1);
    if (!card) return undefined;
    const customer = await this.getCustomer(card.customerId);
    if (!customer) return undefined;
    return { ...card, customer };
  }

  async getSubscriptionCardById(id: string): Promise<(SubscriptionCard & { customer: Customer }) | undefined> {
    const [card] = await db.select().from(subscriptionCards).where(eq(subscriptionCards.id, id)).limit(1);
    if (!card) return undefined;
    const customer = await this.getCustomer(card.customerId);
    if (!customer) return undefined;
    return { ...card, customer };
  }

  async listSubscriptionCards(): Promise<Array<SubscriptionCard & { customer: Customer }>> {
    const cards = await db.select().from(subscriptionCards).orderBy(desc(subscriptionCards.createdAt));
    const out: Array<SubscriptionCard & { customer: Customer }> = [];
    for (const card of cards) {
      const customer = await this.getCustomer(card.customerId);
      if (customer) out.push({ ...card, customer });
    }
    return out;
  }

  async issueSubscriptionCard(
    customerId: string,
    opts?: { discountOverrideValue?: string | null; notes?: string | null }
  ): Promise<SubscriptionCard> {
    const settings = await this.getSettings();
    const minSpend = parseFloat(settings?.subscriptionMinSpend || "50");
    const spend = await this.getCustomerPosLifetimeSpend(customerId);
    if (spend + 1e-9 < minSpend) {
      throw new Error(
        `Customer is not eligible yet. Minimum POS spend is $${minSpend.toFixed(2)} (current: $${spend.toFixed(2)}).`
      );
    }
    const cust = await this.getCustomer(customerId);
    if (!cust) throw new Error("Customer not found");

    await db
      .update(subscriptionCards)
      .set({ isActive: "false" })
      .where(and(eq(subscriptionCards.customerId, customerId), eq(subscriptionCards.isActive, "true")));

    let barcode = "";
    for (let attempt = 0; attempt < 20; attempt++) {
      const part = Math.random().toString(36).slice(2, 10).toUpperCase();
      barcode = `SUB${Date.now().toString(36).toUpperCase()}${part}`.slice(0, 32);
      const existing = await db
        .select({ id: subscriptionCards.id })
        .from(subscriptionCards)
        .where(eq(subscriptionCards.barcode, barcode))
        .limit(1);
      if (existing.length === 0) break;
    }
    if (!barcode) throw new Error("Could not generate a unique barcode");

    const [row] = await db
      .insert(subscriptionCards)
      .values({
        barcode,
        customerId,
        discountOverrideValue: opts?.discountOverrideValue ?? null,
        notes: opts?.notes ?? null,
        isActive: "true",
      })
      .returning();
    return row;
  }

  async updateSubscriptionCard(
    id: string,
    updates: Partial<Pick<InsertSubscriptionCard, "isActive" | "notes" | "discountOverrideValue">>
  ): Promise<SubscriptionCard | undefined> {
    const result = await db.update(subscriptionCards).set(updates).where(eq(subscriptionCards.id, id)).returning();
    return result[0];
  }
}

export const storage = new DatabaseStorage();
