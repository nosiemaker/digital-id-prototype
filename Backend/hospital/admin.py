from django.contrib import admin
from .models import BirthRecord,DeathRecord,DeathRecordSubmissions,BirthRecordSubmissions

admin.site.register(BirthRecord)
admin.site.register(DeathRecord)
admin.site.register(DeathRecordSubmissions)
admin.site.register(BirthRecordSubmissions)