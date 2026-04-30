# Civil Registration — Streaming Document Endpoints

## Overview

All document-retrieval endpoints in the civil registration system return **live-generated PDFs**, never pre-stored files. Each call to a streaming endpoint triggers on-demand PDF generation from the database, then delivers the bytes over HTTP using FastAPI's `StreamingResponse`.

There are two response formats in use:

| Format | `Content-Type` | When used |
|---|---|---|
| `application/pdf` | Single PDF stream | Birth Certificate (single-doc endpoint only) |
| `multipart/form-data` | Multiple PDFs in one response | All other document endpoints |

---

## Birth Record Streaming Endpoints

### 1. `GET /births/{birth_records_id}/review`

**Access:** REGISTRAR only  
**Status required:** Any (submission exists)  
**Response format:** `multipart/form-data; boundary=birth-review-boundary`

**Parts returned:**

| Part name | Filename | Description |
|---|---|---|
| `notice_of_birth` | `notice_of_birth.pdf` | Form VIII — full parental and child details, attendant, paternity fields |
| `record_of_birth` | `record_of_birth.pdf` | M.F.2 — facility summary signed by officer in charge |

**Use case:** Registrar reviewing the two submission-phase documents before making an approval/rejection decision.

---

### 2. `GET /births/{birth_records_id}/view/certificate`

**Access:** REGISTRAR or CITIZEN  
**Status required:** APPROVED  
**Response format:** `application/pdf`  
**Content-Disposition:** `attachment; filename="birth_certificate_{id}.pdf"`

**Returns:** A single Birth Certificate PDF (Reg-Gen Form No. IV). This is the only endpoint that streams a raw PDF rather than a multipart body.

**Use case:** Citizen downloading their child's birth certificate, or a Registrar retrieving the certificate individually.

---

### 3. `GET /births/{birth_records_id}/review/full_pack`

**Access:** REGISTRAR or HEALTH_WORKER  
**Status required:** APPROVED  
**Response format:** `multipart/form-data; boundary=birth-full-pack-boundary`

**Parts returned:**

| Part name | Filename | Description |
|---|---|---|
| `birth_certificate` | `birth_certificate.pdf` | Legal proof of birth — generated at approval |
| `notice_of_birth` | `notice_of_birth.pdf` | Form VIII — submission-phase document |
| `record_of_birth` | `record_of_birth.pdf` | M.F.2 — submission-phase document |

**Use case:** Downloading or archiving the complete three-document birth case file after approval.

---

## Death Record Streaming Endpoints

### 4. `GET /deaths/{death_records_id}/view`

**Access:** REGISTRAR only  
**Status required:** Any (both MCCD and Notice of Death must be attached)  
**Response format:** `multipart/form-data; boundary=death-review-boundary`

**Parts returned:**

| Part name | Filename | Description |
|---|---|---|
| `mccd` | `mccd.pdf` | Medical Certificate of Cause of Death — submitted by Health Worker |
| `notice_of_death` | `notice_of_death.pdf` | DNRPC Form — submitted by informant; includes deceased particulars and police/coroner fields |

**Use case:** Registrar reviewing submission-phase death documents before making an approval/rejection decision.

---

### 5. `GET /deaths/{death_records_id}/view/certificates`

**Access:** REGISTRAR or CITIZEN  
**Status required:** APPROVED  
**Response format:** `multipart/form-data; boundary=death-certificates-boundary`

**Parts returned:**

| Part name | Filename | Description |
|---|---|---|
| `death_certificate` | `death_certificate.pdf` | Legal proof of death — generated at approval |
| `burial_permit` | `burial_permit.pdf` | Form XI — authorises burial; generated at approval |

**Use case:** Citizen retrieving their death certificates and burial permit, or Registrar issuing post-approval documents.

---

### 6. `GET /deaths/{death_records_id}/review/full_pack`

**Access:** REGISTRAR or HEALTH_WORKER  
**Status required:** APPROVED  
**Response format:** `multipart/form-data; boundary=death-full-pack-boundary`

**Parts returned:**

| Part name | Filename | Description |
|---|---|---|
| `death_certificate` | `death_certificate.pdf` | Legal proof of death |
| `burial_permit` | `burial_permit.pdf` | Form XI — burial authorisation |
| `mccd` | `mccd.pdf` | Medical Certificate of Cause of Death |
| `notice_of_death` | `notice_of_death.pdf` | DNRPC Form |

