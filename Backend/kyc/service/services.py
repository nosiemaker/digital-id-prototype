"""
KYC Service Layer for Third-Party Identity Gateway and Administrative Statistics Hub
Handles selective data sharing and demographic analytics.
"""
from typing import Any
from django.utils import timezone
from django.db.models import Count, Q
from citizens.models import Citizen, CitizenStatus, Gender, Province
from ..models import KYCRequest, ConsentRecord, ThirdPartyInstitution, KYCRequestStatus
import logging

logger = logging.getLogger(__name__)


class KYCService:
    """Service for handling KYC requests and selective data disclosure."""

    @staticmethod
    def filter_citizen_data(citizen: Citizen, fields_requested: list[str]) -> dict[str, Any]:
        """
        Filter citizen data to only return requested fields.
        Implements selective data sharing to prevent over-disclosure.
        
        Args:
            citizen: Citizen model instance
            fields_requested: List of field names to return
            
        Returns:
            Dictionary containing only the requested fields
        """
        # Define available fields that can be shared
        available_fields = {
            'full_name': citizen.full_name,
            'dob': citizen.dob.isoformat() if citizen.dob else None,
            'phone': citizen.phone,
            'nrc': citizen.nrc,
            'din': citizen.din,
            'gender': citizen.gender,
            'province': citizen.province,
            'status': citizen.status,
            'language': citizen.language,
            'created_at': citizen.created_at.isoformat() if citizen.created_at else None,
            'updated_at': citizen.updated_at.isoformat() if citizen.updated_at else None,
        }
        
        # Filter to only requested fields that are available
        filtered_data = {}
        for field in fields_requested:
            if field in available_fields:
                filtered_data[field] = available_fields[field]
            else:
                logger.warning(f"Requested field '{field}' is not available for sharing")
                
        return filtered_data

    @staticmethod
    def create_kyc_request(institution_id: int, citizen_din: str, fields_requested: list[str]) -> KYCRequest:
        """
        Create a new KYC request from a third-party institution.
        
        Args:
            institution_id: ID of the ThirdPartyInstitution
            citizen_din: DIN of the citizen
            fields_requested: List of fields the institution is requesting
            
        Returns:
            Created KYCRequest instance
        """
        try:
            institution = ThirdPartyInstitution.objects.get(id=institution_id)
            citizen = Citizen.objects.get(din=citizen_din)
            
            kyc_request = KYCRequest.objects.create(
                institution=institution,
                citizen_din=citizen_din,
                citizen=citizen,
                fields_requested=fields_requested,
                status=KYCRequestStatus.PENDING
            )
            
            logger.info(f"KYC request created: {institution.name} -> {citizen_din}")
            return kyc_request
            
        except ThirdPartyInstitution.DoesNotExist:
            logger.error(f"Institution with ID {institution_id} not found")
            raise
        except Citizen.DoesNotExist:
            logger.error(f"Citizen with DIN {citizen_din} not found")
            raise

    @staticmethod
    def process_citizen_response(kyc_request_id: int, decision: str, citizen_id: int) -> ConsentRecord:
        """
        Process citizen's approval/denial of a KYC request.
        
        Args:
            kyc_request_id: ID of the KYCRequest
            decision: Either 'APPROVED' or 'DENIED'
            citizen_id: ID of the citizen making the decision
            
        Returns:
            Created ConsentRecord instance
        """
        try:
            kyc_request = KYCRequest.objects.get(id=kyc_request_id)
            citizen = Citizen.objects.get(id=citizen_id)
            
            # Verify the citizen matches the request
            if kyc_request.citizen != citizen:
                raise ValueError("Citizen does not match KYC request")
                
            # Update the KYC request
            kyc_request.status = KYCRequestStatus.APPROVED if decision == 'APPROVED' else KYCRequestStatus.DENIED
            kyc_request.responded_at = timezone.now()
            
            if decision == 'APPROVED':
                # Citizen approved - grant the requested fields
                kyc_request.fields_granted = kyc_request.fields_requested
            else:
                # Citizen denied - no fields granted
                kyc_request.fields_granted = []
                
            kyc_request.save()
            
            # Create immutable consent record
            consent_record = ConsentRecord.objects.create(
                kyc_request=kyc_request,
                citizen=citizen,
                decision=decision,
                fields_shared=kyc_request.fields_granted if decision == 'APPROVED' else None
            )
            
            logger.info(f"Citizen {citizen.din} {decision} KYC request {kyc_request_id}")
            return consent_record
            
        except KYCRequest.DoesNotExist:
            logger.error(f"KYC request with ID {kyc_request_id} not found")
            raise
        except Citizen.DoesNotExist:
            logger.error(f"Citizen with ID {citizen_id} not found")
            raise


