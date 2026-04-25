# ZDID — Zambia Digital ID System

A national digital identity platform built with a Django + FastAPI hybrid backend and a modern frontend.

---

## Prerequisites

Make sure you have the following installed before getting started:

- **Python 3.11+**
- **uv** (recommended) — fast Python package manager
- **Node.js 18+**
- **pnpm**

---

## Backend Setup

The backend uses a hybrid architecture: **Django** handles the ORM and data models, while **FastAPI** serves the API layer.

### 1. Navigate to the backend directory

```bash
cd Backend
```

### 2. Create and activate the virtual environment

```bash
# Create the venv (if it doesn't exist yet)
python -m venv .venv

# Activate on macOS/Linux
source .venv/bin/activate

# Activate on Windows
.venv\Scripts\activate
```

### 3. Install dependencies

**With uv (recommended):**

```bash
uv sync
```

**Without uv — use pip:**

```bash
pip install -r requirements.txt
```

> Don't have uv? Install it by following the official docs at [https://docs.astral.sh/uv/getting-started/installation](https://docs.astral.sh/uv/getting-started/installation) or run this 
```bash
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

### 4. Generate signing keys

ZDID uses ECDSA P-256 keys to sign Digital IDs and QR payloads. Run the key generation script to create your key pair:

```bash
python generate_signing_key.py
```

This will print two values to your terminal:

- `ZDID_SIGNING_PRIVATE_KEY` — the PEM-encoded private key
- `ZDID_SIGNING_PUBLIC_KEY` — the PEM-encoded public key

Copy both values and paste them into your `.env` file:

```env
ZDID_SIGNING_PRIVATE_KEY="-----BEGIN EC PRIVATE KEY-----
...
-----END EC PRIVATE KEY-----"

ZDID_SIGNING_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----
...
-----END PUBLIC KEY-----"
```

> ⚠️ Keep the private key secret. Never commit it to version control.

### 5. Configure your environment

Create a `.env` file in the `Backend/` directory if one doesn't exist, and fill in the required values:

```env
# Django
SECRET_KEY=your-django-secret-key
DEBUG=True

# Signing keys (from step 4)
ZDID_SIGNING_PRIVATE_KEY="..."
ZDID_SIGNING_PUBLIC_KEY="..."

# QR code TTL in seconds (default: 300)
ZDID_QR_TTL_SECONDS=300
```

### 6. Run database migrations

```bash
uv run python manage.py migrate
```

### 7. Start the servers

The backend requires **two servers** running simultaneously — open two terminal windows.

**Terminal 1 — FastAPI (API layer):**

```bash
uvicorn main:app --reload
```

Runs at: `http://localhost:8000`  
API docs: `http://localhost:8000/docs`

**Terminal 2 — Django (ORM / admin):**

```bash
uv run python manage.py runserver 8001
```

Runs at: `http://localhost:8001`  
Django admin: `http://localhost:8001/admin`

---

## Frontend Setup

### 1. Navigate to the frontend directory

```bash
cd Frontend
```

### 2. Install pnpm (if not already installed)

```bash
npm install -g pnpm
```

### 3. Install dependencies

```bash
pnpm install
```

### 4. Start the development server

```bash
pnpm run dev
```

Runs at: `http://localhost:5173` (or whichever port Vite assigns)

---

## Project Structure

```
ZDID/
├── Backend/
│   ├── citizens/          # Citizen models, schemas, services
│   ├── registration/      # Enrollment request handling
│   ├── digital_id/        # Digital ID signing & packaging
│   ├── qr/                # QR payload generation & verification
│   ├── Utils/             # Shared utilities (auth, audit, RBAC, signing)
│   ├── generate_signing_key.py
│   ├── main.py            # FastAPI entrypoint
│   ├── manage.py          # Django entrypoint
│   └── requirements.txt
└── Frontend/
    ├── src/
    └── package.json
```

---

## Frontend Architecture

The frontend is a **Next.js** app. Below is a breakdown of the key files and what each one is responsible for.

---

### `lib/axios.ts`

The central HTTP client. Sets up an Axios instance with the base API URL and JWT auth headers, and handles token refresh and session expiry. When a request returns `401` and the refresh attempt fails, it fires a custom `AUTH_EXPIRED` browser event so any listening component can react (e.g. redirect to login). Also exports typed API wrappers — `authApi`, `enrollmentApi` — so the rest of the app never constructs raw requests.

