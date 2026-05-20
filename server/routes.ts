import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import type { WebSocketServer } from "ws";
import { storage } from "./storage";
import { createWebSocketServer, emitWebOrderCreated } from "./websocket";
import { insertOrderSchema, insertOrderItemSchema, insertExpenseCategorySchema, insertExpenseSchema, insertCategorySchema, insertProductSchema, insertPurchaseSchema, insertTableSchema, insertEmployeeSchema, insertAttendanceSchema, insertLeaveSchema, insertPayrollSchema, insertStaffSalarySchema, insertStaffDeductionSchema, insertStaffAdvanceSchema, insertStaffPreviousDueSchema, insertStaffLoanSchema, insertStaffUnpaidLeaveSchema, insertPositionSchema, insertDepartmentSchema, insertSettingsSchema, insertUserSchema, insertInventoryAdjustmentSchema, insertBranchSchema, insertPaymentAdjustmentSchema, insertCustomerSchema, insertDuePaymentSchema, insertDuePaymentAllocationSchema, insertMainProductSchema, insertMainProductItemSchema, insertUnitSchema, InsertInventoryAdjustment } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure uploads directory exists
// In development: server/../uploads
// In production: dist/../uploads
const uploadsDir = path.resolve(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storageConfig = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage: storageConfig,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  },
  fileFilter: (req, file, cb) => {
    // Allow images only
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Multiple file upload for payment slips
const uploadMultiple = multer({
  storage: storageConfig,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 10, // Allow up to 10 files
  },
  fileFilter: (req, file, cb) => {
    // Allow images only
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const createOrderWithItemsSchema = insertOrderSchema.extend({
  items: z.array(insertOrderItemSchema.omit({ orderId: true })),
  subscriptionCardId: z.string().optional().nullable(),
  subscriptionDiscount: z.union([z.string(), z.number()]).optional(),
});

const publicOrderItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().min(1),
  selectedSize: z.string().optional(),
});
const publicOrderSchema = z.object({
  branchId: z.string().optional(), // no longer required; single store
  customerName: z.string().min(1, "Name is required"),
  customerPhone: z.string().min(1, "Phone is required"),
  customerContactType: z.enum(["phone", "whatsapp", "telegram", "facebook", "other"]).optional(),
  paymentMethod: z.enum(["cash_on_delivery", "due"]).optional(), // public web: pay on delivery or pay later (due)
  items: z.array(publicOrderItemSchema).min(1, "At least one item is required"),
});

let webSocketServer: WebSocketServer | null = null;

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId && !req.session.branchId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

// API Key authentication for Central Dashboard
function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  const expectedApiKey = process.env.CENTRAL_DASHBOARD_API_KEY || 'central-dashboard-2024-secure-key';
  
  if (!apiKey || apiKey !== expectedApiKey) {
    return res.status(401).json({ error: "Invalid API key" });
  }
  next();
}

// Audit log helper: only saves when the action is attributable to a logged-in user or branch; fire-and-forget so it never blocks the response
function auditLog(
  req: Request,
  opts: { action: string; entityType: string; entityId?: string; entityName?: string; description?: string; changes?: string }
) {
  const hasUser = !!req.session?.userId;
  const hasBranch = !!req.session?.branchId;
  if (!hasUser && !hasBranch) return;

  const userId = hasUser ? req.session!.userId! : undefined;
  const username = req.session!.username ?? (hasUser ? "user" : "branch");
  const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket?.remoteAddress || null;
  const userAgent = (req.headers["user-agent"] as string) || null;
  storage
    .createAuditLog({
      userId,
      username,
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId,
      entityName: opts.entityName,
      description: opts.description,
      changes: opts.changes,
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      branchId: req.session?.branchId || undefined,
    })
    .catch(() => {});
}

// Helper function to check if user has permission
async function checkPermission(req: Request, requiredPermission: string): Promise<boolean> {
  // Branches have all permissions
  if (req.session.branchId) {
    return true;
  }

  if (!req.session.userId) {
    return false;
  }

  const user = await storage.getUser(req.session.userId);
  if (!user) {
    return false;
  }

  // Admin users have all permissions
  if (user.role === "admin") {
    return true;
  }

  // Get user's permissions
  let roleId = user.roleId;
  if (!roleId && user.role) {
    let role = await storage.getRoleByName(user.role);
    if (!role) {
      const allRoles = await storage.getRoles();
      role = allRoles.find(r => r.name.toLowerCase() === user.role?.toLowerCase());
    }
    if (role) {
      roleId = role.id;
    }
  }

  if (!roleId) {
    return false;
  }

  const rolePermissions = await storage.getPermissionsForRole(roleId);
  const permissions = rolePermissions.map(p => p.name);

  // Check if user has the required permission
  return permissions.includes(requiredPermission) || permissions.includes("*");
}

// Middleware to require specific permission
function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const hasPermission = await checkPermission(req, permission);
    if (!hasPermission) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

// Allow if user has any of the given permissions (for items OR inventory)
function requireAnyPermission(permissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    for (const permission of permissions) {
      const hasPermission = await checkPermission(req, permission);
      if (hasPermission) {
        return next();
      }
    }
    return res.status(403).json({ error: "Insufficient permissions" });
  };
}

// Allow any authenticated user to edit drafts; completed orders require sales.edit
function requireOrderEditOrDraft() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId && !req.session?.branchId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const order = await storage.getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status === "draft") return next();
    const hasPermission = await checkPermission(req, "sales.edit");
    if (!hasPermission) return res.status(403).json({ error: "Insufficient permissions" });
    next();
  };
}

// Allow any authenticated user to delete drafts; completed orders require sales.delete
function requireOrderDeleteOrDraft() {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.userId && !req.session?.branchId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const order = await storage.getOrder(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status === "draft") return next();
    const hasPermission = await checkPermission(req, "sales.delete");
    if (!hasPermission) return res.status(403).json({ error: "Insufficient permissions" });
    next();
  };
}

