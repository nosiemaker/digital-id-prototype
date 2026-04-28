from rest_framework.serializers import ModelSerializer
from hospital.models import MedicalCertificateCauseOfDeath, DeathRecords, BirthRecords, NoticeOfDeath, NoticeOfBirth, RecordOfBirth, BurialPermit, DeathCertificate, BirthCertificate


class MedicalCertificateCauseOfDeathSerializer(ModelSerializer):
    class Meta:
        model = MedicalCertificateCauseOfDeath
        fields = "__all__"

class NoticeOfDeathSerializer(ModelSerializer):
    class Meta:
        model = NoticeOfDeath
        fields = "__all__"

class BurialPermitSerializer(ModelSerializer):
    class Meta:
        model = BurialPermit
        fields = "__all__"

class DeathCertificateSerializer(ModelSerializer):
    class Meta:
        model = DeathCertificate
        fields = "__all__"

class BirthCertificateSerializer(ModelSerializer):
    class Meta:
        model = BirthCertificate
        fields = "__all__"

class BirthRecordRequestSerializer(ModelSerializer):
    class Meta:
        model = BirthRecords
        fields = "__all__"

class DeathRecordRequestSerializer(ModelSerializer):
    class Meta:
        model = DeathRecords
        fields = "__all__"

class NoticeOfBirthSerializer(ModelSerializer):
    class Meta:
        model = NoticeOfBirth
        fields = "__all__"

class RecordOfBirthSerializer(ModelSerializer):
    class Meta:
        model = RecordOfBirth
        fields = "__all__"