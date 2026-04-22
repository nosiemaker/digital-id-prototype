# Digital ID Prototype - Agent Guide

## Essential Commands
**Activate environment:**
```bash
source Backend/.venv/bin/activate
```

**Run development server:**
```bash
uvicorn Backend.main:app --reload
```
*(Sets DJANGO_SETTINGS_MODULE internally)*

**Run tests:**
```bash
python Backend/manage.py test [app_name]  # e.g., citizens
```

**Code quality:**
```bash
ruff check Backend    # lint
ruff fix Backend      # format
```

## Key Architecture Notes
- Hybrid Django/FastAPI: FastAPI handles API routes, Django manages ORM/admin
- Main app: `Backend/main.py` (includes routers, middleware)
- Django settings: `Backend/zdid_core/settings.py`
- Auth middleware: Sets `request.state.user` after JWT validation
- RBAC system: `Backend/Utils/rbac.py` with `Permission` enum and `require_permission()` dependency

## Critical Implementation Details
- Citizens can ONLY access their own data (by DIN)
- Registration Officers can access ANY citizen data
- Logout endpoint REQUIRES authentication (not in public routes)
- Use `require_permission(Permission.XXX)` for endpoint protection
- Database access via Django ORM: `Backend/Utils/database.py`

## Router-Specific Rules
**Auth router (`Backend/routers/auth.py`):**
- `/me` and `/logout` require `CITIZEN_READ_OWN_PROFILE`

**Citizens router (`Backend/routers/citizens.py`):**
- Citizens: own data only via DIN
- Registration Officers: full citizen/biometrics access
- Other roles: checked via RBAC permissions

**Registration router (`Backend/routers/registration.py`):**
- List requests: `RO_READ_PENDING_ENROLLMENTS`
- Approve: `RO_APPROVE_ENROLLMENT`  
- Reject: `RO_REJECT_ENROLLMENT`