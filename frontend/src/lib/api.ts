const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error("VITE_API_BASE_URL is not configured.");
}
const AUTH_TOKEN_KEY = "zapp_dashboard_access_token";
const REFRESH_TOKEN_KEY = "zapp_dashboard_refresh_token";

export type UserRole = "admin" | "manager" | "viewer";
export type UserStatus = "pending" | "approved" | "rejected" | "disabled";

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  user: AuthUser;
}

export interface RegisterPayload {
  email: string;
  name: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AccessUserUpdatePayload {
  name?: string;
  role?: UserRole;
  status?: UserStatus;
}

export type DiagnosticStatus =
  | "success"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "timeout"
  | "server_error"
  | "invalid_response"
  | "unknown_error";

export interface ZappEndpointDiagnostic {
  label: string;
  path: string;
  status: DiagnosticStatus;
  upstreamStatus: number | null;
  elapsedMs: number | null;
  itemCount: number | null;
  responseKeys: string[];
  message?: string;
}

export interface ZappDiagnosticsResponse {
  checkedAt: string;
  configured: boolean;
  results: ZappEndpointDiagnostic[];
}

export interface DashboardCollectionResponse<T> {
  success: boolean;
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  fetchedAt: string;
  source?: {
    path: string;
    upstreamStatus: number | null;
    elapsedMs: number | null;
    responseKeys: string[];
    localDateFilterApplied?: boolean;
  };
  errorType?: DiagnosticStatus;
  message?: string;
  upstreamStatus?: number | null;
}

export interface DashboardOrder {
  id: string;
  orderName: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  status: string;
  financialStatus: string;
  fulfillmentStatus: string;
  total: number | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
  linkedRequestId: string;
  sourceType: string;
  itemCount: number | null;
  receiptStatus: string;
  deliveryStatus: string;
  trackingNumber: string;
  source: {
    sourceId: string;
    availableFields: string[];
  };
}

export interface DashboardRequest {
  id: string;
  requestNumber: string;
  reference: string;
  customerName: string;
  customerEmail: string;
  status: string;
  quoteStatus: string;
  paymentStatus: string;
  quotedTotal: number | null;
  currency: string;
  itemCount: number | null;
  createdAt: string;
  updatedAt: string;
  linkedOrderId: string;
  latestMessageStatus: string;
  emailStatus: string;
  sourceType: string;
  publicToken: string;
  productTitle: string;
  productUrl: string;
  receiptStatus: string;
  quoteMvr: string;
  quoteUsd: string;
  source: {
    sourceId: string;
    availableFields: string[];
  };
}

export interface DashboardEmailLog {
  id: string;
  shop: string;
  provider: string;
  direction: string;
  messageType: string;
  eventType: string;
  status: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  resendEmailId: string;
  webhookDeliveryId: string;
  linkedRequestId: string;
  requestPublicToken: string;
  orderReference: string;
  requestCustomerName: string;
  requestCustomerEmail: string;
  requestProductTitle: string;
  requestStatus: string;
  errorMessage: string;
  metadataSummary: string;
  createdAt: string;
  updatedAt: string;
  source: {
    sourceId: string;
    availableFields: string[];
  };
}

export interface CollectionQuery {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface CurrencyRecord {
  id: number;
  code: string;
  name: string;
  symbol: string;
  exchange_rate_to_base: number;
  is_base: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CurrencyPayload = Omit<CurrencyRecord, "id" | "created_at" | "updated_at">;

export interface ShippingRateRecord {
  id: number;
  name: string;
  origin_country: string;
  destination_country: string;
  carrier: string;
  service_level: string;
  min_weight: number;
  max_weight: number;
  rate: number;
  currency: string;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ShippingRatePayload = Omit<ShippingRateRecord, "id" | "created_at" | "updated_at">;

export interface CostRecord {
  id: number;
  source_type: "order" | "request" | "manual";
  source_id: string | null;
  linked_order_id: string | null;
  linked_request_id: string | null;
  reference_label: string | null;
  customer_name: string | null;
  title: string | null;
  supplier_name: string | null;
  product_purchase_cost: number;
  bml_tax: number;
  import_tax: number;
  shipping_cost: number;
  additional_cost: number;
  item_cost: number;
  international_shipping_cost: number;
  local_delivery_cost: number;
  customs_cost: number;
  payment_fee: number;
  packaging_cost: number;
  other_cost: number;
  sale_total: number;
  currency: string;
  total_cost: number;
  profit: number;
  margin_percent: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type CostPayload = {
  source_type?: "order" | "request" | "manual";
  source_id?: string | null;
  linked_order_id?: string | null;
  linked_request_id?: string | null;
  reference_label?: string | null;
  customer_name?: string | null;
  title?: string | null;
  supplier_name?: string | null;
  product_purchase_cost?: number;
  bml_tax?: number;
  import_tax?: number;
  shipping_cost?: number;
  additional_cost?: number;
  item_cost?: number;
  international_shipping_cost?: number;
  local_delivery_cost?: number;
  customs_cost?: number;
  payment_fee?: number;
  packaging_cost?: number;
  other_cost?: number;
  sale_total?: number;
  currency?: string;
  notes?: string | null;
};

export interface PricingCalculatePayload {
  item_cost: number;
  source_currency: string;
  target_currency: string;
  product_weight: number;
  origin_country: string;
  destination_country: string;
  desired_margin_percent: number;
  payment_fee_percent: number;
  customs_cost: number;
  local_delivery_cost: number;
  packaging_cost: number;
  other_cost: number;
}

export interface PricingCalculateResult {
  source_currency: string;
  target_currency: string;
  converted_item_cost: number;
  international_shipping_cost: number;
  customs_cost: number;
  local_delivery_cost: number;
  packaging_cost: number;
  other_cost: number;
  total_landed_cost: number;
  payment_fee: number;
  recommended_sale_price: number;
  expected_profit: number;
  margin_percent: number | null;
  shipping_rate_used: {
    id: number;
    name: string;
    carrier: string;
    service_level: string;
    origin_country: string;
    destination_country: string;
    min_weight: number;
    max_weight: number;
    rate: number;
    currency: string;
    estimated_days_min: number | null;
    estimated_days_max: number | null;
  };
  breakdown: Record<string, number>;
}

export type OverviewZappStatus = DiagnosticStatus | "not_configured" | "degraded";

export interface OverviewFinanceStats {
  currency: string;
  totalCostRecords: number;
  totalSaleValue: number;
  totalCostValue: number;
  totalProfit: number;
  averageMarginPercent: number | null;
  profitableRecordsCount: number;
  lossRecordsCount: number;
  linkedOrdersCount: number;
  linkedRequestsCount: number;
  scope: string;
}

export interface OverviewConfigurationStats {
  activeCurrenciesCount: number;
  activeShippingRateCardsCount: number;
}

export interface OverviewAccessStats {
  pendingUsersCount: number | null;
}

export interface OverviewRecentCostRecord {
  id: number;
  referenceLabel: string | null;
  linkedOrderId: string | null;
  linkedRequestId: string | null;
  saleTotal: number;
  totalCost: number;
  profit: number;
  marginPercent: number | null;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface OverviewFinanceTrendPoint {
  date: string;
  revenue: number;
  costs: number;
  profit: number;
  marginPercent: number | null;
  records: number;
}

export interface OverviewRequestConversion {
  available: boolean;
  total: number;
  quoted: number;
  approvedPaid: number;
  cancelled: number;
  pending: number;
  conversionRate: number | null;
  cancellationRate: number | null;
  countsMayBePartial: boolean;
  sampleSize: number;
}

export interface OverviewZappSection<T> {
  available: boolean;
  status: DiagnosticStatus | "not_configured";
  total: number | null;
  recentCount: number;
  recent: T[];
  upstreamStatus: number | null;
  elapsedMs: number | null;
  responseKeys: string[];
  statusCounts: Record<string, number>;
  cancelledCount: number;
  countsMayBePartial: boolean;
  sampleSize: number;
  message: string | null;
}

export interface OverviewStatsResponse {
  generatedAt: string;
  role: UserRole;
  permissions: {
    canManageFinance: boolean;
    canManageAccess: boolean;
    canViewDiagnostics: boolean;
  };
  finance: OverviewFinanceStats;
  configuration: OverviewConfigurationStats;
  access: OverviewAccessStats;
  recentCostRecords: OverviewRecentCostRecord[];
  financeTrend: OverviewFinanceTrendPoint[];
  zappApiConfigured: boolean;
  zappApi: {
    configured: boolean;
    checkedAt: string;
    status: OverviewZappStatus;
    message: string;
    orders: OverviewZappSection<DashboardOrder>;
    requests: OverviewZappSection<DashboardRequest>;
    emailLogs: OverviewZappSection<DashboardEmailLog>;
    requestConversion: OverviewRequestConversion;
  };
}

export class ApiClientError extends Error {
  status?: number;
  errorType?: DiagnosticStatus;
  upstreamStatus?: number | null;

