import axios, { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user_id: string;
  email: string;
  role: string;
  name: string;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
}

// ── Session / Me ──────────────────────────────────────────────────────────────
// Extended shape returned by GET /auth/me.
// Includes citizen fields that are absent from the login response so the
// wallet can gate UI on enrollment state without an extra citizen API call.

export interface MeResponse extends LoginResponse {
  /** Assigned after a Registration Officer approves enrollment. Null until then. */
  citizen_din: string | null;
  /** Current lifecycle state of the citizen record. Null if not yet enrolled. */
  citizen_status: CitizenStatus | null;
  is_email_verified: boolean;
}

// ── Account creation / OTP (Phase 1 registration) ────────────────────────────

export interface AccountCreateRequest {
  email: string;
  password: string;
}

export interface AccountCreateResponse {
  user_id: number;
  email: string;
  message: string;
}

export interface OTPVerifyRequest {
  email: string;
  otp: string;
}

export interface OTPVerifyResponse {
  message: string;
  is_email_verified: boolean;
}

export interface ResendOTPRequest {
  email: string;
}

export interface ResendOTPResponse {
  message: string;
}

// ── Identity submission (Phase 2 registration) ────────────────────────────────

export interface IdentitySubmitRequest {
  nrc: string;
  full_name: string;
  dob: string;           // ISO date string: "YYYY-MM-DD"
  phone?: string;
  gender: Gender;
  province: PROVINCE;
  language: Language;
  public_key: string;    // PEM-encoded RSA public key
  nrc_front_url: string;
  nrc_back_url: string;
  face_image_url: string;
}

export interface IdentitySubmitResponse {
  enrollment_request_id: number;
  citizen_id: number;
  message: string;
}

export type CitizenStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "DECEASED"
export type Gender = "MALE" | "FEMALE" | "OTHER";
export type Language = "en" | "bem" | "nya" | "toi" | "loz";
export type PROVINCE =
  | "CENTRAL"
  | "COPPERBELT"
  | "EASTERN"
  | "LUAPULA"
  | "LUSAKA"
  | "MUCHINGA"
  | "NORTHERN"
  | "NORTHWEST"
  | "SOUTHERN"
  | "WESTERN";

export type RelationshipType =
  | "PARENT"
  | "CHILD"
  | "SIBLING"
  | "SPOUSE"
  | "GUARDIAN";

// ===== Citizens ======

export interface CitizenBase {
  nrc: string;
  full_name: string;
  dob: string;
  phone?: string;
  language: Language;
  public_key: string;
  nrc_front_url?: string;
  nrc_back_url?: string;
  face_url?: string;
  email?: string;
  password?: string;
}

export interface CitizenSummary {
  din: string;
  full_name: string;
  nrc: string;
  status: CitizenStatus;
}

export interface CitizenResponse extends CitizenBase {
  din: string;
  status: CitizenStatus;
  created_at: string;
  updated_at: string;
}

export interface CitizenUpdate {
  full_name?: string;
  phone?: string;
  language?: string;
  status?: CitizenStatus;
}

export interface FamilyLinkBase {
  related_citizen_din: string;
  relationship_type: RelationshipType;
}

export interface BiometricRecordResponse {
  citizen_din: string;
  facial_template?: string | null;
  captured_at: string;
  updated_at: string;
}

export interface FamilyLinkResponse {
  id: number;
  citizen: CitizenSummary;
  related_citizen: CitizenSummary;
  relationship_type: RelationshipType;
  created_at: string;
}

export interface FamilyTreeResponse {
  citizen: CitizenSummary;
  parents: CitizenSummary[];
  children: CitizenSummary[];
  siblings: CitizenSummary[];
  spouses: CitizenSummary[];
}

// ====== Enrollment =======

export interface EnrollmentRequestResponse {
  id: number;
  citizen: CitizenResponse;
  submitted_at: string;
  reviewed_at?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejection_reason?: string | null;
  ro_id?: number | null;
}

export interface EnrollmentRejection {
  rejection_reason: string;
}

// ====== Digital ID =====

export interface DigitalIDPayload {
  din: string;
  full_name: string;
  nrc: string;
  dob: string;
  status: CitizenStatus;
  public_key: string;
  issued_at: string;
  signature: string;
}

