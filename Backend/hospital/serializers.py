from rest_framework.serializers import ModelSerializer
from hospital.models import DeathRecord, BirthRecord, DeathRecordSubmissions, BirthRecordSubmissions


class BirthRecordSerializer(ModelSerializer):
    class Meta:
        model = BirthRecord
        fields = "__all__"

class DeathRecordSerializer(ModelSerializer):
    class Meta:
        model = DeathRecord
        fields = "__all__"

class BirthRecordRequestSerializer(ModelSerializer):
    class Meta:
        model = BirthRecordSubmissions
        fields = "__all__"

class DeathRecordRequestSerializer(ModelSerializer):
    class Meta:
        model = DeathRecordSubmissions
        fields = "__all__"