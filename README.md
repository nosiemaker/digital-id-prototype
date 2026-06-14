# ZDID — Zambia Digital ID System

A comprehensive national digital identity platform built with a Django + FastAPI hybrid backend and a modern TypeScript/Next.js frontend. This system provides secure citizen identity management, enrollment, verification, and digital ID generation.

---

## Overview

ZDID is an enterprise-grade digital identity solution designed to streamline citizen registration and identity verification in Zambia. It combines:

- **Django ORM** for robust data modeling and management
- **FastAPI** for high-performance async APIs
- **Next.js + TypeScript** for a responsive frontend
- **ECDSA P-256 cryptography** for secure digital signing
- **QR code generation** for portable identity verification
- **PostgreSQL** for scalable data storage

---

## Prerequisites

Make sure you have the following installed before getting started:

- **Python 3.11+**
- **uv** (recommended) — fast Python package manager
- **Node.js 18+**
- **pnpm** (or npm)
- **PostgreSQL 12+** (for database backend)

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

> Don't have uv? Install it by following the official docs at [https://docs.astral.sh/uv/getting-started/installation](https://docs.astral.sh/uv/getting-started/installation) or run:
> ```bash
> powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
> ```

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
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/zdid_db

# Signing keys (from step 4)
ZDID_SIGNING_PRIVATE_KEY="..."
ZDID_SIGNING_PUBLIC_KEY="..."

# QR code TTL in seconds (default: 300)
ZDID_QR_TTL_SECONDS=300

# API Configuration
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
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

- Runs at: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`
- OpenAPI schema: `http://localhost:8000/openapi.json`

**Terminal 2 — Django (ORM / admin):**

```bash
uv run python manage.py runserver 8001
```

- Runs at: `http://localhost:8001`
- Django admin: `http://localhost:8001/admin`

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

### 4. Configure environment variables

Create a `.env.local` file in the `Frontend/` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_upload_preset
```

### 5. Start the development server

```bash
pnpm run dev
```

- Runs at: `http://localhost:3000` or `http://localhost:5173` (depending on your Vite config)

---

## Project Structure

```
ZDID/
├── Backend/
│   ├── citizens/              # Citizen models, schemas, services
│   ├── registration/          # Enrollment request handling
│   ├── digital_id/            # Digital ID signing & packaging
│   ├── qr/                    # QR payload generation & verification
│   ├── Utils/                 # Shared utilities (auth, audit, RBAC, signing)
│   ├── generate_signing_key.py # Key generation script
│   ├── main.py                # FastAPI entrypoint
│   ├── manage.py              # Django entrypoint
│   ├── requirements.txt       # Python dependencies
│   └── .env                   # Environment configuration (not in git)
│
└── Frontend/
    ├── src/
    │   ├── app/               # Next.js pages and layouts
    │   ├── components/        # Reusable React components
    │   ├── hooks/             # Custom React hooks
    │   ├── lib/               # Utilities and services
    │   ├── services/          # API clients and business logic
    │   └── styles/            # CSS/styling
    ├── public/                # Static assets
    ├── package.json
    └── .env.local             # Environment configuration (not in git)
```

---

## Backend Architecture & Key Modules

### Citizens Module (`Backend/citizens/`)
Manages citizen profiles, personal information, and identity verification:
- User models and schemas
- Profile management services
- Citizen status tracking

### Registration Module (`Backend/registration/`)
Handles enrollment workflows:
- Enrollment requests
- Document verification
- Identity approval flows

### Digital ID Module (`Backend/digital_id/`)
Generates and signs digital identity documents:
- Digital ID creation
- ECDSA P-256 signing
- Document packaging

### QR Module (`Backend/qr/`)
QR code generation and payload management:
- Secure QR payload generation
- QR TTL (time-to-live) management
- Payload verification

### Utils Module (`Backend/Utils/`)
Shared utilities across modules:
- Authentication & JWT handling
- Role-based access control (RBAC)
- Audit logging
- Cryptographic functions

---

## Frontend Architecture & Key Components

### HTTP Client (`lib/axios.ts`)

Central Axios instance with:
- JWT authentication headers
- Automatic token refresh
- Session expiry handling
- 401 error interception with `AUTH_EXPIRED` event emission

### Authentication Guard (`hooks/useAuthGuard.ts`)

Lightweight React hook for protected routes:
- Listens for `AUTH_EXPIRED` events
- Auto-redirects to `/login` on session expiry

### Cryptography Service (`service/crypto.ts`)

