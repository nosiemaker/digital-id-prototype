# Civil Registration API — Birth & Death Workflow Documentation

> **Module:** `hospital` — FastAPI router backed by Django ORM service layer  
> **Base path (assumed):** `/hospital`  
> **Auth:** JWT bearer token. Every endpoint enforces role-based access via `require_groups()`.

---

## Role Reference

| Role | Code | Description |
|---|---|---|
| Health Worker | `HEALTH_WORKER` | Clinical staff at a registered facility. Submits records. |
| Registrar Officer | `REGISTRAR` | DNRPC officer. Reviews, approves, or rejects submissions. |
| Citizen | `CITIZEN` | Registered individual. Can attach a Notice of Death and retrieve their own documents. |

---

## Table of Contents

1. [Birth Registration Workflow](#1-birth-registration-workflow)
2. [Death Registration Workflow](#2-death-registration-workflow)
3. [Citizen Self-Service — Document Retrieval](#3-citizen-self-service--document-retrieval)
4. [Endpoint Reference with Examples](#4-endpoint-reference-with-examples)
5. [Frontend Form Field Summary](#5-frontend-form-field-summary)

---

## 1. Birth Registration Workflow

Birth registration is a **2-step pipeline** with an optional review decision at the end.

```
Step 1: HEALTH_WORKER → POST /hospital/births/submit
        (Creates NoticeOfBirth + RecordOfBirth + BirthRecords [PENDING])
                              ↓
Step 2a: REGISTRAR → PUT /hospital/births/{id}/approve
         (Creates BirthCertificate + child Citizen [INACTIVE] → status: APPROVED)

Step 2b: REGISTRAR → PUT /hospital/births/{id}/reject
         (Stores rejection_reason → status: REJECTED)
```

### Who Does What

| Step | Actor | Action | Outcome |
|---|---|---|---|
| 1 | Health Worker | Submits a unified birth form payload | `BirthRecords` created in `PENDING` status. Generates `notice_of_birth_id` and `record_of_birth_id`. |
| 2a | Registrar | Approves the pending submission | `BirthCertificate` generated. A new `Citizen` record is created for the child (status: `INACTIVE`) with a generated DIN. `BirthRecords` status moves to `APPROVED`. |
| 2b | Registrar | Rejects the pending submission | `rejection_reason` stored on `BirthRecords`. Status moves to `REJECTED`. Visible to the submitting Health Worker. |

### Intermediate Read Endpoints (Registrar Only)

| Action | Endpoint |
|---|---|
| List all pending birth submissions | `GET /hospital/births/pending_submissions` |
| View a specific pending submission | `GET /hospital/births/submission/{id}` |
| View any birth record (any status) | `GET /hospital/births/record/{id}` |
| View all birth records | `GET /hospital/births/all` |

---

## 2. Death Registration Workflow

Death registration is a **3-step pipeline**. The MCCD and the Notice of Death are submitted separately before a Registrar can act.

```
Step 1: HEALTH_WORKER → POST /hospital/deaths/submit
        (Creates MedicalCertificateCauseOfDeath + DeathRecords [PENDING, ready_for_review=False])
                              ↓
Step 2: HEALTH_WORKER or CITIZEN (informant only) → POST /hospital/deaths/submit/{death_record_id}/notice_of_death
        (Creates NoticeOfDeath, links it → DeathRecords [ready_for_review=True])
                              ↓
Step 3a: REGISTRAR → PUT /hospital/deaths/{id}/approve
         (Creates DeathCertificate + BurialPermit → status: APPROVED)
         (If deceased had a DIN → Citizen status updated to DECEASED)

Step 3b: REGISTRAR → PUT /hospital/deaths/{id}/reject
         (Stores rejection_reason → status: REJECTED)
```

### Who Does What

| Step | Actor | Action | Outcome |
|---|---|---|---|
| 1 | Health Worker | Submits the MCCD (Medical Certificate of Cause of Death) | `MedicalCertificateCauseOfDeath` created. `DeathRecords` opened in `PENDING` status with `ready_for_review = False`. Returns `death_records_id` and `mccd_id`. |
| 2 | Health Worker **or** Citizen (informant) | Attaches the Notice of Death to the existing record | `NoticeOfDeath` created and linked. `ready_for_review` set to `True`. Submission becomes visible in the Registrar's review queue. Note: only the informant recorded on the original MCCD is allowed to submit this form. |
| 3a | Registrar | Approves the pending submission | `DeathCertificate` and `BurialPermit` (Form XI) generated. `DeathRecords` status moves to `APPROVED`. If the deceased has a registered DIN, their `Citizen` record is updated to `DECEASED`. |
| 3b | Registrar | Rejects the pending submission | `rejection_reason` stored on `DeathRecords`. Status moves to `REJECTED`. |

### Intermediate Read Endpoints (Registrar Only)

| Action | Endpoint |
|---|---|
| List all pending death submissions | `GET /hospital/deaths/pending_submissions` |
| View a specific pending submission | `GET /hospital/deaths/submission/{id}` |
| View any death record (any status) | `GET /hospital/deaths/record/{id}` |
| View all death records | `GET /hospital/deaths/all` |

---

## 3. Citizen Self-Service — Document Retrieval

Once a record is approved, the relevant Citizen can retrieve their issued documents.

| Document | Endpoint | Condition |
|---|---|---|
| Birth certificates (as mother or father) | `GET /hospital/births/my_certificates` | Citizen must be the mother or father on the birth certificate |
| Burial permits | `GET /hospital/deaths/my_burial_permits` | Citizen must be the informant on the death record |
| Death certificates | `GET /hospital/deaths/my_certificates` | Citizen must be the informant on the death record |

---

## 4. Endpoint Reference with Examples

All requests require a `Authorization: Bearer <token>` header.

---

### BIRTH ENDPOINTS

---

#### `POST /hospital/births/submit`
**Role:** `HEALTH_WORKER`  
Submit a new birth record for registrar review.

**Request Body:**
```json
{
  "mother_din": "123456/01/1",
  "father_din": "654321/01/1",
  "notice_serial_number": "0050984",
  "record_of_birth_serial_number": "MF2-001",
  "facility_name": "University Teaching Hospital",
  "district": "Lusaka",
  "date_and_time_of_birth_notification": "2024-04-27T14:30:00",
  "date_of_birth": "2024-04-27",
  "place_of_birth": "HEALTH_FACILITY",
  "health_facility_name": "University Teaching Hospital",
  "child_surname": "Mwale",
  "child_given_name": "John",
  "child_other_names": "Kaunda",
  "sex": "MALE",
  "birth_weight_kg": 3.5,
  "attendant_at_birth": "MIDWIFE",
  "marital_status": "MARRIED",
  "father_village_of_origin": "Chongwe",
  "father_tribe": "Ngoni",
  "mother_village_of_origin": "Chipata",
  "mother_tribe": "Chewa",
  "time_of_birth": "14:25:00",
  "officer_in_charge": "Dr. Banda",
  "date_signed": "2024-04-27"
}
```

**Success Response — HTTP 201:**
```json
{
  "details": "Birth Record Submitted",
  "birth_records_id": 42,
  "notice_of_birth_id": 17,
  "record_of_birth_id": 9
}
```

---

#### `GET /hospital/births/pending_submissions`
**Role:** `REGISTRAR`  
List all birth submissions awaiting review.

**Success Response — HTTP 200:**
```json
{
  "details": "Submission Found",
  "pending_submissions": [
    {
      "id": 42,
      "child_surname": "Mwale",
      "child_given_name": "John",
      "mother_din": "123456/01/1",
      "status": "PENDING",
      "created_at": "2024-04-27T14:32:10Z"
    }
  ]
}
```

---

#### `GET /hospital/births/submission/{submission_id}`
**Role:** `REGISTRAR`  
Retrieve the full detail of a single pending birth submission before making a decision.

```
GET /hospital/births/submission/42
```

**Success Response — HTTP 200:**
```json
{
  "details": "Submission Found",
  "pending_submission": { ... }
}
```

**Error — 404:**
```json
{ "detail": "Submission Does Not Exist" }
```

---

#### `PUT /hospital/births/42/approve`
**Role:** `REGISTRAR`  
Approve a pending birth submission. No request body needed.

**Success Response — HTTP 200:**
```json
{
  "details": "Birth Record Approved",
  "birth_certificate_id": 5,
  "child_din": "789012/24/1"
}
```

**Possible Errors:**
| Code | Reason |
|---|---|
| 404 | Submission or registrar not found |
| 409 | Submission is not PENDING, or duplicate certificate detected |
| 400 | Required sub-documents (Notice / Record of Birth) are missing |

---

#### `PUT /hospital/births/42/reject`
**Role:** `REGISTRAR`  
Reject a pending birth submission with a mandatory reason.

**Request Body:**
```json
{
  "rejection_reason": "Mother's DIN could not be verified in the citizen registry."
}
```

**Success Response — HTTP 200:**
```json
{
  "details": "Birth Record Rejected",
  "birth_records_id": 42
}
```

---

### DEATH ENDPOINTS

---

#### `POST /hospital/deaths/submit`
**Role:** `HEALTH_WORKER`  
Step 1 — Submit the Medical Certificate of Cause of Death (MCCD). Opens a new `DeathRecords` entry.

**Request Body:**
```json
{
  "medical_no": "MCCD-2024-00315",
  "attended_name": "Grace Phiri",
  "illness_start_date": "2024-04-20",
  "last_attended_alive_date": "2024-04-25",
  "last_attended_alive_day": 25,
  "death_date": "2024-04-26",
  "death_day": 26,
  "death_year": 24,
  "death_time": "03:45:00",
  "body_identified_of": "Grace Phiri",
  "age_stated": "62 years",
  "postmortem_confirmed": false,
  "cause_a": "Acute myocardial infarction",
  "cause_a_interval": "2 hours",
  "cause_a_icd_code": "BA41",
  "cause_b": "Hypertensive heart disease",
  "cause_b_interval": "5 years",
  "cause_b_icd_code": "BA80",
  "witness_date": "2024-04-26",
  "certificate_handed_to": "James Phiri",
  "medical_attendant_name": "Dr. Chanda Mutale",
  "medical_attendant_qualification": "MBChB, MMed (Internal Medicine)",
  "medical_attendant_residence": "Plot 45, Kabulonga, Lusaka",
  "district": "Lusaka",
  "informant_din": "998877/01/1",
  "informant_relationship": "Son",
  "informant_contact_no": "0977123456",
  "informant_declaration_date": "2024-04-26"
}
```

**Success Response — HTTP 201:**
```json
{
  "details": "MCCD Submitted",
  "death_records_id": 18,
  "mccd_id": 7
}
```

---

#### `POST /hospital/deaths/submit/18/notice_of_death`
**Role:** `HEALTH_WORKER` or `CITIZEN` (must be the informant named on the MCCD)  
Step 2 — Attach the Notice of Death. Marks the case as ready for registrar review.

**Request Body:**
```json
{
  "serial_number": "ND-2024-00891",
  "date_and_time": "2024-04-26T10:00:00",
  "deceased_din": "556677/01/1",
  "district": "Lusaka",
  "date_of_death": "2024-04-26",
  "place_of_death": "HEALTH_FACILITY",
  "place_of_death_name": "University Teaching Hospital",
  "death_type": "NATURAL",
  "immediate_cause": "Acute myocardial infarction",
  "informant_din": "998877/01/1",
  "informant_relationship": "Son",
  "has_mccd": true,
  "has_informant_national_id": true,
  "informant_declaration_date": "2024-04-26"
}
```

**Success Response — HTTP 200:**
```json
{
  "details": "Notice of Death Submitted",
  "death_records_id": 18,
  "notice_of_death_id": 12
}
```

**Possible Errors:**
| Code | Reason |
|---|---|
| 404 | DeathRecords or user not found |
| 400 | Authenticated user is not the informant on the MCCD |
| 400 | Notice of Death already attached to this record |

---

#### `GET /hospital/deaths/pending_submissions`
**Role:** `REGISTRAR`  
List all death submissions with `ready_for_review = True` awaiting decision.

**Success Response — HTTP 200:**
```json
{
  "details": "Submission Found",
  "pending_submissions": [
    {
      "id": 18,
      "status": "PENDING",
      "ready_for_review": true,
      "created_at": "2024-04-26T10:05:00Z"
    }
  ]
}
```

---

#### `PUT /hospital/deaths/18/approve`
**Role:** `REGISTRAR`  
Approve a pending death record. No request body needed.

**Success Response — HTTP 200:**
```json
{
  "details": "Death Record Approved",
  "death_certificate_id": 3,
  "burial_permit_id": 3
}
```

**Possible Errors:**
| Code | Reason |
|---|---|
| 404 | Submission not found |
| 409 | Submission is not PENDING |
| 400 | Notice of Death has not been attached yet |

---

#### `PUT /hospital/deaths/18/reject`
**Role:** `REGISTRAR`  
Reject a pending death record with a mandatory reason.

**Request Body:**
```json
{
  "rejection_reason": "Informant DIN does not match the registered informant on the MCCD."
}
```

**Success Response — HTTP 200:**
```json
{
  "details": "Death Record Rejected",
  "death_records_id": 18
}
```

---

#### `GET /hospital/deaths/my_burial_permits`
**Role:** `CITIZEN`  
Retrieve burial permits for deaths where the authenticated citizen is the informant.

**Success Response — HTTP 200:**
```json
{
  "details": "Burial Permits Found",
  "permits": [
    {
      "id": 3,
      "permit_number": "BP-2024-003",
      "issued_date": "2024-04-27",
      "death_records_id": 18
    }
  ]
}
```

---

## 5. Frontend Form Field Summary

This section maps each API schema to the form fields your frontend must render, grouped by the user role that fills them in.

---

### HEALTH WORKER — Birth Submission Form
**Endpoint:** `POST /hospital/births/submit`  
**Schema:** `BirthRecordSubmission`

#### Parent References
| Field | Type | Required | Notes |
|---|---|---|---|
| `mother_din` | Text | **Yes** | DIN of the registered mother |
| `father_din` | Text | No | Optional if father unknown or parents unmarried |

#### Form Details (Notice of Birth — Form VIII)
| Field | Type | Required | Notes |
|---|---|---|---|
| `notice_serial_number` | Text | **Yes** | Pre-printed serial on the physical Notice of Birth form |
| `record_of_birth_serial_number` | Text | **Yes** | Pre-printed serial on the M.F.2 form |
| `facility_name` | Text | **Yes** | Hospital or clinic name |
| `district` | Text | **Yes** | District of the facility |
| `date_and_time_of_birth_notification` | DateTime | **Yes** | Official notification timestamp |

#### Child Details
| Field | Type | Required | Notes |
|---|---|---|---|
| `date_of_birth` | Date | **Yes** | |
| `place_of_birth` | Select | **Yes** | `HEALTH_FACILITY`, `HOME`, `OTHER` |
| `health_facility_name` | Text | Conditional | Required if `place_of_birth = HEALTH_FACILITY` |
| `home_address` | Textarea | Conditional | Required if `place_of_birth = HOME` |
| `other_place_specified` | Text | Conditional | Required if `place_of_birth = OTHER` |
| `child_surname` | Text | **Yes** | |
| `child_given_name` | Text | **Yes** | |
| `child_other_names` | Text | No | |
| `sex` | Select | **Yes** | `MALE`, `FEMALE` |
| `birth_weight_kg` | Number | **Yes** | Range: 0.1–10 kg |

#### Additional Father Details (from Notice form)
| Field | Type | Required | Notes |
|---|---|---|---|
| `father_village_of_origin` | Text | No | |
| `father_chief` | Text | No | |
| `father_district` | Text | No | |
| `father_tribe` | Text | No | |

#### Additional Mother Details (from Notice form)
| Field | Type | Required | Notes |
|---|---|---|---|
| `mother_village_of_origin` | Text | No | |
| `mother_chief` | Text | No | |
| `mother_district` | Text | No | |
| `mother_tribe` | Text | No | |
| `mother_usual_place_of_residence` | Textarea | No | |

#### Birth Attendance
| Field | Type | Required | Notes |
|---|---|---|---|
| `attendant_at_birth` | Select | **Yes** | `MIDWIFE`, `TBA`, `OTHER` |
| `attendant_other_specified` | Text | Conditional | Required if `attendant_at_birth = OTHER` |

#### Marital Status & Paternity
| Field | Type | Required | Notes |
|---|---|---|---|
| `marital_status` | Select | **Yes** | `MARRIED`, `NOT_MARRIED` |
| `father_acknowledgement_signature` | Signature pad / Base64 | Conditional | Required if `marital_status = NOT_MARRIED` |
| `father_acknowledgement_date` | Date | Conditional | Required if `marital_status = NOT_MARRIED` |
| `mother_consent_signature` | Signature pad / Base64 | Conditional | Required if `marital_status = NOT_MARRIED` |
| `mother_consent_date` | Date | Conditional | Required if `marital_status = NOT_MARRIED` |

#### Record of Birth (M.F.2) Sign-off
| Field | Type | Required | Notes |
|---|---|---|---|
| `file_number` | Text | No | Facility case/file number |
| `place_of_birth_text` | Text | No | Free-text description |
| `time_of_birth` | Time | No | |
| `officer_in_charge` | Text | No | Name of signing officer |
| `official_stamp_ref` | Text | No | Stamp reference or scan path |
| `date_signed` | Date | No | Date the M.F.2 was signed |

---

### HEALTH WORKER — Death Submission Form (Step 1: MCCD)
**Endpoint:** `POST /hospital/deaths/submit`  
**Schema:** `MedicalCertificateCauseOfDeathCreate`

#### Certificate Reference
| Field | Type | Required | Notes |
|---|---|---|---|
| `medical_no` | Text | **Yes** | Pre-printed medical number on the MCCD counterfoil |

#### Doctor's Attendance Narrative
| Field | Type | Required | Notes |
|---|---|---|---|
| `attended_name` | Text | **Yes** | Full name of the person attended |
| `illness_start_date` | Date | **Yes** | Date doctor first attended during last illness |
| `last_attended_alive_date` | Date | **Yes** | Last date patient was seen alive |
| `last_attended_alive_day` | Number | **Yes** | Day of month (1–31), mirrors paper form |
| `death_date` | Date | **Yes** | |
| `death_day` | Number | **Yes** | Day of month (1–31) |
| `death_year` | Number | **Yes** | Last 2 digits of year, e.g. `24` |
| `death_time` | Time | No | |
| `body_identified_of` | Text | **Yes** | Name of person formally identifying the body |
| `age_stated` | Text | **Yes** | As written on form, e.g. `"45 years"` |
| `postmortem_confirmed` | Checkbox | **Yes** | Whether cause was confirmed by post-mortem |

#### Cause of Death — Part I (Direct Chain)
| Field | Type | Required | Notes |
|---|---|---|---|
| `cause_a` | Text | **Yes** | Immediate cause directly leading to death |
| `cause_a_interval` | Text | No | Approximate interval between onset and death |
| `cause_a_icd_code` | Text | No | ICD-11 code |
| `cause_b` | Text | No | Condition giving rise to (a) |
| `cause_b_interval` | Text | No | |
| `cause_b_icd_code` | Text | No | |
| `cause_c` | Text | No | Underlying condition |
| `cause_c_interval` | Text | No | |
| `cause_c_icd_code` | Text | No | |

#### Cause of Death — Part II (Other Significant Conditions)
| Field | Type | Required | Notes |
|---|---|---|---|
| `other_condition_1` | Text | No | |
| `other_condition_1_interval` | Text | No | |
| `other_condition_2` | Text | No | |
| `other_condition_2_interval` | Text | No | |

#### Doctor Sign-off
| Field | Type | Required | Notes |
|---|---|---|---|
| `witness_date` | Date | **Yes** | Date the doctor signed |
| `certificate_handed_to` | Text | **Yes** | Name of person who received the certificate |
| `medical_attendant_name` | Text | **Yes** | |
| `medical_attendant_signature` | Signature pad / Base64 | No | |
| `medical_attendant_qualification` | Text | **Yes** | E.g. `MBChB, MMed` |
| `medical_attendant_residence` | Text | **Yes** | |

#### Location (Bottom of Form)
| Field | Type | Required | Notes |
|---|---|---|---|
| `village` | Text | No | |
| `chief` | Text | No | |
| `district` | Text | No | |

#### Informant Details
| Field | Type | Required | Notes |
|---|---|---|---|
| `informant_din` | Text | **Yes** | DIN of the informant — resolved to full Citizen details by the service |
| `informant_relationship` | Text | **Yes** | Relationship to the deceased |
| `informant_contact_no` | Text | No | |
| `informant_postal_address` | Textarea | No | |
| `informant_signature` | Signature pad / Base64 | No | |
| `informant_declaration_date` | Date | No | |

---

### HEALTH WORKER or CITIZEN — Notice of Death Form (Step 2)
**Endpoint:** `POST /hospital/deaths/submit/{death_record_id}/notice_of_death`  
**Schema:** `NoticeOfDeathCreate`

> ℹ️ Only the Citizen identified as the informant on the original MCCD is permitted to submit this form.

#### Form Reference
| Field | Type | Required | Notes |
|---|---|---|---|
| `serial_number` | Text | **Yes** | Pre-printed serial on the DNRPC form |
| `application_no` | Text | No | Assigned by registrar, may be blank at submission |
| `date_and_time` | DateTime | **Yes** | Official date and time on the form |

#### Section A — Deceased Details
| Field | Type | Required | Notes |
|---|---|---|---|
| `deceased_din` | Text | No | If provided, the service auto-fills name, address, DOB, sex, etc. from the Citizen record |
| `surname` | Text | Conditional | Required only if `deceased_din` is not provided |
| `other_names` | Text | No | |
| `occupation` | Text | No | Auto-filled from Citizen if `deceased_din` given |
| `residential_address` | Textarea | No | Auto-filled from Citizen if `deceased_din` given |
| `district` | Text | **Yes** | Always required |
| `date_of_death` | Date | **Yes** | |
| `place_of_death` | Select | **Yes** | `HEALTH_FACILITY`, `HOME`, `OTHER` |
| `place_of_death_name` | Text | No | Facility name or home description |
| `place_of_death_other` | Text | No | Specify if `place_of_death = OTHER` |
| `date_of_birth` | Date | No | Auto-filled from Citizen if `deceased_din` given |
| `age_at_death` | Number | No | |
| `sex` | Select | No | Auto-filled from Citizen if `deceased_din` given |
| `nationality` | Text | No | Auto-filled from Citizen if `deceased_din` given |
| `national_identity_no` | Text | No | NRC number |
| `social_security_no` | Text | No | NAPSA number |
| `education_level` | Select | No | `NONE`, `PRIMARY`, `SECONDARY`, `TERTIARY` |

#### Section B — Cause of Death (FOR OFFICIAL USE — filled by registrar)
> These fields are populated by the Registrar from the attached MCCD. The frontend should display them as **read-only** or in a separate registrar-only panel.

| Field | Type | Notes |
|---|---|---|
| `death_type` | Select | `NATURAL`, `SUDDEN`, `UNNATURAL` |
| `immediate_cause` | Text | |
| `immediate_cause_icd` | Text | ICD-11 code |
| `antecedent_cause` | Text | |
| `antecedent_cause_icd` | Text | |
| `underlying_cause` | Text | |
| `underlying_cause_icd` | Text | |

#### Section C — Police / Brought-in-Dead Certificate (Sudden or Unnatural Deaths Only)
| Field | Type | Required | Notes |
|---|---|---|---|
| `police_certifier_name` | Text | No | |
| `police_certifier_residence` | Text | No | |
| `police_certifier_relationship` | Text | No | |
| `deceased_surname_police` | Text | No | |
| `deceased_other_names_police` | Text | No | |
| `deceased_age_police` | Number | No | |
| `passed_away_date` | Date | No | |
| `passed_away_time` | Time | No | |
| `passed_away_place` | Text | No | |
| `suddenly_suffering_from` | Textarea | No | Symptoms/illness before death |
| `treatment_was_at` | Text | No | |
| `is_natural_death` | Checkbox | No | |
| `is_sudden_death_postmortem_required` | Checkbox | No | |
| `police_no_and_rank` | Text | No | |
| `police_formation` | Text | No | |
| `police_officer_name` | Text | No | |
| `police_officer_signed` | Signature pad / Base64 | No | |
| `police_officer_date` | Date | No | |
| `doctors_remarks` | Textarea | No | |
| `pupils_dilated_and_fixed` | Checkbox | No | Clinical confirmation |
| `certifying_doctor_name` | Text | No | |
| `certifying_doctor_signature` | Signature pad / Base64 | No | |
| `certifying_doctor_date` | Date | No | |

#### Section D — Informant Details
| Field | Type | Required | Notes |
|---|---|---|---|
| `informant_din` | Text | **Yes** | Resolved to Citizen details by the service |
| `informant_relationship` | Text | **Yes** | Relationship to deceased |
| `informant_contact_no` | Text | No | |
| `informant_postal_address` | Textarea | No | |
| `date_of_registration` | Date | No | |

#### Section E — Appendices Checklist
| Field | Type | Required | Notes |
|---|---|---|---|
| `has_mccd` | Checkbox | **Yes** (default: false) | Confirm original MCCD is physically attached |
| `has_informant_national_id` | Checkbox | **Yes** (default: false) | Confirm copy of informant's NID is attached |
| `has_coroner_report` | Checkbox | **Yes** (default: false) | Required for unnatural/sudden deaths |

#### Informant's Declaration
| Field | Type | Required | Notes |
|---|---|---|---|
| `informant_declaration_name` | Text | No | |
| `informant_declaration_signature` | Signature pad / Base64 | No | |
| `informant_declaration_date` | Date | No | |

---

### REGISTRAR — Rejection Form (Birth or Death)
**Endpoint:** `PUT /hospital/births/{id}/reject` or `PUT /hospital/deaths/{id}/reject`  
**Schema:** `RecordRejection`

| Field | Type | Required | Notes |
|---|---|---|---|
| `rejection_reason` | Textarea | **Yes** | Minimum 10 characters. Visible to the submitting Health Worker. |

---

*End of document.*
