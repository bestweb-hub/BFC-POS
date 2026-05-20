import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    branchId?: string;
    username?: string;
    role?: string;
    userType?: "user" | "branch";
  }
}