export interface DigitalIDResponse {
  payload: DigitalIDPayload;
  issued_at: string;
  valid_for_seconds: number;
}

export interface ServerPublicKeyResponse {
  public_key_pem: string;
  algorithm: string;
  usage: string;
}

// ===== QR =====

export interface QRPayload {
  din: string;
  name: string;
  nonce: string;
  exp: number;
  sig: string;
}

export interface QRVerifyRequest {
  din: string;
  nonce: string;
  exp: number;
  sig: string;
}

export interface QRVerifyResponse {
  verified: boolean;
  din: string;
  expires_in_seconds: number;
}

// ===== Hospital (birth / death records) ======

export interface BirthRecordBase {
  citizen_din: string;
  hospital_name: string;
  birth_date: string;
  [key: string]: unknown;
}

export interface DeathRecordBase {
  citizen_din: string;
  hospital_name: string;
  death_date: string;
  cause_of_death?: string;
  [key: string]: unknown;
}

export interface RecordRejection {
  rejection_reason: string;
}

// ===== KYC ======

export interface KYCRequestCreate {
  citizen_din: string;
  fields_requested: string[];
}

export interface KYCRequestResponse {
  id: number;
  institution_name: string;
  citizen_din: string;
  fields_requested: string[];
  fields_granted: string[];
  status: string;
  requested_at: string;
  responded_at?: string | null;
  expires_at?: string | null;
}

export interface KYCCitizenResponse {
  decision: "APPROVED" | "DENIED";
  fields_granted?: string[];
}

export interface ConsentRecordResponse {
  id: number;
  decision: string;
  fields_shared: string[];
  timestamp: string;
}

export interface ApprovedCitizenDataResponse {
  kyc_request_id: number;
  citizen_din: string;
  approved_fields: Record<string, unknown>;
  decision: string;
  timestamp: string;
}

export interface StatisticsResponse {
  total_registered_citizens: number;
  live_births_vs_deaths: Record<string, number>;
  gender_ratio: Record<string, unknown>;
  regional_breakdown: Array<Record<string, unknown>>;
  kyc_metrics: Record<string, unknown>;
}

// ===== Generic API error shape ====

export interface APIError {
  detail: string;
  status: number;
  code?: string;
  validationErrors?: Record<string, string[]>;
}

/**
 * Token store - thin wrapper over localStorage
 * Replace with SecureStorage (Capacitor) for the mobile app build
 */

const TOKEN_KEY = "zdid_access_token";
const REFRESH_KEY = "zdid_refresh_token";
const ROLE_KEY = 'zdid_user_role';

export const tokenStore = {
  getAccess: (): string | null => localStorage.getItem(TOKEN_KEY),
  getRefresh: (): string | null => localStorage.getItem(REFRESH_KEY),
  getRole: (): string | null => localStorage.getItem(ROLE_KEY),

  set: (access: string, refresh: string, role: string): void => {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(ROLE_KEY, role);
  },

  clear: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(ROLE_KEY);
    // Reset refresh state on logout
    if (typeof refreshState !== 'undefined' && refreshState.reset) {
      refreshState.reset();
    }
  },
}

// 3. Base Axios instance

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8000";

export const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
})

// === Request intercepter = attach Bearer token ===

axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStore.getAccess();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: any) => Promise.reject(error)
);

export const AUTH_EXPIRED_EVENT = "zdid:authenticated" as const;

function signalSessionExpired() {
  tokenStore.clear()
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
}

// === Response interceptor - handle 401 with token refresh ===
// Pattern: if a request returns 401, attempt one silent refresh, retry the
// original request, then give up and redirect to /login if refresh also fails.

