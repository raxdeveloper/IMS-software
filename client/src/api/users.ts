import { apiFetch } from "./client";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

export function listUsers(): Promise<{ data: UserRow[] }> {
  return apiFetch("/api/users");
}

export function createUser(body: {
  name: string;
  email: string;
  password: string;
  role: "admin" | "doctor" | "staff";
}): Promise<{ user: Omit<UserRow, "createdAt"> }> {
  return apiFetch("/api/users", { method: "POST", body: JSON.stringify(body) });
}

export function patchUser(id: string, body: { role?: string; isActive?: boolean }): Promise<{ user: UserRow }> {
  return apiFetch(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}
