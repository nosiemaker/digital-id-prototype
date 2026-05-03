# user_management.py
# Service layer for system user and third-party institution management.
# Handles creation and activation of system users, third-party institution
# enrollment requests, and role/permission management for existing users.

import datetime
import secrets
import string
from django.db import transaction
from fastapi import HTTPException
from rest_framework import status

from Utils.audit_logger import audit
from Utils.auth import hash_password
from admin_ops.models import SystemUser, ThirdPartyEnrollmentRequest
from admin_ops.serializers import (
    SystemUserSerializer,
    ThirdPartyInstitutionSerializer,
    ThirdPartyEnrollmentRequestSerializer
)
from citizens.serializer import CitizenSerializer
from citizens.utilities.id_generation import generate_id
from dependencies.auth import UserRole
from kyc.models import ThirdPartyInstitution, InstitutionStatus
from registration.models import EnrollmentStatus


def create_system_user(request_body: dict) -> dict:
    """Creates a new system user record after checking for duplicate DINs."""
    if not request_body.get("username") and request_body.get("email"):
        request_body["username"] = request_body.get("email")

    citizen_din = request_body.get("citizen_din") or request_body.get("din")
    if citizen_din and SystemUser.objects.filter(citizen_din=citizen_din).exists():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User with this Digital ID already exists")

    user_serializer = SystemUserSerializer(data=request_body)
    if not user_serializer.is_valid():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=user_serializer.errors)

    user = user_serializer.save()
    if request_body.get("password"):
        user.set_password(request_body.get("password"))
        user.save()

    return {"details": "User created successfully", "user": user_serializer.data, "status": status.HTTP_201_CREATED}


def get_user_by_din(din: str) -> dict:
    """Retrieves a system user by their citizen DIN."""
    try:
        user = SystemUser.objects.get(citizen_din=din)
    except SystemUser.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return {"details": "User found", "user": SystemUserSerializer(user).data}


def get_user_by_email(email: str) -> dict:
    """Retrieves a system user by their email address."""
    try:
        user = SystemUser.objects.get(email=email)
    except SystemUser.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return {"details": "User found", "user": SystemUserSerializer(user).data}


def activate_system_user(user_din: str) -> dict:
    """Initiates the account activation flow for a system user identified by DIN."""
    try:
        user = SystemUser.objects.get(citizen_din=user_din)
    except SystemUser.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user_serializer = SystemUserSerializer(user)
    if user_serializer.data.get("is_active"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is already active")

    token = ''.join(secrets.choice(string.digits) for _ in range(6))
    return {"token": token}


def set_system_user_password(request_body: dict) -> dict:
    """Completes the account activation by setting the user's password."""
    try:
        user = SystemUser.objects.get(citizen_din=request_body.get("citizen_din"))
    except SystemUser.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user_serializer = SystemUserSerializer(
        instance=user,
        data={
            "is_active": True,
            "password_hash": hash_password(request_body.get("password"))
        },
        partial=True
    )
    if not user_serializer.is_valid():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=user_serializer.errors)

    user_serializer.save()
    return {"details": "User Successfully Activated"}


def third_party_registration_request(request_body: dict):
    """Submits a new third-party institution enrollment request."""
    serializer = ThirdPartyInstitutionSerializer(data=request_body)
    if serializer.is_valid():
        third_party = serializer.save()
        new_request = {"third_party_institution": third_party.id}
        request_serializer = ThirdPartyEnrollmentRequestSerializer(data=new_request)
        if request_serializer.is_valid():
            request_serializer.save()
            return {"details": "Request Submitted", "request": request_serializer.data,
                    "status": status.HTTP_201_CREATED}
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=request_serializer.errors)
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=serializer.errors)


