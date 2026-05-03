# Authentication and RBAC System Documentation

## Overview

This document describes the authentication and Role-Based Access Control (RBAC) system implemented for the ZDID (Zero Knowledge Digital ID) backend.

## Authentication System

### Endpoints

#### Login
- **URL**: `POST /auth/login`
- **Description**: Authenticate user and return access and refresh tokens
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "user_password"
  }
  ```
- **Response**:
  ```json
  {
    "access_token": "jwt_access_token",
    "refresh_token": "jwt_refresh_token",
    "token_type": "bearer",
    "user_id": 123,
    "role": "CITIZEN",
    "name": "John Doe"
  }
  ```

#### Refresh Token
- **URL**: `POST /auth/refresh`
- **Description**: Generate new access token using refresh token
- **Request Body**:
  ```json
  {
    "refresh_token": "jwt_refresh_token"
  }
  ```
- **Response**:
  ```json
  {
    "access_token": "new_jwt_access_token",
    "token_type": "bearer"
  }
  ```

#### Logout
- **URL**: `POST /auth/logout`
- **Description**: Logout endpoint (client-side token invalidation)
- **Response**:
  ```json
  {
    "message": "Successfully logged out"
  }
  ```

#### Get Current User Info
- **URL**: `GET /auth/me`
- **Description**: Get current user's information
- **Requires**: Authentication
- **Response**:
  ```json
  {
    "access_token": "",
    "refresh_token": "",
    "user_id": 123,
    "role": "CITIZEN",
    "name": "John Doe"
  }
  ```

### Security Features

1. **JWT Tokens**: Uses JSON Web Tokens for stateless authentication
2. **Access/Refresh Token Separation**: Short-lived access tokens (60 minutes) and long-lived refresh tokens (7 days)
3. **Password Security**: Bcrypt hashing for password storage
4. **Token Validation**: Middleware validates tokens on protected routes
5. **Role Information**: Tokens contain user role for authorization decisions
6. **Active Status Check**: Verifies user account is active during authentication

## RBAC System

### Role Hierarchy

The system implements a role hierarchy where higher roles inherit permissions from lower roles:

```
THIRD_PARTY (standalone)
HEALTH_WORKER (inherits basic CITIZEN permissions)
CITIZEN (base role)
REGISTRATION_OFFICER (inherits CITIZEN permissions)
REGISTRAR (inherits RO permissions)
SUPERVISOR (inherits REGISTRAR permissions)
```

### Permissions

Permissions are fine-grained and assigned to roles. Key permissions include:

#### Citizen Permissions
- `citizen:read_own_profile` - Read own profile
- `citizen:update_own_profile` - Update own profile
- `citizen:read_own_biometrics` - Read own biometric data
- `citizen:read_digital_id` - Read digital ID payload
- `citizen:read_family_tree` - Read family tree
- `citizen:create_family_link` - Create family links

#### Registration Officer Permissions
- `ro:read_pending_enrollments` - View pending enrollment requests
- `ro:review_enrollment` - Review enrollment requests
- `ro:approve_enrollment` - Approve enrollment requests
- `ro:reject_enrollment` - Reject enrollment requests
- `ro:read_citizen_profile` - Read citizen profiles
- `ro:capture_biometrics` - Capture biometric data

#### Registrar Permissions
- `registrar:read_all_citizens` - Read all citizen profiles
- `registrar:read_all_enrollments` - Read all enrollment requests
- `registrar:manage_ros` - Manage Registration Officers
- `registrar:system_settings` - Modify system settings

#### Supervisor Permissions
- `supervisor:read_audit_logs` - Read audit logs
- `supervisor:read_transactions` - Read transaction data
- `supervisor:system_overview` - Get system overview statistics

#### Health Worker Permissions
- `health_worker:read_citizen_health_data` - Read citizen health data
- `health_worker:update_citizen_health_data` - Update citizen health data

#### Third Party Permissions
- `third_party:initiate_transaction` - Initiate transactions
- `third_party:read_own_transactions` - Read own transactions
- `third_party:verify_citizen_id` - Verify citizen identity

### Implementation

The RBAC system is implemented in `/Backend/Utils/rbac.py` and provides:

1. **Permission Enum**: Strongly-typed permission definitions
2. **Role-Permission Mapping**: Defines which permissions each role has
3. **Helper Functions**:
   - `get_user_permissions(role)`: Get permissions for a role
   - `has_permission(user_role, permission)`: Check if role has permission
   - `get_permission_dependency(required_permission)`: FastAPI dependency for endpoint protection
   - `get_current_user_role(request)`: Extract role from request
   - `get_current_user_id(request)`: Extract user ID from request

### Usage in Routers

To protect an endpoint with RBAC:

```python
from Utils.rbac import get_permission_dependency, Permission

