"""
Role-Based Access Control (RBAC) utilities for the ZDID system.
Defines permissions and role-based access checks.
"""

from enum import Enum
from typing import Set
from fastapi import HTTPException, status
from starlette.requests import Request


class Permission(str, Enum):
    """System permissions"""

    # Citizen permissions
    CITIZEN_READ_OWN_PROFILE = "citizen:read_own_profile"
    CITIZEN_UPDATE_OWN_PROFILE = "citizen:update_own_profile"
    CITIZEN_READ_OWN_BIOMETRICS = "citizen:read_own_biometrics"
    CITIZEN_READ_DIGITAL_ID = "citizen:read_digital_id"
    CITIZEN_READ_FAMILY_TREE = "citizen:read_family_tree"
    CITIZEN_CREATE_FAMILY_LINK = "citizen:create_family_link"

    # Registration Officer permissions
    RO_READ_PENDING_ENROLLMENTS = "ro:read_pending_enrollments"
    RO_REVIEW_ENROLLMENT = "ro:review_enrollment"
    RO_APPROVE_ENROLLMENT = "ro:approve_enrollment"
    RO_REJECT_ENROLLMENT = "ro:reject_enrollment"
    RO_READ_CITIZEN_PROFILE = "ro:read_citizen_profile"
    RO_CAPTURE_BIOMETRICS = "ro:capture_biometrics"

    # Registrar/Supervisor permissions
    REGISTRAR_READ_ALL_CITIZENS = "registrar:read_all_citizens"
    REGISTRAR_READ_ALL_ENROLLMENTS = "registrar:read_all_enrollments"
    REGISTRAR_MANAGE_ROS = "registrar:manage_ros"
    REGISTRAR_SYSTEM_SETTINGS = "registrar:system_settings"

    # Supervisor permissions (includes registrar + more)
    SUPERVISOR_READ_AUDIT_LOGS = "supervisor:read_audit_logs"
    SUPERVISOR_READ_TRANSACTIONS = "supervisor:read_transactions"
    SUPERVISOR_SYSTEM_OVERVIEW = "supervisor:system_overview"

    # Health Worker permissions
    HEALTH_WORKER_READ_CITIZEN_HEALTH_DATA = "health_worker:read_citizen_health_data"
    HEALTH_WORKER_UPDATE_CITIZEN_HEALTH_DATA = (
        "health_worker:update_citizen_health_data"
    )

    # Third Party permissions
    THIRD_PARTY_INITIATE_TRANSACTION = "third_party:initiate_transaction"
    THIRD_PARTY_READ_OWN_TRANSACTIONS = "third_party:read_own_transactions"
    THIRD_PARTY_VERIFY_CITIZEN_ID = "third_party:verify_citizen_id"


