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

export interface CitizenLookupResult {
  din: string;
  full_name: string;
  phone?: string;
  residential_address?: string;
  nrc?: string;
  nationality?: string;
  sex?: string;
  dob?: string;
  occupation?: string;
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

export interface BirthRecordSubmission {
  mother_din: string;
  father_din: string;
  district: string;
  date_and_time_of_birth_notification: string;
  date_of_birth: string
  place_of_birth: "HEALTH_FACILITY" | "HOME";
  health_facility_name?: string;
  other_place_specified?: string;
  child_surname: string;
  child_given_name: string;
  child_other_names?: string;
  sex: Gender;
  birth_weight_kg: number;
  father_village_of_origin?: string;
  father_chief?: string;
  father_district?: string;
  father_tribe?: string;
  mother_village_of_origin?: string;
  mother_chief?: string;
  mother_district?: string;
  mother_tribe?: string;
  mother_usual_place_of_residence?: string;
  attendant_at_birth: "MIDWIFE" | "TBA" | "OTHER";
  attendant_other_specified?: string;
  marital_status: "MARRIED" | "NOT_MARRIED";
  father_acknowledgement_signature?: string;
  father_acknowledgement_date?: string;
  mother_consent_signature?: string;
  mother_consent_date?: string;
  file_number?: string;
  place_of_birth_text?: string;
  time_of_birth?: string;
  officer_in_charge?: string;
  official_stamp_ref?: string;
  date_signed?: string;
}

export interface MedicalCertificateCuaseOfDeathCreate {
  medical_no: string;
  attended_name: string;
  illness_start_date: string;
  last_attended_alive_date: string;
  last_attended_alive_day: number;
  death_date: string;
  death_day: number;
  death_year: number;
  death_time?: string;
  body_identified_of: string;
  age_stated: string;
  postmortem_confirmed: boolean; 
  cause_a: string;
  cause_a_interval?: string;
  cause_a_icd_code?: string;
  cause_b?: string;
  cause_b_interval?: string;
  cause_b_icd_code?: string;
  cause_c?: string;
  cause_c_interval?: string;
  cause_c_icd_code?: string;
  other_condition_1?: string;
  other_condition_1_interval?: string;
  other_condition_2?: string;
  other_condition_2_interval?: string;
  witness_date: string;
  certificate_handed_to: string;
  medical_attendant_name: string;
  medical_attendant_signature?: string;
  medical_attendant_qualification: string;
  medical_attendant_residence: string;
  village?: string;
  chief?: string;
  district?: string;
  informant_din: string;
  informant_relationship: string;
  informant_contact_no?: string;
  informant_postal_address?: string;
  informant_signature?: string;
  informant_declaration_date?: string;
}

export interface NoticeOfDeathCreate {
  serial_number: string;
  application_no?: string;
  date_and_time: string;
  deceased_din?: string;
  surname?: string;
  other_names?: string;
  occupation?: string;
  residential_address?: string;
  district: string;
  date_of_death: string;
  place_of_death: "HEALTH_FACILITY" | "HOME" | "OTHER";
  place_of_death_name?: string;
  place_of_death_other?: string;
  date_of_birth?: string;
  age_at_death?: number;
  sex?: Gender;
  nationality?: string;
  national_identity_no?: string;
  social_security_no?: string;
  education_level?: "NONE" | "PRIMARY" | "SECONDARY" | "TERTIARY";
  death_type?: "NATURAL" | "SUDDEN" | "UNNATURAL";
  immediate_cause?: string;
  immediate_cause_icd?: string;
  antecedent_cause?: string;
  antecedent_cause_icd?: string;
  underlying_cause?: string;
  underlying_cause_icd?: string;
  police_certifier_name?: string;
  police_certifier_residence?: string;
  police_certifier_relationship?: string;
  deceased_surname_police?: string;
  deceased_other_names_police?: string;
  deceased_age_police?: number;
  passed_away_date?: string;
  passed_away_time?: string;
  passed_away_place?: string;
  suddenly_suffering_from?: string;
  treatment_was_at?: string;
  is_natural_death?: boolean;
  is_sudden_death_postmortem_required?: boolean;
  police_no_and_rank?: string;
  police_formation?: string;
  police_officer_name?: string;
  police_officer_signed?: string;
  police_officer_date?: string;
  doctors_remarks?: string;
  pupils_dilated_and_fixed?: boolean;
  certifying_doctor_name?: string;
  certifying_doctor_signature?: string;
  certifying_doctor_date?: string;
  informant_din: string;
  informant_relationship: string;
  informant_contact_no?: string;
  informant_postal_address?: string;
  date_of_registration?: string;
  has_mccd: boolean;
  has_informant_national_id: boolean;
  has_coroner_report: boolean;
  informant_declaration_name?: string;
  informant_declaration_signature?: string;
  informant_declaration_date?: string;
}

export interface RecordRejection {
  rejection_reason: string;
}

export interface PendingBirthSubmission {
  id: number;
  mother_din: string;
  father_din?: string | null;
  mother: number;
  father?: number | null;
  notice_of_birth?: number | null;
  record_of_birth?: number | null;
  birth_certificate?: number | null;
  submitted_at: string;
  registrar?: number | null;
  health_worker?: number | null;
  reviewed_at?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejection_reason?: string | null;
  created_at: string;
  certificate_url?: string;
  
