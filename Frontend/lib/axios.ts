import axios, { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user_id: number;           // int, not string
  role: string;
  name: string;
  email: string;
  is_email_verified: boolean;
  citizen_din: string | null;
  citizen_status: CitizenStatus | null;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
}

// ── Session / Me ──────────────────────────────────────────────────────────────
// GET /auth/me returns the same shape as login — reuse LoginResponse directly.
export type MeResponse = LoginResponse;

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
// province is UI-only (used to filter district dropdown) — never sent to backend.
// district_id is the FK that actually gets stored on the Citizen record.

export interface IdentitySubmitRequest {
  nrc: string;
  full_name: string;
  dob: string;              // ISO date string: "YYYY-MM-DD"
  phone?: string;
  gender: Gender;
  district_id?: number;     // resolved from province → district selection
  language: Language;
  public_key: string;       // PEM-encoded ECDSA P-256 public key
  nrc_front_url: string;
  nrc_back_url: string;
  face_image_url: string;
}

export interface IdentitySubmitResponse {
  enrollment_request_id: number;
  citizen_id: number;
  message: string;
}

// ── Province / District (dropdown reference data) ─────────────────────────────

export interface ProvinceOption {
  id: number;
  name: string;
  code: string;
}

export interface DistrictOption {
  id: number;
  name: string;
  code: string;
  province_name: string;
  province_code: string;
}

export type CitizenStatus = "PENDING" | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DECEASED" | "REJECTED";
export type Gender = "MALE" | "FEMALE";    
export type Language = "en" | "bem" | "nya" | "toi" | "loz";

// province type kept for the UI dropdown filter 
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
  face_image_url?: string;
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
  gender?: string;
  residential_address?: string;
  citizen_type?: string;
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
  gender: Gender;
  province: PROVINCE;
  face_image_url: string;
  citizen_type: string;
  status: CitizenStatus;
  public_key: string;
  issued_at: string;
  signature: string;
}

export interface DigitalIDResponse {
  payload: DigitalIDPayload;
  server_public_key: string;
  valid_until: string;
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
 * Token store — thin wrapper over localStorage.
 * Replace with SecureStorage (Capacitor) for the mobile app build.
 */
const TOKEN_KEY   = "zdid_access_token";
const REFRESH_KEY = "zdid_refresh_token";
<<<<<<< Updated upstream
const ROLE_KEY    = "zdid_user_role";
const NAME_KEY    = "zdid_user_name";
const PRIV_KEY    = "zdid_private_key";   // ECDSA P-256 private key (PKCS8 base64)

export const tokenStore = {
  getAccess:   (): string | null => localStorage.getItem(TOKEN_KEY),
  getRefresh:  (): string | null => localStorage.getItem(REFRESH_KEY),
  getRole:     (): string | null => localStorage.getItem(ROLE_KEY),
  getName:     (): string | null => localStorage.getItem(NAME_KEY),
  getPrivKey:  (): string | null => localStorage.getItem(PRIV_KEY),

  set: (access: string, refresh: string, role: string, name?: string): void => {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    localStorage.setItem(ROLE_KEY, role);
    if (name) {
      localStorage.setItem(NAME_KEY, name);
    }
  },

  setPrivKey: (pkcs8B64: string): void => {
    localStorage.setItem(PRIV_KEY, pkcs8B64);
  },

  setName: (name: string): void => localStorage.setItem(NAME_KEY, name),
  setRole: (role: string): void => localStorage.setItem(ROLE_KEY, role),

  clear: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(NAME_KEY);
    // NOTE: private key is intentionally NOT cleared on logout
    // so the citizen can still sign challenges after re-login.
    if (typeof refreshState !== "undefined" && refreshState.reset) {
      refreshState.reset();
    }
  },
};

// ── Axios instance ────────────────────────────────────────────────────────────

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});

// Request interceptor — attach Bearer token
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = tokenStore.getAccess();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error)
);

// Session-expired event — named correctly now
export const SESSION_EXPIRED_EVENT = "zdid:session_expired" as const;

function signalSessionExpired() {
  tokenStore.clear();
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

// Response interceptor — silent token refresh on 401
const refreshState = (() => {
  let isRefreshing = false;
  let refreshQueue: Array<{
    resolve: (token: string) => void;
    reject: (err: unknown) => void;
  }> = [];

  return {
    get isRefreshing() { return isRefreshing; },
    set isRefreshing(value: boolean) { isRefreshing = value; },
    get refreshQueue() { return refreshQueue; },
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
    },
  };
})();

axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(normaliseError(error));
    }

    if (original.url?.includes("/auth/refresh")) {
      signalSessionExpired();
      return Promise.reject(normaliseError(error));
    }

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
      const currentRole = tokenStore.getRole() || "";
      const currentName = tokenStore.getName() || "";
      tokenStore.set(data.access_token, data.refresh_token, currentRole, currentName);
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
  const responseData = error.response?.data as Record<string, unknown> | undefined;

  let detail = "An unexpected error occurred";
  let validationErrors: Record<string, string[]> | undefined;
  let code: string | undefined;

  if (responseData) {
    if (typeof responseData.detail === "string") {
      detail = responseData.detail;
    } else if (Array.isArray(responseData.detail)) {
      detail = "Validation failed";
      validationErrors = {};
      (responseData.detail as Array<{ loc: string[]; msg: string }>).forEach((err) => {
        if (err.loc && err.msg) {
          const field = err.loc[err.loc.length - 1];
          if (!validationErrors![field]) validationErrors![field] = [];
          validationErrors![field].push(err.msg);
        }
      });
    } else if (typeof responseData.message === "string") {
      detail = responseData.message;
    }
    if (typeof responseData.code === "string") {
      code = responseData.code;
    }
  } else if (error.message) {
    detail = error.message;
  }

  if (error.code === "ECONNABORTED") {
    detail = "Request timeout. Please check your connection and try again.";
  } else if (error.code === "ERR_NETWORK") {
    detail = "Network error. Please check your internet connection.";
  }

  return {
    detail,
    status: error.response?.status ?? 0,
    ...(code && { code }),
    ...(validationErrors && { validationErrors }),
  };
}

// ── Domain API clients ────────────────────────────────────────────────────────

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: async (body: LoginRequest): Promise<LoginResponse> => {
    const { data } = await axiosInstance.post<LoginResponse>("/auth/login", body);
    tokenStore.set(data.access_token, data.refresh_token, data.role, data.name);
    return data;
  },

  refresh: async (refresh_token: string): Promise<RefreshResponse> => {
    const { data } = await axiosInstance.post<RefreshResponse>("/auth/refresh", { refresh_token });
    const currentRole = tokenStore.getRole() || "";
    const currentName = tokenStore.getName() || "";
    tokenStore.set(data.access_token, data.refresh_token, currentRole, currentName);
    return data;
  },

  me: async (): Promise<MeResponse> => {
    const { data } = await axiosInstance.get<MeResponse>("/auth/me");
    if (data.name) tokenStore.setName(data.name);
    if (data.role) tokenStore.setRole(data.role);
    return data;
  },

  logout: async (): Promise<void> => {
    await axiosInstance.post("/auth/logout");
    tokenStore.clear();
  },

  /** Step 1a — Create account. POST /enrollments/register */
  createAccount: async (body: AccountCreateRequest): Promise<AccountCreateResponse> => {
    const { data } = await axiosInstance.post<AccountCreateResponse>("/enrollments/register", body);
    return data;
  },

  /** Step 1b — Verify OTP. POST /enrollments/verify-otp */
  verifyOtp: async (body: OTPVerifyRequest): Promise<OTPVerifyResponse> => {
    const { data } = await axiosInstance.post<OTPVerifyResponse>("/enrollments/verify-otp", body);
    return data;
  },

  /** Step 1b retry — Resend OTP. POST /enrollments/resend-otp */
  resendOtp: async (body: ResendOTPRequest): Promise<ResendOTPResponse> => {
    const { data } = await axiosInstance.post<ResendOTPResponse>("/enrollments/resend-otp", body);
    return data;
  },
};

// ── Reference data (provinces / districts) ────────────────────────────────────
export const referenceApi = {
  getProvinces: async (): Promise<ProvinceOption[]> => {
    const { data } = await axiosInstance.get<ProvinceOption[]>("/districts/provinces");
    return data;
  },

  /** Pass province_code e.g. "LUSAKA" to filter, or omit for all districts */
  getDistricts: async (province_code?: string): Promise<DistrictOption[]> => {
    const { data } = await axiosInstance.get<DistrictOption[]>("/districts", {
      params: province_code ? { province_code } : undefined,
    });
    return data;
  },
};