// Use a singleton pattern to avoid state issues in SSR or multiple executions
const refreshState = (() => {
  let isRefreshing = false;
  let refreshQueue: Array<{
    resolve: (token: string) => void;
    reject: (err: unknown) => void;
  }> = [];

  return {
    get isRefreshing() {
      return isRefreshing;
    },
    set isRefreshing(value: boolean) {
      isRefreshing = value;
    },
    get refreshQueue() {
      return refreshQueue;
    },
    addToQueue: (item: { resolve: (token: string) => void; reject: (err: unknown) => void }) => {
      refreshQueue.push(item);
    },
    drainQueue: (token: string | null, error: unknown = null) => {
      refreshQueue.forEach(({ resolve, reject }) => {
        if (token) resolve(token);
        else reject(error);
      });
      refreshQueue = [];
    },
    reset: () => {
      isRefreshing = false;
      refreshQueue = [];
    }
  };
})();

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(normaliseError(error))
    }

    if (original.url?.includes("/auth/refresh")) {
      signalSessionExpired();
      return Promise.reject(normaliseError(error));
    }

    // Queue concurrent requests while a refresh is already in flight

    if (refreshState.isRefreshing) {
      return new Promise<AxiosResponse>((resolve, reject) => {
        refreshState.addToQueue({
          resolve: (token) => {
            original.headers.Authorization = `Bearer ${token}`;

            resolve(axiosInstance(original));
          },
          reject,
        });
      });
    }

    original._retry = true;
    refreshState.isRefreshing = true;

    const refreshToken = tokenStore.getRefresh();

    if (!refreshToken) {
      refreshState.isRefreshing = false;
      signalSessionExpired();
      return Promise.reject(normaliseError(error));
    }

    try {
      const { data } = await axios.post<RefreshResponse>(
        `${API_BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken }
      );

      const currentRole = tokenStore.getRole() || '';
      tokenStore.set(data.access_token, data.refresh_token, currentRole);
      axiosInstance.defaults.headers.common.Authorization = `Bearer ${data.access_token}`;
      refreshState.drainQueue(data.access_token);
      original.headers.Authorization = `Bearer ${data.access_token}`;
      return axiosInstance(original);
    } catch (refreshError) {
      refreshState.drainQueue(null, refreshError);
      signalSessionExpired();
      return Promise.reject(normaliseError(error));
    } finally {
      refreshState.isRefreshing = false;
    }
  }
);

function normaliseError(error: AxiosError): APIError {
  const responseData = error.response?.data as any;
  
  let detail = "An unexpected error occurred";
  let validationErrors: Record<string, string[]> | undefined;
  let code: string | undefined;

  if (responseData) {
    // Try to extract detail message
    if (typeof responseData.detail === 'string') {
      detail = responseData.detail;
    } else if (Array.isArray(responseData.detail)) {
      // Handle array of validation errors
      detail = "Validation failed";
      validationErrors = {};
      responseData.detail.forEach((err: any) => {
        if (err.loc && err.msg) {
          const field = err.loc[err.loc.length - 1];
          if (!validationErrors![field]) {
            validationErrors![field] = [];
          }
          validationErrors![field].push(err.msg);
        }
      });
    } else if (responseData.message) {
      detail = responseData.message;
    }
    
    // Extract error code if present
    if (responseData.code) {
      code = responseData.code;
    }
  } else if (error.message) {
    detail = error.message;
  }

  // Handle network errors
  if (error.code === 'ECONNABORTED') {
    detail = "Request timeout. Please check your connection and try again.";
  } else if (error.code === 'ERR_NETWORK') {
    detail = "Network error. Please check your internet connection.";
  }

  return { 
    detail, 
    status: error.response?.status ?? 0,
    ...(code && { code }),
    ...(validationErrors && { validationErrors })
  };
}

// 4. Domain API clients
// ---------------------------------------------------------------------------

// ── Auth ─────────────────────────────────────────────────────────────────────
// POST /auth/login
// POST /auth/refresh
// GET  /auth/me
// POST /auth/logout

export const authApi = {
  login: async (body: LoginRequest): Promise<LoginResponse> => {
    const { data } = await axiosInstance.post<LoginResponse>("/auth/login", body);
    tokenStore.set(data.access_token, data.refresh_token, data.role);
    return data;
  },

  refresh: async (refresh_token: string): Promise<RefreshResponse> => {
    const { data } = await axiosInstance.post<RefreshResponse>("/auth/refresh", {
      refresh_token,
    });
    const currentRole = tokenStore.getRole() || '';
    tokenStore.set(data.access_token, data.refresh_token, currentRole);
    return data;
  },

  /**
   * Returns the full session shape including citizen_din, citizen_status, and
   * is_email_verified — used by the wallet to gate enrollment UI without an
   * extra citizen API call.
   */
  me: async (): Promise<MeResponse> => {
    const { data } = await axiosInstance.get<MeResponse>("/auth/me");
    return data;
  },

  logout: async (): Promise<void> => {
    await axiosInstance.post("/auth/logout");
    tokenStore.clear();
  },

  /**
   * Step 1a — Create a new citizen account.
   * The backend creates an inactive SystemUser and emails a 6-digit OTP.
   * No token required; this is the public entry point.
   * POST /enrollments/register
   */
  createAccount: async (body: AccountCreateRequest): Promise<AccountCreateResponse> => {
    const { data } = await axiosInstance.post<AccountCreateResponse>(
      "/enrollments/register",
      body,
    );
    return data;
  },

  /**
   * Step 1b — Submit the emailed OTP to activate the account.
   * On success the backend sets is_email_verified=true and is_active=true.
   * No token required.
   * POST /enrollments/verify-otp
   */
  verifyOtp: async (body: OTPVerifyRequest): Promise<OTPVerifyResponse> => {
    const { data } = await axiosInstance.post<OTPVerifyResponse>(
      "/enrollments/verify-otp",
      body,
    );
    return data;
  },

  /**
   * Step 1b (retry) — Re-issue a fresh OTP for an unverified account.
   * Only valid for accounts where is_email_verified is still false.
   * No token required.
   * POST /enrollments/resend-otp
   */
  resendOtp: async (body: ResendOTPRequest): Promise<ResendOTPResponse> => {
    const { data } = await axiosInstance.post<ResendOTPResponse>(
      "/enrollments/resend-otp",
      body,
    );
    return data;
  },
};

// ── Enrollment ───────────────────────────────────────────────────────────────
// POST /enrollments/register                       → authApi.createAccount
// POST /enrollments/verify-otp                     → authApi.verifyOtp
// POST /enrollments/resend-otp                     → authApi.resendOtp
// POST /enrollments/submit-identity                (below)
// POST /enrollments/submit                         (legacy — kept for RO tooling)
// GET  /enrollments/pending_requests
// GET  /enrollments/pending_request/{request_id}
// PUT  /enrollments/{request_id}/request_approve
// PUT  /enrollments/{request_id}/request_reject

export const enrollmentApi = {
  /**
   * Step 2 — Authenticated citizen submits NRC docs, biometric photos, and
   * device public key to begin the RO review workflow.
   * Requires JWT with role=CITIZEN and is_email_verified=true.
   * POST /enrollments/submit-identity
   */
  submitIdentity: async (body: IdentitySubmitRequest): Promise<IdentitySubmitResponse> => {
    const { data } = await axiosInstance.post<IdentitySubmitResponse>(
      "/enrollments/submit-identity",
      body,
    );
    return data;
  },

  /** Legacy open endpoint — kept for Registration Officer tooling. */
  submit: async (body: CitizenBase): Promise<EnrollmentRequestResponse> => {
    const { data } = await axiosInstance.post<EnrollmentRequestResponse>(
      "/enrollments/submit",
      body
    );
    return data;
  },

  getPendingRequests: async (): Promise<EnrollmentRequestResponse[]> => {
    const { data } = await axiosInstance.get<EnrollmentRequestResponse[]>(
      "/enrollments/pending_requests"
    );
    return data;
  },

  getPendingRequest: async (requestId: number): Promise<EnrollmentRequestResponse> => {
    const { data } = await axiosInstance.get<EnrollmentRequestResponse>(
      `/enrollments/pending_request/${requestId}`
    );
    return data;
  },

  approve: async (requestId: number): Promise<EnrollmentRequestResponse> => {
    const { data } = await axiosInstance.put<EnrollmentRequestResponse>(
      `/enrollments/${requestId}/request_approve`
    );
    return data;
  },

  reject: async (
    requestId: number,
    body: EnrollmentRejection
  ): Promise<EnrollmentRequestResponse> => {
    const { data } = await axiosInstance.put<EnrollmentRequestResponse>(
      `/enrollments/${requestId}/request_reject`,
      body
    );
    return data;
  },
};

// ── Citizens ─────────────────────────────────────────────────────────────────
// GET    /citizens/
// GET    /citizens/{din}
// PATCH  /citizens/{din}
// DELETE /citizens/{din}
// GET    /citizens/{din}/biometrics
// POST   /citizens/{din}/biometrics
// PATCH  /citizens/{din}/biometrics
// POST   /citizens/{din}/family-links
// GET    /citizens/{din}/family-tree

export const citizenApi = {
  list: async (params?: {
    status?: CitizenStatus;
    language?: Language;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<CitizenSummary[]> => {
    const { data } = await axiosInstance.get<CitizenSummary[]>("/citizens/", {
      params,
    });
    return data;
  },

  get: async (din: string): Promise<CitizenResponse> => {
    const { data } = await axiosInstance.get<CitizenResponse>(`/citizens/${din}`);
    return data;
  },

  update: async (din: string, body: CitizenUpdate): Promise<CitizenResponse> => {
    const { data } = await axiosInstance.patch<CitizenResponse>(
      `/citizens/${din}`,
      body
    );
    return data;
  },

  delete: async (din: string): Promise<void> => {
    await axiosInstance.delete(`/citizens/${din}`);
  },

  getBiometrics: async (din: string): Promise<BiometricRecordResponse> => {
    const { data } = await axiosInstance.get<BiometricRecordResponse>(
      `/citizens/${din}/biometrics`
    );
    return data;
  },

  createBiometrics: async (
    din: string,
    body: { facial_template?: string }
  ): Promise<BiometricRecordResponse> => {
    const { data } = await axiosInstance.post<BiometricRecordResponse>(
      `/citizens/${din}/biometrics`,
      body
    );
    return data;
  },

  updateBiometrics: async (
    din: string,
    body: { facial_template?: string }
  ): Promise<BiometricRecordResponse> => {
    const { data } = await axiosInstance.patch<BiometricRecordResponse>(
      `/citizens/${din}/biometrics`,
      body
    );
    return data;
  },

  createFamilyLink: async (
    din: string,
    body: FamilyLinkBase
  ): Promise<FamilyLinkResponse> => {
    const { data } = await axiosInstance.post<FamilyLinkResponse>(
      `/citizens/${din}/family-links`,
      body
    );
    return data;
  },

  getFamilyTree: async (din: string): Promise<FamilyTreeResponse> => {
    const { data } = await axiosInstance.get<FamilyTreeResponse>(
      `/citizens/${din}/family-tree`
    );
    return data;
  },
};

// ── Digital ID ───────────────────────────────────────────────────────────────
// GET /digital-id/server-public-key   (public — no auth)
// GET /digital-id/{din}

export const digitalIdApi = {
  /** Public endpoint — no token required. Used to verify DigitalIDPayload signatures. */
  getServerPublicKey: async (): Promise<ServerPublicKeyResponse> => {
    const { data } = await axiosInstance.get<ServerPublicKeyResponse>(
      "/digital-id/server-public-key"
    );
    return data;
  },

  get: async (din: string): Promise<DigitalIDResponse> => {
    const { data } = await axiosInstance.get<DigitalIDResponse>(
      `/digital-id/${din}`
    );
    return data;
  },
};

// ── QR ───────────────────────────────────────────────────────────────────────
// POST /qr/{din}/generate
// POST /qr/verify            (public — no auth)

export const qrApi = {
  generate: async (din: string): Promise<QRPayload> => {
    const { data } = await axiosInstance.post<QRPayload>(
      `/qr/${din}/generate`
    );
    return data;
  },

  /** Public endpoint — used by third-party verifiers and testing tools. */
  verify: async (body: QRVerifyRequest): Promise<QRVerifyResponse> => {
    const { data } = await axiosInstance.post<QRVerifyResponse>(
      "/qr/verify",
      body
    );
    return data;
  },
};

// ── Birth Records ─────────────────────────────────────────────────────────────
// POST /birth_record/submit
// GET  /birth_record/pending_submissions
// GET  /birth_record/record/{record_id}
// GET  /birth_record/submission/{record_id}
// PUT  /birth_record/{submission_id}/approve_submission
// PUT  /birth_record/{submission_id}/reject_submission

export const birthRecordApi = {
  submit: async (body: BirthRecordBase): Promise<unknown> => {
    const { data } = await axiosInstance.post("/birth_record/submit", body);
    return data;
  },

  getPendingSubmissions: async (): Promise<unknown[]> => {
    const { data } = await axiosInstance.get("/birth_record/pending_submissions");
    return data;
  },

  getRecord: async (recordId: number): Promise<unknown> => {
    const { data } = await axiosInstance.get(`/birth_record/record/${recordId}`);
    return data;
  },

  getSubmission: async (recordId: number): Promise<unknown> => {
    const { data } = await axiosInstance.get(
      `/birth_record/submission/${recordId}`
    );
    return data;
  },

  approve: async (submissionId: number): Promise<unknown> => {
    const { data } = await axiosInstance.put(
      `/birth_record/${submissionId}/approve_submission`
    );
    return data;
  },

  reject: async (
    submissionId: number,
    body: RecordRejection
  ): Promise<unknown> => {
    const { data } = await axiosInstance.put(
      `/birth_record/${submissionId}/reject_submission`,
      body
    );
    return data;
  },
};

// ── Death Records ─────────────────────────────────────────────────────────────
// POST /death_record/submit
// GET  /death_record/pending_submissions
// GET  /death_record/record/{record_id}
// GET  /death_record/submission/{record_id}
// PUT  /death_record/{submission_id}/approve_submission
// PUT  /death_record/{submission_id}/reject_submission

export const deathRecordApi = {
  submit: async (body: DeathRecordBase): Promise<unknown> => {
    const { data } = await axiosInstance.post("/death_record/submit", body);
    return data;
  },

  getPendingSubmissions: async (): Promise<unknown[]> => {
    const { data } = await axiosInstance.get("/death_record/pending_submissions");
    return data;
  },

  getRecord: async (recordId: number): Promise<unknown> => {
    const { data } = await axiosInstance.get(`/death_record/record/${recordId}`);
    return data;
  },

  getSubmission: async (recordId: number): Promise<unknown> => {
    const { data } = await axiosInstance.get(
      `/death_record/submission/${recordId}`
    );
    return data;
  },

  approve: async (submissionId: number): Promise<unknown> => {
    const { data } = await axiosInstance.put(
      `/death_record/${submissionId}/approve_submission`
    );
    return data;
  },

  reject: async (
    submissionId: number,
    body: RecordRejection
  ): Promise<unknown> => {
    const { data } = await axiosInstance.put(
      `/death_record/${submissionId}/reject_submission`,
      body
    );
    return data;
  },
};

// ── KYC ──────────────────────────────────────────────────────────────────────
// POST /kyc/request
// POST /kyc/{kyc_request_id}/respond
// GET  /kyc/{kyc_request_id}/data
// GET  /kyc/statistics

export const kycApi = {
  /** Institution initiates a KYC request for a citizen. */
  initiateRequest: async (
    body: KYCRequestCreate
  ): Promise<KYCRequestResponse> => {
    const { data } = await axiosInstance.post<KYCRequestResponse>(
      "/kyc/request",
      body
    );
    return data;
  },

  /** Citizen approves or denies a KYC request. */
  respond: async (
    kycRequestId: number,
    body: KYCCitizenResponse
  ): Promise<ConsentRecordResponse> => {
    const { data } = await axiosInstance.post<ConsentRecordResponse>(
      `/kyc/${kycRequestId}/respond`,
      body
    );
    return data;
  },

  /** Institution retrieves only the fields the citizen approved. */
  getApprovedData: async (
    kycRequestId: number
  ): Promise<ApprovedCitizenDataResponse> => {
    const { data } = await axiosInstance.get<ApprovedCitizenDataResponse>(
      `/kyc/${kycRequestId}/data`
    );
    return data;
  },

  /** Supervisor/admin statistics dashboard. */
  getStatistics: async (): Promise<StatisticsResponse> => {
    const { data } = await axiosInstance.get<StatisticsResponse>(
      "/kyc/statistics"
    );
    return data;
  },
};