  // Flattened child fields from NoticeOfBirth
  child_given_name?: string | null;
  child_surname?: string | null;
  child_other_names?: string | null;
  sex?: string | null;
  date_of_birth?: string | null;
  birth_weight_kg?: string | null;
  health_facility_name?: string | null;
  home_address?: string | null;
  other_place_specified?: string | null;
  attendant_at_birth?: string | null;
  attendant_other_specified?: string | null;
  marital_status?: string | null;
  mother_surname?: string | null;
  mother_other_names?: string | null;
  mother_maiden_surname?: string | null;
  father_surname?: string | null;
  father_other_names?: string | null;
}

export interface PendingDeathSubmission {
  id: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  
  // Flattened fields from MCCD and NoticeOfDeath
  medical_certificate_of_death?: {
    id: number;
    medical_no: string;
    attended_name: string;
    death_date: string;
    cause_a: string;
    cause_b?: string | null;
    cause_c?: string | null;
    other_condition_1?: string | null;
    other_condition_2?: string | null;
    district?: string | null;
  } | null;
  
  notice_of_death?: {
    id: number;
    serial_number: string;
    surname?: string;
    other_names?: string;
    deceased_din?: string | null;
    death_date: string;
    district: string;
    place_of_death: "HEALTH_FACILITY" | "HOME" | "OTHER";
    place_of_death_name?: string | null;
    place_of_death_other?: string | null;
    age_at_death?: number | null;
    sex?: string | null;
    nationality?: string | null;
  } | null;
  
  registrar?: number | null;
  health_worker?: number | null;
  informant?: number | null;
  submitted_at: string;
  ready_for_review: boolean;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  certificate_url?: string;
  
  // Flattened for easier frontend access
  deceasedName?: string | null;
  attended_name?: string | null;
  cause_a?: string | null;
  cause_b?: string | null;
  cause_c?: string | null;
  other_condition_1?: string | null;
  other_condition_2?: string | null;
  district?: string | null;
  place_of_death?: string | null;
  place_of_death_name?: string | null;
  place_of_death_other?: string | null;
  age_at_death?: number | null;
  sex?: string | null;
  nationality?: string | null;
  informant_name?: string | null;
  informant_relationship?: string | null;
}

// ===== Generic API error shape ====

export interface APIError {
  detail: string;
  status: number;
  code?: string;
  validationErrors?: Record<string, string[]>;
}

export interface DeathRecordApproveResponse {
  details: string;
  death_records_id: number;
  death_certificate_id: number;
  burial_permit_id: number;
  status: number;
}