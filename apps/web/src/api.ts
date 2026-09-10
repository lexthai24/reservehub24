import type { LoginInput, RegisterInput, ResourceInput, UserRole } from "@reservehub/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export interface ApiUser { id: string; email: string; fullName: string; role: UserRole; }
export interface ApiResource { id: string; name: string; description: string | null; imageUrl: string | null; resourceType: string; location: string | null; capacity: number | null; timezone: string; status: "ACTIVE" | "ARCHIVED"; createdAt: string; updatedAt: string; }
export interface ApiBooking { id: string; resourceId: string; userId: string; startsAt: string; endsAt: string; status: "CONFIRMED" | "CANCELLED" | "COMPLETED"; notes: string | null; idempotencyKey: string | null; resource: ApiResource; }
export interface ApiNotification { id: string; type: string; title: string; message: string; readAt: string | null; createdAt: string; }
export interface ApiWaitingListEntry { id: string; resourceId: string; userId: string; requestedStart: string; requestedEnd: string; priority: number; status: string; createdAt: string; }
export interface ApiAuditLog { id: string; actorUserId: string | null; action: string; entityType: string; entityId: string | null; metadata: unknown; createdAt: string; }
export interface ApiAdminUser { id: string; email: string; fullName: string; role: UserRole; createdAt: string; }
export interface ApiAnalyticsOverview { totalBookings: number; confirmedBookings: number; activeResources: number; }
export interface ApiUsageRecord { resourceId: string; resourceName: string; usageCount: number; }
export interface ApiPeakHour { hour: number; usageCount: number; }

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: "include" });
  const payload = await response.json().catch(() => ({})) as { data?: T; error?: string; message?: string };
  if (!response.ok) throw new ApiError(response.status, payload.error ?? "REQUEST_FAILED", payload.message ?? "The request could not be completed");
  return payload.data as T;
}

function jsonBody(value: unknown): RequestInit { return { method: "POST", body: JSON.stringify(value) }; }

export const api = {
  me: () => request<ApiUser>("/auth/me"),
  login: (input: LoginInput) => request<ApiUser>("/auth/login", jsonBody(input)),
  register: (input: RegisterInput) => request<ApiUser>("/auth/register", jsonBody(input)),
  logout: () => request<{ success: boolean }>("/auth/logout", jsonBody({})),
  updateProfile: (fullName: string) => request<ApiUser>("/auth/me", { method: "PATCH", body: JSON.stringify({ fullName }) }),
  changePassword: (input: { currentPassword: string; newPassword: string }) => request<{ success: boolean }>("/auth/change-password", jsonBody(input)),
  resources: (params: { status?: "ACTIVE" | "ARCHIVED"; q?: string; type?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.q) query.set("q", params.q);
    if (params.type) query.set("type", params.type);
    return request<ApiResource[]>(`/resources${query.size ? `?${query.toString()}` : ""}`);
  },
  createResource: (input: ResourceInput) => request<ApiResource>("/resources", jsonBody(input)),
  updateResource: (resourceId: string, input: Partial<ResourceInput>) => request<ApiResource>(`/resources/${resourceId}`, { method: "PATCH", body: JSON.stringify(input) }),
  archiveResource: (resourceId: string) => request<{ success: boolean }>(`/resources/${resourceId}`, { method: "DELETE" }),
  availability: (resourceId: string, from: string, to: string) => request<Array<{ startsAt: string; endsAt: string }>>(`/resources/${resourceId}/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  suggestions: (resourceId: string) => request<ApiResource[]>(`/resources/${resourceId}/suggestions`),
  bookings: () => request<ApiBooking[]>("/bookings/me"),
  createBooking: (input: { resourceId: string; startsAt: string; endsAt: string; notes?: string; idempotencyKey: string }) => request<ApiBooking>("/bookings", jsonBody(input)),
  updateBooking: (bookingId: string, input: { startsAt?: string; endsAt?: string; notes?: string }) => request<ApiBooking>(`/bookings/${bookingId}`, { method: "PATCH", body: JSON.stringify(input) }),
  cancelBooking: (bookingId: string) => request<ApiBooking>(`/bookings/${bookingId}/cancel`, jsonBody({})),
  waitingList: () => request<ApiWaitingListEntry[]>("/waiting-list/me"),
  joinWaitingList: (input: { resourceId: string; requestedStart: string; requestedEnd: string; priority: number }) => request<ApiWaitingListEntry>("/waiting-list", jsonBody(input)),
  cancelWaitingList: (id: string) => request<ApiWaitingListEntry>(`/waiting-list/${id}`, { method: "DELETE" }),
  notifications: () => request<ApiNotification[]>("/notifications"),
  markNotificationRead: (id: string) => request<ApiNotification>(`/notifications/${id}/read`, { method: "PATCH" }),
  analyticsOverview: () => request<ApiAnalyticsOverview>("/analytics/overview"),
  resourceUsage: () => request<ApiUsageRecord[]>("/analytics/resource-usage"),
  peakHours: () => request<ApiPeakHour[]>("/analytics/peak-hours"),
  adminUsers: () => request<ApiAdminUser[]>("/admin/users"),
  updateUserRole: (userId: string, role: UserRole) => request<{ id: string; role: UserRole }>(`/admin/users/${userId}/role`, { method: "PATCH", body: JSON.stringify({ role }) }),
  resetUserPassword: (userId: string, newPassword: string) => request<{ success: boolean }>(`/admin/users/${userId}/password`, { method: "PATCH", body: JSON.stringify({ newPassword }) }),
  auditLogs: () => request<ApiAuditLog[]>("/admin/audit-logs"),
};
