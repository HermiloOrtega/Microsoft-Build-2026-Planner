import { Session, SessionFilters, SyncResult } from '../types';

const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api';

function buildQuery(filters: Partial<SessionFilters>): string {
  const params = new URLSearchParams();
  if (filters.prio      && filters.prio      !== 'all') params.set('prio',      filters.prio);
  if (filters.type      && filters.type      !== 'all') params.set('type',      filters.type);
  if (filters.category  && filters.category  !== 'all') params.set('category',  filters.category);
  if (filters.recorded  && filters.recorded  !== 'all') params.set('recorded',  filters.recorded);
  if (filters.search    && filters.search.trim())        params.set('search',    filters.search.trim());
  if (filters.sort      && filters.sort      !== 'prio') params.set('sort',      filters.sort);
  if (filters.direction && filters.direction !== 'asc')  params.set('direction', filters.direction);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function pwdHeader(password?: string): Record<string, string> {
  return password ? { 'X-Master-Password': password } : {};
}

export async function fetchSessions(filters: Partial<SessionFilters> = {}): Promise<Session[]> {
  const res = await fetch(`${BASE}/sessions${buildQuery(filters)}`);
  if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.statusText}`);
  return res.json();
}

export async function fetchSession(id: number): Promise<Session> {
  const res = await fetch(`${BASE}/sessions/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch session ${id}: ${res.statusText}`);
  return res.json();
}

export async function createSession(data: Partial<Session>, password?: string): Promise<Session> {
  const res = await fetch(`${BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...pwdHeader(password) },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to create session: ${res.statusText}`);
  return res.json();
}

export async function updateSession(id: number, data: Partial<Session>, password?: string): Promise<Session> {
  const res = await fetch(`${BASE}/sessions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...pwdHeader(password) },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update session ${id}: ${res.statusText}`);
  return res.json();
}

export async function deleteSession(id: number, password?: string): Promise<void> {
  const res = await fetch(`${BASE}/sessions/${id}`, {
    method: 'DELETE',
    headers: { ...pwdHeader(password) },
  });
  if (!res.ok) throw new Error(`Failed to delete session ${id}: ${res.statusText}`);
}

export async function triggerSync(password?: string): Promise<SyncResult> {
  const res = await fetch(`${BASE}/sync`, {
    method: 'POST',
    headers: { ...pwdHeader(password) },
  });
  if (!res.ok) throw new Error(`Sync failed: ${res.statusText}`);
  return res.json();
}

export async function checkPassword(password: string): Promise<boolean> {
  const res = await fetch(`${BASE}/auth/check`, {
    method: 'POST',
    headers: { ...pwdHeader(password) },
  });
  return res.ok;
}

export async function pasteImport(text: string, password?: string): Promise<SyncResult> {
  const res = await fetch(`${BASE}/paste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...pwdHeader(password) },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Paste import failed: ${res.statusText}`);
  }
  return res.json();
}
