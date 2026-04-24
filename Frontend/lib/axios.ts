
import axios, { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { useRouter } from 'next/router';

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    user_id: string;
    role: string;
    name: string;
}

export interface RefreshResponse {
    access_token: string;
    refresh_token: string;
    token_type: "bearer";
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
}

/**
 * Token store - thin wrapper over localStorage
 * Replace with SecureStorage (Capacitor) for the mobile app build
 */

const TOKEN_KEY = "zdid_access_token";
const REFRESH_KEY = "zdid_refresh_token";

export const tokenStore = {
    getAccess: (): string | null => localStorage.getItem(TOKEN_KEY),
    getRefresh: (): string | null => localStorage.getItem(REFRESH_KEY),

    set: (access: string, refresh: string): void => {
        localStorage.setItem(TOKEN_KEY, access);
        localStorage.setItem(REFRESH_KEY, refresh);
    },

    clear: (): void => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
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

let isRefreshing = false;
let refreshQueue: Array<{
    resolve: (token: string) => void;
    reject: (err: unknown ) => void;
}> = [];

function drainQueue(token: string | null, error: unknown = null) {
    refreshQueue.forEach(({ resolve, reject }) => {
        if (token) resolve(token);
        else reject(error);
    });
    refreshQueue = [];
}

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

        if (isRefreshing) {
            return new Promise<AxiosResponse>((resolve, reject) => {
                refreshQueue.push({
                    resolve: (token) => {
                        original.headers.Authorization = `Bearer ${token}`;

                        resolve(axiosInstance(original));
                    },
                    reject,
                });
            });
        }

        original._retry = true;
        isRefreshing = true;

        const refreshToken = tokenStore.getRefresh();

        if (!refreshToken) {
            isRefreshing = false;
            signalSessionExpired();
            return Promise.reject(normaliseError(error));
        }

        try {
            const { data } = await axios.post<RefreshResponse>(
              `${API_BASE_URL}/auth/refresh`,
                { refresh_token: refreshToken }  
            );

            tokenStore.set(data.access_token, data.refresh_token);
            axiosInstance.defaults.headers.common.Authorization = `
            Bearer ${data.access_token}`;
            drainQueue(data.access_token);
            original.headers.Authorization = `Bearer ${data.access_token}`;
            return axiosInstance(original);
        } catch (refreshError) {
            drainQueue(null, refreshError);
            signalSessionExpired();
            return Promise.reject(normaliseError(error));
        } finally {
            isRefreshing = false;
        }
    }
);

function normaliseError(error: AxiosError): APIError {
  const detail =
    (error.response?.data as { detail?: string })?.detail ??
    error.message ??
    "An unexpected error occurred";
  return { detail, status: error.response?.status ?? 0 };
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
    tokenStore.set(data.access_token, data.refresh_token);
    return data;
  },
 
  refresh: async (refresh_token: string): Promise<RefreshResponse> => {
    const { data } = await axiosInstance.post<RefreshResponse>("/auth/refresh", {
      refresh_token,
    });
    tokenStore.set(data.access_token, data.refresh_token);
    return data;
  },
 
  me: async (): Promise<LoginResponse> => {
    const { data } = await axiosInstance.get<LoginResponse>("/auth/me");
    return data;
  },
 
  logout: async (): Promise<void> => {
    await axiosInstance.post("/auth/logout");
    tokenStore.clear();
  },
};
 
// ── Enrollment ───────────────────────────────────────────────────────────────
// POST /enrollments/submit
// GET  /enrollments/pending_requests
// GET  /enrollments/pending_request/{request_id}
// PUT  /enrollments/{request_id}/request_approve
// PUT  /enrollments/{request_id}/request_reject
 
export const enrollmentApi = {
  /** Open endpoint. Citizen submits enrollment + device public key. */
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