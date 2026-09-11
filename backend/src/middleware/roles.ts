import { Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { AuthedRequest } from "./auth";

/**
 * Usage: router.get("/admin-only", requireAuth, requireRole(["ADMIN"]), handler)
 * Must always run AFTER requireAuth so req.user is populated from the DB.
 */
export function requireRole(allowed: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: { message: "Not authenticated" } });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: { message: "Insufficient permissions" } });
    }
    next();
  };
}