def approve_third_party_registration(request_id: int, registrar_id: int, permitted_scope: list) -> dict:
    """Approves a pending third-party institution enrollment request."""
    enrollment_request = ThirdPartyEnrollmentRequest.objects.select_related("third_party_institution").get(
        id=request_id)

    if enrollment_request.status != EnrollmentStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request is not pending")

    third_party = enrollment_request.third_party_institution
    third_party_serializer_temp = ThirdPartyInstitutionSerializer(third_party)
    institution_id = generate_id(third_party_serializer_temp.data.get("reg_number"), "THIRD_PARTY")

    try:
        ThirdPartyInstitution.objects.get(institution_id=institution_id)
        details = reject_third_party_registration(request_id, registrar_id, "Institution Already Registered")
        third_party.delete()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=details)
    except ThirdPartyInstitution.DoesNotExist:
        pass

    with transaction.atomic():
        enrollment_serializer = ThirdPartyEnrollmentRequestSerializer(
            instance=enrollment_request,
            data={"status": EnrollmentStatus.APPROVED, "registrar": registrar_id,
                  "reviewed_at": datetime.datetime.now()},
            partial=True
        )
        if not enrollment_serializer.is_valid():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=enrollment_serializer.errors)
        enrollment_serializer.save()

        third_party_serializer = ThirdPartyInstitutionSerializer(
            instance=third_party,
            data={"institution_id": institution_id, "enrolled_by": registrar_id, "status": InstitutionStatus.ACTIVE,
                  "permitted_scope": permitted_scope},
            partial=True
        )
        if not third_party_serializer.is_valid():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=third_party_serializer.errors)
        third_party_serializer.save()

        create_system_user({
            "role": UserRole.THIRD_PARTY,
            "email": third_party.email,
            "name": third_party.name,
            "institution_din": third_party.institution_id,
            "password": "password123."
        })
        audit.third_party_enrollment_approved(registrar_id, enrollment_serializer.data['id'],
                                              enrollment_serializer.data)

    return {"details": "Approval Successful", "request": enrollment_serializer.data, "status": status.HTTP_200_OK}


def reject_third_party_registration(request_id: int, registrar_id: int, rejection_reason: str) -> dict:
    """Rejects a pending third-party institution enrollment request."""
    try:
        enrollment_request = ThirdPartyEnrollmentRequest.objects.select_related("third_party_institution").get(
            id=request_id)
    except ThirdPartyEnrollmentRequest.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request Is Not Found")

    if enrollment_request.status != EnrollmentStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request Is Not Pending")

    third_party = enrollment_request.third_party_institution

    with transaction.atomic():
        serializer = ThirdPartyEnrollmentRequestSerializer(
            instance=enrollment_request,
            data={"status": EnrollmentStatus.REJECTED, "registrar": registrar_id,
                  "reviewed_at": datetime.datetime.now(), "rejection_reason": rejection_reason},
            partial=True
        )
        if not serializer.is_valid():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=serializer.errors)
        serializer.save()

        third_party_serializer = ThirdPartyInstitutionSerializer(instance=third_party,
                                                                 data={"status": InstitutionStatus.REJECTED},
                                                                 partial=True)
        if not third_party_serializer.is_valid():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=third_party_serializer.errors)
        third_party_serializer.save()

        audit.third_party_enrollment_rejected(registrar_id, serializer.data['id'], serializer.data)

    return {"details": "Request Successfully Rejected", "request": serializer.data, "status": status.HTTP_200_OK}


def get_single_pending(request_id: int):
    pending_enrollment = ThirdPartyEnrollmentRequest.objects.get(id=request_id)
    return ThirdPartyEnrollmentRequestSerializer(pending_enrollment).data


def get_all_pending():
    pending_enrollments = ThirdPartyEnrollmentRequest.objects.filter(status=EnrollmentStatus.PENDING)
    return ThirdPartyEnrollmentRequestSerializer(pending_enrollments, many=True).data


def get_active_institutions():
    print("DEBUG: get_active_institutions called")
    active_institutions = ThirdPartyInstitution.objects.filter(status=InstitutionStatus.ACTIVE)
    print(f"DEBUG: Found {active_institutions.count()} active institutions")
    return ThirdPartyInstitutionSerializer(active_institutions, many=True).data


# =============================================================================
# Staff Role Addition Functions (Fixed: Role parsing, removed temp passwords)
# =============================================================================

def create_registration_officer(request_body: dict) -> dict:
    """Creates a new RegistrationOfficer linked to a Citizen."""
    from citizens.models import RegistrationOfficer, Citizen, District

    citizen_din = request_body.get("citizen_din")
    try:
        citizen = Citizen.objects.get(din=citizen_din)
    except Citizen.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Citizen not found")

    try:
        system_user = SystemUser.objects.get(profile__din=citizen_din)
    except SystemUser.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="System user not found for this citizen")

    # Standardized role parsing
    role_str = system_user.role or ""
    current_roles = [r.strip() for r in role_str.split(",") if r.strip()]
    if UserRole.REGISTRATION_OFFICER not in current_roles:
        current_roles.append(UserRole.REGISTRATION_OFFICER)

    serializer = SystemUserSerializer(instance=system_user, data={"role": ", ".join(current_roles)}, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()

    if RegistrationOfficer.objects.filter(user=system_user).exists():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="RegistrationOfficer already exists for this citizen")

    district = None
    if request_body.get("district_id"):
        try:
            district = District.objects.get(id=request_body["district_id"])
        except District.DoesNotExist:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="District not found")

    employee_id = request_body.get("employee_id") or f"RO-{secrets.token_hex(4).upper()}"
    officer = RegistrationOfficer.objects.create(
        user=system_user,
        employee_id=employee_id,
        station_name=request_body.get("station_name"),
        district=district,
        is_active=True
    )

    return {"details": "RegistrationOfficer created successfully", "officer_id": officer.id, "employee_id": employee_id}


