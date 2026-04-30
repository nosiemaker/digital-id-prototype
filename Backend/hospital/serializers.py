from rest_framework.serializers import ModelSerializer, SerializerMethodField
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
    """
    Custom serializer for BirthRecords that includes flattened child name fields
    from the linked NoticeOfBirth for easier frontend consumption.
    """
    child_given_name = SerializerMethodField()
    child_surname = SerializerMethodField()
    child_other_names = SerializerMethodField()
    sex = SerializerMethodField()
    date_of_birth = SerializerMethodField()
    birth_weight_kg = SerializerMethodField()
    health_facility_name = SerializerMethodField()
    home_address = SerializerMethodField()
    other_place_specified = SerializerMethodField()
    attendant_at_birth = SerializerMethodField()
    attendant_other_specified = SerializerMethodField()
    marital_status = SerializerMethodField()
    mother_surname = SerializerMethodField()
    mother_other_names = SerializerMethodField()
    mother_maiden_surname = SerializerMethodField()
    father_surname = SerializerMethodField()
    father_other_names = SerializerMethodField()

    class Meta:
        model = BirthRecords
        fields = "__all__"

    def get_child_given_name(self, obj: BirthRecords) -> str | None:
        return obj.notice_of_birth.child_given_name if obj.notice_of_birth else None

    def get_child_surname(self, obj: BirthRecords) -> str | None:
        return obj.notice_of_birth.child_surname if obj.notice_of_birth else None

    def get_child_other_names(self, obj: BirthRecords) -> str | None:
        return obj.notice_of_birth.child_other_names if obj.notice_of_birth else None

    def get_sex(self, obj: BirthRecords) -> str | None:
        return obj.notice_of_birth.sex if obj.notice_of_birth else None

    def get_date_of_birth(self, obj: BirthRecords) -> str | None:
        return obj.notice_of_birth.date_of_birth.isoformat() if obj.notice_of_birth and obj.notice_of_birth.date_of_birth else None

    def get_birth_weight_kg(self, obj: BirthRecords) -> str | None:
        return str(obj.notice_of_birth.birth_weight_kg) if obj.notice_of_birth and obj.notice_of_birth.birth_weight_kg else None

    def get_health_facility_name(self, obj: BirthRecords) -> str | None:
        return obj.notice_of_birth.health_facility_name if obj.notice_of_birth else None

    def get_home_address(self, obj: BirthRecords) -> str | None:
        return obj.notice_of_birth.home_address if obj.notice_of_birth else None

    def get_other_place_specified(self, obj: BirthRecords) -> str | None:
        return obj.notice_of_birth.other_place_specified if obj.notice_of_birth else None

    def get_attendant_at_birth(self, obj: BirthRecords) -> str | None:
        return obj.notice_of_birth.attendant_at_birth if obj.notice_of_birth else None

    def get_attendant_other_specified(self, obj: BirthRecords) -> str | None:
        return obj.notice_of_birth.attendant_other_specified if obj.notice_of_birth else None

    def get_marital_status(self, obj: BirthRecords) -> str | None:
        return obj.notice_of_birth.marital_status if obj.notice_of_birth else None

    def get_mother_surname(self, obj: BirthRecords) -> str | None:
        return obj.notice_of_birth.mother_surname if obj.notice_of_birth else None

    def get_mother_other_names(self, obj: BirthRecords) -> str | None:
        return obj.notice_of_birth.mother_other_names if obj.notice_of_birth else None

    def get_mother_maiden_surname(self, obj: BirthRecords) -> str | None:
        return obj.notice_of_birth.mother_maiden_surname if obj.notice_of_birth else None

    def get_father_surname(self, obj: BirthRecords) -> str | None:
        return obj.notice_of_birth.father_surname if obj.notice_of_birth else None

    def get_father_other_names(self, obj: BirthRecords) -> str | None:
        return obj.notice_of_birth.father_other_names if obj.notice_of_birth else None