class StatisticsService:
    """Service for calculating demographic analytics and KYC metrics."""

    @staticmethod
    def get_total_registered_citizens() -> int:
        """Get total number of registered citizens."""
        return Citizen.objects.count()

    @staticmethod
    def get_live_births_vs_deaths() -> dict[str, int]:
        """
        Calculate live births vs recorded deaths using a single aggregated query.
        Using status field: ACTIVE = live births, DECEASED = recorded deaths.
        
        INTEGRATION EXAMPLE:
        When a Death Record is approved by an RO, the citizen's status is updated:
            citizen.status = CitizenStatus.DECEASED
            citizen.save()
        This method automatically reflects the change because it queries in real-time.
        """
        stats = Citizen.objects.aggregate(
            live_births=Count('id', filter=Q(status=CitizenStatus.ACTIVE)),
            recorded_deaths=Count('id', filter=Q(status=CitizenStatus.DECEASED))
        )
        
        return {
            'live_births': stats['live_births'],
            'recorded_deaths': stats['recorded_deaths']
        }

    @staticmethod
    def get_gender_ratio() -> dict[str, Any]:
        """
        Calculate male-to-female ratio across entire population.
        Uses Django aggregates for efficiency.
        
        Returns:
            Dictionary with male_count, female_count, ratio, and total
        """
        stats = Citizen.objects.aggregate(
            male_count=Count('id', filter=Q(gender=Gender.MALE)),
            female_count=Count('id', filter=Q(gender=Gender.FEMALE)),
            other_count=Count('id', filter=Q(gender=Gender.OTHER))
        )
        
        total = Citizen.objects.count()
        
        # Calculate ratio: male-to-female
        ratio = (
            stats['male_count'] / stats['female_count'] 
            if stats['female_count'] > 0 
            else 0.0
        )
        
        return {
            'male_count': stats['male_count'],
            'female_count': stats['female_count'],
            'other_count': stats['other_count'],
            'ratio': round(ratio, 2),
            'total': total,
            'male_percentage': round((stats['male_count'] / total * 100), 2) if total > 0 else 0.0,
            'female_percentage': round((stats['female_count'] / total * 100), 2) if total > 0 else 0.0,
        }

    @staticmethod
    def get_regional_breakdown() -> list[dict[str, Any]]:
        """
        Group population by Zambia's 10 provinces using Django aggregates.
        
        Returns:
            List of dictionaries with province name, registered count, and percentage
        """
        # Get total for percentage calculations
        total_citizens = Citizen.objects.count()
        
        if total_citizens == 0:
            # Return structure with all provinces but 0 counts
            return [
                {
                    'province_code': province_code,
                    'province_name': province_name,
                    'registered_count': 0,
                    'percentage': 0.0
                }
                for province_code, province_name in Province.choices
            ]
        
        # Query all provinces and their counts in one operation
        province_stats = Citizen.objects.values('province').annotate(
            count=Count('id')
        ).order_by('province')
        
        # Create result with all provinces (including zeros)
        province_counts = {stat['province']: stat['count'] for stat in province_stats}
        
        breakdown = []
        for province_code, province_name in Province.choices:
            count = province_counts.get(province_code, 0)
            percentage = (count / total_citizens * 100) if total_citizens > 0 else 0.0
            
            breakdown.append({
                'province_code': province_code,
                'province_name': province_name,
                'registered_count': count,
                'percentage': round(percentage, 2)
            })
        
        return breakdown

    @staticmethod
    def get_kyc_metrics() -> dict[str, Any]:
        """
        Aggregate volumes of Approved vs Denied KYC requests.
        Uses a single aggregated query for efficiency.
        
        Returns:
            Dictionary with approval counts, pending, total, and approval rate
        """
        stats = KYCRequest.objects.aggregate(
            approved_count=Count('id', filter=Q(status=KYCRequestStatus.APPROVED)),
            denied_count=Count('id', filter=Q(status=KYCRequestStatus.DENIED)),
            pending_count=Count('id', filter=Q(status=KYCRequestStatus.PENDING)),
            expired_count=Count('id', filter=Q(status=KYCRequestStatus.EXPIRED))
        )
        
        total_requests = (
            stats['approved_count'] + 
            stats['denied_count'] + 
            stats['pending_count'] + 
            stats['expired_count']
        )
        
        approval_rate = (
            (stats['approved_count'] / total_requests * 100) 
            if total_requests > 0 
            else 0.0
        )
        
        return {
            'approved': stats['approved_count'],
            'denied': stats['denied_count'],
            'pending': stats['pending_count'],
            'expired': stats['expired_count'],
            'total': total_requests,
            'approval_rate': round(approval_rate, 2)
        }