from rest_framework.serializers import ModelSerializer
from admin_ops.models import SystemUser,ThirdPartyEnrollmentRequest
from kyc.models import ThirdPartyInstitution

class SystemUserSerializer(ModelSerializer):
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