**Use case:** Complete four-document death case file for archival, audit, or bulk download.

---

## Error Responses

All streaming endpoints return JSON error objects (not a stream) when something goes wrong:

| HTTP Status | Scenario |
|---|---|
| `404` | Record with the given ID does not exist |
| `400` | A required sub-document (MCCD, Notice of Birth, etc.) is missing; error lists which ones |
| `409` | Record is not in the required status (e.g. requesting a full pack on a PENDING record) |
| `200 + { "error": "..." }` | PDF file generation itself failed on disk (rare; logged server-side) |

---

## React Frontend Integration

### The Core Pattern

Because the server returns `multipart/form-data` (not JSON), the standard `fetch` + `.json()` pattern will not work. You must read the raw `ArrayBuffer`, then parse the multipart boundary manually to extract each PDF part.

The approach below works for React Native and React web.

---

### Helper: Parse a Multipart Response

```javascript
/**
 * Parses a multipart/form-data ArrayBuffer into a map of part name → Uint8Array.
 *
 * @param {ArrayBuffer} buffer   - Raw response body
 * @param {string}      boundary - Boundary string from Content-Type header
 * @returns {Map<string, Uint8Array>}
 */
function parseMultipart(buffer, boundary) {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();
  const parts = new Map();

  // Convert boundary to bytes for searching
  const boundaryBytes = new TextEncoder().encode(`--${boundary}`);

  // Find all boundary positions
  const positions = [];
  outer: for (let i = 0; i < bytes.length - boundaryBytes.length; i++) {
    for (let j = 0; j < boundaryBytes.length; j++) {
      if (bytes[i + j] !== boundaryBytes[j]) continue outer;
    }
    positions.push(i);
  }

  for (let p = 0; p < positions.length - 1; p++) {
    const start = positions[p] + boundaryBytes.length + 2; // skip \r\n
    const end = positions[p + 1] - 2;                     // trim trailing \r\n

    // Split headers from body at the first blank line (\r\n\r\n)
    const chunk = bytes.slice(start, end);
    const chunkText = decoder.decode(chunk);
    const headerBodySplit = chunkText.indexOf('\r\n\r\n');
    if (headerBodySplit === -1) continue;

    const headers = chunkText.slice(0, headerBodySplit);
    const bodyStart = headerBodySplit + 4;

    // Extract the `name` field from Content-Disposition
    const nameMatch = headers.match(/name="([^"]+)"/);
    if (!nameMatch) continue;

    const name = nameMatch[1];
    const body = chunk.slice(bodyStart);
    parts.set(name, body);
  }

  return parts;
}
```

---

### Utility: Convert Uint8Array to a Blob URL

```javascript
/**
 * Creates a temporary blob URL for a PDF Uint8Array.
 * Call URL.revokeObjectURL(url) when the component unmounts.
 */
function pdfToUrl(uint8Array) {
  const blob = new Blob([uint8Array], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}
```

---

### Example 1: Birth Record Review (two PDFs)

```jsx
import React, { useEffect, useState } from 'react';

export default function BirthRecordReview({ birthRecordsId, token }) {
  const [docs, setDocs] = useState({ noticeUrl: null, recordUrl: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let noticeUrl, recordUrl;

    async function fetchDocs() {
      try {
        const res = await fetch(`/births/${birthRecordsId}/review`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Request failed');
        }

        // Extract boundary from Content-Type header
        const contentType = res.headers.get('Content-Type');
        const boundaryMatch = contentType.match(/boundary=(.+)/);
        if (!boundaryMatch) throw new Error('No multipart boundary in response');
        const boundary = boundaryMatch[1];

        const buffer = await res.arrayBuffer();
        const parts = parseMultipart(buffer, boundary);

        noticeUrl = pdfToUrl(parts.get('notice_of_birth'));
        recordUrl = pdfToUrl(parts.get('record_of_birth'));

        setDocs({ noticeUrl, recordUrl });
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    fetchDocs();

    // Clean up blob URLs when component unmounts
    return () => {
      if (noticeUrl) URL.revokeObjectURL(noticeUrl);
      if (recordUrl) URL.revokeObjectURL(recordUrl);
    };
  }, [birthRecordsId, token]);

  if (loading) return <p>Loading documents...</p>;
  if (error)   return <p>Error: {error}</p>;

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <h3>Notice of Birth</h3>
        <iframe src={docs.noticeUrl} width="100%" height={700} title="Notice of Birth" />
      </div>
      <div style={{ flex: 1 }}>
        <h3>Record of Birth</h3>
        <iframe src={docs.recordUrl} width="100%" height={700} title="Record of Birth" />
      </div>
    </div>
  );
}
```

