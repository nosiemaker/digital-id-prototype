# Backend API Fixes - Civil Registration Module

**Date:** April 30, 2026  
**Affected Modules:** `hospital/serializers.py`, `routers/hospital.py`  
**Purpose:** Fix API response structure mismatches between backend and frontend for birth and death record endpoints

---

## Overview

This document describes the changes made to the backend civil registration API to ensure proper data mapping between the FastAPI backend and Next.js frontend for birth and death record management.

---

## Issues Identified

### 1. Incorrect Endpoint Paths (Frontend)
The frontend was calling incorrect endpoint paths:

| Frontend (Old) | Backend (Correct) | Issue |
|----------------|-------------------|-------|
| `/birth_record/record/{id}` | `/births/record/{id}` | Wrong base path |
| `/death_record/submit` | `/deaths/submit` | Wrong base path |
| `/death_record/pending_submissions` | `/deaths/pending_submissions` | Wrong base path |
| `/death_record/record/{id}` | `/deaths/record/{id}` | Wrong base path |
| `/death_record/submission/{id}` | `/deaths/submission/{id}` | Wrong base path |
| `/death_record/{id}/approve_submission` | `/deaths/{id}/approve` | Wrong endpoint name |
| `/death_record/{id}/reject_submission` | `/deaths/{id}/reject` | Wrong endpoint name |

### 2. Missing Flattened Fields in Serializers
The `DeathRecordRequestSerializer` and `BirthRecordRequestSerializer` were returning raw model fields only, but the frontend expected flattened fields from related models:

**Birth Records:**
- Frontend expected: `child_given_name`, `child_surname`, `sex`, `date_of_birth`, `birth_weight_kg`, etc.
- Backend returned: Only `BirthRecords` model fields (IDs to related models)

**Death Records:**
- Frontend expected: `deceasedName`, `attended_name`, `cause_a`, `death_date`, `place_of_death`, etc.
- Backend returned: Only `DeathRecords` model fields (IDs to related models)

### 3. Approval Response Structure Mismatch
The `DeathRecordApproveResponse` type expected:
- Old: `{ certificate: number }`
- Actual backend response: `{ death_certificate_id: number, burial_permit_id: number }`

---

## Changes Made

### 1. Backend Serializers (`hospital/serializers.py`)

#### BirthRecordRequestSerializer
Added `SerializerMethodField` methods to flatten child-related data from `NoticeOfBirth`:

```python
class BirthRecordRequestSerializer(ModelSerializer):
    child_given_name = SerializerMethodField()
    child_surname = SerializerMethodField()
    child_other_names = SerializerMethodField()
    sex = SerializerMethodField()
    date_of_birth = SerializerMethodField()
    birth_weight_kg = SerializerMethodField()
    health_facility_name = SerializerMethodField()
    home_address = SerializerMethodField()
    other_place_specified = SerializerMethodField()
    attendant_at_birth = SerializerMethodField()
    attendant_other_specified = SerializerMethodField()
    marital_status = SerializerMethodField()
    mother_surname = SerializerMethodField()
    mother_other_names = SerializerMethodField()
    mother_maiden_surname = SerializerMethodField()
    father_surname = SerializerMethodField()
    father_other_names = SerializerMethodField()

    class Meta:
        model = BirthRecords
        fields = "__all__"
```

**Methods implemented:**
- `get_child_given_name()` - Returns `notice_of_birth.child_given_name`
- `get_child_surname()` - Returns `notice_of_birth.child_surname`
- `get_sex()` - Returns `notice_of_birth.sex`
- `get_date_of_birth()` - Returns ISO-formatted date string
- `get_birth_weight_kg()` - Returns string representation of decimal
- And more...

#### DeathRecordRequestSerializer
Added `SerializerMethodField` methods to flatten deceased/medical data:

```python
class DeathRecordRequestSerializer(ModelSerializer):
    deceasedName = SerializerMethodField()
    attended_name = SerializerMethodField()
    death_date = SerializerMethodField()
    cause_a = SerializerMethodField()
    cause_b = SerializerMethodField()
    cause_c = SerializerMethodField()
    other_condition_1 = SerializerMethodField()
    other_condition_2 = SerializerMethodField()
    district = SerializerMethodField()
    place_of_death = SerializerMethodField()
    place_of_death_name = SerializerMethodField()
    place_of_death_other = SerializerMethodField()
    age_at_death = SerializerMethodField()
    sex = SerializerMethodField()
    nationality = SerializerMethodField()
    informant_name = SerializerMethodField()
    informant_relationship = SerializerMethodField()

    class Meta:
        model = DeathRecords
        fields = "__all__"
```

**Methods implemented:**
- `get_deceasedName()` - Combines `notice_of_death.other_names` and `notice_of_death.surname`
- `get_attended_name()` - Returns `medical_certificate_of_death.attended_name`
- `get_death_date()` - Returns ISO-formatted date from MCCD
- `get_cause_a/b/c()` - Returns cause fields from MCCD
- `get_place_of_death()` - Returns place from NoticeOfDeath
- And more...

### 2. Frontend API Endpoints (`lib/api/birthRecords.ts` and `lib/api/deathRecords.ts`)

Fixed all endpoint paths to match the backend router configuration:

