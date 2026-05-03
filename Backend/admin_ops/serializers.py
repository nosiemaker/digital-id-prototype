from rest_framework.serializers import ModelSerializer, SerializerMethodField
from admin_ops.models import SystemUser, ThirdPartyEnrollmentRequest
from kyc.models import ThirdPartyInstitution
from rest_framework import serializers

class SystemUserSerializer(ModelSerializer):
    role = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = SystemUser
        exclude = ["password", "otp_code", "otp_expires_at"]

class ThirdPartyInstitutionSerializer(ModelSerializer):
    class Meta:
        model = ThirdPartyInstitution
        fields = ["id", "name", "reg_number", "institution_id", "email", "phone", "institution_type", "purpose", "status", "permitted_scope"]

class ThirdPartyEnrollmentRequestSerializer(ModelSerializer):
    third_party_institution_details = SerializerMethodField()
    
    class Meta:
        model = ThirdPartyEnrollmentRequest
        fields = [
            "id", 
            "third_party_institution", 
            "third_party_institution_details", 
            "submitted_at", 
            "reviewed_at", 
            "status", 
            "rejection_reason"
        ]

    def get_third_party_institution_details(self, obj):
        if obj.third_party_institution:
            return ThirdPartyInstitutionSerializer(obj.third_party_institution).data
        return None