def create_registrar(request_body: dict) -> dict:
    """Creates a new Registrar linked to a Citizen."""
    from citizens.models import Registrar, Citizen, District

    citizen_din = request_body.get("citizen_din")
    try:
        citizen = Citizen.objects.get(din=citizen_din)
    except Citizen.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Citizen not found")

    try:
        system_user = SystemUser.objects.get(profile__din=citizen_din)
    except SystemUser.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="System user not found for this citizen")

    role_str = system_user.role or ""
    current_roles = [r.strip() for r in role_str.split(",") if r.strip()]
    if UserRole.REGISTRAR not in current_roles:
        current_roles.append(UserRole.REGISTRAR)

    serializer = SystemUserSerializer(instance=system_user, data={"role": ", ".join(current_roles)}, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()

    if Registrar.objects.filter(citizen=citizen).exists():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Registrar already exists for this citizen")

    district = None
    if request_body.get("district_id"):
        try:
            district = District.objects.get(id=request_body["district_id"])
        except District.DoesNotExist:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="District not found")

    registrar = Registrar.objects.create(
        citizen=citizen,
        employee_id=request_body.get("employee_id"),
        department=request_body.get("department"),
        district=district,
        is_active=True
    )

    return {"details": "Registrar created successfully", "registrar_id": registrar.id,
            "employee_id": registrar.employee_id}


def create_supervisor(request_body: dict) -> dict:
    """Creates a new Supervisor linked to a Citizen."""
    from citizens.models import Supervisor, Citizen, District

    citizen_din = request_body.get("citizen_din")
    try:
        citizen = Citizen.objects.get(din=citizen_din)
    except Citizen.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Citizen not found")

    try:
        system_user = SystemUser.objects.get(profile__din=citizen_din)
    except SystemUser.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="System user not found for this citizen")

    role_str = system_user.role or ""
    current_roles = [r.strip() for r in role_str.split(",") if r.strip()]
    if UserRole.SUPERVISOR not in current_roles:
        current_roles.append(UserRole.SUPERVISOR)

    serializer = SystemUserSerializer(instance=system_user, data={"role": ", ".join(current_roles)}, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()

    if Supervisor.objects.filter(citizen=citizen).exists():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Supervisor already exists for this citizen")

    district = None
    if request_body.get("district_id"):
        try:
            district = District.objects.get(id=request_body["district_id"])
        except District.DoesNotExist:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="District not found")

    supervisor = Supervisor.objects.create(
        citizen=citizen,
        employee_id=request_body.get("employee_id"),
        department=request_body.get("department"),
        district=district,
        is_active=True
    )

    return {"details": "Supervisor created successfully", "supervisor_id": supervisor.id,
            "employee_id": supervisor.employee_id}


def create_health_worker(request_body: dict) -> dict:
    """Creates a new HealthWorker linked to a Citizen."""
    from citizens.models import HealthWorker, Citizen

    citizen_din = request_body.get("citizen_din")
    try:
        citizen = Citizen.objects.get(din=citizen_din)
    except Citizen.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Citizen not found")

    try:
        system_user = SystemUser.objects.get(profile__din=citizen_din)
    except SystemUser.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="System user not found for this citizen")

    role_str = system_user.role or ""
    current_roles = [r.strip() for r in role_str.split(",") if r.strip()]
    if UserRole.HEALTH_WORKER not in current_roles:
        current_roles.append(UserRole.HEALTH_WORKER)

    serializer = SystemUserSerializer(instance=system_user, data={"role": ", ".join(current_roles)}, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()

    if HealthWorker.objects.filter(user=system_user).exists():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="HealthWorker already exists for this citizen")

    employee_id = request_body.get("employee_id") or f"HW-{secrets.token_hex(4).upper()}"
    health_worker = HealthWorker.objects.create(
        user=system_user,
        employee_id=employee_id,
        facility_name=request_body.get("facility_name"),
        department=request_body.get("department"),
        is_active=True
    )

    # Temp password generation & email thread REMOVED as requested

    return {"details": "HealthWorker created successfully", "health_worker_id": health_worker.id,
            "employee_id": employee_id}


# =============================================================================
# Staff Role Removal Functions
# =============================================================================