@router.get("/admin/stats")
async def get_admin_stats(
    current_user: dict = Depends(get_permission_dependency(Permission.SUPERVISOR_SYSTEM_OVERVIEW))
):
    # Only SUPERVISOR role can access this endpoint
    return {"stats": "system_data"}
```

### Protected Endpoints Example

In the enhanced auth router (`/Backend/routers/auth.py`):

- `/auth/refresh`: Requires `citizen:read_own_profile` (any authenticated user)
- `/auth/logout`: Requires `citizen:read_own_profile` (any authenticated user)
- `/auth/me`: Requires `citizen:read_own_profile` (any authenticated user)
- `/auth/admin/stats`: Requires `supervisor:system_overview` (SUPERVISOR only)
- `/auth/ro/pending-enrollments`: Requires `ro:read_pending_enrollments` (RO and higher)

## Middleware

The authentication middleware (`/Backend/middleware/auth.py`):

1. Extracts JWT token from Authorization header
2. Validates token signature and expiration
3. Checks token type (must be "access")
4. Attaches user information to `request.state.user`
5. Allows public routes to bypass authentication:
   - `/docs`
   - `/openapi.json`
   - `/auth/login`
   - `/auth/refresh`
   - `/auth/logout`

## Integration

The system integrates with:

1. **Django Models**: Uses `SystemUser` model from `admin_ops` app
2. **Existing Auth Utilities**: Leverages password verification and token creation from `Utils/auth.py`
3. **FastAPI Framework**: Uses FastAPI's dependency injection system for clean endpoint protection
4. **CORS Middleware**: Configured to allow cross-origin requests

## Configuration

Environment variables used:
- `JWT_SECRET`: Secret key for JWT signing
- `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`: Access token expiry (default: 60)
- `JWT_REFRESH_TOKEN_EXPIRE_DAYS`: Refresh token expiry (default: 7)
- `BIOMETRIC_SALT`: Salt for biometric DIN generation
- `BIOMETRIC_CLEAR_THRESHOLD`: Biometric deduplication clear threshold (default: 0.75)
- `BIOMETRIC_DUPLICATE_THRESHOLD`: Biometric deduplication duplicate threshold (default: 0.88)

## Testing

Endpoints can be tested using:
1. Login to get tokens
2. Use access token in Authorization header as `Bearer <token>`
3. Access protected endpoints based on user role
4. Refresh tokens when access tokens expire

## Extending the System

To add new permissions:
1. Add permission to `Permission` enum in `Utils/rbac.py`
2. Add permission to appropriate role(s) in `ROLE_PERMISSIONS`
3. Use `get_permission_dependency(Permission.NEW_PERMISSION)` to protect endpoints

To add new roles:
1. Add role to `UserRole` enum in `admin_ops/models.py`
2. Add role to `ROLE_PERMISSIONS` mapping in `Utils/rbac.py`
3. Define appropriate permissions for the role

## Notes

- The stateless nature of JWT means logout is handled client-side by discarding tokens
- Token blacklisting could be added in the future for immediate token invalidation
- Permissions follow the principle of least privilege
- Role inheritance reduces permission assignment complexity
- All password handling uses secure bcrypt hashing