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
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(userId: string, path: string, options?: RequestInit) {
  const res = await fetch(path, {
    method: options?.method || 'GET',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
    body: options?.body
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body.error?.code || 'ERROR', body.error?.message || 'Request failed');
  }
  return body;
}

export const api = {
  listEquipment: async (userId: string) => {
    const body = await request(userId, '/api/equipment');
    return body.data as Equipment[];
  },
  createEquipment: async (userId: string, name: string, total_units: number) => {
    const body = await request(userId, '/api/equipment', {
      method: 'POST',
      body: JSON.stringify({ name, total_units })
    });
    return body.data as Equipment;
  },
  retireEquipment: async (userId: string, id: number) => {
    await request(userId, '/api/equipment/' + id + '/retire', { method: 'PATCH' });
  },
  borrow: async (userId: string, equipment_id: number) => {
    const body = await request(userId, '/api/checkouts', {
      method: 'POST',
      body: JSON.stringify({ equipment_id })
    });
    return body.data as Checkout;
  },
  listCheckouts: async (userId: string, page: number) => {
    const body = await request(userId, '/api/checkouts?page=' + page + '&limit=10');
    return body as { data: Checkout[]; pagination: { page: number; total_pages: number } };
  },
  returnCheckout: async (userId: string, id: number) => {
    await request(userId, '/api/checkouts/' + id + '/return', { method: 'POST' });
  },
  report: async (userId: string) => {
    const body = await request(userId, '/api/report/equipment-usage');
    return body.data as ReportRow[];
  }
};

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
