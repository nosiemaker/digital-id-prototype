from rest_framework.serializers import ModelSerializer
from admin_ops.models import SystemUser,ThirdPartyEnrollmentRequest
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
        fields = ["id", "name", "reg_number", "institution_id", "email", "status", "permitted_scope"]

class ThirdPartyEnrollmentRequestSerializer(ModelSerializer):
    class Meta:
        model = ThirdPartyEnrollmentRequest
        fields = "__all__"