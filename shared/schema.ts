import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  purchaseCost: decimal("purchase_cost", { precision: 10, scale: 2 }),
  categoryId: varchar("category_id").notNull(),
  branchId: varchar("branch_id"),
  imageUrl: text("image_url"),
  unit: text("unit").notNull().default("piece"),
  description: text("description"),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull().default("0"),
  stockShort: decimal("stock_short", { precision: 10, scale: 2 }),
  stockShortReason: text("stock_short_reason"),
  barcode: varchar("barcode", { length: 255 }),
  sizePrices: jsonb("size_prices"), // JSON object for size-based pricing: {"S": "100", "M": "150", "L": "200"}
  sizePurchasePrices: jsonb("size_purchase_prices"), // Purchase cost per size when size-based pricing: {"S": "50", "M": "75", "L": "100"}
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
}).extend({
  sizePrices: z.record(z.string(), z.string()).optional().nullable(), // Optional size-based pricing: {"S": "100", "M": "150", "L": "200"}
  sizePurchasePrices: z.record(z.string(), z.string()).optional().nullable(), // Optional purchase cost per size
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export const tables = pgTable("tables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tableNumber: text("table_number").notNull().unique(),
  capacity: text("capacity"),
  description: text("description"),
  branchId: varchar("branch_id"),
  status: text("status").notNull().default("available"),
});

export const insertTableSchema = createInsertSchema(tables).omit({
  id: true,
});

export type InsertTable = z.infer<typeof insertTableSchema>;
export type Table = typeof tables.$inferSelect;

export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  branchId: varchar("branch_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export const subscriptionCards = pgTable("subscription_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  barcode: text("barcode").notNull().unique(),
  customerId: varchar("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  discountOverrideValue: decimal("discount_override_value", { precision: 10, scale: 2 }),
  isActive: text("is_active").notNull().default("true"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertSubscriptionCardSchema = createInsertSchema(subscriptionCards).omit({
  id: true,
  createdAt: true,
});

export type InsertSubscriptionCard = z.infer<typeof insertSubscriptionCardSchema>;
export type SubscriptionCard = typeof subscriptionCards.$inferSelect;

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: text("order_number").notNull().unique(),
  tableId: varchar("table_id"),
  customerId: varchar("customer_id"),
  branchId: varchar("branch_id"),
  diningOption: text("dining_option").notNull().default("dine-in"),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  customerContactType: text("customer_contact_type"), // For web orders: phone, whatsapp, telegram, facebook, other
  orderSource: text("order_source").notNull().default("pos"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  discountType: text("discount_type").notNull().default("amount"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  dueAmount: decimal("due_amount", { precision: 10, scale: 2 }),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("draft"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  paymentMethod: text("payment_method"),
  paymentSplits: text("payment_splits"),
  subscriptionCardId: varchar("subscription_card_id"),
  subscriptionDiscount: decimal("subscription_discount", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  completedAt: timestamp("completed_at"),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  orderNumber: true,
}).extend({
  createdAt: z.coerce.date().optional(),
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull(),
  productId: varchar("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  itemDiscount: decimal("item_discount", { precision: 10, scale: 2 }).default("0"),
  itemDiscountType: varchar("item_discount_type", { length: 20 }).default("amount"),
  selectedSize: varchar("selected_size", { length: 50 }), // Store selected size (S, M, L, etc.) for cup products
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

export const duePayments = pgTable("due_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id").notNull(),
  paymentDate: timestamp("payment_date").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  unappliedAmount: decimal("unapplied_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  paymentMethod: text("payment_method").notNull(),
  reference: text("reference"),
  note: text("note"),
  paymentSlips: text("payment_slips"), // JSON array of image URLs
  recordedBy: varchar("recorded_by"),
  branchId: varchar("branch_id"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertDuePaymentSchema = createInsertSchema(duePayments).omit({
  id: true,
  createdAt: true,
}).extend({
  paymentDate: z.coerce.date(),
});

export type InsertDuePayment = z.infer<typeof insertDuePaymentSchema>;
export type DuePayment = typeof duePayments.$inferSelect;

export const duePaymentAllocations = pgTable("due_payment_allocations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  paymentId: varchar("payment_id").notNull(),
  orderId: varchar("order_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertDuePaymentAllocationSchema = createInsertSchema(duePaymentAllocations).omit({
  id: true,
  createdAt: true,
});

export type InsertDuePaymentAllocation = z.infer<typeof insertDuePaymentAllocationSchema>;
export type DuePaymentAllocation = typeof duePaymentAllocations.$inferSelect;

export const expenseCategories = pgTable("expense_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
});

export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).omit({
  id: true,
});

export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  expenseDate: timestamp("expense_date").notNull(),
  categoryId: varchar("category_id").notNull(),
  branchId: varchar("branch_id"),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  slipImage: text("slip_image"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
}).extend({
  expenseDate: z.coerce.date(),
});

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

export const purchases = pgTable("purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  imageUrl: text("image_url"),
  categoryId: varchar("category_id").notNull(),
  productId: varchar("product_id"),
  branchId: varchar("branch_id"),
  itemName: text("item_name").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  piecesPerUnit: decimal("pieces_per_unit", { precision: 10, scale: 2 }),
  pricePerPiece: decimal("price_per_piece", { precision: 10, scale: 2 }),
  purchaseDate: timestamp("purchase_date").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertPurchaseSchema = createInsertSchema(purchases).omit({
  id: true,
  createdAt: true,
}).extend({
  purchaseDate: z.coerce.date(),
});

export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof purchases.$inferSelect;

export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: text("employee_id").notNull().unique(),
  name: text("name").notNull(),
  position: text("position").notNull(),
  department: text("department").notNull(),
  branchId: varchar("branch_id"),
  email: text("email"),
  phone: text("phone"),
  joiningDate: timestamp("joining_date").notNull(),
  salary: decimal("salary", { precision: 10, scale: 2 }).notNull(),
  photoUrl: text("photo_url"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
  createdAt: true,
}).extend({
  joiningDate: z.coerce.date(),
});

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

export const attendance = pgTable("attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  date: timestamp("date").notNull(),
  checkIn: text("check_in"),
  checkOut: text("check_out"),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertAttendanceSchema = createInsertSchema(attendance).omit({
  id: true,
  createdAt: true,
}).extend({
  date: z.coerce.date(),
});

export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendance.$inferSelect;

export const leaves = pgTable("leaves", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  leaveType: text("leave_type").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertLeaveSchema = createInsertSchema(leaves).omit({
  id: true,
  createdAt: true,
}).extend({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export type InsertLeave = z.infer<typeof insertLeaveSchema>;
export type Leave = typeof leaves.$inferSelect;

export const payroll = pgTable("payroll", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  month: text("month").notNull(),
  year: text("year").notNull(),
  baseSalary: decimal("base_salary", { precision: 10, scale: 2 }).notNull(),
  bonus: decimal("bonus", { precision: 10, scale: 2 }).notNull().default("0"),
  deductions: decimal("deductions", { precision: 10, scale: 2 }).notNull().default("0"),
  netSalary: decimal("net_salary", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertPayrollSchema = createInsertSchema(payroll).omit({
  id: true,
  createdAt: true,
});

export type InsertPayroll = z.infer<typeof insertPayrollSchema>;
export type Payroll = typeof payroll.$inferSelect;

export const staffSalaries = pgTable("staff_salaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  salaryDate: timestamp("salary_date").notNull(),
  salaryAmount: decimal("salary_amount", { precision: 10, scale: 2 }).notNull(),
  deductSalary: decimal("deduct_salary", { precision: 10, scale: 2 }).notNull().default("0"),
  deductReason: text("deduct_reason"),
  advanceAmount: decimal("advance_amount", { precision: 10, scale: 2 }).default("0"),
  carriedUnreleased: decimal("carried_unreleased", { precision: 10, scale: 2 }).default("0"),
  totalSalary: decimal("total_salary", { precision: 10, scale: 2 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertStaffSalarySchema = createInsertSchema(staffSalaries).omit({
  id: true,
  createdAt: true,
}).extend({
  salaryDate: z.coerce.date(),
  deductReason: z.string().optional().nullable(),
  advanceAmount: z.string().optional().nullable(),
  carriedUnreleased: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
});

export type InsertStaffSalary = z.infer<typeof insertStaffSalarySchema>;
export type StaffSalary = typeof staffSalaries.$inferSelect;

export const staffDeductions = pgTable("staff_deductions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  staffSalaryId: varchar("staff_salary_id"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertStaffDeductionSchema = createInsertSchema(staffDeductions).omit({
  id: true,
  createdAt: true,
  status: true,
  staffSalaryId: true,
}).extend({
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
});

export type InsertStaffDeduction = z.infer<typeof insertStaffDeductionSchema>;
export type StaffDeduction = typeof staffDeductions.$inferSelect;

export const staffAdvances = pgTable("staff_advances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  note: text("note"),
  status: text("status").notNull().default("pending"),
  staffSalaryId: varchar("staff_salary_id"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertStaffAdvanceSchema = createInsertSchema(staffAdvances).omit({
  id: true,
  createdAt: true,
  status: true,
  staffSalaryId: true,
}).extend({
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
});

export type InsertStaffAdvance = z.infer<typeof insertStaffAdvanceSchema>;
export type StaffAdvance = typeof staffAdvances.$inferSelect;

export const staffPreviousDue = pgTable("staff_previous_due", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  note: text("note"),
  status: text("status").notNull().default("pending"),
  staffSalaryId: varchar("staff_salary_id"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertStaffPreviousDueSchema = createInsertSchema(staffPreviousDue).omit({
  id: true,
  createdAt: true,
  status: true,
  staffSalaryId: true,
}).extend({
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
});

export type InsertStaffPreviousDue = z.infer<typeof insertStaffPreviousDueSchema>;
export type StaffPreviousDue = typeof staffPreviousDue.$inferSelect;

export const staffLoans = pgTable("staff_loans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  note: text("note"),
  status: text("status").notNull().default("pending"),
  staffSalaryId: varchar("staff_salary_id"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertStaffLoanSchema = createInsertSchema(staffLoans).omit({
  id: true,
  createdAt: true,
  status: true,
  staffSalaryId: true,
}).extend({
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
});

export type InsertStaffLoan = z.infer<typeof insertStaffLoanSchema>;
export type StaffLoan = typeof staffLoans.$inferSelect;

export const staffUnpaidLeave = pgTable("staff_unpaid_leave", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  note: text("note"),
  status: text("status").notNull().default("pending"),
  staffSalaryId: varchar("staff_salary_id"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertStaffUnpaidLeaveSchema = createInsertSchema(staffUnpaidLeave).omit({
  id: true,
  createdAt: true,
  status: true,
  staffSalaryId: true,
}).extend({
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
});

export type InsertStaffUnpaidLeave = z.infer<typeof insertStaffUnpaidLeaveSchema>;
export type StaffUnpaidLeave = typeof staffUnpaidLeave.$inferSelect;

export const positions = pgTable("positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertPositionSchema = createInsertSchema(positions).omit({
  id: true,
  createdAt: true,
});

export type InsertPosition = z.infer<typeof insertPositionSchema>;
export type Position = typeof positions.$inferSelect;

export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  createdAt: true,
});

export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departments.$inferSelect;

export const settings = pgTable("settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessName: text("business_name").notNull().default("BondPos POS"),
  businessLogo: text("business_logo"),
  appName: text("app_name"),
  appTagline: text("app_tagline"),
  websiteTitle: text("website_title"),
  websiteDescription: text("website_description"),
  favicon: text("favicon"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  dateFormat: text("date_format").notNull().default("dd-mm-yyyy"),
  timeFormat: text("time_format").notNull().default("12h"),
  terminalId: text("terminal_id"),
  
  paymentCash: text("payment_cash").notNull().default("true"),
  paymentCard: text("payment_card").notNull().default("true"),
  paymentAba: text("payment_aba").notNull().default("true"),
  paymentAcleda: text("payment_acleda").notNull().default("true"),
  paymentCredit: text("payment_credit").notNull().default("true"),
  defaultPaymentMethod: text("default_payment_method").notNull().default("cash"),
  minTransactionAmount: decimal("min_transaction_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  maxTransactionAmount: decimal("max_transaction_amount", { precision: 10, scale: 2 }),
  
  vatRate: decimal("vat_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  serviceTaxRate: decimal("service_tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  defaultDiscount: decimal("default_discount", { precision: 5, scale: 2 }).notNull().default("0"),
  enablePercentageDiscount: text("enable_percentage_discount").notNull().default("true"),
  enableFixedDiscount: text("enable_fixed_discount").notNull().default("true"),
  maxDiscount: decimal("max_discount", { precision: 5, scale: 2 }).notNull().default("50"),
  
  invoicePrefix: text("invoice_prefix").notNull().default("INV-"),
  receiptHeader: text("receipt_header"),
  receiptFooter: text("receipt_footer"),
  receiptLogo: text("receipt_logo"),
  autoPrintReceipt: text("auto_print_receipt").notNull().default("false"),
  showLogoOnReceipt: text("show_logo_on_receipt").notNull().default("true"),
  includeTaxBreakdown: text("include_tax_breakdown").notNull().default("true"),
  
  receiptPrinter: text("receipt_printer").notNull().default("default"),
  kitchenPrinter: text("kitchen_printer").notNull().default("none"),
  paperSize: text("paper_size").notNull().default("80mm"),
  enableBarcodeScanner: text("enable_barcode_scanner").notNull().default("false"),
  barcodeScannerType: text("barcode_scanner_type").notNull().default("keyboard"), // keyboard, usb, bluetooth
  barcodeScanDelay: integer("barcode_scan_delay").notNull().default(200), // milliseconds
  barcodeBeepSound: text("barcode_beep_sound").notNull().default("true"),
  enableCashDrawer: text("enable_cash_drawer").notNull().default("true"),
  
  currency: text("currency").notNull().default("usd"),
  secondaryCurrency: text("secondary_currency"),
  secondaryCurrencySymbol: text("secondary_currency_symbol"),
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 2 }),
  language: text("language").notNull().default("en"),
  decimalPlaces: text("decimal_places").notNull().default("2"),
  roundingRule: text("rounding_rule").notNull().default("nearest"),
  currencySymbolPosition: text("currency_symbol_position").notNull().default("before"),
  
  autoBackup: text("auto_backup").notNull().default("true"),
  backupFrequency: text("backup_frequency").notNull().default("daily"),
  backupStorage: text("backup_storage").notNull().default("cloud"),
  
  lowStockAlerts: text("low_stock_alerts").notNull().default("true"),
  stockThreshold: integer("stock_threshold").notNull().default(10),
  saleNotifications: text("sale_notifications").notNull().default("false"),
  discountAlerts: text("discount_alerts").notNull().default("false"),
  systemUpdateNotifications: text("system_update_notifications").notNull().default("true"),
  notificationEmail: text("notification_email"),
  
  colorTheme: text("color_theme").notNull().default("orange"),
  primaryColor: text("primary_color"), // custom hex e.g. #6366f1
  componentSize: text("component_size").notNull().default("medium"), // small | medium | large
  layoutPreference: text("layout_preference").notNull().default("grid"),
  fontSize: text("font_size").notNull().default("medium"),
  compactMode: text("compact_mode").notNull().default("false"),
  showAnimations: text("show_animations").notNull().default("true"),
  
  permAccessReports: text("perm_access_reports").notNull().default("true"),
  permAccessSettings: text("perm_access_settings").notNull().default("false"),
  permProcessRefunds: text("perm_process_refunds").notNull().default("false"),
  permManageInventory: text("perm_manage_inventory").notNull().default("true"),

  subscriptionProgramEnabled: text("subscription_program_enabled").notNull().default("true"),
  subscriptionMinSpend: decimal("subscription_min_spend", { precision: 10, scale: 2 }).notNull().default("50"),
  subscriptionDiscountType: text("subscription_discount_type").notNull().default("percentage"),
  subscriptionDiscountValue: decimal("subscription_discount_value", { precision: 10, scale: 2 }).notNull().default("5"),
  
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
});

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;

export const inventoryAdjustments = pgTable("inventory_adjustments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull(),
  adjustmentType: text("adjustment_type").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  notes: text("notes"),
  performedBy: varchar("performed_by"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertInventoryAdjustmentSchema = createInsertSchema(inventoryAdjustments).omit({
  id: true,
  createdAt: true,
});

export type InsertInventoryAdjustment = z.infer<typeof insertInventoryAdjustmentSchema>;
export type InventoryAdjustment = typeof inventoryAdjustments.$inferSelect;

// Roles table - defined before users to allow reference
export const roles = pgTable("roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
}).extend({
  name: z.string().min(1, "Role name is required"),
});

export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  role: text("role").notNull().default("staff"), // Keep for backward compatibility
  roleId: varchar("role_id").references(() => roles.id, { onDelete: "set null" }), // New: reference to roles table
  employeeId: varchar("employee_id"),
  isActive: text("is_active").notNull().default("true"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Permissions table - stores all available permissions in the system
export const permissions = pgTable("permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  category: text("category").notNull(), // e.g., "sales", "inventory", "settings", etc.
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertPermissionSchema = createInsertSchema(permissions).omit({
  id: true,
  createdAt: true,
}).extend({
  name: z.string().min(1, "Permission name is required"),
  category: z.string().min(1, "Category is required"),
});

export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type Permission = typeof permissions.$inferSelect;

// Role-Permissions junction table
export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
  permissionId: varchar("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
});

export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;

export const paymentAdjustments = pgTable("payment_adjustments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  paymentMethod: text("payment_method").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  adjustmentType: text("adjustment_type").notNull().default("add"),
  description: text("description"),
  branchId: varchar("branch_id"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertPaymentAdjustmentSchema = createInsertSchema(paymentAdjustments).omit({
  id: true,
  createdAt: true,
});

export type InsertPaymentAdjustment = z.infer<typeof insertPaymentAdjustmentSchema>;
export type PaymentAdjustment = typeof paymentAdjustments.$inferSelect;

export const orderCounters = pgTable("order_counters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  counterValue: integer("counter_value").notNull().default(0),
});

export const branches = pgTable("branches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  location: text("location"),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  isActive: text("is_active").notNull().default("true"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertBranchSchema = createInsertSchema(branches).omit({
  id: true,
  createdAt: true,
}).extend({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type Branch = typeof branches.$inferSelect;

// Audit Logs / Activity Logs
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  username: text("username"),
  action: text("action").notNull(), // e.g., "create", "update", "delete", "view", "login", "logout"
  entityType: text("entity_type").notNull(), // e.g., "order", "product", "user", "expense"
  entityId: varchar("entity_id"), // ID of the affected entity
  entityName: text("entity_name"), // Human-readable name of the entity
  description: text("description"), // Detailed description of the action
  changes: text("changes"), // JSON string of changes made (for updates)
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  branchId: varchar("branch_id"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// Main Products - for grouping multiple products together
export const mainProducts = pgTable("main_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  mainStockCount: decimal("main_stock_count", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertMainProductSchema = createInsertSchema(mainProducts).omit({
  id: true,
  createdAt: true,
});

export type InsertMainProduct = z.infer<typeof insertMainProductSchema>;
export type MainProduct = typeof mainProducts.$inferSelect;

export const units = pgTable("units", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertUnitSchema = createInsertSchema(units).omit({
  id: true,
  createdAt: true,
});

export type InsertUnit = z.infer<typeof insertUnitSchema>;
export type Unit = typeof units.$inferSelect;

// Main Product Items - links products to main products
export const mainProductItems = pgTable("main_product_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  mainProductId: varchar("main_product_id").notNull().references(() => mainProducts.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const insertMainProductItemSchema = createInsertSchema(mainProductItems).omit({
  id: true,
  createdAt: true,
});

export type InsertMainProductItem = z.infer<typeof insertMainProductItemSchema>;
export type MainProductItem = typeof mainProductItems.$inferSelect;