function getDateRange(filter: string, customDate?: string, clientStart?: string, clientEnd?: string): { startDate: Date; endDate: Date } {
  // Use client-provided range when given (ensures "today" etc. use user's timezone, not server's)
  if (clientStart && clientEnd) {
    const start = new Date(clientStart);
    const end = new Date(clientEnd);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) return { startDate: start, endDate: end };
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (filter) {
    case "today":
      return {
        startDate: today,
        endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999),
      };
    case "yesterday":
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        startDate: yesterday,
        endDate: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999),
      };
    case "this-week":
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      return {
        startDate: startOfWeek,
        endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
      };
    case "this-month":
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        startDate: startOfMonth,
        endDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
      };
    case "last-month":
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return {
        startDate: startOfLastMonth,
        endDate: endOfLastMonth,
      };
    case "custom":
      if (customDate) {
        const custom = new Date(customDate);
        const customDay = new Date(custom.getFullYear(), custom.getMonth(), custom.getDate());
        return {
          startDate: customDay,
          endDate: new Date(customDay.getFullYear(), customDay.getMonth(), customDay.getDate(), 23, 59, 59, 999),
        };
      }
      return {
        startDate: today,
        endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999),
      };
    case "all":
      return {
        startDate: new Date(2000, 0, 1),
        endDate: new Date(2099, 11, 31, 23, 59, 59, 999),
      };
    default:
      return {
        startDate: today,
        endDate: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999),
      };
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint (must be before authentication middleware)
  app.get("/health", async (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Public API for customer web ordering (no auth)
  app.get("/api/public/branches", async (_req, res) => {
    try {
      const branches = await storage.getBranches();
      const active = branches.filter((b) => b.isActive === "true");
      res.json(active.map(({ id, name, location, contactPerson, phone, email }) => ({ id, name, location, contactPerson, phone, email })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch branches" });
    }
  });

  app.get("/api/public/categories", async (_req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.get("/api/public/products", async (req, res) => {
    try {
      const branchId = (req.query.branchId as string) || undefined;
      const products = await storage.getProducts(branchId);
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.post("/api/public/orders", async (req, res) => {
    try {
      const parsed = publicOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      }
      const { branchId: branchIdPayload, customerName, customerPhone, customerContactType, paymentMethod: webPaymentMethod, items: rawItems } = parsed.data;
      const branchId = branchIdPayload || null;

      const orderItems: Array<{ productId: string; quantity: number; price: string; total: string; selectedSize?: string }> = [];
      let subtotal = 0;

      for (const item of rawItems) {
        const product = await storage.getProduct(item.productId);
        if (!product) {
          return res.status(400).json({ error: `Product not found: ${item.productId}` });
        }
        let price: number;
        if (item.selectedSize && product.sizePrices && typeof product.sizePrices === "object" && (product.sizePrices as Record<string, string>)[item.selectedSize] != null) {
          price = parseFloat((product.sizePrices as Record<string, string>)[item.selectedSize]);
        } else {
          price = parseFloat(String(product.price));
        }
        if (isNaN(price) || price < 0) price = 0;
        const total = price * item.quantity;
        subtotal += total;
        orderItems.push({
          productId: product.id,
          quantity: item.quantity,
          price: price.toFixed(2),
          total: total.toFixed(2),
          ...(item.selectedSize && { selectedSize: item.selectedSize }),
        });
      }

      const discount = 0;
      const total = subtotal;
      const isDue = webPaymentMethod === "due";
      const orderData = {
        branchId,
        tableId: undefined,
        customerId: undefined,
        diningOption: "takeaway" as const,
        customerName,
        customerPhone,
        customerContactType: customerContactType || null,
        orderSource: "web" as const,
        subtotal: subtotal.toFixed(2),
        discount: discount.toFixed(2),
        discountType: "amount" as const,
        total: total.toFixed(2),
        dueAmount: isDue ? total.toFixed(2) : undefined,
        paidAmount: "0",
        status: "web-pending" as const,
        paymentStatus: isDue ? ("due" as const) : ("pending" as const),
        paymentMethod: webPaymentMethod === "cash_on_delivery" ? "cash" : (isDue ? "due" : null),
        paymentSplits: null,
        subscriptionCardId: null,
        subscriptionDiscount: "0",
      };

      const order = await storage.createOrderWithItems(orderData, orderItems);
      const orderWithItems = { ...order, items: await storage.getOrderItemsWithProducts(order.id) };

      if (webSocketServer) {
        emitWebOrderCreated(webSocketServer, branchId ?? "", orderWithItems);
      }

      res.status(201).json(orderWithItems);
    } catch (error) {
      console.error("Error creating web order:", error);
      res.status(500).json({ error: "Failed to create order", message: error instanceof Error ? error.message : String(error) });
    }
  });

  // Public API endpoints for Central Dashboard (API key authentication)
  app.get("/api/central/stats", requireApiKey, async (req, res) => {
    try {
      const { branchId } = req.query;
      const settings = await storage.getSettings();
      const stats = await storage.getSalesStats(branchId as string | undefined);
      
      // Get products count using paginated method (more efficient)
      const productsResult = await storage.getProductsPaginated(
        branchId as string | undefined,
        1, // limit
        0, // offset
        undefined, // search
        undefined, // categoryId
        undefined, // minPrice
        undefined, // maxPrice
        undefined, // inStock
        undefined, // dateFrom
        undefined, // dateTo
        undefined, // hasShortage
        undefined, // status
        undefined  // threshold
      );
      const totalProducts = productsResult.total;
      
      // Get active orders (draft orders) count
      const draftOrdersResult = await storage.getOrdersPaginated(
        branchId as string | undefined,
        1, // limit
        0, // offset
        undefined, // search
        undefined, // paymentMethod
        undefined, // paymentStatus
        undefined, // minAmount
        undefined, // maxAmount
        undefined, // dateFrom
        undefined, // dateTo
        undefined  // productSearch
      );
      // We need to count draft orders specifically, so get all and filter
      const allOrders = await storage.getOrders(branchId as string | undefined);
      const activeOrders = allOrders.filter(o => o.status === 'draft').length;
      const totalOrders = allOrders.filter(o => o.status === 'completed').length;
      
      res.json({
        totalSales: stats.totalRevenue,
        totalOrders,
        totalProducts,
        activeOrders,
        totalRevenue: stats.totalRevenue,
        averageOrderValue: stats.averageOrderValue,
        appName: settings?.appName || undefined,
      });
    } catch (error) {
      console.error("Error fetching central stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/central/orders", requireApiKey, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string | undefined;
      const search = (req.query.search as string)?.trim() || undefined;
      const branchId = req.query.branchId as string | undefined;
      
      const result = await storage.getOrdersPaginated(
        branchId,
        limit,
        offset,
        search, // order number / search
        undefined, // paymentMethod
        status === 'all' ? undefined : status, // paymentStatus
        undefined, // minAmount
        undefined, // maxAmount
        undefined, // dateFrom
        undefined, // dateTo
        undefined  // productSearch
      );
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching central orders:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  app.get("/api/central/products", requireApiKey, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const search = req.query.search as string | undefined;
      const categoryId = req.query.categoryId as string | undefined;
      
      const result = await storage.getProductsPaginated(
        undefined, // branchId
        limit,
        offset,
        search,
        categoryId
      );
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching central products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/central/sales-summary", requireApiKey, async (req, res) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(0);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      const items = await storage.getSalesSummary(startDate, endDate);
      res.json({ items: items || [], total: (items || []).length });
    } catch (error) {
      console.error("Error fetching central sales summary:", error);
      res.status(500).json({ error: "Failed to fetch sales summary" });
    }
  });

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }

      const user = await storage.validateUserCredentials(username, password);
      
      if (user) {
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;
        req.session.userType = "user";

        // Explicitly save the session before responding
        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });

        auditLog(req, { action: "login", entityType: "user", entityId: user.id, entityName: user.username, description: "User logged in" });

        return res.json({
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          userType: "user",
        });
      }

      const branch = await storage.validateBranchCredentials(username, password);
      
      if (branch) {
        req.session.branchId = branch.id;
        req.session.username = branch.username;
        req.session.role = "branch";
        req.session.userType = "branch";

        // Explicitly save the session before responding
        await new Promise<void>((resolve, reject) => {
          req.session.save((err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });

        auditLog(req, { action: "login", entityType: "branch", entityId: branch.id, entityName: branch.username, description: "Branch logged in" });

        return res.json({
          id: branch.id,
          username: branch.username,
          name: branch.name,
          location: branch.location,
          role: "branch",
          userType: "branch",
        });
      }

      return res.status(401).json({ error: "Invalid credentials" });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    const entityType = req.session?.userType === "branch" ? "branch" : "user";
    const entityId = req.session?.userId ?? req.session?.branchId ?? undefined;
    const entityName = req.session?.username ?? undefined;
    auditLog(req, { action: "logout", entityType, entityId, entityName, description: "Logged out" });
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/session", async (req, res) => {
    if (req.session.userId) {
      const user = await storage.getUser(req.session.userId);
      if (user) {
        // Get user's permissions
        let permissions: string[] = [];
        
        // Admin users have all permissions
        if (user.role === "admin") {
          permissions = ["*"]; // Special marker for all permissions
        } else {
          // Try to get roleId from user, or look it up by role name
          let roleId = user.roleId;
          
          // If no roleId but user has a role name, look it up (case-insensitive)
          if (!roleId && user.role) {
            // Try exact match first
            let role = await storage.getRoleByName(user.role);
            
            // If not found, try case-insensitive lookup
            if (!role) {
              const allRoles = await storage.getRoles();
              role = allRoles.find(r => r.name.toLowerCase() === user.role?.toLowerCase());
            }
            
            if (role) {
              roleId = role.id;
            }
          }
          
          // Fetch permissions if we have a roleId
          if (roleId) {
            const rolePermissions = await storage.getPermissionsForRole(roleId);
            permissions = rolePermissions.map(p => p.name);
          }
        }
        
        return res.json({
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          roleId: user.roleId,
          permissions,
          userType: "user",
        });
      }
    }
    
    if (req.session.branchId) {
      const branch = await storage.getBranch(req.session.branchId);
      if (branch) {
        return res.json({
          id: branch.id,
          username: branch.username,
          name: branch.name,
          location: branch.location,
          role: "branch",
          permissions: ["*"], // Branches have all permissions
          userType: "branch",
        });
      }
    }
    
    res.status(401).json({ error: "Not authenticated" });
  });

  // Public settings endpoint (for login page branding)
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  // Change password endpoint (requires authentication but before global middleware)
  app.put("/api/auth/change-password", requireAuth, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "New password must be at least 6 characters long" });
      }

      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify current password
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await storage.updateUser(userId, { password: hashedPassword });

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Apply authentication middleware to all /api routes except /api/central/* (those use API key)
  app.use("/api", (req: Request, res: Response, next: NextFunction) => {
    // req.path is relative to mount point, so /api/central/orders becomes /central/orders
    if (req.path.startsWith("/central")) {
      return next();
    }
    return requireAuth(req, res, next);
  });

  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.get("/api/categories/:id", async (req, res) => {
    try {
      const category = await storage.getCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch category" });
    }
  });

  app.post("/api/categories", requireAnyPermission(["items.create", "inventory.create"]), async (req, res) => {
    try {
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validatedData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid category data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.patch("/api/categories/:id", async (req, res) => {
    try {
      const category = await storage.updateCategory(req.params.id, req.body);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCategory(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  app.get("/api/products", async (req, res) => {
    try {
      const { categoryId, branchId, limit, offset, search, minPrice, maxPrice, inStock, dateFrom, dateTo, hasShortage, status, threshold } = req.query;
      
      // If pagination parameters are provided, use paginated endpoint
      if (limit !== undefined || offset !== undefined || search || minPrice || maxPrice || inStock !== undefined || dateFrom || dateTo || hasShortage !== undefined || status) {
        const limitNum = limit ? parseInt(limit as string, 10) : 50;
        const offsetNum = offset ? parseInt(offset as string, 10) : 0;
        const minPriceNum = minPrice ? parseFloat(minPrice as string) : undefined;
        const maxPriceNum = maxPrice ? parseFloat(maxPrice as string) : undefined;
        const inStockBool = inStock !== undefined ? inStock === 'true' : undefined;
        const dateFromDate = dateFrom ? new Date(dateFrom as string) : undefined;
        const dateToDate = dateTo ? new Date(dateTo as string) : undefined;
        const hasShortageBool = hasShortage !== undefined ? hasShortage === 'true' : undefined;
        const statusValue = status as "in_stock" | "low_stock" | "out_of_stock" | undefined;
        const thresholdNum = threshold ? parseInt(threshold as string, 10) : 10;
        
        const result = await storage.getProductsPaginated(
          branchId as string | undefined,
          limitNum,
          offsetNum,
          categoryId as string | undefined,
          search as string | undefined,
          minPriceNum,
          maxPriceNum,
          inStockBool,
          dateFromDate,
          dateToDate,
          hasShortageBool,
          statusValue,
          thresholdNum
        );
        res.json(result);
      } else {
        // Legacy endpoint for backward compatibility
        const products = categoryId
          ? await storage.getProductsByCategory(categoryId as string, branchId as string | undefined)
          : await storage.getProducts(branchId as string | undefined);
        res.json(products);
      }
    } catch (error) {
      console.error("GET /api/products error:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.get("/api/products/barcode/:barcode", async (req, res) => {
    try {
      const product = await storage.getProductByBarcode(req.params.barcode);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch product by barcode" });
    }
  });

  app.post("/api/products", requireAnyPermission(["items.create", "inventory.create"]), async (req, res) => {
    try {
      const validatedData = insertProductSchema.parse(req.body);
      
      // Check for duplicate name
      const existingProduct = await storage.getProductByName(validatedData.name);
      if (existingProduct) {
        return res.status(409).json({ error: "Already uploaded" });
      }
      
      // Auto-generate barcode if not provided (use product ID after creation)
      const productData = { ...validatedData };
      if (!productData.barcode) {
        // Will be set to product ID after creation
        productData.barcode = undefined;
      }
      
      const product = await storage.createProduct(productData);
      
      // If barcode was not provided, set it to product ID
      if (!product.barcode) {
        const updatedProduct = await storage.updateProduct(product.id, { barcode: product.id });
        res.status(201).json(updatedProduct || product);
      } else {
        res.status(201).json(product);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid product data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.post("/api/products/bulk", requireAnyPermission(["items.edit", "inventory.edit"]), async (req, res) => {
    try {
      const items = req.body.items;
      if (!Array.isArray(items)) {
        return res.status(400).json({ error: "Items must be an array" });
      }

      const results = {
        imported: 0,
        updated: 0,
        failed: 0,
        errors: [] as Array<{ row: number; name: string; error: string }>
      };

      // Normalize numeric string for PostgreSQL decimal (comma→dot, strip non-numeric; output valid decimal string)
      const toDecimalString = (v: unknown): string | undefined => {
        if (v == null || v === "") return undefined;
        const s = String(v).trim().replace(/,/g, ".").replace(/\s/g, "");
        const cleaned = s.replace(/[^\d.-]/g, "");
        const n = parseFloat(cleaned);
        if (Number.isNaN(n)) return undefined;
        return String(n);
      };

      for (let i = 0; i < items.length; i++) {
        try {
          const raw = items[i];
          // Coerce and normalize Excel/CSV values for decimal columns (PostgreSQL accepts numeric strings)
          const priceStr = toDecimalString(raw.price);
          const qtyStr = toDecimalString(raw.quantity);
          const costStr = toDecimalString(raw.purchaseCost);
          const item: Record<string, unknown> = {
            ...raw,
            price: priceStr ?? (raw.price != null ? String(raw.price).trim() : undefined),
            quantity: qtyStr ?? "0",
            purchaseCost: costStr,
          };
          // Normalize size-based pricing from Excel (ensure values are strings)
          if (item.sizePrices && typeof item.sizePrices === "object" && !Array.isArray(item.sizePrices)) {
            item.sizePrices = Object.fromEntries(
              Object.entries(item.sizePrices).map(([k, v]) => [k, v != null ? String(v) : ""])
            );
          }
          if (item.sizePurchasePrices && typeof item.sizePurchasePrices === "object" && !Array.isArray(item.sizePurchasePrices)) {
            item.sizePurchasePrices = Object.fromEntries(
              Object.entries(item.sizePurchasePrices).map(([k, v]) => [k, v != null ? String(v) : ""])
            );
          }
          // Allow empty/undefined price only when size-based pricing is provided
          const hasSizePrices = item.sizePrices && typeof item.sizePrices === "object" && Object.keys(item.sizePrices as object).length > 0;
          if ((item.price === undefined || item.price === "") && !hasSizePrices) {
            throw new Error("Price is required and must be a valid number (or use size-based pricing with Sale S/M/L)");
          }
          if (hasSizePrices && (item.price === undefined || item.price === "")) {
            item.price = "0";
          }
          const validatedData = insertProductSchema.parse(item);

          const existingProduct = await storage.getProductByName(validatedData.name);
          if (existingProduct) {
            await storage.updateProduct(existingProduct.id, validatedData);
            results.updated++;
            continue;
          }

          await storage.createProduct(validatedData);
          results.imported++;
        } catch (error) {
          results.failed++;
          const errorMsg = error instanceof z.ZodError
            ? error.errors.map(e => e.message).join(", ")
            : error instanceof Error
              ? error.message
              : String(error);
          results.errors.push({
            row: i + 2, // +2 because row 1 is header and array is 0-indexed
            name: items[i]?.name || "Unknown",
            error: errorMsg
          });
        }
      }

      res.status(200).json(results);
    } catch (error) {
      res.status(500).json({ error: "Failed to process bulk import" });
    }
  });

  app.patch("/api/products/:id", requireAnyPermission(["items.edit", "inventory.edit"]), async (req, res) => {
    try {
      // Get current product
      const currentProduct = await storage.getProduct(req.params.id);
      if (!currentProduct) {
        return res.status(404).json({ error: "Product not found" });
      }

      // If name is being updated, check for duplicates
      if (req.body.name && req.body.name !== currentProduct.name) {
        const existingProduct = await storage.getProductByName(req.body.name, req.params.id);
        if (existingProduct) {
          return res.status(409).json({ error: "Duplicate name" });
        }
      }

      // Normalize body: empty string -> undefined for optional decimals (Zod .optional() accepts undefined); ensure size price values are strings (JSON may send numbers)
      const body = { ...req.body } as Record<string, unknown>;
      if (body.purchaseCost === "") body.purchaseCost = undefined;
      if (body.price === "") body.price = undefined;
      if (body.quantity === "") body.quantity = undefined;
      if (body.sizePrices && typeof body.sizePrices === "object" && !Array.isArray(body.sizePrices)) {
        body.sizePrices = Object.fromEntries(
          Object.entries(body.sizePrices).map(([k, v]) => [k, v != null ? String(v) : ""])
        );
      }
      if (body.sizePurchasePrices && typeof body.sizePurchasePrices === "object" && !Array.isArray(body.sizePurchasePrices)) {
        body.sizePurchasePrices = Object.fromEntries(
          Object.entries(body.sizePurchasePrices).map(([k, v]) => [k, v != null ? String(v) : ""])
        );
      }

      // Validate and allow only schema fields; strip unknown keys
      const updateSchema = insertProductSchema.partial().strip();
      const updates = updateSchema.parse(body);

      // Check if the data is actually being changed (skip for jsonb - compare by JSON stringify)
      if (updates.name && updates.name === currentProduct.name) {
        const hasOtherChanges = Object.keys(updates).some(key => {
          if (key === "name") return false;
          const a = updates[key];
          const b = (currentProduct as any)[key];
          if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
            return JSON.stringify(a) !== JSON.stringify(b);
          }
          return a !== b;
        });
        if (!hasOtherChanges) {
          return res.status(409).json({ error: "Already updated" });
        }
      }

      const product = await storage.updateProduct(req.params.id, updates);
      res.json(product);
    } catch (error) {
      console.error("PATCH /api/products/:id error:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", requireAnyPermission(["items.delete", "inventory.delete"]), async (req, res) => {
    try {
      const deleted = await storage.deleteProduct(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  app.get("/api/tables", async (req, res) => {
    try {
      const { branchId } = req.query;
      const tables = await storage.getTables(branchId as string | undefined);
      res.json(tables);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tables" });
    }
  });

  app.get("/api/tables/:id", async (req, res) => {
    try {
      const table = await storage.getTable(req.params.id);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }
      res.json(table);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch table" });
    }
  });

  app.get("/api/tables/:id/order", async (req, res) => {
    try {
      const table = await storage.getTable(req.params.id);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }
      
      const order = await storage.getTableCurrentOrder(req.params.id);
      if (!order) {
        return res.json(null);
      }
      
      const items = await storage.getOrderItemsWithProducts(order.id);
      const itemsWithProductName = items.map(item => ({
        ...item,
        productName: item.product.name,
      }));
      
      res.json({ ...order, items: itemsWithProductName });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch table order" });
    }
  });

  app.post("/api/tables", requirePermission("sales.create"), async (req, res) => {
    try {
      const validatedData = insertTableSchema.parse(req.body);
      const table = await storage.createTable(validatedData);
      res.status(201).json(table);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid table data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create table" });
    }
  });

  app.patch("/api/tables/:id", requirePermission("sales.edit"), async (req, res) => {
    try {
      const validatedData = insertTableSchema.partial().parse(req.body);
      const table = await storage.updateTable(req.params.id, validatedData);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }
      res.json(table);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid table data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update table" });
    }
  });

  app.patch("/api/tables/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      const table = await storage.updateTableStatus(req.params.id, status);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }
      res.json(table);
    } catch (error) {
      res.status(500).json({ error: "Failed to update table status" });
    }
  });

  app.delete("/api/tables/:id", requirePermission("sales.delete"), async (req, res) => {
    try {
      const deleted = await storage.deleteTable(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Table not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete table" });
    }
  });

  app.get("/api/orders", async (req, res) => {
    try {
      const { branchId } = req.query;
      const orders = await storage.getOrders(branchId as string | undefined);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  app.get("/api/orders/paginated", async (req, res) => {
    try {
      const { 
        branchId, 
        page = "1", 
        limit = "10", 
        search, 
        paymentMethod, 
        paymentStatus, 
        dateFrom, 
        dateTo,
        productSearch,
        months: monthsParam
      } = req.query;
      
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;
      
      // Parse months (comma-separated YYYY-MM)
      let months: string[] | undefined;
      if (monthsParam && typeof monthsParam === "string" && monthsParam.trim()) {
        months = monthsParam.split(",").map((m) => m.trim()).filter(Boolean);
      }
      
      // Parse dates
      let parsedDateFrom: Date | undefined;
      if (dateFrom && typeof dateFrom === "string" && dateFrom.trim()) {
        const date = new Date(dateFrom);
        if (!isNaN(date.getTime())) {
          parsedDateFrom = date;
        }
      }
      
      let parsedDateTo: Date | undefined;
      if (dateTo && typeof dateTo === "string" && dateTo.trim()) {
        const date = new Date(dateTo);
        if (!isNaN(date.getTime())) {
          parsedDateTo = date;
        }
      }
      
      const result = await storage.getOrdersPaginated(
        branchId as string | undefined,
        limitNum,
        offset,
        search && typeof search === "string" && search.trim() ? search.trim() : undefined,
        paymentMethod && typeof paymentMethod === "string" && paymentMethod !== "all" ? paymentMethod : undefined,
        paymentStatus && typeof paymentStatus === "string" && paymentStatus !== "all" ? paymentStatus : undefined,
        undefined,
        undefined,
        parsedDateFrom,
        parsedDateTo,
        productSearch && typeof productSearch === "string" && productSearch.trim() ? productSearch.trim() : undefined,
        months
      );
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching paginated orders:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // Export all sales (orders) matching current filters - no pagination limit
  app.get("/api/orders/export", async (req, res) => {
    try {
      const { 
        branchId, 
        search, 
        paymentMethod, 
        paymentStatus, 
        dateFrom, 
        dateTo,
        productSearch,
        months: monthsParam
      } = req.query;
      
      let months: string[] | undefined;
      if (monthsParam && typeof monthsParam === "string" && monthsParam.trim()) {
        months = monthsParam.split(",").map((m) => m.trim()).filter(Boolean);
      }
      
      let parsedDateFrom: Date | undefined;
      if (dateFrom && typeof dateFrom === "string" && dateFrom.trim()) {
        const d = new Date(dateFrom);
        if (!isNaN(d.getTime())) parsedDateFrom = d;
      }
      let parsedDateTo: Date | undefined;
      if (dateTo && typeof dateTo === "string" && dateTo.trim()) {
        const d = new Date(dateTo);
        if (!isNaN(d.getTime())) parsedDateTo = d;
      }
      
      const result = await storage.getOrdersPaginated(
        branchId as string | undefined,
        50000,
        0,
        search && typeof search === "string" && search.trim() ? search.trim() : undefined,
        paymentMethod && typeof paymentMethod === "string" && paymentMethod !== "all" ? paymentMethod : undefined,
        paymentStatus && typeof paymentStatus === "string" && paymentStatus !== "all" ? paymentStatus : undefined,
        undefined,
        undefined,
        parsedDateFrom,
        parsedDateTo,
        productSearch && typeof productSearch === "string" && productSearch.trim() ? productSearch.trim() : undefined,
        months
      );
      
      res.json({ orders: result.orders });
    } catch (error) {
      console.error("Error exporting orders:", error);
      res.status(500).json({ error: "Failed to export orders" });
    }
  });

  app.get("/api/sales/stats", async (req, res) => {
    try {
      const { branchId, dateFrom, dateTo, months: monthsParam, paymentMethod, paymentStatus, search } = req.query;
      let months: string[] | undefined;
      if (monthsParam && typeof monthsParam === "string" && monthsParam.trim()) {
        months = monthsParam.split(",").map((m) => m.trim()).filter(Boolean);
      }
      let parsedDateFrom: Date | undefined;
      if (dateFrom && typeof dateFrom === "string") {
        const d = new Date(dateFrom);
        if (!isNaN(d.getTime())) parsedDateFrom = d;
      }
      let parsedDateTo: Date | undefined;
      if (dateTo && typeof dateTo === "string") {
        const d = new Date(dateTo);
        if (!isNaN(d.getTime())) parsedDateTo = d;
      }
      const filters = (parsedDateFrom != null || parsedDateTo != null || (months && months.length > 0) || (paymentMethod && typeof paymentMethod === "string" && paymentMethod !== "all") || (paymentStatus && typeof paymentStatus === "string" && paymentStatus !== "all") || (search && typeof search === "string" && search.trim()))
        ? {
            dateFrom: parsedDateFrom,
            dateTo: parsedDateTo,
            months,
            paymentMethod: paymentMethod as string | undefined,
            paymentStatus: paymentStatus as string | undefined,
            search: typeof search === "string" && search.trim() ? search.trim() : undefined,
          }
        : undefined;
      const stats = await storage.getSalesStats(branchId as string | undefined, filters);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching sales stats:", error);
      res.status(500).json({ error: "Failed to fetch sales stats" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      const items = await storage.getOrderItemsWithProducts(order.id);
      res.json({ ...order, items });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  app.get("/api/orders/:id/items", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      const items = await storage.getOrderItemsWithProducts(order.id);
      // Return items with full product objects, not just productName
      const itemsWithProducts = items
        .filter(item => item.product) // Filter out items with null products
        .map(item => ({
          id: item.id,
          orderId: item.orderId,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
          itemDiscount: item.itemDiscount || "0",
          itemDiscountType: item.itemDiscountType || "amount",
          selectedSize: item.selectedSize || undefined, // Include selected size
          product: item.product, // Include full product object
          productName: item.product.name, // Keep for backward compatibility
        }));
      res.json(itemsWithProducts);
    } catch (error) {
      console.error("Error fetching order items:", error);
      res.status(500).json({ error: "Failed to fetch order items" });
    }
  });

  app.post("/api/orders/:id/items", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      const { productId, quantity, price, total, itemDiscount, itemDiscountType, selectedSize } = req.body;
      if (!productId || !quantity || !price || !total) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const orderItem = await storage.createOrderItem({
        orderId: req.params.id,
        productId,
        quantity: quantity.toString(),
        price,
        total,
        itemDiscount: itemDiscount || "0",
        itemDiscountType: itemDiscountType || "amount",
        selectedSize: selectedSize || undefined,
      });

      const allItems = await storage.getOrderItems(req.params.id);
      const newSubtotal = allItems.reduce((sum, item) => sum + parseFloat(item.total), 0).toFixed(2);
      const currentDiscount = parseFloat(order.discount) || 0;
      const newTotal = (parseFloat(newSubtotal) - currentDiscount).toFixed(2);

      await storage.updateOrder(req.params.id, {
        subtotal: newSubtotal,
        total: newTotal,
      });

      res.status(201).json(orderItem);
    } catch (error) {
      res.status(500).json({ error: "Failed to add item to order" });
    }
  });

  app.post("/api/orders", requirePermission("sales.create"), async (req, res) => {
    try {
      const validatedData = createOrderWithItemsSchema.parse(req.body);
      const { items, ...orderData } = validatedData;
      
      // Use createOrderWithItems which handles inventory deduction automatically
      const order = await storage.createOrderWithItems(orderData, items);

      if (orderData.tableId) {
        await storage.updateTableStatus(orderData.tableId, "occupied");
      }
      
      const orderWithItems = {
        ...order,
        items: await storage.getOrderItemsWithProducts(order.id),
      };

      auditLog(req, { action: "create", entityType: "order", entityId: order.id, description: `Order ${order.id} created` });

      res.status(201).json(orderWithItems);
    } catch (error) {
      console.error("Error creating order:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid order data", details: error.errors });
      }
      res.status(500).json({ 
        error: "Failed to create order",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.patch("/api/orders/:id", requireOrderEditOrDraft(), async (req, res) => {
    try {
      const updates: any = { ...req.body };
      
      // Check if items are provided - if so, use updateOrderWithItems
      if (updates.items && Array.isArray(updates.items)) {
        const { items, ...orderData } = updates;
        
        // Convert createdAt from ISO string to Date if provided
        if (orderData.createdAt && typeof orderData.createdAt === 'string') {
          orderData.createdAt = new Date(orderData.createdAt);
        }
        
        const order = await storage.updateOrderWithItems(req.params.id, orderData, items);
        if (!order) {
          return res.status(404).json({ error: "Order not found" });
        }
        
        const orderWithItems = {
          ...order,
          items: await storage.getOrderItemsWithProducts(order.id),
        };

        auditLog(req, { action: "update", entityType: "order", entityId: order.id, description: `Order ${order.id} updated` });

        res.json(orderWithItems);
      } else {
        // Regular order update without items
        // Convert createdAt from ISO string to Date if provided
        if (updates.createdAt && typeof updates.createdAt === 'string') {
          updates.createdAt = new Date(updates.createdAt);
        }
        
        const order = await storage.updateOrder(req.params.id, updates);
        if (!order) {
          return res.status(404).json({ error: "Order not found" });
        }
        auditLog(req, { action: "update", entityType: "order", entityId: order.id, description: `Order ${order.id} updated` });
        res.json(order);
      }
    } catch (error) {
      console.error("Error updating order:", error);
      res.status(500).json({ 
        error: "Failed to update order",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.patch("/api/orders/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      const order = await storage.updateOrderStatus(req.params.id, status);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to update order status" });
    }
  });

  app.delete("/api/orders/:id", requireOrderDeleteOrDraft(), async (req, res) => {
    try {
      const deleted = await storage.deleteOrder(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Order not found" });
      }
      auditLog(req, { action: "delete", entityType: "order", entityId: req.params.id, description: `Order ${req.params.id} deleted` });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete order" });
    }
  });

  app.get("/api/orders/drafts", async (req, res) => {
    try {
      const drafts = await storage.getDraftOrders();
      const draftsWithItems = await Promise.all(
        drafts.map(async (draft) => {
          const items = await storage.getOrderItemsWithProducts(draft.id);
          return { ...draft, items };
        })
      );
      res.json(draftsWithItems);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch draft orders" });
    }
  });

  app.get("/api/orders/qr", async (req, res) => {
    try {
      const qrOrders = await storage.getQROrders();
      const qrOrdersWithItems = await Promise.all(
        qrOrders.map(async (order) => {
          const items = await storage.getOrderItemsWithProducts(order.id);
          return { ...order, items };
        })
      );
      res.json(qrOrdersWithItems);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch QR orders" });
    }
  });

  app.get("/api/orders/web", requireAuth, async (req, res) => {
    try {
      const branchId = (req.query.branchId as string) || req.session?.branchId || undefined;
      const webOrders = await storage.getWebOrders(branchId);
      const webOrdersWithItems = await Promise.all(
        webOrders.map(async (order) => {
          const items = await storage.getOrderItemsWithProducts(order.id);
          return { ...order, items };
        })
      );
      res.json(webOrdersWithItems);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch web orders" });
    }
  });

  app.patch("/api/orders/:id/accept", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getOrder(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Order not found" });
      }
      if (existing.orderSource !== "web" || existing.status !== "web-pending") {
        return res.status(400).json({ error: "Only web-pending web orders can be accepted" });
      }
      const order = await storage.updateOrderStatus(req.params.id, "pending");
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to accept order" });
    }
  });

  app.patch("/api/orders/:id/reject", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getOrder(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Order not found" });
      }
      if (existing.orderSource !== "web" || existing.status !== "web-pending") {
        return res.status(400).json({ error: "Only web-pending web orders can be rejected" });
      }
      const order = await storage.updateOrderStatus(req.params.id, "cancelled");
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to reject order" });
    }
  });

  app.get("/api/sales", async (req, res) => {
    try {
      const sales = await storage.getCompletedOrders();
      res.json(sales);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sales" });
    }
  });

  app.get("/api/reports/items", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "Start date and end date are required" });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);

      const itemSales = await storage.getSalesSummary(start, end);
      res.json(itemSales);
    } catch (error) {
      console.error("Error fetching item sales:", error);
      res.status(500).json({ error: "Failed to fetch item sales" });
    }
  });

  app.post("/api/sales/import", async (req, res) => {
    try {
      const { sales: salesData } = req.body;
      
      if (!Array.isArray(salesData) || salesData.length === 0) {
        return res.status(400).json({ error: "Invalid sales data. Expected an array of sales." });
      }

      const results = {
        success: 0,
        failed: 0,
        errors: [] as Array<{ index: number; orderNumber: string; error: string }>,
      };

      for (let i = 0; i < salesData.length; i++) {
        const saleData = salesData[i];
        try {
          // Validate required fields
          if (!saleData.orderNumber && !saleData.total) {
            results.failed++;
            results.errors.push({
              index: i + 1,
              orderNumber: saleData.orderNumber || 'N/A',
              error: "Missing required fields: orderNumber or total",
            });
            continue;
          }

          // Prepare order data
          const orderData: any = {
            orderNumber: saleData.orderNumber || undefined, // Will be generated if not provided
            customerName: saleData.customerName || "Walk-in Customer",
            customerPhone: saleData.customerPhone || null,
            subtotal: saleData.subtotal || saleData.total || "0",
            discount: saleData.discount || "0",
            discountType: "amount",
            total: saleData.total || saleData.subtotal || "0",
            paymentMethod: saleData.paymentMethod || "cash",
            paymentStatus: saleData.paymentStatus || "paid",
            status: saleData.status || "completed",
            diningOption: saleData.diningOption || "dine-in",
            orderSource: "import",
          };

          // Set createdAt if provided
          if (saleData.createdAt) {
            orderData.createdAt = new Date(saleData.createdAt);
          }

          // Set completedAt if status is completed
          if (orderData.status === "completed") {
            orderData.completedAt = orderData.createdAt ? new Date(orderData.createdAt) : new Date();
          }

          // Set paidAmount based on payment status
          if (orderData.paymentStatus === "paid") {
            orderData.paidAmount = orderData.total;
          } else {
            orderData.paidAmount = "0";
          }

          // Create the order
          await storage.createOrder(orderData);
          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push({
            index: i + 1,
            orderNumber: saleData.orderNumber || 'N/A',
            error: error.message || "Unknown error",
          });
        }
      }

      res.json({
        message: `Import completed: ${results.success} successful, ${results.failed} failed`,
        results,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to import sales", message: error.message });
    }
  });

  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const filter = (req.query.filter as string) || "today";
      const customDate = req.query.date as string | undefined;
      const startDateParam = req.query.startDate as string | undefined;
      const endDateParam = req.query.endDate as string | undefined;
      const { startDate, endDate } = getDateRange(filter, customDate, startDateParam, endDateParam);
      const stats = await storage.getDashboardStats(startDate, endDate);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/dashboard/sales-by-category", async (req, res) => {
    try {
      const filter = (req.query.filter as string) || "today";
      const customDate = req.query.date as string | undefined;
      const startDateParam = req.query.startDate as string | undefined;
      const endDateParam = req.query.endDate as string | undefined;
      const { startDate, endDate } = getDateRange(filter, customDate, startDateParam, endDateParam);
      const sales = await storage.getSalesByCategory(startDate, endDate);
      res.json(sales);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sales by category" });
    }
  });

  app.get("/api/dashboard/sales-by-payment-method", async (req, res) => {
    try {
      const filter = (req.query.filter as string) || "today";
      const customDate = req.query.date as string | undefined;
      const startDateParam = req.query.startDate as string | undefined;
      const endDateParam = req.query.endDate as string | undefined;
      const { startDate, endDate } = getDateRange(filter, customDate, startDateParam, endDateParam);
      const sales = await storage.getSalesByPaymentMethod(startDate, endDate);
      res.json(sales);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sales by payment method" });
    }
  });

  app.get("/api/dashboard/popular-products", async (req, res) => {
    try {
      const filter = (req.query.filter as string) || "today";
      const customDate = req.query.date as string | undefined;
      const startDateParam = req.query.startDate as string | undefined;
      const endDateParam = req.query.endDate as string | undefined;
      const { startDate, endDate } = getDateRange(filter, customDate, startDateParam, endDateParam);
      const products = await storage.getPopularProducts(startDate, endDate);
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch popular products" });
    }
  });

  app.get("/api/sales/summary", async (req, res) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(0);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      const summary = await storage.getSalesSummary(startDate, endDate);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sales summary" });
    }
  });

  app.get("/api/sales/summary/paginated", async (req, res) => {
    try {
      const { 
        startDate: startDateStr, 
        endDate: endDateStr,
        branchId,
        page = "1",
        limit = "10",
        search
      } = req.query;
      
      const startDate = startDateStr ? new Date(startDateStr as string) : new Date(0);
      const endDate = endDateStr ? new Date(endDateStr as string) : new Date();
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;
      
      const result = await storage.getSalesSummaryPaginated(
        startDate,
        endDate,
        branchId as string | undefined,
        limitNum,
        offset,
        search as string | undefined
      );
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching paginated sales summary:", error);
      res.status(500).json({ error: "Failed to fetch sales summary" });
    }
  });

  app.get("/api/dashboard/recent-orders", async (req, res) => {
    try {
      const filter = (req.query.filter as string) || "today";
      const customDate = req.query.date as string | undefined;
      const startDateParam = req.query.startDate as string | undefined;
      const endDateParam = req.query.endDate as string | undefined;
      const { startDate, endDate } = getDateRange(filter, customDate, startDateParam, endDateParam);
      const orders = await storage.getRecentOrders(startDate, endDate);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch recent orders" });
    }
  });

  // Units API endpoints
  app.get("/api/units", async (req, res) => {
    try {
      const unitsList = await storage.getUnits();
      res.json(unitsList);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch units" });
    }
  });

  app.get("/api/units/:id", async (req, res) => {
    try {
      const unit = await storage.getUnit(req.params.id);
      if (!unit) {
        return res.status(404).json({ error: "Unit not found" });
      }
      res.json(unit);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unit" });
    }
  });

  app.post("/api/units", requirePermission("settings.edit"), async (req, res) => {
    try {
      const validatedData = insertUnitSchema.parse(req.body);
      const unit = await storage.createUnit(validatedData);
      res.status(201).json(unit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid unit data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create unit" });
    }
  });

  app.patch("/api/units/:id", requirePermission("settings.edit"), async (req, res) => {
    try {
      const updates = req.body;
      const unit = await storage.updateUnit(req.params.id, updates);
      if (!unit) {
        return res.status(404).json({ error: "Unit not found" });
      }
      res.json(unit);
    } catch (error) {
      res.status(500).json({ error: "Failed to update unit" });
    }
  });

  app.delete("/api/units/:id", requirePermission("settings.edit"), async (req, res) => {
    try {
      const deleted = await storage.deleteUnit(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Unit not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete unit" });
    }
  });

  app.get("/api/expense-categories", async (req, res) => {
    try {
      const categories = await storage.getExpenseCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expense categories" });
    }
  });

  app.get("/api/expense-categories/:id", async (req, res) => {
    try {
      const category = await storage.getExpenseCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ error: "Expense category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expense category" });
    }
  });

  app.post("/api/expense-categories", async (req, res) => {
    try {
      const validatedData = insertExpenseCategorySchema.parse(req.body);
      const category = await storage.createExpenseCategory(validatedData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid category data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create expense category" });
    }
  });

  app.patch("/api/expense-categories/:id", async (req, res) => {
    try {
      const category = await storage.updateExpenseCategory(req.params.id, req.body);
      if (!category) {
        return res.status(404).json({ error: "Expense category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ error: "Failed to update expense category" });
    }
  });

  app.delete("/api/expense-categories/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteExpenseCategory(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Expense category not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete expense category" });
    }
  });

  app.get("/api/expenses", async (req, res) => {
    try {
      const { branchId, dateFrom: dateFromStr, dateTo: dateToStr, months: monthsParam, categoryId } = req.query;
      let dateFrom: Date | undefined;
      if (dateFromStr && typeof dateFromStr === "string") {
        const d = new Date(dateFromStr);
        if (!isNaN(d.getTime())) dateFrom = d;
      }
      let dateTo: Date | undefined;
      if (dateToStr && typeof dateToStr === "string") {
        const d = new Date(dateToStr);
        if (!isNaN(d.getTime())) dateTo = d;
      }
      let months: string[] | undefined;
      if (monthsParam && typeof monthsParam === "string" && monthsParam.trim()) {
        months = monthsParam.split(",").map((m) => m.trim()).filter(Boolean);
      }
      const expenses = await storage.getExpenses(branchId as string | undefined, dateFrom, dateTo, months, categoryId as string | undefined);
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.get("/api/expenses/export", async (req, res) => {
    try {
      const { branchId, dateFrom: dateFromStr, dateTo: dateToStr, months: monthsParam, categoryId } = req.query;
      let dateFrom: Date | undefined;
      if (dateFromStr && typeof dateFromStr === "string") {
        const d = new Date(dateFromStr);
        if (!isNaN(d.getTime())) dateFrom = d;
      }
      let dateTo: Date | undefined;
      if (dateToStr && typeof dateToStr === "string") {
        const d = new Date(dateToStr);
        if (!isNaN(d.getTime())) dateTo = d;
      }
      let months: string[] | undefined;
      if (monthsParam && typeof monthsParam === "string" && monthsParam.trim()) {
        months = monthsParam.split(",").map((m) => m.trim()).filter(Boolean);
      }
      const expenses = await storage.getExpenses(branchId as string | undefined, dateFrom, dateTo, months, categoryId as string | undefined);
      res.json({ expenses });
    } catch (error) {
      res.status(500).json({ error: "Failed to export expenses" });
    }
  });

  app.get("/api/expenses/stats", async (req, res) => {
    try {
      const { branchId, dateFrom: dateFromStr, dateTo: dateToStr, months: monthsParam, categoryId } = req.query;
      let dateFrom: Date | undefined;
      if (dateFromStr && typeof dateFromStr === "string") {
        const d = new Date(dateFromStr);
        if (!isNaN(d.getTime())) dateFrom = d;
      }
      let dateTo: Date | undefined;
      if (dateToStr && typeof dateToStr === "string") {
        const d = new Date(dateToStr);
        if (!isNaN(d.getTime())) dateTo = d;
      }
      let months: string[] | undefined;
      if (monthsParam && typeof monthsParam === "string" && monthsParam.trim()) {
        months = monthsParam.split(",").map((m) => m.trim()).filter(Boolean);
      }
      const stats = await storage.getExpenseStats(branchId as string | undefined, dateFrom, dateTo, months, categoryId as string | undefined);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching expense stats:", error);
      res.status(500).json({ error: "Failed to fetch expense stats" });
    }
  });

  app.get("/api/expenses/:id", async (req, res) => {
    try {
      const expense = await storage.getExpense(req.params.id);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expense" });
    }
  });

  app.post("/api/expenses", async (req, res) => {
    try {
      const validatedData = insertExpenseSchema.parse(req.body);
      const expense = await storage.createExpense(validatedData);
      res.status(201).json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid expense data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.patch("/api/expenses/:id", requirePermission("expenses.edit"), async (req, res) => {
    try {
      // Get the existing expense to preserve fields that aren't being updated
      const existingExpense = await storage.getExpense(req.params.id);
      if (!existingExpense) {
        return res.status(404).json({ error: "Expense not found" });
      }

      // Prepare update data - only include fields that are provided
      const updateData: any = {};
      
      if (req.body.expenseDate !== undefined) {
        updateData.expenseDate = new Date(req.body.expenseDate);
      }
      if (req.body.categoryId !== undefined) {
        updateData.categoryId = req.body.categoryId;
      }
      if (req.body.description !== undefined) {
        updateData.description = req.body.description;
      }
      if (req.body.amount !== undefined) {
        updateData.amount = req.body.amount;
      }
      if (req.body.unit !== undefined) {
        updateData.unit = req.body.unit;
      }
      if (req.body.quantity !== undefined) {
        updateData.quantity = req.body.quantity;
      }
      if (req.body.total !== undefined) {
        updateData.total = req.body.total;
      }
      
      // Handle slipImage: if it's provided and is a base64 string, use it
      // If it's empty string, set to null to remove the image
      // If it's not provided, preserve the existing image
      if (req.body.slipImage !== undefined) {
        if (req.body.slipImage === "" || req.body.slipImage === null) {
          updateData.slipImage = null;
        } else if (typeof req.body.slipImage === "string") {
          // If it's a base64 data URL, use it as-is
          // If it's a URL (starts with http), preserve it
          updateData.slipImage = req.body.slipImage;
        }
      }

      const expense = await storage.updateExpense(req.params.id, updateData);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json(expense);
    } catch (error: any) {
      console.error("Error updating expense:", error);
      res.status(500).json({ error: "Failed to update expense", details: error.message });
    }
  });

  app.delete("/api/expenses/:id", requirePermission("expenses.delete"), async (req, res) => {
    try {
      const deleted = await storage.deleteExpense(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  app.get("/api/purchases", async (req, res) => {
    try {
      const { branchId } = req.query;
      const purchases = await storage.getPurchases(branchId as string | undefined);
      res.json(purchases);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch purchases" });
    }
  });

  app.get("/api/purchases/:id", async (req, res) => {
    try {
      const purchase = await storage.getPurchase(req.params.id);
      if (!purchase) {
        return res.status(404).json({ error: "Purchase not found" });
      }
      res.json(purchase);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch purchase" });
    }
  });

  app.post("/api/purchases", requirePermission("purchases.create"), async (req, res) => {
    try {
      const validatedData = insertPurchaseSchema.parse(req.body);
      const purchase = await storage.createPurchase(validatedData);
      res.status(201).json(purchase);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid purchase data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create purchase" });
    }
  });

  app.patch("/api/purchases/:id", requirePermission("purchases.edit"), async (req, res) => {
    try {
      const purchase = await storage.updatePurchase(req.params.id, req.body);
      if (!purchase) {
        return res.status(404).json({ error: "Purchase not found" });
      }
      res.json(purchase);
    } catch (error) {
      res.status(500).json({ error: "Failed to update purchase" });
    }
  });

  app.delete("/api/purchases/:id", requirePermission("purchases.delete"), async (req, res) => {
    try {
      const deleted = await storage.deletePurchase(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Purchase not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete purchase" });
    }
  });

  app.get("/api/inventory/adjustments", async (req, res) => {
    try {
      const { branchId, productId, limit, offset, search, adjustmentType } = req.query;
      
      // If pagination parameters are provided, use paginated endpoint
      if (limit !== undefined || offset !== undefined || search || adjustmentType) {
        const limitNum = limit ? parseInt(limit as string, 10) : 50;
        const offsetNum = offset ? parseInt(offset as string, 10) : 0;
        
        const result = await storage.getInventoryAdjustmentsPaginated(
          branchId as string | undefined,
          limitNum,
          offsetNum,
          search as string | undefined,
          productId as string | undefined,
          adjustmentType as string | undefined
        );
        res.json(result);
      } else {
        // Legacy endpoint for backward compatibility
        const adjustments = productId
          ? await storage.getInventoryAdjustmentsByProduct(productId as string)
          : await storage.getInventoryAdjustments();
        res.json(adjustments);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch inventory adjustments" });
    }
  });

  app.get("/api/inventory/low-stock", async (req, res) => {
    try {
      const { branchId, threshold, limit, offset, search, categoryId } = req.query;
      const thresholdNum = threshold ? parseInt(threshold as string, 10) : 10;
      
      // If pagination parameters are provided, use paginated endpoint
      if (limit !== undefined || offset !== undefined || search || categoryId) {
        const limitNum = limit ? parseInt(limit as string, 10) : 50;
        const offsetNum = offset ? parseInt(offset as string, 10) : 0;
        
        const result = await storage.getLowStockProductsPaginated(
          branchId as string | undefined,
          thresholdNum,
          limitNum,
          offsetNum,
          search as string | undefined,
          categoryId as string | undefined
        );
        res.json(result);
      } else {
        // Legacy endpoint for backward compatibility
        const lowStockProducts = await storage.getLowStockProducts(thresholdNum);
        res.json(lowStockProducts);
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch low stock products" });
    }
  });

  app.get("/api/inventory/sold-quantities", async (req, res) => {
    try {
      const soldQuantities = await storage.getSoldQuantitiesByProduct();
      res.json(soldQuantities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sold quantities" });
    }
  });

  app.get("/api/inventory/stats", async (req, res) => {
    try {
      const { branchId, threshold } = req.query;
      const thresholdNum = threshold ? parseInt(threshold as string) : 10;
      const stats = await storage.getInventoryStats(branchId as string | undefined, thresholdNum);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch inventory stats" });
    }
  });

  // Main Products endpoints
  app.get("/api/main-products", async (req, res) => {
    try {
      const mainProducts = await storage.getMainProducts();
      res.json(mainProducts);
    } catch (error: any) {
      console.error("Error fetching main products:", error);
      // Check if it's a missing table error
      if (error?.code === '42P01' || error?.message?.includes('does not exist') || error?.message?.includes('relation') && error?.message?.includes('does not exist')) {
        res.status(500).json({ 
          error: "Main products tables not found. Please run database migration 0007_add_main_products.sql",
          details: error.message 
        });
      } else {
        res.status(500).json({ error: "Failed to fetch main products", details: error?.message || String(error) });
      }
    }
  });

  app.get("/api/main-products/:id", async (req, res) => {
    try {
      const mainProduct = await storage.getMainProduct(req.params.id);
      if (!mainProduct) {
        return res.status(404).json({ error: "Main product not found" });
      }
      res.json(mainProduct);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch main product" });
    }
  });

  app.post("/api/main-products", requirePermission("inventory.manage"), async (req, res) => {
    try {
      const validatedData = insertMainProductSchema.parse(req.body);
      const mainProduct = await storage.createMainProduct(validatedData);
      res.status(201).json(mainProduct);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid main product data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create main product" });
    }
  });

  app.put("/api/main-products/:id", requirePermission("inventory.manage"), async (req, res) => {
    try {
      const validatedData = insertMainProductSchema.partial().parse(req.body);
      const mainProduct = await storage.updateMainProduct(req.params.id, validatedData);
      if (!mainProduct) {
        return res.status(404).json({ error: "Main product not found" });
      }
      res.json(mainProduct);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid main product data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update main product" });
    }
  });

  app.delete("/api/main-products/:id", requirePermission("inventory.manage"), async (req, res) => {
    try {
      const deleted = await storage.deleteMainProduct(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Main product not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete main product" });
    }
  });

  app.get("/api/main-products/:id/items", async (req, res) => {
    try {
      const items = await storage.getMainProductItems(req.params.id);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch main product items" });
    }
  });

  app.post("/api/main-products/:id/items", requirePermission("inventory.manage"), async (req, res) => {
    try {
      const validatedData = insertMainProductItemSchema.parse({
        ...req.body,
        mainProductId: req.params.id,
      });
      const item = await storage.addMainProductItem(validatedData);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid item data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to add item to main product" });
    }
  });

  app.delete("/api/main-products/:id/items/:itemId", requirePermission("inventory.manage"), async (req, res) => {
    try {
      const deleted = await storage.removeMainProductItem(req.params.itemId);
      if (!deleted) {
        return res.status(404).json({ error: "Item not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove item from main product" });
    }
  });

  app.get("/api/main-products/:id/stats", async (req, res) => {
    try {
      const stats = await storage.getMainProductStats(req.params.id);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch main product stats" });
    }
  });

  app.post("/api/inventory/adjustments", requirePermission("inventory.adjust"), async (req, res) => {
    try {
      const validatedData = insertInventoryAdjustmentSchema.parse(req.body);
      const adjustment = await storage.createInventoryAdjustment(validatedData);
      res.status(201).json(adjustment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid adjustment data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create inventory adjustment" });
    }
  });

  app.put("/api/inventory/adjustments/:id", requirePermission("inventory.adjust"), async (req, res) => {
    try {
      const { id } = req.params;
      // Allow partial updates (quantity, adjustmentType, reason, notes)
      const updateData: Partial<InsertInventoryAdjustment> = {};
      if (req.body.quantity !== undefined) updateData.quantity = req.body.quantity;
      if (req.body.adjustmentType !== undefined) updateData.adjustmentType = req.body.adjustmentType;
      if (req.body.reason !== undefined) updateData.reason = req.body.reason;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;
      
      const adjustment = await storage.updateInventoryAdjustment(id, updateData);
      res.json(adjustment);
    } catch (error: any) {
      if (error.message === "Adjustment not found") {
        return res.status(404).json({ error: "Adjustment not found" });
      }
      res.status(500).json({ error: "Failed to update inventory adjustment" });
    }
  });

  app.delete("/api/inventory/adjustments/:id", requirePermission("inventory.adjust"), async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteInventoryAdjustment(id);
      res.json({ success: true });
    } catch (error: any) {
      if (error.message === "Adjustment not found") {
        return res.status(404).json({ error: "Adjustment not found" });
      }
      res.status(500).json({ error: "Failed to delete inventory adjustment" });
    }
  });

  // Employee/Staff routes
  app.get("/api/employees", requirePermission("hrm.view"), async (req, res) => {
    try {
      const { branchId } = req.query;
      const employees = await storage.getEmployees(branchId as string | undefined);
      res.json(employees);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  app.get("/api/employees/next-employee-id", requirePermission("hrm.create"), async (req, res) => {
    try {
      const branchId = req.query.branchId as string | undefined;
      const nextId = await storage.getNextEmployeeId(branchId);
      res.json({ nextId });
    } catch (error) {
      res.status(500).json({ error: "Failed to get next employee ID" });
    }
  });

  app.get("/api/employees/expected-salaries", requirePermission("hrm.view"), async (req, res) => {
    try {
      const idsParam = req.query.ids as string;
      const ids = idsParam ? idsParam.split(",").map((id) => id.trim()).filter(Boolean) : [];
      if (ids.length === 0) return res.json([]);
      const [pendingDed, pendingAdv, lastCarried, pendingPrevDue, pendingLoan, pendingUL] = await Promise.all([
        storage.getPendingDeductionsTotalsByEmployeeIds(ids),
        storage.getPendingAdvancesTotalsByEmployeeIds(ids),
        storage.getLastCarriedByEmployeeIds(ids),
        storage.getPendingPreviousDueTotalsByEmployeeIds(ids),
        storage.getPendingLoanTotalsByEmployeeIds(ids),
        storage.getPendingUnpaidLeaveTotalsByEmployeeIds(ids),
      ]);
      const result: { employeeId: string; baseSalary: number; expectedSalary: number; payable: number }[] = [];
      for (const id of ids) {
        const employee = await storage.getEmployee(id);
        if (!employee) continue;
        const base = parseFloat(employee.salary);
        const payable = base + (lastCarried[id] ?? 0) + (pendingPrevDue[id] ?? 0) - (pendingDed[id] ?? 0) - (pendingAdv[id] ?? 0) - (pendingLoan[id] ?? 0) - (pendingUL[id] ?? 0);
        result.push({ employeeId: id, baseSalary: base, expectedSalary: payable, payable });
      }
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expected salaries" });
    }
  });

  app.get("/api/employees/paginated", requirePermission("hrm.view"), async (req, res) => {
    try {
      const branchId = req.query.branchId as string | undefined;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
      const offset = (page - 1) * limit;
      const search = (req.query.search as string)?.trim() || undefined;
      const status = (req.query.status as string) || undefined;
      const joinDateFrom = req.query.joinDateFrom ? new Date(req.query.joinDateFrom as string) : undefined;
      const joinDateTo = req.query.joinDateTo ? new Date(req.query.joinDateTo as string) : undefined;
      const { employees: list, total } = await storage.getEmployeesPaginated({ branchId, limit, offset, search, status, joinDateFrom, joinDateTo });
      const ids = list.map((e) => e.id);
      const [pendingDed, pendingAdv, lastCarried, pendingPrevDue, pendingLoan, pendingUL] = await Promise.all([
        storage.getPendingDeductionsTotalsByEmployeeIds(ids),
        storage.getPendingAdvancesTotalsByEmployeeIds(ids),
        storage.getLastCarriedByEmployeeIds(ids),
        storage.getPendingPreviousDueTotalsByEmployeeIds(ids),
        storage.getPendingLoanTotalsByEmployeeIds(ids),
        storage.getPendingUnpaidLeaveTotalsByEmployeeIds(ids),
      ]);
      const employeesWithExpected = list.map((e) => {
        const base = parseFloat(e.salary);
        const totalDeduction = pendingDed[e.id] ?? 0;
        const advanceSalary = pendingAdv[e.id] ?? 0;
        const loanAmount = pendingLoan[e.id] ?? 0;
        const unpaidLeave = pendingUL[e.id] ?? 0;
        const payable = base + (lastCarried[e.id] ?? 0) + (pendingPrevDue[e.id] ?? 0) - totalDeduction - advanceSalary - loanAmount - unpaidLeave;
        return { ...e, payable, totalDeduction, advanceSalary, loanAmount, unpaidLeave };
      });
      res.json({ employees: employeesWithExpected, total, page, limit });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  app.get("/api/employees/payable-summary", requirePermission("hrm.view"), async (req, res) => {
    try {
      const branchId = req.query.branchId as string | undefined;
      const summary = await storage.getEmployeesPayableSummary(branchId);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payable summary" });
    }
  });

  app.get("/api/employees/:id/salary-details", requirePermission("hrm.view"), async (req, res) => {
    try {
      const employee = await storage.getEmployee(req.params.id);
      if (!employee) return res.status(404).json({ error: "Employee not found" });
      const [salaryHistory, deductions, advances, previousDue, loans, unpaidLeave, pendingDedTotal, pendingAdvTotal, lastCarried, pendingPrevDueTotal, pendingLoanTotal, pendingULTotal] = await Promise.all([
        storage.getStaffSalariesByEmployee(req.params.id),
        storage.getDeductionsByEmployee(req.params.id),
        storage.getAdvancesByEmployee(req.params.id),
        storage.getPreviousDueByEmployee(req.params.id),
        storage.getLoansByEmployee(req.params.id),
        storage.getUnpaidLeaveByEmployee(req.params.id),
        storage.getPendingDeductionsTotalsByEmployeeIds([req.params.id]).then((r) => r[req.params.id] ?? 0),
        storage.getPendingAdvancesTotalsByEmployeeIds([req.params.id]).then((r) => r[req.params.id] ?? 0),
        storage.getLastCarriedByEmployeeIds([req.params.id]).then((r) => r[req.params.id] ?? 0),
        storage.getPendingPreviousDueTotalsByEmployeeIds([req.params.id]).then((r) => r[req.params.id] ?? 0),
        storage.getPendingLoanTotalsByEmployeeIds([req.params.id]).then((r) => r[req.params.id] ?? 0),
        storage.getPendingUnpaidLeaveTotalsByEmployeeIds([req.params.id]).then((r) => r[req.params.id] ?? 0),
      ]);
      const base = parseFloat(employee.salary);
      const expectedSalary = base + lastCarried - pendingDedTotal - pendingAdvTotal - pendingLoanTotal - pendingULTotal;
      const payable = base + lastCarried + pendingPrevDueTotal - pendingDedTotal - pendingAdvTotal - pendingLoanTotal - pendingULTotal;
      res.json({
        employee,
        salaryHistory,
        deductions,
        advances,
        previousDue,
        loans,
        unpaidLeave,
        expectedSalary,
        payable,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employee salary details" });
    }
  });

  app.get("/api/employees/:id/deductions", requirePermission("hrm.view"), async (req, res) => {
    try {
      const status = req.query.status as "pending" | "applied" | undefined;
      const list = await storage.getDeductionsByEmployee(req.params.id, status);
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deductions" });
    }
  });

  app.post("/api/employees/:id/deductions", requirePermission("hrm.create"), async (req, res) => {
    try {
      const employee = await storage.getEmployee(req.params.id);
      if (!employee) return res.status(404).json({ error: "Employee not found" });
      const validated = insertStaffDeductionSchema.parse({ ...req.body, employeeId: req.params.id });
      const deduction = await storage.createStaffDeduction(validated);
      auditLog(req, { action: "create", entityType: "staff-deduction", entityId: deduction.id, description: `Deduction ${deduction.amount} for ${employee.name}` });
      res.status(201).json(deduction);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid data", details: error.errors });
      res.status(500).json({ error: "Failed to create deduction" });
    }
  });

  app.patch("/api/employees/:id/deductions/:deductionId", requirePermission("hrm.edit"), async (req, res) => {
    try {
      const existing = await storage.getStaffDeduction(req.params.deductionId);
      if (!existing || existing.employeeId !== req.params.id) return res.status(404).json({ error: "Deduction not found" });
      const updates: { amount?: string; reason?: string } = {};
      if (req.body.amount !== undefined) updates.amount = String(req.body.amount);
      if (req.body.reason !== undefined) updates.reason = req.body.reason;
      const deduction = await storage.updateStaffDeduction(req.params.deductionId, updates);
      if (!deduction) return res.status(404).json({ error: "Deduction not found" });
      res.json(deduction);
    } catch (error) {
      res.status(500).json({ error: "Failed to update deduction" });
    }
  });

  app.delete("/api/employees/:id/deductions/:deductionId", requirePermission("hrm.delete"), async (req, res) => {
    try {
      const existing = await storage.getStaffDeduction(req.params.deductionId);
      if (!existing || existing.employeeId !== req.params.id) return res.status(404).json({ error: "Deduction not found" });
      const deleted = await storage.deleteStaffDeduction(req.params.deductionId);
      if (!deleted) return res.status(404).json({ error: "Deduction not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete deduction" });
    }
  });

  app.get("/api/employees/:id/advances", requirePermission("hrm.view"), async (req, res) => {
    try {
      const status = req.query.status as "pending" | "deducted" | undefined;
      const list = await storage.getAdvancesByEmployee(req.params.id, status);
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch advances" });
    }
  });

  app.post("/api/employees/:id/advances", requirePermission("hrm.create"), async (req, res) => {
    try {
      const employee = await storage.getEmployee(req.params.id);
      if (!employee) return res.status(404).json({ error: "Employee not found" });
      const validated = insertStaffAdvanceSchema.parse({ ...req.body, employeeId: req.params.id });
      const advance = await storage.createStaffAdvance(validated);
      auditLog(req, { action: "create", entityType: "staff-advance", entityId: advance.id, description: `Advance ${advance.amount} for ${employee.name}` });
      res.status(201).json(advance);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid data", details: error.errors });
      res.status(500).json({ error: "Failed to create advance" });
    }
  });

  app.patch("/api/employees/:id/advances/:advanceId", requirePermission("hrm.edit"), async (req, res) => {
    try {
      const existing = await storage.getStaffAdvance(req.params.advanceId);
      if (!existing || existing.employeeId !== req.params.id) return res.status(404).json({ error: "Advance not found" });
      const updates: { amount?: string; note?: string | null } = {};
      if (req.body.amount !== undefined) updates.amount = String(req.body.amount);
      if (req.body.note !== undefined) updates.note = req.body.note;
      const advance = await storage.updateStaffAdvance(req.params.advanceId, updates);
      if (!advance) return res.status(404).json({ error: "Advance not found" });
      res.json(advance);
    } catch (error) {
      res.status(500).json({ error: "Failed to update advance" });
    }
  });

  app.delete("/api/employees/:id/advances/:advanceId", requirePermission("hrm.delete"), async (req, res) => {
    try {
      const existing = await storage.getStaffAdvance(req.params.advanceId);
      if (!existing || existing.employeeId !== req.params.id) return res.status(404).json({ error: "Advance not found" });
      const deleted = await storage.deleteStaffAdvance(req.params.advanceId);
      if (!deleted) return res.status(404).json({ error: "Advance not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete advance" });
    }
  });

  app.get("/api/employees/:id/previous-due", requirePermission("hrm.view"), async (req, res) => {
    try {
      const status = req.query.status as "pending" | "settled" | undefined;
      const list = await storage.getPreviousDueByEmployee(req.params.id, status);
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch previous due" });
    }
  });

  app.post("/api/employees/:id/previous-due", requirePermission("hrm.create"), async (req, res) => {
    try {
      const employee = await storage.getEmployee(req.params.id);
      if (!employee) return res.status(404).json({ error: "Employee not found" });
      const validated = insertStaffPreviousDueSchema.parse({ ...req.body, employeeId: req.params.id });
      const previousDue = await storage.createStaffPreviousDue(validated);
      auditLog(req, { action: "create", entityType: "staff-previous-due", entityId: previousDue.id, description: `Previous due ${previousDue.amount} for ${employee.name}` });
      res.status(201).json(previousDue);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid data", details: error.errors });
      res.status(500).json({ error: "Failed to create previous due" });
    }
  });

  app.patch("/api/employees/:id/previous-due/:previousDueId", requirePermission("hrm.edit"), async (req, res) => {
    try {
      const existing = await storage.getStaffPreviousDue(req.params.previousDueId);
      if (!existing || existing.employeeId !== req.params.id) return res.status(404).json({ error: "Previous due not found" });
      const updates: { amount?: string; note?: string | null } = {};
      if (req.body.amount !== undefined) updates.amount = String(req.body.amount);
      if (req.body.note !== undefined) updates.note = req.body.note;
      const previousDue = await storage.updateStaffPreviousDue(req.params.previousDueId, updates);
      if (!previousDue) return res.status(404).json({ error: "Previous due not found" });
      res.json(previousDue);
    } catch (error) {
      res.status(500).json({ error: "Failed to update previous due" });
    }
  });

  app.delete("/api/employees/:id/previous-due/:previousDueId", requirePermission("hrm.delete"), async (req, res) => {
    try {
      const existing = await storage.getStaffPreviousDue(req.params.previousDueId);
      if (!existing || existing.employeeId !== req.params.id) return res.status(404).json({ error: "Previous due not found" });
      const deleted = await storage.deleteStaffPreviousDue(req.params.previousDueId);
      if (!deleted) return res.status(404).json({ error: "Previous due not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete previous due" });
    }
  });

  app.get("/api/employees/:id/loans", requirePermission("hrm.view"), async (req, res) => {
    try {
      const status = req.query.status as "pending" | "settled" | undefined;
      const list = await storage.getLoansByEmployee(req.params.id, status);
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch loans" });
    }
  });

  app.post("/api/employees/:id/loans", requirePermission("hrm.create"), async (req, res) => {
    try {
      const employee = await storage.getEmployee(req.params.id);
      if (!employee) return res.status(404).json({ error: "Employee not found" });
      const validated = insertStaffLoanSchema.parse({ ...req.body, employeeId: req.params.id });
      const loan = await storage.createStaffLoan(validated);
      auditLog(req, { action: "create", entityType: "staff-loan", entityId: loan.id, description: `Loan ${loan.amount} for ${employee.name}` });
      res.status(201).json(loan);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid data", details: error.errors });
      res.status(500).json({ error: "Failed to create loan" });
    }
  });

  app.patch("/api/employees/:id/loans/:loanId", requirePermission("hrm.edit"), async (req, res) => {
    try {
      const existing = await storage.getStaffLoan(req.params.loanId);
      if (!existing || existing.employeeId !== req.params.id) return res.status(404).json({ error: "Loan not found" });
      const updates: { amount?: string; note?: string | null } = {};
      if (req.body.amount !== undefined) updates.amount = String(req.body.amount);
      if (req.body.note !== undefined) updates.note = req.body.note;
      const loan = await storage.updateStaffLoan(req.params.loanId, updates);
      if (!loan) return res.status(404).json({ error: "Loan not found" });
      res.json(loan);
    } catch (error) {
      res.status(500).json({ error: "Failed to update loan" });
    }
  });

  app.delete("/api/employees/:id/loans/:loanId", requirePermission("hrm.delete"), async (req, res) => {
    try {
      const existing = await storage.getStaffLoan(req.params.loanId);
      if (!existing || existing.employeeId !== req.params.id) return res.status(404).json({ error: "Loan not found" });
      const deleted = await storage.deleteStaffLoan(req.params.loanId);
      if (!deleted) return res.status(404).json({ error: "Loan not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete loan" });
    }
  });

  app.get("/api/employees/:id/unpaid-leave", requirePermission("hrm.view"), async (req, res) => {
    try {
      const status = req.query.status as "pending" | "applied" | undefined;
      const list = await storage.getUnpaidLeaveByEmployee(req.params.id, status);
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unpaid leave" });
    }
  });

  app.post("/api/employees/:id/unpaid-leave", requirePermission("hrm.create"), async (req, res) => {
    try {
      const employee = await storage.getEmployee(req.params.id);
      if (!employee) return res.status(404).json({ error: "Employee not found" });
      const validated = insertStaffUnpaidLeaveSchema.parse({ ...req.body, employeeId: req.params.id });
      const ul = await storage.createStaffUnpaidLeave(validated);
      auditLog(req, { action: "create", entityType: "staff-unpaid-leave", entityId: ul.id, description: `Unpaid leave ${ul.amount} for ${employee.name}` });
      res.status(201).json(ul);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid data", details: error.errors });
      res.status(500).json({ error: "Failed to create unpaid leave" });
    }
  });

  app.patch("/api/employees/:id/unpaid-leave/:ulId", requirePermission("hrm.edit"), async (req, res) => {
    try {
      const existing = await storage.getStaffUnpaidLeave(req.params.ulId);
      if (!existing || existing.employeeId !== req.params.id) return res.status(404).json({ error: "Unpaid leave not found" });
      const updates: { amount?: string; note?: string | null } = {};
      if (req.body.amount !== undefined) updates.amount = String(req.body.amount);
      if (req.body.note !== undefined) updates.note = req.body.note;
      const ul = await storage.updateStaffUnpaidLeave(req.params.ulId, updates);
      if (!ul) return res.status(404).json({ error: "Unpaid leave not found" });
      res.json(ul);
    } catch (error) {
      res.status(500).json({ error: "Failed to update unpaid leave" });
    }
  });

  app.delete("/api/employees/:id/unpaid-leave/:ulId", requirePermission("hrm.delete"), async (req, res) => {
    try {
      const existing = await storage.getStaffUnpaidLeave(req.params.ulId);
      if (!existing || existing.employeeId !== req.params.id) return res.status(404).json({ error: "Unpaid leave not found" });
      const deleted = await storage.deleteStaffUnpaidLeave(req.params.ulId);
      if (!deleted) return res.status(404).json({ error: "Unpaid leave not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete unpaid leave" });
    }
  });

  app.get("/api/employees/:id", requirePermission("hrm.view"), async (req, res) => {
    try {
      const employee = await storage.getEmployee(req.params.id);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }
      res.json(employee);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employee" });
    }
  });

  app.post("/api/employees", requirePermission("hrm.create"), async (req, res) => {
    try {
      const validatedData = insertEmployeeSchema.parse(req.body);
      const employee = await storage.createEmployee(validatedData);
      auditLog(req, { action: "create", entityType: "employee", entityId: employee.id, entityName: employee.name, description: `Employee ${employee.name} created` });
      res.status(201).json(employee);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid employee data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create employee" });
    }
  });

  app.patch("/api/employees/:id", requirePermission("hrm.edit"), async (req, res) => {
    try {
      const employee = await storage.updateEmployee(req.params.id, req.body);
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }
      auditLog(req, { action: "update", entityType: "employee", entityId: employee.id, entityName: employee.name, description: `Employee ${employee.name} updated` });
      res.json(employee);
    } catch (error) {
      res.status(500).json({ error: "Failed to update employee" });
    }
  });

  app.delete("/api/employees/:id", requirePermission("hrm.delete"), async (req, res) => {
    try {
      const deleted = await storage.deleteEmployee(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Employee not found" });
      }
      auditLog(req, { action: "delete", entityType: "employee", entityId: req.params.id, description: `Employee deleted` });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete employee" });
    }
  });

  // Bulk import employees
  app.post("/api/employees/import", requirePermission("hrm.create"), async (req, res) => {
    try {
      const { employees: employeesData } = req.body;
      if (!Array.isArray(employeesData) || employeesData.length === 0) {
        return res.status(400).json({ error: "No employees data provided" });
      }
      
      const results: { success: number; failed: number; errors: string[] } = { success: 0, failed: 0, errors: [] };
      
      for (const empData of employeesData) {
        try {
          const validatedData = insertEmployeeSchema.parse(empData);
          await storage.createEmployee(validatedData);
          results.success++;
        } catch (err) {
          results.failed++;
          results.errors.push(`Row ${results.success + results.failed}: ${err instanceof Error ? err.message : "Invalid data"}`);
        }
      }
      
      auditLog(req, { action: "import", entityType: "employee", description: `Imported ${results.success} employees` });
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: "Failed to import employees" });
    }
  });

  // Export employees
  app.get("/api/employees/export", requirePermission("hrm.view"), async (req, res) => {
    try {
      const employees = await storage.getEmployees();
      // Return employees for CSV/JSON export on frontend
      res.json(employees);
    } catch (error) {
      res.status(500).json({ error: "Failed to export employees" });
    }
  });

  // Positions (for staff dropdown)
  app.get("/api/positions", requirePermission("hrm.view"), async (req, res) => {
    try {
      const list = await storage.getPositions();
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch positions" });
    }
  });

  app.post("/api/positions", requirePermission("hrm.create"), async (req, res) => {
    try {
      const validatedData = insertPositionSchema.parse(req.body);
      const position = await storage.createPosition(validatedData);
      res.status(201).json(position);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid position data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create position" });
    }
  });

  app.patch("/api/positions/:id", requirePermission("hrm.edit"), async (req, res) => {
    try {
      const position = await storage.updatePosition(req.params.id, req.body);
      if (!position) return res.status(404).json({ error: "Position not found" });
      res.json(position);
    } catch (error) {
      res.status(500).json({ error: "Failed to update position" });
    }
  });

  app.delete("/api/positions/:id", requirePermission("hrm.delete"), async (req, res) => {
    try {
      const deleted = await storage.deletePosition(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Position not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete position" });
    }
  });

  // Departments (for staff dropdown)
  app.get("/api/departments", requirePermission("hrm.view"), async (req, res) => {
    try {
      const list = await storage.getDepartments();
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch departments" });
    }
  });

  app.post("/api/departments", requirePermission("hrm.create"), async (req, res) => {
    try {
      const validatedData = insertDepartmentSchema.parse(req.body);
      const department = await storage.createDepartment(validatedData);
      res.status(201).json(department);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid department data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create department" });
    }
  });

  app.patch("/api/departments/:id", requirePermission("hrm.edit"), async (req, res) => {
    try {
      const department = await storage.updateDepartment(req.params.id, req.body);
      if (!department) return res.status(404).json({ error: "Department not found" });
      res.json(department);
    } catch (error) {
      res.status(500).json({ error: "Failed to update department" });
    }
  });

  app.delete("/api/departments/:id", requirePermission("hrm.delete"), async (req, res) => {
    try {
      const deleted = await storage.deleteDepartment(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Department not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete department" });
    }
  });

  // HRM attendance/leaves/payroll routes - commented out
  /*
  app.get("/api/attendance", async (req, res) => {
    try {
      const { date, employeeId } = req.query;
      let attendance;
      
      if (date) {
        attendance = await storage.getAttendanceByDate(new Date(date as string));
      } else if (employeeId) {
        attendance = await storage.getAttendanceByEmployee(employeeId as string);
      } else {
        attendance = await storage.getAttendance();
      }
      
      res.json(attendance);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch attendance" });
    }
  });

  app.get("/api/attendance/stats", async (req, res) => {
    try {
      const stats = await storage.getAttendanceStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch attendance statistics" });
    }
  });

  app.post("/api/attendance", async (req, res) => {
    try {
      const validatedData = insertAttendanceSchema.parse(req.body);
      const attendance = await storage.createAttendance(validatedData);
      res.status(201).json(attendance);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid attendance data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create attendance record" });
    }
  });

  app.patch("/api/attendance/:id", async (req, res) => {
    try {
      const attendance = await storage.updateAttendance(req.params.id, req.body);
      if (!attendance) {
        return res.status(404).json({ error: "Attendance record not found" });
      }
      res.json(attendance);
    } catch (error) {
      res.status(500).json({ error: "Failed to update attendance" });
    }
  });

  app.delete("/api/attendance/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteAttendance(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Attendance record not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete attendance" });
    }
  });
  */

  // Leaves routes also part of HRM - commented out
  /*
  app.get("/api/leaves", async (req, res) => {
    try {
      const { employeeId } = req.query;
      let leaves;
      
      if (employeeId) {
        leaves = await storage.getLeavesByEmployee(employeeId as string);
      } else {
        leaves = await storage.getLeaves();
      }
      
      res.json(leaves);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leaves" });
    }
  });

  app.get("/api/leaves/:id", async (req, res) => {
    try {
      const leave = await storage.getLeave(req.params.id);
      if (!leave) {
        return res.status(404).json({ error: "Leave not found" });
      }
      res.json(leave);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leave" });
    }
  });

  app.post("/api/leaves", async (req, res) => {
    try {
      const validatedData = insertLeaveSchema.parse(req.body);
      const leave = await storage.createLeave(validatedData);
      res.status(201).json(leave);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid leave data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create leave request" });
    }
  });

  app.patch("/api/leaves/:id", async (req, res) => {
    try {
      const leave = await storage.updateLeave(req.params.id, req.body);
      if (!leave) {
        return res.status(404).json({ error: "Leave not found" });
      }
      res.json(leave);
    } catch (error) {
      res.status(500).json({ error: "Failed to update leave" });
    }
  });

  app.delete("/api/leaves/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteLeave(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Leave not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete leave" });
    }
  });
  */

  // Payroll routes also part of HRM - commented out
  /*
  app.get("/api/payroll", async (req, res) => {
    try {
      const { employeeId } = req.query;
      let payroll;
      
      if (employeeId) {
        payroll = await storage.getPayrollByEmployee(employeeId as string);
      } else {
        payroll = await storage.getPayroll();
      }
      
      res.json(payroll);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payroll" });
    }
  });

  app.get("/api/payroll/:id", async (req, res) => {
    try {
      const payroll = await storage.getPayrollById(req.params.id);
      if (!payroll) {
        return res.status(404).json({ error: "Payroll not found" });
      }
      res.json(payroll);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payroll" });
    }
  });

  app.post("/api/payroll", async (req, res) => {
    try {
      const validatedData = insertPayrollSchema.parse(req.body);
      const payroll = await storage.createPayroll(validatedData);
      res.status(201).json(payroll);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid payroll data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create payroll record" });
    }
  });

  app.patch("/api/payroll/:id", async (req, res) => {
    try {
      const payroll = await storage.updatePayroll(req.params.id, req.body);
      if (!payroll) {
        return res.status(404).json({ error: "Payroll not found" });
      }
      res.json(payroll);
    } catch (error) {
      res.status(500).json({ error: "Failed to update payroll" });
    }
  });

  app.delete("/api/payroll/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePayroll(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Payroll not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete payroll" });
    }
  });
  */

  app.get("/api/staff-salaries", requireAuth, async (req, res) => {
    try {
      const salaries = await storage.getStaffSalaries();
      res.json(salaries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch staff salaries" });
    }
  });

  // Specific paths must be defined before /:id to avoid "with-employees", "summary", "export" being matched as id
  app.get("/api/staff-salaries/with-employees", requireAuth, async (req, res) => {
    try {
      const { startDate, endDate, months: monthsParam } = req.query;
      let startDateVal: Date | undefined;
      let endDateVal: Date | undefined;
      if (monthsParam && typeof monthsParam === "string" && monthsParam.trim()) {
        const months = monthsParam.split(",").map((m) => m.trim()).filter(Boolean).sort();
        if (months.length > 0) {
          const first = months[0].split("-").map(Number);
          const last = months[months.length - 1].split("-").map(Number);
          startDateVal = new Date(first[0], first[1] - 1, 1);
          endDateVal = new Date(last[0], last[1], 0, 23, 59, 59, 999);
        }
      }
      if (!startDateVal && startDate && typeof startDate === "string") {
        const d = new Date(startDate);
        if (!isNaN(d.getTime())) startDateVal = d;
      }
      if (!endDateVal && endDate && typeof endDate === "string") {
        const d = new Date(endDate);
        if (!isNaN(d.getTime())) endDateVal = d;
      }
      const salaries = await storage.getStaffSalariesWithEmployees(startDateVal, endDateVal);
      res.json(salaries);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch staff salaries with employees" });
    }
  });

  app.get("/api/staff-salaries/export", requireAuth, async (req, res) => {
    try {
      const { startDate, endDate, months: monthsParam } = req.query;
      let startDateVal: Date | undefined;
      let endDateVal: Date | undefined;
      if (monthsParam && typeof monthsParam === "string" && monthsParam.trim()) {
        const months = monthsParam.split(",").map((m) => m.trim()).filter(Boolean).sort();
        if (months.length > 0) {
          const first = months[0].split("-").map(Number);
          const last = months[months.length - 1].split("-").map(Number);
          startDateVal = new Date(first[0], first[1] - 1, 1);
          endDateVal = new Date(last[0], last[1], 0, 23, 59, 59, 999);
        }
      }
      if (!startDateVal && startDate && typeof startDate === "string") {
        const d = new Date(startDate);
        if (!isNaN(d.getTime())) startDateVal = d;
      }
      if (!endDateVal && endDate && typeof endDate === "string") {
        const d = new Date(endDate);
        if (!isNaN(d.getTime())) endDateVal = d;
      }
      const salaries = await storage.getStaffSalariesWithEmployees(startDateVal, endDateVal);
      res.json({ salaries });
    } catch (error) {
      res.status(500).json({ error: "Failed to export staff salaries" });
    }
  });

  app.get("/api/staff-salaries/summary", requireAuth, async (req, res) => {
    try {
      const { startDate, endDate, months: monthsParam } = req.query;
      let startDateVal: Date | undefined;
      let endDateVal: Date | undefined;
      if (monthsParam && typeof monthsParam === "string" && monthsParam.trim()) {
        const months = monthsParam.split(",").map((m) => m.trim()).filter(Boolean).sort();
        if (months.length > 0) {
          const first = months[0].split("-").map(Number);
          const last = months[months.length - 1].split("-").map(Number);
          startDateVal = new Date(first[0], first[1] - 1, 1);
          endDateVal = new Date(last[0], last[1], 0, 23, 59, 59, 999);
        }
      }
      if (!startDateVal && startDate && typeof startDate === "string") {
        const d = new Date(startDate);
        if (!isNaN(d.getTime())) startDateVal = d;
      }
      if (!endDateVal && endDate && typeof endDate === "string") {
        const d = new Date(endDate);
        if (!isNaN(d.getTime())) endDateVal = d;
      }
      const summary = await storage.getStaffSalarySummary(startDateVal, endDateVal);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch salary summary" });
    }
  });

  app.get("/api/staff-salaries/:id", requireAuth, async (req, res) => {
    try {
      const salary = await storage.getStaffSalary(req.params.id);
      if (!salary) {
        return res.status(404).json({ error: "Staff salary not found" });
      }
      res.json(salary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch staff salary" });
    }
  });

  app.post("/api/staff-salaries", requirePermission("hrm.create"), async (req, res) => {
    try {
      const validatedData = insertStaffSalarySchema.parse(req.body);
      const salary = await storage.createStaffSalary(validatedData);
      auditLog(req, { action: "create", entityType: "staff-salary", entityId: salary.id, description: `Staff salary released` });
      res.status(201).json(salary);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid staff salary data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create staff salary" });
    }
  });

  // Bulk release salaries for multiple employees
  app.post("/api/staff-salaries/bulk-release", requirePermission("hrm.create"), async (req, res) => {
    try {
      const { salaries } = req.body;
      if (!Array.isArray(salaries) || salaries.length === 0) {
        return res.status(400).json({ error: "No salary data provided" });
      }
      
      const results: { success: number; failed: number; errors: string[]; created: any[] } = { success: 0, failed: 0, errors: [], created: [] };
      
      for (const salaryData of salaries) {
        try {
          const validatedData = insertStaffSalarySchema.parse(salaryData);
          const salary = await storage.createStaffSalary(validatedData);
          results.success++;
          results.created.push(salary);
        } catch (err) {
          results.failed++;
          results.errors.push(`Employee ${salaryData.employeeId}: ${err instanceof Error ? err.message : "Invalid data"}`);
        }
      }
      
      auditLog(req, { action: "bulk-release", entityType: "staff-salary", description: `Bulk released ${results.success} salaries` });
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: "Failed to bulk release salaries" });
    }
  });

  app.patch("/api/staff-salaries/:id", requirePermission("hrm.edit"), async (req, res) => {
    try {
      const salary = await storage.updateStaffSalary(req.params.id, req.body);
      if (!salary) {
        return res.status(404).json({ error: "Staff salary not found" });
      }
      auditLog(req, { action: "update", entityType: "staff-salary", entityId: salary.id, description: `Staff salary updated` });
      res.json(salary);
    } catch (error) {
      res.status(500).json({ error: "Failed to update staff salary" });
    }
  });

  app.delete("/api/staff-salaries/:id", requirePermission("hrm.delete"), async (req, res) => {
    try {
      const deleted = await storage.deleteStaffSalary(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Staff salary not found" });
      }
      auditLog(req, { action: "delete", entityType: "staff-salary", entityId: req.params.id, description: `Staff salary deleted` });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete staff salary" });
    }
  });

  // User routes
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/users", requirePermission("settings.users"), async (req, res) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(validatedData);
      const { password, ...userWithoutPassword } = user;
      auditLog(req, { action: "create", entityType: "user", entityId: user.id, entityName: user.username, description: `User ${user.username} created` });
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid user data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", requirePermission("settings.users"), async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.id, req.body);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password, ...userWithoutPassword } = user;
      auditLog(req, { action: "update", entityType: "user", entityId: user.id, entityName: user.username, description: `User ${user.username} updated` });
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requirePermission("settings.users"), async (req, res) => {
    try {
      const deleted = await storage.deleteUser(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "User not found" });
      }
      auditLog(req, { action: "delete", entityType: "user", entityId: req.params.id, description: `User ${req.params.id} deleted` });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Roles routes
  app.get("/api/roles", async (req, res) => {
    try {
      const roles = await storage.getRoles();
      res.json(roles);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  app.get("/api/roles/:id", async (req, res) => {
    try {
      const role = await storage.getRole(req.params.id);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      res.json(role);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch role" });
    }
  });

  app.post("/api/roles", requirePermission("settings.roles"), async (req, res) => {
    try {
      const { insertRoleSchema } = await import("@shared/schema");
      const validatedData = insertRoleSchema.parse(req.body);
      const role = await storage.createRole(validatedData);
      res.status(201).json(role);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid role data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create role" });
    }
  });

  app.patch("/api/roles/:id", requirePermission("settings.roles"), async (req, res) => {
    try {
      const role = await storage.updateRole(req.params.id, req.body);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      res.json(role);
    } catch (error) {
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  app.delete("/api/roles/:id", requirePermission("settings.roles"), async (req, res) => {
    try {
      const deleted = await storage.deleteRole(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Role not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete role" });
    }
  });

  // Permissions routes
  app.get("/api/permissions", async (req, res) => {
    try {
      const permissions = await storage.getPermissions();
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  });

  app.get("/api/permissions/:id", async (req, res) => {
    try {
      const permission = await storage.getPermission(req.params.id);
      if (!permission) {
        return res.status(404).json({ error: "Permission not found" });
      }
      res.json(permission);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch permission" });
    }
  });

  app.get("/api/permissions/category/:category", async (req, res) => {
    try {
      const permissions = await storage.getPermissionsByCategory(req.params.category);
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  });

  app.post("/api/permissions", async (req, res) => {
    try {
      const { insertPermissionSchema } = await import("@shared/schema");
      const validatedData = insertPermissionSchema.parse(req.body);
      const permission = await storage.createPermission(validatedData);
      res.status(201).json(permission);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid permission data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create permission" });
    }
  });

  app.patch("/api/permissions/:id", async (req, res) => {
    try {
      const permission = await storage.updatePermission(req.params.id, req.body);
      if (!permission) {
        return res.status(404).json({ error: "Permission not found" });
      }
      res.json(permission);
    } catch (error) {
      res.status(500).json({ error: "Failed to update permission" });
    }
  });

  app.delete("/api/permissions/:id", async (req, res) => {
    try {
      const deleted = await storage.deletePermission(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Permission not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete permission" });
    }
  });

  // Role-Permissions routes
  app.get("/api/roles/:roleId/permissions", async (req, res) => {
    try {
      const permissions = await storage.getPermissionsForRole(req.params.roleId);
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch role permissions" });
    }
  });

  app.post("/api/roles/:roleId/permissions", requirePermission("settings.permissions"), async (req, res) => {
    try {
      const { permissionIds } = req.body;
      if (!Array.isArray(permissionIds)) {
        return res.status(400).json({ error: "permissionIds must be an array" });
      }
      await storage.setRolePermissions(req.params.roleId, permissionIds);
      const permissions = await storage.getPermissionsForRole(req.params.roleId);
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ error: "Failed to set role permissions" });
    }
  });

  app.get("/api/branches", async (req, res) => {
    try {
      const branches = await storage.getBranches();
      const branchesWithoutPasswords = branches.map(({ password, ...branch }) => branch);
      res.json(branchesWithoutPasswords);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch branches" });
    }
  });

  app.get("/api/branches/:id", async (req, res) => {
    try {
      const branch = await storage.getBranch(req.params.id);
      if (!branch) {
        return res.status(404).json({ error: "Branch not found" });
      }
      const { password, ...branchWithoutPassword } = branch;
      res.json(branchWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch branch" });
    }
  });

  app.post("/api/branches", requirePermission("branches.create"), async (req, res) => {
    try {
      const validatedData = insertBranchSchema.parse(req.body);
      
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      
      const branch = await storage.createBranch({
        ...validatedData,
        password: hashedPassword,
      });
      
      const { password, ...branchWithoutPassword } = branch;
      res.status(201).json(branchWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid branch data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create branch" });
    }
  });

  app.patch("/api/branches/:id", requirePermission("branches.edit"), async (req, res) => {
    try {
      let updateData = { ...req.body };
      
      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10);
      }
      
      const branch = await storage.updateBranch(req.params.id, updateData);
      if (!branch) {
        return res.status(404).json({ error: "Branch not found" });
      }
      
      const { password, ...branchWithoutPassword } = branch;
      res.json(branchWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to update branch" });
    }
  });

  app.delete("/api/branches/:id", requirePermission("branches.delete"), async (req, res) => {
    try {
      const deleted = await storage.deleteBranch(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Branch not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete branch" });
    }
  });

  app.get("/api/payment-adjustments", async (req, res) => {
    try {
      const branchId = req.query.branchId as string | undefined;
      const adjustments = await storage.getPaymentAdjustments(branchId);
      res.json(adjustments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment adjustments" });
    }
  });

  app.post("/api/payment-adjustments", async (req, res) => {
    try {
      const validatedData = insertPaymentAdjustmentSchema.parse(req.body);
      const adjustment = await storage.createPaymentAdjustment(validatedData);
      res.status(201).json(adjustment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid adjustment data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create payment adjustment" });
    }
  });

  app.get("/api/customers", async (req, res) => {
    try {
      const branchId = req.query.branchId as string | undefined;
      const customers = await storage.getCustomers(branchId);
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const validatedData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(validatedData);
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid customer data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.updateCustomer(req.params.id, req.body);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteCustomer(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete customer" });
    }
  });

  app.get("/api/subscription-cards", requirePermission("subscription_cards.manage"), async (req, res) => {
    try {
      const list = await storage.listSubscriptionCards();
      res.json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch subscription cards" });
    }
  });

  app.get("/api/subscription-cards/by-id/:id", requirePermission("sales.create"), async (req, res) => {
    try {
      const settings = await storage.getSettings();
      if (settings?.subscriptionProgramEnabled === "false") {
        return res.status(400).json({ error: "Subscription program is disabled" });
      }
      const row = await storage.getSubscriptionCardById(req.params.id);
      if (!row || row.isActive !== "true") {
        return res.status(404).json({ error: "Card not found or inactive" });
      }
      const discountType = settings?.subscriptionDiscountType === "amount" ? "amount" : "percentage";
      const defaultVal = parseFloat(settings?.subscriptionDiscountValue || "5");
      const override = row.discountOverrideValue;
      const value =
        override != null && String(override) !== "" && !Number.isNaN(parseFloat(String(override)))
          ? parseFloat(String(override))
          : defaultVal;
      res.json({
        cardId: row.id,
        barcode: row.barcode,
        customerId: row.customer.id,
        customerName: row.customer.name,
        discountType,
        discountValue: value,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to load subscription card" });
    }
  });

  app.get("/api/subscription-cards/lookup/:barcode", requirePermission("sales.create"), async (req, res) => {
    try {
      const settings = await storage.getSettings();
      if (settings?.subscriptionProgramEnabled === "false") {
        return res.status(400).json({ error: "Subscription program is disabled" });
      }
      const decoded = decodeURIComponent(req.params.barcode);
      const row = await storage.getSubscriptionCardByBarcode(decoded);
      if (!row || row.isActive !== "true") {
        return res.status(404).json({ error: "Card not found or inactive" });
      }
      const discountType = settings?.subscriptionDiscountType === "amount" ? "amount" : "percentage";
      const defaultVal = parseFloat(settings?.subscriptionDiscountValue || "5");
      const override = row.discountOverrideValue;
      const value =
        override != null && String(override) !== "" && !Number.isNaN(parseFloat(String(override)))
          ? parseFloat(String(override))
          : defaultVal;
      res.json({
        cardId: row.id,
        barcode: row.barcode,
        customerId: row.customer.id,
        customerName: row.customer.name,
        discountType,
        discountValue: value,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to look up subscription card" });
    }
  });

  app.post("/api/subscription-cards", requirePermission("subscription_cards.manage"), async (req, res) => {
    try {
      const body = z
        .object({
          customerId: z.string(),
          discountOverrideValue: z.string().optional().nullable(),
          notes: z.string().optional().nullable(),
        })
        .parse(req.body);
      const card = await storage.issueSubscriptionCard(body.customerId, {
        discountOverrideValue: body.discountOverrideValue ?? null,
        notes: body.notes ?? null,
      });
      res.status(201).json(card);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("not eligible")) {
        return res.status(400).json({ error: msg });
      }
      res.status(500).json({ error: "Failed to issue subscription card" });
    }
  });

  app.patch("/api/subscription-cards/:id", requirePermission("subscription_cards.manage"), async (req, res) => {
    try {
      const body = z
        .object({
          isActive: z.enum(["true", "false"]).optional(),
          notes: z.string().optional().nullable(),
          discountOverrideValue: z.string().optional().nullable(),
        })
        .parse(req.body);
      const updated = await storage.updateSubscriptionCard(req.params.id, body);
      if (!updated) {
        return res.status(404).json({ error: "Subscription card not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid request", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update subscription card" });
    }
  });

  app.get(
    "/api/customers/:id/subscription-eligibility",
    requirePermission("subscription_cards.manage"),
    async (req, res) => {
      try {
        const settings = await storage.getSettings();
        const minSpend = parseFloat(settings?.subscriptionMinSpend || "50");
        const spend = await storage.getCustomerPosLifetimeSpend(req.params.id);
        res.json({
          eligible: spend + 1e-9 >= minSpend,
          lifetimePosSpend: spend,
          minSpend,
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to check eligibility" });
      }
    }
  );

  app.post("/api/customers/bulk-delete", requirePermission("customers.delete"), async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "Invalid request. 'ids' must be a non-empty array." });
      }

      let deletedCount = 0;
      const errors: string[] = [];
      
      for (const id of ids) {
        try {
          const deleted = await storage.deleteCustomer(id);
          if (deleted) {
            deletedCount++;
          } else {
            errors.push(`Customer ${id} not found or could not be deleted`);
          }
        } catch (error: any) {
          console.error(`Error deleting customer ${id}:`, error);
          errors.push(`Failed to delete customer ${id}: ${error.message}`);
        }
      }

      if (deletedCount === 0 && errors.length > 0) {
        return res.status(400).json({ 
          success: false, 
          deletedCount: 0, 
          errors 
        });
      }

      res.json({ 
        success: true, 
        deletedCount,
        ...(errors.length > 0 && { warnings: errors })
      });
    } catch (error: any) {
      console.error("Error bulk deleting customers:", error);
      res.status(500).json({ error: "Failed to delete customers", message: error.message });
    }
  });

  app.get("/api/due/payments", async (req, res) => {
    try {
      const customerId = req.query.customerId as string | undefined;
      const branchId = req.query.branchId as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = page && limit ? (page - 1) * limit : undefined;
      
      const result = await storage.getDuePayments(customerId, branchId, limit, offset);
      res.json(result);
    } catch (error) {
      console.error("GET /api/due/payments error:", error);
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  // Payment slip upload endpoint
  app.post("/api/due/payments/upload-slips", requirePermission("due.create"), uploadMultiple.array("slips", 10), async (req, res) => {
    try {
      if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const files = Array.isArray(req.files) ? req.files : [];
      const fileUrls = files.map((file: any) => `/uploads/${file.filename}`);
      
      res.json({ urls: fileUrls });
    } catch (error: any) {
      if (error.message === "Only image files are allowed") {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to upload payment slips" });
    }
  });

  app.post("/api/due/payments", requirePermission("due.create"), async (req, res) => {
    try {
      const { allocations, paymentSlips, ...paymentData } = req.body;
      
      if (!allocations || !Array.isArray(allocations)) {
        return res.status(400).json({ error: "Allocations array is required" });
      }
      
      // Convert paymentSlips array to JSON string if provided
      const paymentDataWithSlips = {
        ...paymentData,
        ...(paymentSlips && Array.isArray(paymentSlips) && paymentSlips.length > 0 
          ? { paymentSlips: JSON.stringify(paymentSlips) } 
          : {}),
      };
      
      const validatedPayment = insertDuePaymentSchema.parse(paymentDataWithSlips);
      
      const payment = await storage.recordPaymentWithAllocations(
        validatedPayment,
        allocations
      );
      
      res.status(201).json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid payment data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to record payment" });
    }
  });

  app.get("/api/due/payments/:id/allocations", async (req, res) => {
    try {
      const allocations = await storage.getDuePaymentAllocations(req.params.id);
      res.json(allocations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch payment allocations" });
    }
  });

  app.patch("/api/due/payments/:id", requirePermission("due.edit"), async (req, res) => {
    try {
      const updates = req.body;
      const payment = await storage.updateDuePayment(req.params.id, updates);
      if (!payment) {
        return res.status(404).json({ error: "Due payment not found" });
      }
      res.json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid payment data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update due payment" });
    }
  });

  app.delete("/api/due/payments/:id", requirePermission("due.delete"), async (req, res) => {
    try {
      const deleted = await storage.deleteDuePayment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Due payment not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete due payment" });
    }
  });

  app.post("/api/due/payments/bulk-delete", requirePermission("due.delete"), async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "IDs array is required" });
      }
      
      let deletedCount = 0;
      const errors: string[] = [];
      
      for (const id of ids) {
        try {
          const deleted = await storage.deleteDuePayment(id);
          if (deleted) {
            deletedCount++;
          } else {
            errors.push(`Due payment ${id} not found or could not be deleted`);
          }
        } catch (error: any) {
          console.error(`Error deleting due payment ${id}:`, error);
          errors.push(`Failed to delete due payment ${id}: ${error.message}`);
        }
      }

      if (deletedCount === 0 && errors.length > 0) {
        return res.status(400).json({ 
          success: false, 
          deletedCount: 0, 
          errors 
        });
      }
      
      res.json({ 
        success: true, 
        deletedCount,
        ...(errors.length > 0 && { warnings: errors })
      });
    } catch (error: any) {
      console.error("Error bulk deleting due payments:", error);
      res.status(500).json({ error: "Failed to delete due payments", message: error.message });
    }
  });

  app.get("/api/due/customers-summary", async (req, res) => {
    try {
      const branchId = req.query.branchId as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = page && limit ? (page - 1) * limit : undefined;
      const search = req.query.search as string | undefined;
      const statusFilter = req.query.statusFilter as string | undefined;
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;
      
      const result = await storage.getAllCustomersDueSummary(
        branchId, 
        limit, 
        offset,
        search,
        statusFilter,
        undefined,
        undefined,
        dateFrom,
        dateTo
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers summary" });
    }
  });

  app.get("/api/due/customers-summary/stats", async (req, res) => {
    try {
      const branchId = req.query.branchId as string | undefined;
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;
      const search = (req.query.search as string)?.trim() || undefined;
      const statusFilter = (req.query.statusFilter as string) && req.query.statusFilter !== "all" ? req.query.statusFilter as string : undefined;
      const stats = await storage.getCustomersDueSummaryStats(branchId, dateFrom, dateTo, search, statusFilter, undefined, undefined);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers summary stats" });
    }
  });

  // Export: all customers + all due records (no pagination), for Excel/CSV/PDF export
  app.get("/api/due/export", async (req, res) => {
    try {
      const branchId = req.query.branchId as string | undefined;
      const search = req.query.search as string | undefined;
      const statusFilter = req.query.statusFilter as string | undefined;
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined;
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : undefined;

      // Get ALL customers matching filters (no limit/offset)
      const { summaries } = await storage.getAllCustomersDueSummary(
        branchId,
        undefined,
        undefined,
        search,
        statusFilter,
        undefined,
        undefined,
        dateFrom,
        dateTo
      );

      // For each customer, get ALL their due/payment transactions (limit=0 means all)
      const transactionsByCustomer: Record<string, Array<{ id: string; type: "due" | "payment"; date: Date; amount: number; description: string; paymentMethod?: string; order?: any; payment?: any }>> = {};
      for (const s of summaries) {
        const { transactions } = await storage.getCustomerTransactionsPaginated(
          s.customer.id,
          branchId,
          0, // limit 0 = return all
          0,
          undefined,
          dateFrom,
          dateTo
        );
        transactionsByCustomer[s.customer.id] = transactions;
      }

      res.json({ summaries, transactionsByCustomer });
    } catch (error) {
      console.error("Error exporting due data:", error);
      res.status(500).json({ error: "Failed to export due data" });
    }
  });

  app.get("/api/due/customers/:id/summary", async (req, res) => {
    try {
      const summary = await storage.getCustomerDueSummary(req.params.id);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customer summary" });
    }
  });

  app.get("/api/customers/:id/orders/paginated", async (req, res) => {
    try {
      const { 
        branchId,
        page = "1",
        limit = "10",
        search,
        paymentStatus,
        dateFrom,
        dateTo
      } = req.query;
      
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;
      
      const result = await storage.getCustomerOrdersPaginated(
        req.params.id,
        branchId as string | undefined,
        limitNum,
        offset,
        search as string | undefined,
        paymentStatus as string | undefined,
        dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo ? new Date(dateTo as string) : undefined
      );
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching customer orders:", error);
      res.status(500).json({ error: "Failed to fetch customer orders" });
    }
  });

  app.get("/api/customers/:id/transactions/paginated", async (req, res) => {
    try {
      const { 
        branchId,
        page = "1",
        limit = "10",
        search,
        dateFrom,
        dateTo
      } = req.query;
      
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;
      
      const result = await storage.getCustomerTransactionsPaginated(
        req.params.id,
        branchId as string | undefined,
        limitNum,
        offset,
        search as string | undefined,
        dateFrom ? new Date(dateFrom as string) : undefined,
        dateTo ? new Date(dateTo as string) : undefined
      );
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching customer transactions:", error);
      res.status(500).json({ error: "Failed to fetch customer transactions" });
    }
  });

  app.post("/api/due/customers", async (req, res) => {
    try {
      const validatedData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(validatedData);
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid customer data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.patch("/api/due/customers/:id", async (req, res) => {
    try {
      const updates = req.body;
      const customer = await storage.updateCustomer(req.params.id, updates);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  // File upload endpoint for logo and favicon
  app.post("/api/upload", requireAuth, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Return the file URL - use relative path that will be served by static middleware
      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({ url: fileUrl, filename: req.file.filename });
    } catch (error: any) {
      if (error.message === "Only image files are allowed") {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  app.put("/api/settings", requireAuth, async (req, res) => {
    try {
      const validatedData = insertSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateSettings(validatedData);
      auditLog(req, { action: "update", entityType: "settings", entityName: "Application settings", description: "Settings updated" });
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid settings data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // Audit Logs endpoints
  app.get("/api/audit-logs", requirePermission("settings.view"), async (req, res) => {
    try {
      const { userId, entityType, action, startDate, endDate, limit, offset } = req.query;
      
      const filters: any = {};
      if (userId) filters.userId = userId as string;
      if (entityType) filters.entityType = entityType as string;
      if (action) filters.action = action as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      filters.limit = limit != null ? parseInt(String(limit), 10) : 50;
      filters.offset = offset != null ? parseInt(String(offset), 10) : 0;

      const result = await storage.getAuditLogs(filters);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  const httpServer = createServer(app);
  webSocketServer = createWebSocketServer(httpServer);

  return httpServer;
}
