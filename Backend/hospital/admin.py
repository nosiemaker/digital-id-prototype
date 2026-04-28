from django.contrib import admin
from .models import BirthCertificate,DeathCertificate,MedicalCertificateCauseOfDeath,DeathRecords,BirthRecords,NoticeOfDeath,NoticeOfBirth,RecordOfBirth,BurialPermit

admin.site.register(BirthCertificate)
admin.site.register(DeathCertificate)
admin.site.register(BirthRecords)
admin.site.register(DeathRecords)
admin.site.register(BurialPermit)
admin.site.register(RecordOfBirth)
admin.site.register(NoticeOfBirth)
admin.site.register(NoticeOfDeath)
admin.site.register(MedicalCertificateCauseOfDeath)