class DeathRecordRequestSerializer(ModelSerializer):
    """
    Custom serializer for DeathRecords that includes flattened deceased name fields
    from the linked NoticeOfDeath for easier frontend consumption.
    """
    deceasedName = SerializerMethodField()
    attended_name = SerializerMethodField()
    death_date = SerializerMethodField()
    cause_a = SerializerMethodField()
    cause_b = SerializerMethodField()
    cause_c = SerializerMethodField()
    other_condition_1 = SerializerMethodField()
    other_condition_2 = SerializerMethodField()
    district = SerializerMethodField()
    place_of_death = SerializerMethodField()
    place_of_death_name = SerializerMethodField()
    place_of_death_other = SerializerMethodField()
    age_at_death = SerializerMethodField()
    sex = SerializerMethodField()
    nationality = SerializerMethodField()
    informant_name = SerializerMethodField()
    informant_relationship = SerializerMethodField()

    class Meta:
        model = DeathRecords
        fields = "__all__"

    def get_deceasedName(self, obj: DeathRecords) -> str | None:
        if obj.notice_of_death:
            return f"{obj.notice_of_death.other_names or ''} {obj.notice_of_death.surname or ''}".strip() or None
        return None

    def get_attended_name(self, obj: DeathRecords) -> str | None:
        return obj.medical_certificate_of_death.attended_name if obj.medical_certificate_of_death else None

    def get_death_date(self, obj: DeathRecords) -> str | None:
        return obj.medical_certificate_of_death.death_date.isoformat() if obj.medical_certificate_of_death and obj.medical_certificate_of_death.death_date else None

    def get_cause_a(self, obj: DeathRecords) -> str | None:
        return obj.medical_certificate_of_death.cause_a if obj.medical_certificate_of_death else None

    def get_cause_b(self, obj: DeathRecords) -> str | None:
        return obj.medical_certificate_of_death.cause_b if obj.medical_certificate_of_death else None

    def get_cause_c(self, obj: DeathRecords) -> str | None:
        return obj.medical_certificate_of_death.cause_c if obj.medical_certificate_of_death else None

    def get_other_condition_1(self, obj: DeathRecords) -> str | None:
        return obj.medical_certificate_of_death.other_condition_1 if obj.medical_certificate_of_death else None

    def get_other_condition_2(self, obj: DeathRecords) -> str | None:
        return obj.medical_certificate_of_death.other_condition_2 if obj.medical_certificate_of_death else None

    def get_district(self, obj: DeathRecords) -> str | None:
        return obj.medical_certificate_of_death.district if obj.medical_certificate_of_death else None

    def get_place_of_death(self, obj: DeathRecords) -> str | None:
        return obj.notice_of_death.place_of_death if obj.notice_of_death else None

    def get_place_of_death_name(self, obj: DeathRecords) -> str | None:
        return obj.notice_of_death.place_of_death_name if obj.notice_of_death else None

    def get_place_of_death_other(self, obj: DeathRecords) -> str | None:
        return obj.notice_of_death.place_of_death_other if obj.notice_of_death else None

    def get_age_at_death(self, obj: DeathRecords) -> int | None:
        return obj.notice_of_death.age_at_death if obj.notice_of_death else None

    def get_sex(self, obj: DeathRecords) -> str | None:
        return obj.notice_of_death.sex if obj.notice_of_death else None

    def get_nationality(self, obj: DeathRecords) -> str | None:
        return obj.notice_of_death.nationality if obj.notice_of_death else None

    def get_informant_name(self, obj: DeathRecords) -> str | None:
        return obj.medical_certificate_of_death.informant_name if obj.medical_certificate_of_death else None

    def get_informant_relationship(self, obj: DeathRecords) -> str | None:
        return obj.medical_certificate_of_death.informant_relationship if obj.medical_certificate_of_death else None


class NoticeOfBirthSerializer(ModelSerializer):
    class Meta:
        model = NoticeOfBirth
        fields = "__all__"


class RecordOfBirthSerializer(ModelSerializer):
    class Meta:
        model = RecordOfBirth
        fields = "__all__"