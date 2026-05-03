# Notice of Death Form - Frontend Specification

## Endpoint
```
POST /deaths/submit/{death_record_id}/notice_of_death
```

## Request Body Fields

### Required Fields
| Field | Type | Description |
|-------|------|-------------|
| `district` | string | District where the death occurred |
| `informant_relationship` | string | Relationship of informant to deceased |

### Optional Fields
| Field | Type | Description |
|-------|------|-------------|
| `deceased_din` | string | DIN of the deceased (Citizen). If provided, deceased details will be auto-populated from Citizen record |
| `surname` | string | Surname of deceased |
| `other_names` | string | Other names of deceased |
| `occupation` | string | Occupation of deceased |
| `residential_address` | string | Residential address of deceased |
| `date_of_birth` | date | Date of birth of deceased |
| `sex` | string | Sex (MALE/FEMALE) |
| `nationality` | string | Nationality |
| `national_identity_no` | string | NRC number |
| `social_security_no` | string | NAPSA/Social security number |
| `education_level` | string | Education level |

## Auto-Populated Fields (Not Required in Request)

These fields are automatically populated by the service from the MCCD and Citizen data:

### From MCCD
- `date_of_death` - death date
- `place_of_death` - always "HEALTH_FACILITY"
- `place_of_death_name` - facility name from health worker
- `age_at_death` - parsed from MCCD age_stated
- `immediate_cause` / `cause_a` - cause of death
- `cause_a_icd_code` - ICD code
- `antecedent_cause` / `cause_b` - antecedent cause
- `underlying_cause` / `cause_c` - underlying cause

### From Informant Citizen Record
- `informant_surname` - from full_name
- `informant_other_names` - from full_name
- `informant_contact_no` - from phone
- `informant_national_id` - from nrc
- `informant_nationality` - from nationality
- `informant_residential_address` - from residential_address
- `informant_postal_address` - from postal_address or residential_address

### Auto-Generated
- `serial_number` - unique identifier
- `application_no` - application number
- `date_and_time` - current timestamp
- `date_of_registration` - today's date

## Example Payload
```json
{
  "district": "Lusaka",
  "informant_relationship": "Spouse"
}
```

Or with manual deceased details:
```json
{
  "district": "Lusaka",
  "informant_relationship": "Spouse",
  "surname": "Mwansa",
  "other_names": "John Paul",
  "occupation": "Teacher",
  "sex": "MALE"
}
```