// ── Enrollment ────────────────────────────────────────────────────────────────
export const enrollmentApi = {
  /** Step 2 — Submit identity. POST /enrollments/submit-identity */
  submitIdentity: async (body: IdentitySubmitRequest): Promise<IdentitySubmitResponse> => {
    const { data } = await axiosInstance.post<IdentitySubmitResponse>(
      "/enrollments/submit-identity",
      body,
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

  reject: async (requestId: number, body: EnrollmentRejection): Promise<EnrollmentRequestResponse> => {
    const { data } = await axiosInstance.put<EnrollmentRequestResponse>(
      `/enrollments/${requestId}/request_reject`,
      body
    );
    return data;
  },
};

// ── Citizens ──────────────────────────────────────────────────────────────────
export const citizenApi = {
  list: async (params?: {
    status?: CitizenStatus;
    language?: Language;
    search?: string;
    page?: number;
    page_size?: number;
  }): Promise<CitizenSummary[]> => {
    const { data } = await axiosInstance.get<CitizenSummary[]>("/citizens/", { params });
    return data;
  },

  get: async (din: string): Promise<CitizenResponse> => {
    const { data } = await axiosInstance.get<CitizenResponse>(`/citizens/${din}`);
    return data;
  },

  update: async (din: string, body: CitizenUpdate): Promise<CitizenResponse> => {
    const { data } = await axiosInstance.patch<CitizenResponse>(`/citizens/${din}`, body);
    return data;
  },

  delete: async (din: string): Promise<void> => {
    await axiosInstance.delete(`/citizens/${din}`);
  },

  getBiometrics: async (din: string): Promise<BiometricRecordResponse> => {
    const { data } = await axiosInstance.get<BiometricRecordResponse>(`/citizens/${din}/biometrics`);
    return data;
  },

  createBiometrics: async (din: string, body: { facial_template?: string }): Promise<BiometricRecordResponse> => {
    const { data } = await axiosInstance.post<BiometricRecordResponse>(`/citizens/${din}/biometrics`, body);
    return data;
  },

  updateBiometrics: async (din: string, body: { facial_template?: string }): Promise<BiometricRecordResponse> => {
    const { data } = await axiosInstance.patch<BiometricRecordResponse>(`/citizens/${din}/biometrics`, body);
    return data;
  },

  createFamilyLink: async (din: string, body: FamilyLinkBase): Promise<FamilyLinkResponse> => {
    const { data } = await axiosInstance.post<FamilyLinkResponse>(`/citizens/${din}/family-links`, body);
    return data;
  },

  getFamilyTree: async (din: string): Promise<FamilyTreeResponse> => {
    const { data } = await axiosInstance.get<FamilyTreeResponse>(`/citizens/${din}/family-tree`);
    return data;
  },
};

// ── Digital ID ────────────────────────────────────────────────────────────────
export const digitalIdApi = {
  getServerPublicKey: async (): Promise<ServerPublicKeyResponse> => {
    const { data } = await axiosInstance.get<ServerPublicKeyResponse>("/digital-id/server-public-key");
    return data;
  },

  get: async (din: string): Promise<DigitalIDResponse> => {
    const { data } = await axiosInstance.get<DigitalIDResponse>(`/digital-id/${din}`);
    return data;
  },
};

// ── QR ────────────────────────────────────────────────────────────────────────
export const qrApi = {
  generate: async (din: string): Promise<QRPayload> => {
    const { data } = await axiosInstance.post<QRPayload>(`/qr/${din}/generate`);
    return data;
  },

  verify: async (body: QRVerifyRequest): Promise<QRVerifyResponse> => {
    const { data } = await axiosInstance.post<QRVerifyResponse>("/qr/verify", body);
    return data;
  },
};

// ── Birth Records ─────────────────────────────────────────────────────────────
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
    const { data } = await axiosInstance.get(`/birth_record/submission/${recordId}`);
    return data;
  },
  approve: async (submissionId: number): Promise<unknown> => {
    const { data } = await axiosInstance.put(`/birth_record/${submissionId}/approve_submission`);
    return data;
  },
  reject: async (submissionId: number, body: RecordRejection): Promise<unknown> => {
    const { data } = await axiosInstance.put(`/birth_record/${submissionId}/reject_submission`, body);
    return data;
  },
};

// ── Death Records ─────────────────────────────────────────────────────────────
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
    const { data } = await axiosInstance.get(`/death_record/submission/${recordId}`);
    return data;
  },
  approve: async (submissionId: number): Promise<unknown> => {
    const { data } = await axiosInstance.put(`/death_record/${submissionId}/approve_submission`);
    return data;
  },
  reject: async (submissionId: number, body: RecordRejection): Promise<unknown> => {
    const { data } = await axiosInstance.put(`/death_record/${submissionId}/reject_submission`, body);
    return data;
  },
};

// ── KYC ───────────────────────────────────────────────────────────────────────
export const kycApi = {
  initiateRequest: async (body: KYCRequestCreate): Promise<KYCRequestResponse> => {
    const { data } = await axiosInstance.post<KYCRequestResponse>("/kyc/request", body);
    return data;
  },
  respond: async (kycRequestId: number, body: KYCCitizenResponse): Promise<ConsentRecordResponse> => {
    const { data } = await axiosInstance.post<ConsentRecordResponse>(`/kyc/${kycRequestId}/respond`, body);
    return data;
  },
  getApprovedData: async (kycRequestId: number): Promise<ApprovedCitizenDataResponse> => {
    const { data } = await axiosInstance.get<ApprovedCitizenDataResponse>(`/kyc/${kycRequestId}/data`);
    return data;
  },
  getStatistics: async (): Promise<StatisticsResponse> => {
    const { data } = await axiosInstance.get<StatisticsResponse>("/kyc/statistics");
    return data;
  },
};