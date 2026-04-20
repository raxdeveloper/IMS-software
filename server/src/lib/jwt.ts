import jwt, { type Secret, type SignOptions } from "jsonwebtoken";

export type JwtRole = "admin" | "doctor" | "staff";

export type JwtPayload = {
  sub: string;
  role: JwtRole;
  email: string;
};

function getSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error("JWT_SECRET must be set and at least 16 characters.");
  }
  return s;
}

export function signAccessToken(payload: JwtPayload): string {
  const options: SignOptions = { expiresIn: "7d" };
  return jwt.sign(payload, getSecret() as Secret, options);
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, getSecret());
  if (typeof decoded !== "object" || decoded === null) {
    throw new Error("Invalid token");
  }
  const { sub, role, email } = decoded as Record<string, unknown>;
  if (typeof sub !== "string" || typeof email !== "string") {
    throw new Error("Invalid token payload");
  }
  if (role !== "admin" && role !== "doctor" && role !== "staff") {
    throw new Error("Invalid role in token");
  }
  return { sub, role, email };
}
