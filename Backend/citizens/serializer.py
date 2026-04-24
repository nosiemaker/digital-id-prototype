from rest_framework.serializers import ModelSerializer

from citizens.models import Citizen


class CitizenSerializer(ModelSerializer):
    class Meta:
        model = Citizen
        fields = "__all__"