Browser-native Web Crypto API wrapper:
- **`init()`** — Initialize IndexedDB store (`ZDID_Store`)
- **`generateKeys()`** — Generate non-exportable P-256 key pair
- **`sign(data)`** — Sign data with stored private key (ECDSA + SHA-256)
- **`signChallenge(enrollmentId, nonce)`** — Sign enrollment activation challenge
- **`signQRPayload(din, expiry)`** — Sign QR identity payload
- **`hasKeys()`** — Check for existing key pair
- **`getPublicKey()`** — Retrieve stored JWK public key
- **`clear()`** — Wipe keys from IndexedDB (logout/reset)

> ⚠️ Private keys are stored with `extractable: false` — they never leave the browser.

### Crypto Hook (`hooks/useCrypto.ts`)

React hook wrapping `crypto.ts`:
- Reactive state management
- Auto-initialization on component mount
- Key pair existence tracking

### Enrollment Hook (`hooks/useEnrollment.ts`)

Orchestrates the citizen enrollment flow:
- **`startEnrollment(data)`** — Generate key pair if needed, submit enrollment
- **`activate(enrollmentId, nonce)`** — Sign challenge and activate Digital ID
- Stores returned Digital ID in `localStorage` (`zdid_digital_id`)

### Image Upload Component (`components/ImageUploadZone.tsx`)

Reusable drag-and-drop file uploader:
- Direct Cloudinary upload
- Unsigned upload preset
- Live file preview
- Upload state feedback (uploading/success/error)

Exported function: `handleImageUpload(file, folder)` for programmatic use

### Login Page (`app/login/page.tsx`)

Role-based login routing:

| Role | Route |
|------|-------|
| `REGISTRATION_OFFICER` | `/dashboard/ro` |
| `SUPERVISOR` | `/dashboard/supervisor` |
| `REGISTRAR` | `/dashboard/registrar` |
| `HEALTH_WORKER` | `/dashboard/health` |
| `CITIZEN` | `/dashboard/citizen` |

Handles:
- ✓ Successful login with JWT token storage
- ✗ 401 (wrong credentials)
- ✗ 403 (suspended account)

Citizen registration link available at bottom of form.

---

## Environment Variables

### Backend (`.env`)

```env
# Django Configuration
SECRET_KEY=your-super-secret-key
DEBUG=False  # Set to True only in development
ALLOWED_HOSTS=localhost,127.0.0.1

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/zdid_db

# Cryptographic Keys
ZDID_SIGNING_PRIVATE_KEY="-----BEGIN EC PRIVATE KEY-----..."
ZDID_SIGNING_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."

# QR Code Configuration
ZDID_QR_TTL_SECONDS=300  # 5 minutes

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Email (if applicable)
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@example.com
EMAIL_HOST_PASSWORD=your-app-password
```

### Frontend (`.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your_upload_preset
```

---

## Database Setup

Ensure PostgreSQL is running and create a database:

```bash
# Using psql
createdb zdid_db

# Or using PostgreSQL GUI (pgAdmin, DataGrip, etc.)
```

Update `DATABASE_URL` in `.env`:
```env
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/zdid_db
```

---

## API Endpoints

### Authentication
- `POST /auth/login` — User login
- `POST /auth/logout` — User logout
- `POST /auth/refresh` — Refresh JWT token
- `GET /auth/me` — Get current user profile

### Citizens
- `GET /citizens/{id}` — Get citizen profile
- `PUT /citizens/{id}` — Update citizen profile
- `GET /citizens/{id}/digital-id` — Get citizen's digital ID

### Registration/Enrollment
- `POST /enrollment/start` — Start enrollment process
- `POST /enrollment/{id}/activate` — Activate digital ID
- `GET /enrollment/{id}` — Get enrollment status

### QR Codes
- `POST /qr/generate` — Generate QR payload
- `POST /qr/verify` — Verify QR signature

### Admin
- `GET /admin/dashboard` — Admin dashboard
- `GET /admin/users` — List system users
- `POST /admin/users` — Create system user

Full API documentation available at: `http://localhost:8000/docs`

---

## Key Features

### 🔐 Security
- ECDSA P-256 digital signing for all identities
- Bcrypt password hashing
- JWT-based stateless authentication
- Browser-based key storage (never exported)
- CORS protection

### 📱 Digital Identity
- Secure citizen enrollment
- QR code identity documents
- Cryptographic proof of identity
- Time-based QR validity

### 📊 Admin & RBAC
- Role-based access control
- Multi-level approval workflows
- Audit logging
- User activity tracking

### 🖼️ Document Management
- Image upload via Cloudinary
- PDF generation with ReportLab
- QR embedding in documents
- Digital signature verification