---

### Example 2: Birth Certificate Only (single PDF)

This endpoint returns a raw `application/pdf` stream, so you read the body directly — no multipart parsing needed.

```jsx
import React, { useEffect, useState } from 'react';

export default function BirthCertificateViewer({ birthRecordsId, token }) {
  const [certUrl, setCertUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    let url;

    async function fetchCert() {
      try {
        const res = await fetch(`/births/${birthRecordsId}/view/certificate`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Request failed');
        }

        const buffer = await res.arrayBuffer();
        url = pdfToUrl(new Uint8Array(buffer));
        setCertUrl(url);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    fetchCert();
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [birthRecordsId, token]);

  if (loading) return <p>Loading certificate...</p>;
  if (error)   return <p>Error: {error}</p>;

  return (
    <div>
      <h2>Birth Certificate</h2>
      <iframe src={certUrl} width="100%" height={750} title="Birth Certificate" />
      <a href={certUrl} download={`birth_certificate_${birthRecordsId}.pdf`}>
        Download PDF
      </a>
    </div>
  );
}
```

---

### Example 3: Full Birth Pack (three PDFs)

```jsx
import React, { useEffect, useState } from 'react';

export default function BirthFullPack({ birthRecordsId, token }) {
  const [urls, setUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let resolvedUrls = {};

    async function fetchPack() {
      try {
        const res = await fetch(`/births/${birthRecordsId}/review/full_pack`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Request failed');
        }

        const contentType = res.headers.get('Content-Type');
        const boundary = contentType.match(/boundary=(.+)/)[1];
        const buffer = await res.arrayBuffer();
        const parts = parseMultipart(buffer, boundary);

        resolvedUrls = {
          birth_certificate: pdfToUrl(parts.get('birth_certificate')),
          notice_of_birth:   pdfToUrl(parts.get('notice_of_birth')),
          record_of_birth:   pdfToUrl(parts.get('record_of_birth')),
        };

        setUrls(resolvedUrls);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    fetchPack();

    return () => {
      Object.values(resolvedUrls).forEach(u => URL.revokeObjectURL(u));
    };
  }, [birthRecordsId, token]);

  if (loading) return <p>Loading full pack...</p>;
  if (error)   return <p>Error: {error}</p>;

  const documents = [
    { key: 'birth_certificate', label: 'Birth Certificate' },
    { key: 'notice_of_birth',   label: 'Notice of Birth' },
    { key: 'record_of_birth',   label: 'Record of Birth' },
  ];

  return (
    <div>
      {documents.map(({ key, label }) => (
        <section key={key} style={{ marginBottom: 32 }}>
          <h3>{label}</h3>
          <iframe src={urls[key]} width="100%" height={700} title={label} />
          <a href={urls[key]} download={`${key}_${birthRecordsId}.pdf`}>
            Download {label}
          </a>
        </section>
      ))}
    </div>
  );
}
```

---

### Example 4: Death Certificates + Burial Permit

```jsx
import React, { useEffect, useState } from 'react';

export default function DeathCertificates({ deathRecordsId, token }) {
  const [urls, setUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let resolvedUrls = {};

    async function fetchCerts() {
      try {
        const res = await fetch(`/deaths/${deathRecordsId}/view/certificates`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Request failed');
        }

        const boundary = res.headers.get('Content-Type').match(/boundary=(.+)/)[1];
        const buffer = await res.arrayBuffer();
        const parts = parseMultipart(buffer, boundary);

        resolvedUrls = {
          death_certificate: pdfToUrl(parts.get('death_certificate')),
          burial_permit:     pdfToUrl(parts.get('burial_permit')),
        };

        setUrls(resolvedUrls);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    fetchCerts();
    return () => { Object.values(resolvedUrls).forEach(u => URL.revokeObjectURL(u)); };
  }, [deathRecordsId, token]);

  if (loading) return <p>Loading certificates...</p>;
  if (error)   return <p>Error: {error}</p>;

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <h3>Death Certificate</h3>
        <iframe src={urls.death_certificate} width="100%" height={700} title="Death Certificate" />
        <a href={urls.death_certificate} download={`death_certificate_${deathRecordsId}.pdf`}>
          Download
        </a>
      </div>
      <div style={{ flex: 1 }}>
        <h3>Burial Permit</h3>
        <iframe src={urls.burial_permit} width="100%" height={700} title="Burial Permit" />
        <a href={urls.burial_permit} download={`burial_permit_${deathRecordsId}.pdf`}>
          Download
        </a>
      </div>
    </div>
  );
}
```

