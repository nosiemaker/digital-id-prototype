from rest_framework.serializers import ModelSerializer

from citizens.models import Citizen


class CitizenSerializer(ModelSerializer):
    class Meta:
        model = Citizen
        exclude = ["public_key"]
        depth = 2