### ⚡ Performance
- FastAPI async request handling
- Database connection pooling
- Optimized query patterns
- Frontend code splitting

---

## Development Workflows

### Running Tests

**Backend:**
```bash
cd Backend
pytest
pytest --cov=.  # With coverage
```

**Frontend:**
```bash
cd Frontend
pnpm test
pnpm test --coverage
```

### Database Management

**Create migration:**
```bash
cd Backend
uv run python manage.py makemigrations
uv run python manage.py migrate
```

**Reset database:**
```bash
cd Backend
uv run python manage.py flush
uv run python manage.py migrate
```

### Code Quality

**Backend linting:**
```bash
flake8 Backend/
black Backend/  # Format
isort Backend/  # Sort imports
```

**Frontend linting:**
```bash
cd Frontend
pnpm lint
pnpm format
```

---

## Production Deployment

### Backend Checklist
- [ ] Set `DEBUG=False`
- [ ] Generate strong `SECRET_KEY`
- [ ] Use production PostgreSQL database
- [ ] Configure `ALLOWED_HOSTS` with domain
- [ ] Set up HTTPS/SSL certificate
- [ ] Use production ASGI server (Gunicorn + Uvicorn workers)
- [ ] Configure environment variables securely
- [ ] Enable logging and monitoring
- [ ] Set up database backups

### Gunicorn Command (Production)
```bash
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8000
```

### Frontend Checklist
- [ ] Build production bundle: `pnpm build`
- [ ] Verify environment variables for production API URL
- [ ] Enable analytics/monitoring
- [ ] Configure CDN for static assets
- [ ] Set up error tracking (Sentry, etc.)

---

## Common Issues & Troubleshooting

### Backend

**`ZDID_SIGNING_PRIVATE_KEY is not set` on startup**
```bash
# Re-run the key generation script
python generate_signing_key.py
# Copy output to .env
```

**`Port 8000/8001 already in use`**
```bash
# Use different ports
uvicorn main:app --reload --port 8002
uv run python manage.py runserver 8003
```

**`uv` command not found**
```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh
# Restart terminal
```

**Database connection error**
- Verify PostgreSQL is running
- Check `DATABASE_URL` format
- Confirm database user permissions

### Frontend

**`pnpm` command not found**
```bash
npm install -g pnpm
```

**Port 3000 already in use**
- Change port in `next.config.js` or `vite.config.ts`
- Or kill process: `lsof -i :3000` → `kill -9 <PID>`

**Cloudinary upload fails**
- Verify `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`
- Check upload preset is unsigned
- Confirm cloud is active in Cloudinary dashboard

**Crypto service not initialized**
- Ensure browser supports IndexedDB
- Check browser console for `ZDID_Store` errors
- Clear IndexedDB and retry

---

## Contributing

1. **Fork** the repository
2. **Create a feature branch**: `git checkout -b feature/your-feature`
3. **Make changes** and test thoroughly
4. **Commit with clear messages**: `git commit -m "Add feature description"`
5. **Push to branch**: `git push origin feature/your-feature`
6. **Open a Pull Request** with description

### Contribution Guidelines
- Follow existing code style (black for Python, Prettier for TypeScript)
- Add tests for new features
- Update documentation as needed
- Keep commits atomic and meaningful

---

## Key Dependencies

### Backend
| Package | Purpose |
|---------|---------|
| FastAPI | Async web framework |
| Django | ORM and admin interface |
| Pydantic | Data validation |
| python-jose | JWT handling |
| bcrypt | Password hashing |
| cryptography | ECDSA signing |
| psycopg2-binary | PostgreSQL driver |
| qrcode | QR code generation |
| ReportLab | PDF generation |
| Pillow | Image processing |

### Frontend
| Package | Purpose |
|---------|---------|
| Next.js | React framework |
| TypeScript | Type safety |
| Axios | HTTP client |
| Tailwind CSS | Styling |
| React Hook Form | Form management |

---

## Support & Contact

For issues, bugs, or feature requests:
1. Check existing [GitHub Issues](https://github.com/nosiemaker/digital-id-prototype/issues)
2. Create a new issue with detailed description and reproduction steps
3. Contact the development team

---

## License

This project is provided for educational and prototyping purposes.

---

## Changelog

### v1.0.0 (Initial Release)
- ✅ Basic citizen enrollment flow
- ✅ Digital ID generation with ECDSA signing
- ✅ QR code identity documents
- ✅ Multi-role admin interface
- ✅ JWT-based authentication
- ✅ Frontend key management

---

**Last Updated**: June 2026  
**Status**: Active Development  
**Maintainers**: ZDID Development Team