---

### Example 5: Full Death Pack (four PDFs)

```jsx
import React, { useEffect, useState } from 'react';

export default function DeathFullPack({ deathRecordsId, token }) {
  const [urls, setUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let resolvedUrls = {};

    async function fetchPack() {
      try {
        const res = await fetch(`/deaths/${deathRecordsId}/review/full_pack`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || 'Request failed');
        }

        const boundary = res.headers.get('Content-Type').match(/boundary=(.+)/)[1];
        const buffer = await res.arrayBuffer();
        const parts = parseMultipart(buffer, boundary);

        resolvedUrls = {
          death_certificate: pdfToUrl(parts.get('death_certificate')),
          burial_permit:     pdfToUrl(parts.get('burial_permit')),
          mccd:              pdfToUrl(parts.get('mccd')),
          notice_of_death:   pdfToUrl(parts.get('notice_of_death')),
        };

        setUrls(resolvedUrls);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    fetchPack();
    return () => { Object.values(resolvedUrls).forEach(u => URL.revokeObjectURL(u)); };
  }, [deathRecordsId, token]);

  if (loading) return <p>Loading full pack...</p>;
  if (error)   return <p>Error: {error}</p>;

  const documents = [
    { key: 'death_certificate', label: 'Death Certificate' },
    { key: 'burial_permit',     label: 'Burial Permit' },
    { key: 'mccd',              label: 'Medical Certificate of Cause of Death' },
    { key: 'notice_of_death',   label: 'Notice of Death' },
  ];

  return (
    <div>
      {documents.map(({ key, label }) => (
        <section key={key} style={{ marginBottom: 32 }}>
          <h3>{label}</h3>
          <iframe src={urls[key]} width="100%" height={700} title={label} />
          <a href={urls[key]} download={`${key}_${deathRecordsId}.pdf`}>
            Download {label}
          </a>
        </section>
      ))}
    </div>
  );
}
```

---

## React Native Notes

`<iframe>` is not available in React Native. To display PDFs there, use one of these approaches:

**Option 1 — `react-native-pdf`**

```jsx
import Pdf from 'react-native-pdf';

// Convert Uint8Array → base64 string, then use as source
import { Buffer } from 'buffer';
const base64 = Buffer.from(uint8Array).toString('base64');
const source = { uri: `data:application/pdf;base64,${base64}` };

<Pdf source={source} style={{ flex: 1 }} />
```

**Option 2 — Open in device viewer**

```jsx
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';

const fileUri = FileSystem.cacheDirectory + 'document.pdf';
await FileSystem.writeAsStringAsync(fileUri, base64String, {
  encoding: FileSystem.EncodingType.Base64,
});
await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
  data: fileUri,
  flags: 1,
  type: 'application/pdf',
});
```

---

## Quick Reference

| Endpoint | Parts | Boundary | Auth Roles |
|---|---|---|---|
| `GET /births/{id}/review` | `notice_of_birth`, `record_of_birth` | `birth-review-boundary` | REGISTRAR |
| `GET /births/{id}/view/certificate` | _(single PDF stream)_ | — | REGISTRAR, CITIZEN |
| `GET /births/{id}/review/full_pack` | `birth_certificate`, `notice_of_birth`, `record_of_birth` | `birth-full-pack-boundary` | REGISTRAR, HEALTH_WORKER |
| `GET /deaths/{id}/view` | `mccd`, `notice_of_death` | `death-review-boundary` | REGISTRAR |
| `GET /deaths/{id}/view/certificates` | `death_certificate`, `burial_permit` | `death-certificates-boundary` | REGISTRAR, CITIZEN |
| `GET /deaths/{id}/review/full_pack` | `death_certificate`, `burial_permit`, `mccd`, `notice_of_death` | `death-full-pack-boundary` | REGISTRAR, HEALTH_WORKER |