# Role to permissions mapping
ROLE_PERMISSIONS = {
    "CITIZEN": {
        Permission.CITIZEN_READ_OWN_PROFILE,
        Permission.CITIZEN_UPDATE_OWN_PROFILE,
        Permission.CITIZEN_READ_OWN_BIOMETRICS,
        Permission.CITIZEN_READ_DIGITAL_ID,
        Permission.CITIZEN_READ_FAMILY_TREE,
        Permission.CITIZEN_CREATE_FAMILY_LINK,
    },
    "REGISTRATION_OFFICER": {
        Permission.RO_READ_PENDING_ENROLLMENTS,
        Permission.RO_REVIEW_ENROLLMENT,
        Permission.RO_APPROVE_ENROLLMENT,
        Permission.RO_REJECT_ENROLLMENT,
        Permission.RO_READ_CITIZEN_PROFILE,
        Permission.RO_CAPTURE_BIOMETRICS,
        # Inherit citizen permissions
        Permission.CITIZEN_READ_OWN_PROFILE,
        Permission.CITIZEN_UPDATE_OWN_PROFILE,
        Permission.CITIZEN_READ_OWN_BIOMETRICS,
        Permission.CITIZEN_READ_DIGITAL_ID,
        Permission.CITIZEN_READ_FAMILY_TREE,
        Permission.CITIZEN_CREATE_FAMILY_LINK,
    },
    "REGISTRAR": {
        Permission.REGISTRAR_READ_ALL_CITIZENS,
        Permission.REGISTRAR_READ_ALL_ENROLLMENTS,
        Permission.REGISTRAR_MANAGE_ROS,
        Permission.REGISTRAR_SYSTEM_SETTINGS,
        # Inherit RO permissions
        Permission.RO_READ_PENDING_ENROLLMENTS,
        Permission.RO_REVIEW_ENROLLMENT,
        Permission.RO_APPROVE_ENROLLMENT,
        Permission.RO_REJECT_ENROLLMENT,
        Permission.RO_READ_CITIZEN_PROFILE,
        Permission.RO_CAPTURE_BIOMETRICS,
        # Inherit citizen permissions
        Permission.CITIZEN_READ_OWN_PROFILE,
        Permission.CITIZEN_UPDATE_OWN_PROFILE,
        Permission.CITIZEN_READ_OWN_BIOMETRICS,
        Permission.CITIZEN_READ_DIGITAL_ID,
        Permission.CITIZEN_READ_FAMILY_TREE,
        Permission.CITIZEN_CREATE_FAMILY_LINK,
    },
    "SUPERVISOR": {
        Permission.SUPERVISOR_READ_AUDIT_LOGS,
        Permission.SUPERVISOR_READ_TRANSACTIONS,
        Permission.SUPERVISOR_SYSTEM_OVERVIEW,
        # Inherit registrar permissions
        Permission.REGISTRAR_READ_ALL_CITIZENS,
        Permission.REGISTRAR_READ_ALL_ENROLLMENTS,
        Permission.REGISTRAR_MANAGE_ROS,
        Permission.REGISTRAR_SYSTEM_SETTINGS,
        # Inherit RO permissions
        Permission.RO_READ_PENDING_ENROLLMENTS,
        Permission.RO_REVIEW_ENROLLMENT,
        Permission.RO_APPROVE_ENROLLMENT,
        Permission.RO_REJECT_ENROLLMENT,
        Permission.RO_READ_CITIZEN_PROFILE,
        Permission.RO_CAPTURE_BIOMETRICS,
        # Inherit citizen permissions
        Permission.CITIZEN_READ_OWN_PROFILE,
        Permission.CITIZEN_UPDATE_OWN_PROFILE,
        Permission.CITIZEN_READ_OWN_BIOMETRICS,
        Permission.CITIZEN_READ_DIGITAL_ID,
        Permission.CITIZEN_READ_FAMILY_TREE,
        Permission.CITIZEN_CREATE_FAMILY_LINK,
    },
    "HEALTH_WORKER": {
        Permission.HEALTH_WORKER_READ_CITIZEN_HEALTH_DATA,
        Permission.HEALTH_WORKER_UPDATE_CITIZEN_HEALTH_DATA,
        # Inherit citizen permissions for their own data
        Permission.CITIZEN_READ_OWN_PROFILE,
        Permission.CITIZEN_UPDATE_OWN_PROFILE,
        Permission.CITIZEN_READ_OWN_BIOMETRICS,
        Permission.CITIZEN_READ_DIGITAL_ID,
        Permission.CITIZEN_READ_FAMILY_TREE,
        Permission.CITIZEN_CREATE_FAMILY_LINK,
    },
    "THIRD_PARTY": {
        Permission.THIRD_PARTY_INITIATE_TRANSACTION,
        Permission.THIRD_PARTY_READ_OWN_TRANSACTIONS,
        Permission.THIRD_PARTY_VERIFY_CITIZEN_ID,
    },
}


def get_user_permissions(role: str) -> Set[Permission]:
    """
    Get all permissions for a given role.

    Args:
        role: User role string

    Returns:
        Set of Permission enums
    """
    role_map = {"RO": "REGISTRATION_OFFICER"}
    normalized_role = role_map.get(role, role)
    return ROLE_PERMISSIONS.get(normalized_role, set())


def has_permission(user_role: str, permission: Permission) -> bool:
    """
    Check if a user role has a specific permission.

    Args:
        user_role: User's role
        permission: Permission to check

    Returns:
        True if role has permission, False otherwise
    """
    user_permissions = get_user_permissions(user_role)
    return permission in user_permissions


def get_permission_dependency(required_permission: Permission):
    """
    Create a FastAPI dependency that checks for a specific permission.

    Args:
        required_permission: Permission required to access the endpoint

    Returns:
        Dependency function
    """

    def permission_checker(request: Request):
        # Get user from request state (set by auth middleware)
        user = getattr(request.state, "user", None)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
            )

        user_role = user.get("role")
        if not user_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="User role not found"
            )

        if not has_permission(user_role, required_permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required: {required_permission.value}",
            )

        return user

    return permission_checker


def get_current_user_role(request: Request) -> str:
    """
    Extract user role from request state.

    Args:
        request: FastAPI request object

    Returns:
        User role string

    Raises:
        HTTPException: If user not authenticated or role not found
    """
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )

    user_role = user.get("role")
    if not user_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User role not found"
        )

    return user_role


def get_current_user_id(request: Request) -> int:
    """
    Extract user ID from request state.

    Args:
        request: FastAPI request object

    Returns:
        User ID integer

    Raises:
        HTTPException: If user not authenticated or ID not found
    """
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )

    user_id = user.get("id")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User ID not found"
        )

    return int(user_id)
