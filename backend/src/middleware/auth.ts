import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/token";
import { prisma } from "../lib/prisma";
import { Role } from "@prisma/client";

export interface AuthedRequest extends Request {
  user?: { id: string; role: Role; email: string; name: string };
}

/**
 * Verifies the JWT AND re-fetches the user from the DB.
 * This matters: a stale/modified token cannot grant access to a role the
 * DB doesn't currently have for that user (e.g. after a role downgrade,
 * or a forged/tampered payload that somehow passes signature checks in a
 * misconfigured environment). We never trust req.user.role from the token
 * alone for anything sensitive downstream — route handlers re-derive scope
 * from this DB-verified user object.
 */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: { message: "Missing access token" } });
    }
    const token = authHeader.split(" ")[1];
    const payload = verifyAccessToken(token);

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      return res.status(401).json({ error: { message: "User no longer exists" } });
    }

    req.user = { id: user.id, role: user.role, email: user.email, name: user.name };
    next();
  } catch (err) {
    return res.status(401).json({ error: { message: "Invalid or expired access token" } });
  }
}