---

### `hooks/useAuthGuard.ts`

A lightweight React hook that listens for the `AUTH_EXPIRED` event fired by `axios.ts` and automatically redirects the user to `/login`. Drop this into any layout or page that should be protected — it handles the redirect without any prop-drilling or context.

---

### `service/crypto.ts`

A browser-native cryptography service built on the **Web Crypto API** and **IndexedDB**. Handles the full lifecycle of a citizen's ECDSA P-256 signing key pair:

- **`init()`** — opens the IndexedDB store (`ZDID_Store`) on first use
- **`generateKeys()`** — generates a non-exportable P-256 key pair; stores the private key in IndexedDB (it never leaves the browser) and returns the public key as a JWK for submission to the backend
- **`sign(data)`** — signs an arbitrary string with the stored private key using ECDSA + SHA-256
- **`signChallenge(enrollmentId, nonce)`** — signs the activation challenge sent by the backend during enrollment completion
- **`signQRPayload(din, expiry)`** — signs a QR identity payload for display in the citizen wallet
- **`hasKeys()`** — checks whether a key pair already exists in the store
- **`getPublicKey()`** — retrieves the stored JWK public key
- **`clear()`** — wipes all keys from IndexedDB (used on logout or reset)

The private key is stored with `extractable: false`, meaning it can never be read out of the browser — only used to sign.

---

### `hooks/useCrypto.ts`

A React hook that wraps `crypto.ts` and exposes its functionality as reactive state. Initialises the crypto service on mount and tracks whether the service is ready and whether a key pair exists. Exports `generateKeys`, `signChallenge`, and `signQR` as stable callbacks via `useCallback`.

---

### `hooks/useEnrollment.ts`

Orchestrates the full citizen enrollment flow:

- **`startEnrollment(data)`** — checks for an existing key pair (generates one if needed), then calls `enrollmentApi.submit()` with the citizen's data plus their public key JWK. Returns an enrollment ID and a message telling the citizen to visit a registration office.
- **`activate(enrollmentId, nonce)`** — signs the backend's challenge nonce and submits it to the activation endpoint. On success, stores the returned Digital ID in `localStorage` under `zdid_digital_id`.

> **Note:** The activation endpoint URL currently uses `process.env.NODE_ENV` as the base URL — this is a placeholder and should be replaced with the correct `NEXT_PUBLIC_API_URL` env variable before going to production.

---

### `components/ImageUploadZone.tsx`

A reusable drag-and-drop image upload component backed by **Cloudinary**. Used during citizen enrollment for uploading NRC photos and supporting documents.

- Accepts a file via click or drag-and-drop
- Shows a live preview after file selection
- Uploads directly to Cloudinary using an unsigned upload preset (configured via `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`)
- Returns the `secure_url` of the uploaded image for storage in the enrollment form
- Displays uploading / success / error states

The upload logic is also exported as a standalone `handleImageUpload(file, folder)` function so it can be called programmatically outside the component if needed.

---

### `app/login/page.tsx`

The login page for staff and citizens. Submits credentials to `authApi.login()`, which handles token storage. On success, reads the user's role from the response and redirects to the correct dashboard using the `ROLE_ROUTES` map:

| Role | Route |
|---|---|
| `REGISTRATION_OFFICER` | `/dashboard/ro` |
| `SUPERVISOR` | `/dashboard/supervisor` |
| `REGISTRAR` | `/dashboard/registrar` |
| `HEALTH_WORKER` | `/dashboard/health` |
| `CITIZEN` | `/dashboard/citizen` |

Handles `401` (wrong credentials) and `403` (suspended account) with specific error messages. Citizens are directed to `/register` via a link at the bottom of the form.

---

### Environment Variables (Frontend)

Create a `.env` file in the `Frontend/` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_upload_preset
```

---

## Common Issues

**`ZDID_SIGNING_PRIVATE_KEY is not set` on startup**  
You haven't added the signing keys to your `.env`. Re-run `generate_signing_key.py` and paste the output into `.env`.

**Port conflict on 8000 or 8001**  
Kill the process using the port or change the port:
```bash
uvicorn main:app --reload --port 8002
```

**`uv` command not found**  
Install uv following the instructions at [https://docs.astral.sh/uv](https://docs.astral.sh/uv), then restart your terminal.

**`pnpm` command not found**  
Run `npm install -g pnpm` then retry.