  constructor(message: string) {
    super(message);
    this.name = "ApiClientError";
  }
}

export function getStoredAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getStoredRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function storeAuthTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearStoredAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function isAdmin(user: AuthUser | null | undefined) {
  return user?.status === "approved" && user.role === "admin";
}

export function canManageFinance(user: AuthUser | null | undefined) {
  return user?.status === "approved" && (user.role === "admin" || user.role === "manager");
}

export async function registerUser(payload: RegisterPayload): Promise<AuthTokenResponse> {
  return apiRequest<AuthTokenResponse>("/api/auth/register", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload: LoginPayload): Promise<AuthTokenResponse> {
  return apiRequest<AuthTokenResponse>("/api/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload),
  });
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  return apiRequest<AuthUser>("/api/auth/me");
}

export async function logoutUser(): Promise<{ success: boolean }> {
  const refreshToken = getStoredRefreshToken();
  return apiRequest<{ success: boolean }>("/api/auth/logout", {
    method: "POST",
    auth: false,
    body: refreshToken ? JSON.stringify({ refresh_token: refreshToken }) : undefined,
  });
}

export async function fetchAccessUsers(): Promise<AuthUser[]> {
  return apiRequest<AuthUser[]>("/api/access/users");
}

export async function updateAccessUser(
  id: number,
  payload: AccessUserUpdatePayload,
): Promise<AuthUser> {
  return apiRequest<AuthUser>(`/api/access/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function fetchZappDiagnostics(): Promise<ZappDiagnosticsResponse> {
  const response = await fetch(`${API_BASE_URL}/diagnostics/zapp-api`, {
    headers: buildHeaders(),
  });

  if (!response.ok) {
    throw new ApiClientError(`Diagnostics request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as ZappDiagnosticsResponse;

  if (!Array.isArray(payload.results)) {
    throw new ApiClientError("Diagnostics response did not include endpoint results.");
  }

  return payload;
}

export async function fetchOrders(
  query: CollectionQuery,
): Promise<DashboardCollectionResponse<DashboardOrder>> {
  return fetchCollection<DashboardOrder>("/api/orders", query);
}

export async function fetchRequests(
  query: CollectionQuery,
): Promise<DashboardCollectionResponse<DashboardRequest>> {
  return fetchCollection<DashboardRequest>("/api/requests", query);
}

export async function fetchEmailLogs(
  query: CollectionQuery,
): Promise<DashboardCollectionResponse<DashboardEmailLog>> {
  return fetchCollection<DashboardEmailLog>("/api/email-logs", query);
}

export async function fetchCurrencies(query: { search?: string; includeInactive?: boolean } = {}) {
  const params = new URLSearchParams();
  if (query.search?.trim()) {
    params.set("search", query.search.trim());
  }
  params.set("include_inactive", String(query.includeInactive ?? true));
  return apiRequest<CurrencyRecord[]>(`/api/currencies?${params.toString()}`);
}

export async function createCurrency(payload: CurrencyPayload) {
  return apiRequest<CurrencyRecord>("/api/currencies", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCurrency(id: number, payload: Partial<CurrencyPayload>) {
  return apiRequest<CurrencyRecord>(`/api/currencies/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCurrency(id: number) {
  return apiRequest<CurrencyRecord>(`/api/currencies/${id}`, {
    method: "DELETE",
  });
}

export async function fetchShippingRates(
  query: {
    search?: string;
    destinationCountry?: string;
    carrier?: string;
    currency?: string;
    includeInactive?: boolean;
  } = {},
) {
  const params = new URLSearchParams();
  if (query.search?.trim()) {
    params.set("search", query.search.trim());
  }
  if (query.destinationCountry?.trim()) {
    params.set("destination_country", query.destinationCountry.trim());
  }
  if (query.carrier?.trim()) {
    params.set("carrier", query.carrier.trim());
  }
  if (query.currency?.trim()) {
    params.set("currency", query.currency.trim());
  }
  params.set("include_inactive", String(query.includeInactive ?? true));
  return apiRequest<ShippingRateRecord[]>(`/api/shipping-rates?${params.toString()}`);
}

export async function createShippingRate(payload: ShippingRatePayload) {
  return apiRequest<ShippingRateRecord>("/api/shipping-rates", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateShippingRate(id: number, payload: Partial<ShippingRatePayload>) {
  return apiRequest<ShippingRateRecord>(`/api/shipping-rates/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteShippingRate(id: number) {
  return apiRequest<ShippingRateRecord>(`/api/shipping-rates/${id}`, {
    method: "DELETE",
  });
}

export async function fetchCosts(query: { search?: string; currency?: string } = {}) {
  const params = new URLSearchParams();
  if (query.search?.trim()) {
    params.set("search", query.search.trim());
  }
  if (query.currency?.trim()) {
    params.set("currency", query.currency.trim());
  }
  return apiRequest<CostRecord[]>(`/api/costs?${params.toString()}`);
}

export async function createCost(payload: CostPayload) {
  return apiRequest<CostRecord>("/api/costs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCost(id: number, payload: Partial<CostPayload>) {
  return apiRequest<CostRecord>(`/api/costs/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCost(id: number) {
  return apiRequest<void>(`/api/costs/${id}`, {
    method: "DELETE",
  });
}

export async function calculatePricing(payload: PricingCalculatePayload) {
  return apiRequest<PricingCalculateResult>("/api/pricing/calculate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchOverviewStats(): Promise<OverviewStatsResponse> {
  return apiRequest<OverviewStatsResponse>("/api/overview/stats");
}

async function fetchCollection<T>(
  path: string,
  query: CollectionQuery,
): Promise<DashboardCollectionResponse<T>> {
  const params = new URLSearchParams();

  if (query.search?.trim()) {
    params.set("search", query.search.trim());
  }
  if (query.status?.trim()) {
    params.set("status", query.status.trim());
  }
  if (query.dateFrom) {
    params.set("date_from", query.dateFrom);
  }
  if (query.dateTo) {
    params.set("date_to", query.dateTo);
  }
  params.set("page", String(query.page ?? 1));
  params.set("page_size", String(query.pageSize ?? 20));

  const response = await fetch(`${API_BASE_URL}${path}?${params.toString()}`, {
    headers: buildHeaders(),
  });
  const payload = (await response.json().catch(() => null)) as
    | DashboardCollectionResponse<T>
    | null;

  if (!response.ok || !payload?.success) {
    const error = new ApiClientError(
      payload?.message || `Request failed with status ${response.status}.`,
    );
    error.status = response.status;
    error.errorType = payload?.errorType;
    error.upstreamStatus = payload?.upstreamStatus;
    throw error;
  }

  if (!Array.isArray(payload.items)) {
    throw new ApiClientError("Response did not include a valid items array.");
  }

  return payload;
}

type ApiRequestInit = RequestInit & { auth?: boolean };
let refreshPromise: Promise<AuthTokenResponse> | null = null;

function buildHeaders(init: RequestInit = {}, includeAuth = true) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) {
    headers.set("Content-Type", "application/json");
  }

  const token = getStoredAuthToken();
  if (includeAuth && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
}

function formatApiDetail(detail: unknown) {
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          const message = (item as { msg?: unknown }).msg;
          return typeof message === "string" ? message : null;
        }
        return null;
      })
      .filter(Boolean)
      .join(" ");
  }
  return null;
}

async function apiRequest<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const { auth = true, ...requestInit } = init;
  const headers = buildHeaders(requestInit, auth);

  let response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestInit,
    headers,
  });

  if (response.status === 401 && auth && path !== "/api/auth/refresh") {
    const refreshed = await refreshSession();
    if (refreshed) {
      const retryHeaders = buildHeaders(requestInit, auth);
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...requestInit,
        headers: retryHeaders,
      });
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = formatApiDetail(payload?.detail);
    const error = new ApiClientError(detail || `Request failed with status ${response.status}.`);
    error.status = response.status;
    if (response.status === 401) {
      clearStoredAuthToken();
      window.dispatchEvent(new CustomEvent("zapp-auth-expired"));
    }
    throw error;
  }

  return payload as T;
}

async function refreshSession() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    return false;
  }

  try {
    refreshPromise ??= apiRequest<AuthTokenResponse>("/api/auth/refresh", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const session = await refreshPromise;
    storeAuthTokens(session.access_token, session.refresh_token);
    return true;
  } catch {
    clearStoredAuthToken();
    window.dispatchEvent(new CustomEvent("zapp-auth-expired"));
    return false;
  } finally {
    refreshPromise = null;
  }
}
