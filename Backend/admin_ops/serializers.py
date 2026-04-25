from rest_framework.serializers import ModelSerializer
from admin_ops.models import SystemUser,ThirdPartyEnrollmentRequest
from kyc.models import ThirdPartyInstitution

class SystemUserSerializer(ModelSerializer):
    class Meta:
        model = SystemUser
        fields = "__all__"

class ThirdPartyInstitutionSerializer(ModelSerializer):
    class Meta:
        model = ThirdPartyInstitution
        fields = "__all__"

class ThirdPartyEnrollmentRequestSerializer(ModelSerializer):
    class Meta:
        model = ThirdPartyEnrollmentRequest
        fields = "__all__"