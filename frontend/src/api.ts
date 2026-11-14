// Tiny typed API client. The demo "login" is just picking a seeded user;
// the id goes out as the X-User-Id header the API trusts (brief §2).
export interface User {
  id: string;
  name: string;
  role: 'student' | 'assistant';
}
export const SEED_USERS: User[] = [
  { id: 'stu-aria', name: 'Aria Sharma (student)', role: 'student' },
  { id: 'stu-rohan', name: 'Rohan Verma (student)', role: 'student' },
  { id: 'stu-meera', name: 'Meera Iyer (student)', role: 'student' },
  { id: 'asst-rahul', name: 'Rahul Gupta (assistant)', role: 'assistant' },
  { id: 'asst-priya', name: 'Priya Nair (assistant)', role: 'assistant' }
];

export interface Equipment {
  id: number;
  name: string;
  total_units: number;
  retired: boolean;
  checked_out: number;
  available_units: number;
}
export interface Checkout {
  id: number;
  equipment_id: number;
  equipment_name: string;
  user_id: string;
  user_name: string;
  borrowed_at: string;
  due_at: string;
  returned_at: string | null;
  overdue: boolean;
}
export interface ReportRow {
  equipment_id: number;
  name: string;
  total_units: number;
  checked_out: number;
  overdue: number;
  available_units: number;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

async function request<T>(userId: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-User-Id': userId, ...(init?.headers || {}) }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body.error?.code || 'ERROR', body.error?.message || `Request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  listEquipment: (u: string) => request<{ data: Equipment[] }>(u, '/api/equipment').then((r) => r.data),
  createEquipment: (u: string, name: string, total_units: number) =>
    request<{ data: Equipment }>(u, '/api/equipment', {
      method: 'POST',
      body: JSON.stringify({ name, total_units })
    }).then((r) => r.data),
  retireEquipment: (u: string, id: number) =>
    request(u, `/api/equipment/${id}/retire`, { method: 'PATCH' }),
  borrow: (u: string, equipment_id: number) =>
    request<{ data: Checkout }>(u, '/api/checkouts', {
      method: 'POST',
      body: JSON.stringify({ equipment_id })
    }).then((r) => r.data),
  listCheckouts: (u: string, page = 1, limit = 20) =>
    request<{ data: Checkout[]; pagination: any }>(u, `/api/checkouts?page=${page}&limit=${limit}`),
  returnCheckout: (u: string, id: number) =>
    request(u, `/api/checkouts/${id}/return`, { method: 'POST' }),
  report: (u: string) =>
    request<{ data: ReportRow[] }>(u, '/api/report/equipment-usage').then((r) => r.data)
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