**birthRecords.ts:**
```typescript
// Before
await axiosInstance.get(`/birth_record/record/${recordId}`);

// After
await axiosInstance.get(`/births/record/${recordId}`);
```

**deathRecords.ts:**
```typescript
// Before
await axiosInstance.post('/death_record/submit', body);
await axiosInstance.get('/death_record/pending_submissions');
await axiosInstance.get(`/death_record/record/${recordId}`);
await axiosInstance.get(`/death_record/submission/${recordId}`);
await axiosInstance.put(`/death_record/${submissionId}/approve_submission`);
await axiosInstance.put(`/death_record/${submissionId}/reject_submission`);

// After
await axiosInstance.post('/deaths/submit', body);
await axiosInstance.get('/deaths/pending_submissions');
await axiosInstance.get(`/deaths/record/${recordId}`);
await axiosInstance.get(`/deaths/submission/${recordId}`);
await axiosInstance.put(`/deaths/${submissionId}/approve`);
await axiosInstance.put(`/deaths/${submissionId}/reject`);
```

### 3. Frontend Types (`utils/types.ts`)

#### Updated PendingBirthSubmission
Added flattened child fields to match serializer output:

```typescript
export interface PendingBirthSubmission {
  id: number;
  mother_din: string;
  // ... existing fields ...
  
  // NEW: Flattened child fields from NoticeOfBirth
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
```

#### Updated PendingDeathSubmission
Added flattened deceased/medical fields:

```typescript
export interface PendingDeathSubmission {
  id: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  
  // NEW: Flattened fields for easier frontend access
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
```

#### Updated DeathRecordApproveResponse
Fixed to match actual backend response:

```typescript
// Before
export interface DeathRecordApproveResponse {
  details: string;
  certificate: number;
  status: number;
}

// After
export interface DeathRecordApproveResponse {
  details: string;
  death_records_id: number;
  death_certificate_id: number;
  burial_permit_id: number;
  status: number;
}
```

---

## API Response Examples

### Birth Record Submission (Pending)
```json
{
  "id": 123,
  "mother_din": "CIT-2024-001",
  "father_din": "CIT-2024-002",
  "status": "PENDING",
  "child_given_name": "John",
  "child_surname": "Doe",
  "child_other_names": "Michael",
  "sex": "MALE",
  "date_of_birth": "2026-04-30",
  "birth_weight_kg": "3.5",
  "health_facility_name": "Lusaka General Hospital",
  "attendant_at_birth": "MIDWIFE",
  "marital_status": "MARRIED",
  "mother_surname": "Doe",
  "mother_other_names": "Jane",
  "mother_maiden_surname": "Smith",
  "submitted_at": "2026-04-30T10:30:00Z",
  "created_at": "2026-04-30T10:30:00Z"
}
```

### Death Record Submission (Pending)
```json
{
  "id": 456,
  "status": "PENDING",
  "deceasedName": "Mary Johnson",
  "attended_name": "Mary Johnson",
  "death_date": "2026-04-29",
  "cause_a": "Pneumonia",
  "cause_b": "Influenza",
  "cause_c": "Chronic obstructive pulmonary disease",
  "place_of_death": "HEALTH_FACILITY",
  "place_of_death_name": "Lusaka General Hospital",
  "age_at_death": 72,
  "sex": "FEMALE",
  "nationality": "Zambian",
  "informant_name": "John Johnson",
  "informant_relationship": "Son",
  "submitted_at": "2026-04-30T14:00:00Z",
  "created_at": "2026-04-30T14:00:00Z"
}
```

### Birth Record Approval Response
```json
{
  "details": "Approval Successful",
  "certificate": 789,
  "status": 200
}
```

### Death Record Approval Response
```json
{
  "details": "Approval Successful",
  "death_records_id": 456,
  "death_certificate_id": 101,
  "burial_permit_id": 102,
  "status": 200
}
```

---

## Testing Checklist

- [ ] Submit a new birth record via `/births/submit`
- [ ] Retrieve pending birth submissions via `/births/pending_submissions`
- [ ] View birth record details via `/births/record/{id}`
- [ ] Approve a birth record via `/births/{id}/approve`
- [ ] Reject a birth record via `/births/{id}/reject`
- [ ] Submit a new death record via `/deaths/submit`
- [ ] Attach Notice of Death via `/deaths/submit/{id}/notice_of_death`
- [ ] Retrieve pending death submissions via `/deaths/pending_submissions`
- [ ] View death record details via `/deaths/record/{id}`
- [ ] Approve a death record via `/deaths/{id}/approve`
- [ ] Reject a death record via `/deaths/{id}/reject`
- [ ] Verify frontend displays all fields correctly

---

## Related Files

| File | Change Type |
|------|-------------|
| `Backend/hospital/serializers.py` | Modified - Added flattened fields |
| `Frontend/lib/api/birthRecords.ts` | Modified - Fixed endpoint paths |
| `Frontend/lib/api/deathRecords.ts` | Modified - Fixed endpoint paths |
| `Frontend/utils/types.ts` | Modified - Updated type definitions |

---

## Notes

- The serializer changes maintain backward compatibility - all original model fields are still included via `fields = "__all__"`
- The flattened fields are computed properties and don't affect database storage
- All changes follow the existing code patterns and conventions in the codebase
