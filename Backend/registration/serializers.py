from rest_framework.serializers import ModelSerializer
from registration.models import EnrollmentRequest


class CitizenRegistrationRequestSerializer(ModelSerializer):
    class Meta:
        model = EnrollmentRequest
        fields = "__all__"

