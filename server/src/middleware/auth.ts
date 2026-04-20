import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken, type JwtPayload, type JwtRole } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";

export type AuthedRequest = Request & { user?: JwtPayload & { id: string } };

function parseBearer(header: string | undefined): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const t = header.slice(7).trim();
  return t.length ? t : null;
}

/** Validates JWT and attaches `req.user` (payload). Optionally ensures user still exists and is active. */
export async function authenticate(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = parseBearer(req.headers.authorization);
    if (!token) {
      res.status(401).json({ error: "Missing or invalid Authorization header" });
      return;
    }
    const payload = verifyAccessToken(token);
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!dbUser || !dbUser.isActive) {
      res.status(401).json({ error: "User not found or inactive" });
      return;
    }
    if (dbUser.email !== payload.email || dbUser.role !== payload.role) {
      res.status(401).json({ error: "Token out of date; please sign in again" });
      return;
    }
    req.user = {
      sub: dbUser.id,
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role as JwtRole,
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRoles(...allowed: JwtRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const role = req.user?.role;
    if (!role || !allowed.includes(role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}