def remove_registration_officer(request_body: dict) -> dict:
    """Removes the RegistrationOfficer role and deactivates the instance."""
    from citizens.models import RegistrationOfficer, Citizen

    citizen_din = request_body.get("citizen_din")
    try:
        citizen = Citizen.objects.get(din=citizen_din)
    except Citizen.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Citizen not found")

    try:
        system_user = SystemUser.objects.get(profile__din=citizen_din)
    except SystemUser.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="System user not found for this citizen")

    role_str = system_user.role or ""
    current_roles = [r.strip() for r in role_str.split(",") if r.strip()]
    if UserRole.REGISTRATION_OFFICER not in current_roles:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Citizen does not have the RegistrationOfficer role")

    updated_perms = ", ".join([p for p in current_roles if p != UserRole.REGISTRATION_OFFICER])
    serializer = SystemUserSerializer(instance=system_user, data={"role": updated_perms}, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()

    try:
        officer = RegistrationOfficer.objects.get(user=system_user)
    except RegistrationOfficer.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="RegistrationOfficer record not found for this citizen")

    officer.is_active = False
    officer.save()

    return {"details": "RegistrationOfficer role removed successfully", "officer_id": officer.id,
            "employee_id": officer.employee_id}


def remove_registrar(request_body: dict) -> dict:
    """Removes the Registrar role and deactivates the instance."""
    from citizens.models import Registrar, Citizen

    citizen_din = request_body.get("citizen_din")
    try:
        citizen = Citizen.objects.get(din=citizen_din)
    except Citizen.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Citizen not found")

    try:
        system_user = SystemUser.objects.get(profile__din=citizen_din)
    except SystemUser.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="System user not found for this citizen")

    role_str = system_user.role or ""
    current_roles = [r.strip() for r in role_str.split(",") if r.strip()]
    if UserRole.REGISTRAR not in current_roles:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Citizen does not have the Registrar role")

    updated_perms = ", ".join([p for p in current_roles if p != UserRole.REGISTRAR])
    serializer = SystemUserSerializer(instance=system_user, data={"role": updated_perms}, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()

    try:
        registrar = Registrar.objects.get(citizen=citizen)
    except Registrar.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registrar record not found for this citizen")

    registrar.is_active = False
    registrar.save()

    return {"details": "Registrar role removed successfully", "registrar_id": registrar.id,
            "employee_id": registrar.employee_id}


def remove_supervisor(request_body: dict) -> dict:
    """Removes the Supervisor role and deactivates the instance."""
    from citizens.models import Supervisor, Citizen

    citizen_din = request_body.get("citizen_din")
    try:
        citizen = Citizen.objects.get(din=citizen_din)
    except Citizen.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Citizen not found")

    try:
        system_user = SystemUser.objects.get(profile__din=citizen_din)
    except SystemUser.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="System user not found for this citizen")

    role_str = system_user.role or ""
    current_roles = [r.strip() for r in role_str.split(",") if r.strip()]
    if UserRole.SUPERVISOR not in current_roles:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Citizen does not have the Supervisor role")

    updated_perms = ", ".join([p for p in current_roles if p != UserRole.SUPERVISOR])
    serializer = SystemUserSerializer(instance=system_user, data={"role": updated_perms}, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()

    try:
        supervisor = Supervisor.objects.get(citizen=citizen)
    except Supervisor.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Supervisor record not found for this citizen")

    supervisor.is_active = False
    supervisor.save()

    return {"details": "Supervisor role removed successfully", "supervisor_id": supervisor.id,
            "employee_id": supervisor.employee_id}


def remove_health_worker(request_body: dict) -> dict:
    """Removes the HealthWorker role and deactivates the instance."""
    from citizens.models import HealthWorker, Citizen

    citizen_din = request_body.get("citizen_din")
    try:
        citizen = Citizen.objects.get(din=citizen_din)
    except Citizen.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Citizen not found")

    try:
        system_user = SystemUser.objects.get(profile__din=citizen_din)
    except SystemUser.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="System user not found for this citizen")

    role_str = system_user.role or ""
    current_roles = [r.strip() for r in role_str.split(",") if r.strip()]
    if UserRole.HEALTH_WORKER not in current_roles:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Citizen does not have the HealthWorker role")

    updated_perms = ", ".join([p for p in current_roles if p != UserRole.HEALTH_WORKER])
    serializer = SystemUserSerializer(instance=system_user, data={"role": updated_perms}, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()

    try:
        health_worker = HealthWorker.objects.get(user=system_user)
    except HealthWorker.DoesNotExist:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="HealthWorker record not found for this citizen")

    health_worker.is_active = False
    health_worker.save()

    return {"details": "HealthWorker role removed successfully", "health_worker_id": health_worker.id,
            "employee_id": health_worker.employee_id}